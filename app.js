// @ts-nocheck

// 1. إعدادات Firebase الخاصة بك
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

// تفعيل استمرارية الجلسة (لكي لا يخرج المستخدم عند تحديث الصفحة)
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);

// العناصر الأساسية من الواجهة
const loginScreen = document.getElementById('login-screen');
const appScreen = document.getElementById('app-screen');
const usernameModal = document.getElementById('username-modal');
const settingsModal = document.getElementById('settings-modal');

const googleLoginBtn = document.getElementById('google-login-btn');
const saveUsernameBtn = document.getElementById('save-username-btn');
const usernameInput = document.getElementById('username-input');

const myAvatar = document.getElementById('my-avatar');
const myUsername = document.getElementById('my-username');
const userSearchInput = document.getElementById('user-search-input');
const searchContainer = document.getElementById('search-container');
const chatsList = document.getElementById('chats-list');

const chatHeader = document.getElementById('chat-header');
const activeChatAvatar = document.getElementById('active-chat-avatar');
const activeChatUsername = document.getElementById('active-chat-username');
const activeUserStatus = document.getElementById('active-user-status');
const noChatSelected = document.getElementById('no-chat-selected');
const chatBox = document.getElementById('chat-box');
const chatInputArea = document.getElementById('chat-input-area');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');

// أزرار التحكم الجديدة
const addChatBtn = document.getElementById('add-chat-btn');
const settingsBtn = document.getElementById('settings-btn');
const closeSettingsBtn = document.getElementById('close-settings-btn');
const logoutBtn = document.getElementById('logout-btn');
const themeToggleBtn = document.getElementById('theme-toggle-btn');
const hideStatusCheckbox = document.getElementById('hide-status-checkbox');

// المتغيرات العامة
let currentUser = null;
let customUsername = '';
let activeChatUser = null; 
let currentChatId = null;
let unsubscribeMessages = null;
let replyToMessageData = null;
let editingMessageId = null;

// ==========================================
// 1. نظام تسجيل الدخول والمصادقة
// ==========================================

googleLoginBtn.addEventListener('click', () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).catch((error) => alert("خطأ التسجيل: " + error.message));
});

auth.onAuthStateChanged(async (user) => {
    if (user) {
        currentUser = user;
        // جلب بيانات المستخدم من قاعدة البيانات بدلاً من LocalStorage
        const userDoc = await db.collection('users').doc(user.uid).get();
        
        if (userDoc.exists && userDoc.data().username) {
            customUsername = userDoc.data().username;
            if (userDoc.data().hideStatus) hideStatusCheckbox.checked = true;
            setupApp();
        } else {
            loginScreen.classList.add('hidden');
            usernameModal.classList.remove('hidden');
        }
    } else {
        loginScreen.classList.remove('hidden');
        appScreen.classList.add('hidden');
        usernameModal.classList.add('hidden');
    }
});

// حفظ اسم المستخدم مع التأكد من عدم تكراره
saveUsernameBtn.addEventListener('click', async () => {
    const val = usernameInput.value.trim().toLowerCase();
    const loadingMsg = document.getElementById('loading-msg');
    const successMsg = document.getElementById('success-msg');
    
    if (val.length < 3) {
        alert("اسم المستخدم يجب أن يكون 3 أحرف على الأقل!");
        return;
    }

    loadingMsg.classList.remove('hidden');
    saveUsernameBtn.classList.add('hidden');

    // التحقق من قاعدة البيانات
    const snap = await db.collection('users').where('username', '==', val).get();
    
    if (!snap.empty) {
        loadingMsg.classList.add('hidden');
        saveUsernameBtn.classList.remove('hidden');
        alert("هذا الاسم مستخدم بالفعل، الرجاء اختيار اسم آخر.");
        return;
    }

    // إذا كان متاحاً، قم بحفظه
    customUsername = val;
    await db.collection('users').doc(currentUser.uid).set({
        username: customUsername,
        email: currentUser.email,
        uid: currentUser.uid,
        lastSeen: firebase.firestore.FieldValue.serverTimestamp(),
        isOnline: true,
        hideStatus: false
    }, { merge: true });

    loadingMsg.classList.add('hidden');
    successMsg.classList.remove('hidden');
    
    setTimeout(() => {
        usernameModal.classList.add('hidden');
        setupApp();
    }, 1500);
});

