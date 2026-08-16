// @ts-nocheck

// 1. ضع إعدادات مشروعك من Firebase هنا
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// تهيئة Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// العناصر الأساسية
const loginScreen = document.getElementById('login-screen');
const appScreen = document.getElementById('app-screen');
const usernameModal = document.getElementById('username-modal');
const googleLoginBtn = document.getElementById('google-login-btn');
const saveUsernameBtn = document.getElementById('save-username-btn');
const usernameInput = document.getElementById('username-input');

const myAvatar = document.getElementById('my-avatar');
const myUsername = document.getElementById('my-username');
const userSearchInput = document.getElementById('user-search-input');
const chatsList = document.getElementById('chats-list');

const chatHeader = document.getElementById('chat-header');
const activeChatAvatar = document.getElementById('active-chat-avatar');
const activeChatUsername = document.getElementById('active-chat-username');
const noChatSelected = document.getElementById('no-chat-selected');
const chatBox = document.getElementById('chat-box');
const chatInputArea = document.getElementById('chat-input-area');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const logoutBtn = document.getElementById('logout-btn');
const langBtn = document.getElementById('lang-btn');

let currentUser = null;
let customUsername = localStorage.getItem('chat_username') || '';
let activeChatUser = null; 
let currentChatId = null;
let unsubscribeMessages = null;
let currentLang = 'ar';

const translations = {
    ar: { placeholder: "اكتب رسالة...", search: "بحث باسم المستخدم..." },
    en: { placeholder: "Write a message...", search: "Search username..." }
};

// تسجيل الدخول بحساب Google
googleLoginBtn.addEventListener('click', () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).catch((error) => {
        alert("حدث خطأ أثناء تسجيل الدخول: " + error.message);
    });
});

// مراقبة حالة المستخدِم
auth.onAuthStateChanged((user) => {
    if (user) {
        currentUser = user;
        if (!customUsername) {
            usernameModal.classList.remove('hidden');
        } else {
            saveUserData();
            setupApp();
        }
    } else {
        loginScreen.classList.remove('hidden');
        appScreen.classList.add('hidden');
    }
});

// حفظ اسم المستخدم والبيانات في Firestore
saveUsernameBtn.addEventListener('click', () => {
    const val = usernameInput.value.trim().toLowerCase();
    if (val) {
        customUsername = val;
        localStorage.setItem('chat_username', val);
        usernameModal.classList.add('hidden');
        saveUserData();
        setupApp();
    }
});

function saveUserData() {
    db.collection('users').doc(currentUser.uid).set({
        username: customUsername,
        email: currentUser.email,
        uid: currentUser.uid
    }, { merge: true });
}

function setupApp() {
    loginScreen.classList.add('hidden');
    appScreen.classList.remove('hidden');
    myUsername.innerText = customUsername;
    myAvatar.innerText = customUsername.charAt(0).toUpperCase();
}

// البحث عن مستخدم باسمه
userSearchInput.addEventListener('input', (e) => {
    const query = e.target.value.trim().toLowerCase();
    if (query.length < 2) {
        chatsList.innerHTML = '<div class="empty-list-notice">ابحث عن اسم مستخدم لبدء محادثة خاصة</div>';
        return;
    }

    db.collection('users')
        .where('username', '>=', query)
        .where('username', '<=', query + '\uf8ff')
        .get()
        .then((snapshot) => {
            chatsList.innerHTML = '';
            let count = 0;
            snapshot.forEach((doc) => {
                const u = doc.data();
                if (u.uid !== currentUser.uid) {
                    count++;
                    renderUserItem(u);
                }
            });
            if (count === 0) {
                chatsList.innerHTML = '<div class="empty-list-notice">لم يتم العثور على مستخدم بهذه الكلمة</div>';
            }
        });
});

function renderUserItem(user) {
    const item = document.createElement('div');
    item.classList.add('user-item');
    item.innerHTML = `
        <div class="avatar">${user.username.charAt(0).toUpperCase()}</div>
        <div class="user-item-info">
            <h4>${user.username}</h4>
            <span>${user.email}</span>
        </div>
    `;
    item.addEventListener('click', () => openPrivateChat(user));
    chatsList.appendChild(item);
}

// فتح محادثة خاصة (Private Chat)
function openPrivateChat(targetUser) {
    activeChatUser = targetUser;
    
    // معرف الغرفة الفريد المكون من معرّف الشخصين مرتبين
    currentChatId = [currentUser.uid, targetUser.uid].sort().join('_');

    // تحديث الواجهة
    noChatSelected.classList.add('hidden');
    chatHeader.classList.remove('hidden');
    chatBox.classList.remove('hidden');
    chatInputArea.classList.remove('hidden');

    activeChatUsername.innerText = targetUser.username;
    activeChatAvatar.innerText = targetUser.username.charAt(0).toUpperCase();

    // إلغاء الاشتراك في الاستماع للمحادثة السابقة إن وجد
    if (unsubscribeMessages) unsubscribeMessages();

    // جلب الرسائل الخاصة بغرفة المحادثة الحالية
    loadPrivateMessages();
}

// إرسال رسالة خاصة
sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

function sendMessage() {
    const text = messageInput.value.trim();
    if (text === '' || !currentChatId) return;

    db.collection('chats').doc(currentChatId).collection('messages').add({
        text: text,
        senderUid: currentUser.uid,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });

    messageInput.value = '';
}

// جلب رسائل المحادثة الخاصة بالوقت الحقيقي
function loadPrivateMessages() {
    unsubscribeMessages = db.collection('chats').doc(currentChatId).collection('messages')
        .orderBy('timestamp', 'asc')
        .onSnapshot((snapshot) => {
            chatBox.innerHTML = '';
            snapshot.forEach((doc) => {
                const data = doc.data();
                displayMessage(data);
            });
            chatBox.scrollTop = chatBox.scrollHeight;
        });
}

function displayMessage(data) {
    const msgDiv = document.createElement('div');
    const isMe = data.senderUid === currentUser.uid;
    
    msgDiv.classList.add('message', isMe ? 'outgoing' : 'incoming');
    
    const timeStr = data.timestamp ? new Date(data.timestamp.toDate()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'الآن';

    msgDiv.innerHTML = `
        <div class="message-text">${data.text}</div>
        <div class="message-time">${timeStr}</div>
    `;
    
    chatBox.appendChild(msgDiv);
}

// تسجيل الخروج
logoutBtn.addEventListener('click', () => {
    auth.signOut();
    localStorage.removeItem('chat_username');
    location.reload();
});

// تبديل اللغة
langBtn.addEventListener('click', () => {
    currentLang = currentLang === 'ar' ? 'en' : 'ar';
    document.dir = currentLang === 'ar' ? 'rtl' : 'ltr';
    messageInput.placeholder = translations[currentLang].placeholder;
    userSearchInput.placeholder = translations[currentLang].search;
});
