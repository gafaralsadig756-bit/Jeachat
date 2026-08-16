// @ts-nocheck

// 1. إعدادات مشروع Firebase الخاصة بك
const firebaseConfig = {
  apiKey: "AIzaSyAoUNChdv9mM3ijVjEkDZCzarVKIVcSGtM",
  authDomain: "eld-jeachat.firebaseapp.com",
  projectId: "eld-jeachat",
  storageBucket: "eld-jeachat.firebasestorage.app",
  messagingSenderId: "566166664040",
  appId: "1:566166664040:web:c0aa091b1a02f79e721cdd"
};

// تهيئة Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const db = firebase.firestore();

// العناصر الأساسية من الواجهة
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
if (googleLoginBtn) {
    googleLoginBtn.addEventListener('click', () => {
        const provider = new firebase.auth.GoogleAuthProvider();
        auth.signInWithPopup(provider)
            .then((result) => {
                console.log("تم تسجيل الدخول بنجاح:", result.user.displayName);
            })
            .catch((error) => {
                console.error("خطأ التسجيل:", error);
                alert("حدث خطأ أثناء تسجيل الدخول: " + error.message);
            });
    });
}

// مراقبة حالة المستخدِم
auth.onAuthStateChanged((user) => {
    if (user) {
        currentUser = user;
        if (!customUsername) {
            if (usernameModal) usernameModal.classList.remove('hidden');
        } else {
            saveUserData();
            setupApp();
        }
    } else {
        if (loginScreen) loginScreen.classList.remove('hidden');
        if (appScreen) appScreen.classList.add('hidden');
    }
});

// حفظ اسم المستخدم والبيانات في Firestore
if (saveUsernameBtn) {
    saveUsernameBtn.addEventListener('click', () => {
        const val = usernameInput.value.trim().toLowerCase();
        if (val) {
            customUsername = val;
            localStorage.setItem('chat_username', val);
            if (usernameModal) usernameModal.classList.add('hidden');
            saveUserData();
            setupApp();
        }
    });
}

function saveUserData() {
    if (!currentUser) return;
    db.collection('users').doc(currentUser.uid).set({
        username: customUsername,
        email: currentUser.email,
        uid: currentUser.uid
    }, { merge: true });
}

function setupApp() {
    if (loginScreen) loginScreen.classList.add('hidden');
    if (appScreen) appScreen.classList.remove('hidden');
    if (myUsername) myUsername.innerText = customUsername;
    if (myAvatar) myAvatar.innerText = customUsername.charAt(0).toUpperCase();
}

// البحث عن مستخدم باسمه
if (userSearchInput) {
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
            })
            .catch((err) => console.error("خطأ البحث:", err));
    });
}

function renderUserItem(user) {
    const item = document.createElement('div');
    item.classList.add('user-item');
    item.style.cursor = 'pointer';
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
    
    // معرف الغرفة الفريد
    currentChatId = [currentUser.uid, targetUser.uid].sort().join('_');

    // إظهار عناصر المحادثة وإخفاء شاشة "لا توجد محادثة"
    if (noChatSelected) {
        noChatSelected.classList.add('hidden');
        noChatSelected.style.display = 'none';
    }
    
    if (chatHeader) {
        chatHeader.classList.remove('hidden');
        chatHeader.style.display = 'flex';
    }
    if (chatBox) {
        chatBox.classList.remove('hidden');
        chatBox.style.display = 'block';
    }
    if (chatInputArea) {
        chatInputArea.classList.remove('hidden');
        chatInputArea.style.display = 'flex';
    }

    if (activeChatUsername) activeChatUsername.innerText = targetUser.username;
    if (activeChatAvatar) activeChatAvatar.innerText = targetUser.username.charAt(0).toUpperCase();

    // إلغاء الاشتراك في الاستماع للمحادثة السابقة إن وجد
    if (unsubscribeMessages) unsubscribeMessages();

    // جلب الرسائل الخاصة
    loadPrivateMessages();
}

// إرسال رسالة خاصة
if (sendBtn) sendBtn.addEventListener('click', sendMessage);
if (messageInput) {
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });
}

function sendMessage() {
    const text = messageInput.value.trim();
    if (text === '' || !currentChatId) return;

    db.collection('chats').doc(currentChatId).collection('messages').add({
        text: text,
        senderUid: currentUser.uid,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => {
        messageInput.value = '';
    }).catch((err) => console.error("خطأ إرسال الرسالة:", err));
}

// جلب رسائل المحادثة الخاصة بالوقت الحقيقي
function loadPrivateMessages() {
    unsubscribeMessages = db.collection('chats').doc(currentChatId).collection('messages')
        .orderBy('timestamp', 'asc')
        .onSnapshot((snapshot) => {
            if (chatBox) chatBox.innerHTML = '';
            snapshot.forEach((doc) => {
                const data = doc.data();
                displayMessage(data);
            });
            if (chatBox) chatBox.scrollTop = chatBox.scrollHeight;
        }, (error) => {
            console.error("خطأ جلب الرسائل:", error);
        });
}

function displayMessage(data) {
    if (!chatBox) return;
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
if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        auth.signOut();
        localStorage.removeItem('chat_username');
        location.reload();
    });
}

// تبديل اللغة
if (langBtn) {
    langBtn.addEventListener('click', () => {
        currentLang = currentLang === 'ar' ? 'en' : 'ar';
        document.dir = currentLang === 'ar' ? 'rtl' : 'ltr';
        if (messageInput) messageInput.placeholder = translations[currentLang].placeholder;
        if (userSearchInput) userSearchInput.placeholder = translations[currentLang].search;
    });
}