// إعداد الواجهة بعد الدخول
function setupApp() {
    loginScreen.classList.add('hidden');
    appScreen.classList.remove('hidden');
    appScreen.classList.add('fade-in');
    
    myUsername.innerText = customUsername;
    myAvatar.innerText = customUsername.charAt(0).toUpperCase();
    
    updateUserPresence(true);
    loadThemePreference();
}

// نظام التواجد (متصل الآن)
function updateUserPresence(isOnline) {
    if (!currentUser) return;
    const isHidden = hideStatusCheckbox.checked;
    
    db.collection('users').doc(currentUser.uid).update({
        isOnline: isHidden ? false : isOnline,
        lastSeen: firebase.firestore.FieldValue.serverTimestamp(),
        hideStatus: isHidden
    });
}
window.addEventListener('beforeunload', () => updateUserPresence(false));

// ==========================================
// 2. واجهة المستخدم والإعدادات
// ==========================================

// إظهار/إخفاء شريط البحث
addChatBtn.addEventListener('click', () => {
    searchContainer.classList.toggle('hidden');
    if (!searchContainer.classList.contains('hidden')) {
        userSearchInput.focus();
    }
});

// فتح الإعدادات
settingsBtn.addEventListener('click', () => {
    settingsModal.classList.remove('hidden');
});
closeSettingsBtn.addEventListener('click', () => {
    settingsModal.classList.add('hidden');
    updateUserPresence(true); // تحديث حالة الظهور إذا تغيرت
});

// تسجيل الخروج
logoutBtn.addEventListener('click', () => {
    updateUserPresence(false);
    auth.signOut();
    settingsModal.classList.add('hidden');
});

// الوضع الداكن
function loadThemePreference() {
    if (localStorage.getItem('theme') === 'dark') {
        document.body.classList.add('dark-theme');
        themeToggleBtn.innerText = 'إلغاء';
        themeToggleBtn.style.background = 'var(--primary-color)';
    }
}
themeToggleBtn.addEventListener('click', () => {
    document.body.classList.toggle('dark-theme');
    if (document.body.classList.contains('dark-theme')) {
        localStorage.setItem('theme', 'dark');
        themeToggleBtn.innerText = 'إلغاء';
        themeToggleBtn.style.background = 'var(--primary-color)';
    } else {
        localStorage.setItem('theme', 'light');
        themeToggleBtn.innerText = 'تفعيل';
        themeToggleBtn.style.background = 'var(--text-muted)';
    }
});

// ==========================================
// 3. البحث وبدء المحادثات
// ==========================================

userSearchInput.addEventListener('input', (e) => {
    const query = e.target.value.trim().toLowerCase();
    if (query.length < 1) {
        chatsList.innerHTML = '<div class="empty-list-notice fade-in">ابحث عن مستخدم للبدء</div>';
        return;
    }

    db.collection('users').where('username', '>=', query).where('username', '<=', query + '\uf8ff').get()
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
                chatsList.innerHTML = '<div class="empty-list-notice fade-in">لم يتم العثور على مستخدم</div>';
            }
        });
});

function renderUserItem(user) {
    const item = document.createElement('div');
    item.style.cssText = "display:flex;align-items:center;padding:15px;cursor:pointer;border-bottom:1px solid var(--border-color); transition: background 0.2s;";
    item.onmouseover = () => item.style.background = 'var(--header-bg)';
    item.onmouseout = () => item.style.background = 'transparent';
    item.innerHTML = `
        <div class="avatar" style="margin-left:15px;">${user.username.charAt(0).toUpperCase()}</div>
        <div>
            <h4 style="margin:0; font-size:16px; color: var(--text-main);">${user.username}</h4>
        </div>
    `;
    item.onclick = () => openPrivateChat(user);
    chatsList.appendChild(item);
}

function openPrivateChat(targetUser) {
    activeChatUser = targetUser;
    currentChatId = [currentUser.uid, targetUser.uid].sort().join('_');

    noChatSelected.classList.add('hidden');
    chatHeader.classList.remove('hidden');
    chatBox.classList.remove('hidden');
    chatInputArea.classList.remove('hidden');

    activeChatUsername.innerText = targetUser.username;
    activeChatAvatar.innerText = targetUser.username.charAt(0).toUpperCase();

    // مراقبة حالة المستخدم الآخر
    db.collection('users').doc(targetUser.uid).onSnapshot(doc => {
        if(doc.exists) {
            const data = doc.data();
            if (data.hideStatus) {
                activeUserStatus.innerText = "آخر ظهور مخفي";
            } else if(data.isOnline) {
                activeUserStatus.innerText = "متصل الآن";
                activeUserStatus.style.color = "var(--primary-color)";
            } else {
                const timeStr = data.lastSeen ? new Date(data.lastSeen.toDate()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '';
                activeUserStatus.innerText = timeStr ? `آخر ظهور ${timeStr}` : 'غير متصل';
                activeUserStatus.style.color = "var(--text-muted)";
            }
        }
    });

    if (unsubscribeMessages) unsubscribeMessages();
    loadPrivateMessages();
}

// ==========================================
// 4. إرسال وتحميل الرسائل
// ==========================================

sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

function sendMessage() {
    const text = messageInput.value.trim();
    if (text === '' || !currentChatId) return;

    if (editingMessageId) {
        db.collection('chats').doc(currentChatId).collection('messages').doc(editingMessageId).update({
            text: text,
            isEdited: true
        });
        editingMessageId = null;
        messageInput.value = '';
        cancelReplyUI();
        return;
    }

    const msgData = {
        text: text,
        senderUid: currentUser.uid,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        status: 'sent',
        deletedFor: [],
        replyTo: replyToMessageData || null
    };

    db.collection('chats').doc(currentChatId).collection('messages').add(msgData);
    messageInput.value = '';
    cancelReplyUI();
    chatBox.scrollTop = chatBox.scrollHeight;
}

function loadPrivateMessages() {
    const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);

    unsubscribeMessages = db.collection('chats').doc(currentChatId).collection('messages')
        .orderBy('timestamp', 'asc')
        .onSnapshot((snapshot) => {
            // تنظيف الحاوية ولكن نحتفظ برسالة الإشعار العلوية
            const notice = chatBox.querySelector('div'); 
            chatBox.innerHTML = '';
            if(notice) chatBox.appendChild(notice);

            snapshot.forEach((doc) => {
                const data = doc.data();
                const msgId = doc.id;

                // التعامل مع الطوابع الزمنية والحذف التلقائي
                if (data.timestamp) {
                    const msgDate = data.timestamp.toDate();
                    if (msgDate < twelveHoursAgo) {
                        db.collection('chats').doc(currentChatId).collection('messages').doc(msgId).delete();
                        return; // لا تقم بعرض الرسالة
                    }
                }

                if (!data.deletedFor || !data.deletedFor.includes(currentUser.uid)) {
                    displayMessage(data, msgId);
                }
            });
            chatBox.scrollTop = chatBox.scrollHeight;
        });
}

function displayMessage(data, msgId) {
    const isMe = data.senderUid === currentUser.uid;
    const msgWrapper = document.createElement('div');
    msgWrapper.className = `message ${isMe ? 'outgoing' : 'incoming'}`;

    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble';

    let replyHTML = '';
    if (data.replyTo) {
        replyHTML = `<div style="background:rgba(0,0,0,0.05); border-right:3px solid var(--primary-color); padding:6px; margin-bottom:8px; border-radius:4px; font-size:12px;">
            <b style="color:var(--primary-color)">${data.replyTo.sender}</b><br>${data.replyTo.text}
        </div>`;
    }

    const timeStr = data.timestamp ? new Date(data.timestamp.toDate()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'الآن';
    
    // تصميم علامات الصح
    let ticks = '';
    if (isMe) {
        ticks = '<span style="font-size:11px; margin-right:5px; color: var(--primary-color);">✓✓</span>';
    }

    bubble.innerHTML = `
        ${replyHTML}
        <div>${data.text} ${data.isEdited ? '<span style="font-size:10px; opacity:0.6;">(معدلة)</span>' : ''}</div>
        <div style="font-size:10px; text-align:left; margin-top:5px; opacity:0.7; display:flex; justify-content:flex-end;">
            ${timeStr} ${ticks}
        </div>
    `;

    // السحب للرد
    let startX = 0;
    bubble.addEventListener('touchstart', (e) => startX = e.touches[0].clientX);
    bubble.addEventListener('touchend', (e) => {
        if (e.changedTouches[0].clientX - startX > 50) {
            setReplyMessage(data.text, isMe ? 'أنت' : activeChatUser.username);
        }
    });

    // قائمة الخيارات عند النقر المطول / اليمين
    bubble.oncontextmenu = (e) => {
        e.preventDefault();
        showContextMenu(e.clientX, e.clientY, data, msgId, isMe);
    };

    msgWrapper.appendChild(bubble);
    chatBox.appendChild(msgWrapper);
}

// ==========================================
// 5. الرد وتعديل وحذف الرسائل
// ==========================================

function setReplyMessage(text, sender) {
    replyToMessageData = { text, sender };
    let replyPreview = document.getElementById('reply-preview');
    if (!replyPreview) {
        replyPreview = document.createElement('div');
        replyPreview.id = 'reply-preview';
        replyPreview.style.cssText = "background:var(--header-bg); padding:10px 15px; display:flex; justify-content:space-between; align-items:center; font-size:13px; border-left:4px solid var(--primary-color);";
        chatInputArea.parentNode.insertBefore(replyPreview, chatInputArea);
    }
    replyPreview.innerHTML = `<div>الرد على <b>${sender}</b>: ${text}</div><button onclick="cancelReplyUI()" style="border:none; background:none; cursor:pointer; color:var(--text-main); font-size:16px;">✕</button>`;
}

function cancelReplyUI() {
    replyToMessageData = null;
    const replyPreview = document.getElementById('reply-preview');
    if (replyPreview) replyPreview.remove();
}

function showContextMenu(x, y, data, msgId, isMe) {
    const oldMenu = document.getElementById('msg-context-menu');
    if (oldMenu) oldMenu.remove();

    const menu = document.createElement('div');
    menu.id = 'msg-context-menu';
    menu.style.cssText = `position:fixed; top:${y}px; left:${x}px; background:var(--bg-card); color:var(--text-main); box-shadow:0 5px 15px rgba(0,0,0,0.2); border-radius:10px; z-index:1000; padding:10px 0; min-width:150px; overflow:hidden; border:1px solid var(--border-color);`;

    let options = `<div style="padding:10px 20px; cursor:pointer; transition:0.2s;" onmouseover="this.style.background='var(--header-bg)'" onmouseout="this.style.background='transparent'" onclick="setReplyMessage('${data.text}', '${isMe ? 'أنت' : activeChatUser.username}'); removeMenu();">↪️ رد</div>`;
    options += `<div style="padding:10px 20px; cursor:pointer; transition:0.2s;" onmouseover="this.style.background='var(--header-bg)'" onmouseout="this.style.background='transparent'" onclick="deleteForMe('${msgId}'); removeMenu();">🗑️ حذف لدي</div>`;

    if (isMe) {
        options += `<div style="padding:10px 20px; cursor:pointer; transition:0.2s;" onmouseover="this.style.background='var(--header-bg)'" onmouseout="this.style.background='transparent'" onclick="editMsg('${msgId}', '${data.text}'); removeMenu();">✏️ تعديل</div>`;
        options += `<div style="padding:10px 20px; cursor:pointer; color:#dc3545; transition:0.2s;" onmouseover="this.style.background='var(--header-bg)'" onmouseout="this.style.background='transparent'" onclick="deleteForEveryone('${msgId}'); removeMenu();">🚫 حذف لدى الجميع</div>`;
    }

    menu.innerHTML = options;
    document.body.appendChild(menu);
    setTimeout(() => document.addEventListener('click', removeMenu, {once: true}), 10);
}

function removeMenu() {
    const menu = document.getElementById('msg-context-menu');
    if (menu) menu.remove();
}

function deleteForMe(msgId) {
    db.collection('chats').doc(currentChatId).collection('messages').doc(msgId).update({
        deletedFor: firebase.firestore.FieldValue.arrayUnion(currentUser.uid)
    });
}
function deleteForEveryone(msgId) {
    db.collection('chats').doc(currentChatId).collection('messages').doc(msgId).delete();
}
function editMsg(msgId, oldText) {
    editingMessageId = msgId;
    messageInput.value = oldText;
    messageInput.focus();
}
