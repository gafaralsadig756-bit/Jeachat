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
const activeUserStatus = document.getElementById('active-user-status');
const noChatSelected = document.getElementById('no-chat-selected');
const chatBox = document.getElementById('chat-box');
const chatInputArea = document.getElementById('chat-input-area');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const logoutBtn = document.getElementById('logout-btn');

// المتغيرات العامة
let currentUser = null;
let customUsername = localStorage.getItem('chat_username') || '';
let activeChatUser = null; 
let currentChatId = null;
let unsubscribeMessages = null;
let replyToMessageData = null;
let editingMessageId = null;
let readReceiptsEnabled = true;

// 1. تسجيل الدخول والتهيئة
if (googleLoginBtn) {
    googleLoginBtn.addEventListener('click', () => {
        const provider = new firebase.auth.GoogleAuthProvider();
        auth.signInWithPopup(provider).catch((error) => alert("خطأ التسجيل: " + error.message));
    });
}

auth.onAuthStateChanged((user) => {
    if (user) {
        currentUser = user;
        if (!customUsername) {
            if (usernameModal) usernameModal.classList.remove('hidden');
        } else {
            saveUserData();
            setupApp();
            updateUserPresence(true);
        }
    } else {
        if (loginScreen) loginScreen.classList.remove('hidden');
        if (appScreen) appScreen.classList.add('hidden');
    }
});

if (saveUsernameBtn) {
    saveUsernameBtn.addEventListener('click', () => {
        const val = usernameInput.value.trim().toLowerCase();
        if (val) {
            customUsername = val;
            localStorage.setItem('chat_username', val);
            if (usernameModal) usernameModal.classList.add('hidden');
            saveUserData();
            setupApp();
            updateUserPresence(true);
        }
    });
}

function saveUserData() {
    if (!currentUser) return;
    db.collection('users').doc(currentUser.uid).set({
        username: customUsername,
        email: currentUser.email,
        uid: currentUser.uid,
        lastSeen: firebase.firestore.FieldValue.serverTimestamp(),
        isOnline: true
    }, { merge: true });
}

function updateUserPresence(isOnline) {
    if (!currentUser) return;
    db.collection('users').doc(currentUser.uid).update({
        isOnline: isOnline,
        lastSeen: firebase.firestore.FieldValue.serverTimestamp()
    });
}

window.addEventListener('beforeunload', () => updateUserPresence(false));

function setupApp() {
    if (loginScreen) loginScreen.classList.add('hidden');
    if (appScreen) appScreen.classList.remove('hidden');
    if (myUsername) myUsername.innerText = customUsername;
    if (myAvatar) myAvatar.innerText = customUsername.charAt(0).toUpperCase();
    buildDynamicUI();
}

// 2. البحث عن المستخدمين والدخول للدردشة
if (userSearchInput) {
    userSearchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim().toLowerCase();
        if (query.length < 1) {
            chatsList.innerHTML = '<div class="empty-list-notice" style="text-align:center;padding:15px;color:#888;">ابحث عن مستخدم للبدء</div>';
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
                    chatsList.innerHTML = '<div class="empty-list-notice" style="text-align:center;padding:15px;color:#888;">لم يتم العثور على مستخدم</div>';
                }
            });
    });
}

function renderUserItem(user) {
    const item = document.createElement('div');
    item.className = 'user-item';
    item.style.cssText = "display:flex;align-items:center;padding:10px;cursor:pointer;border-bottom:1px solid #eee;";
    item.innerHTML = `
        <div class="avatar" style="width:40px;height:40px;border-radius:50%;background:#075e54;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:bold;margin-left:10px;">${user.username.charAt(0).toUpperCase()}</div>
        <div class="user-item-info">
            <h4 style="margin:0;font-size:16px;">${user.username}</h4>
            <span style="font-size:12px;color:#666;">${user.email}</span>
        </div>
    `;
    item.onclick = () => openPrivateChat(user);
    chatsList.appendChild(item);
}

// فتح محادثة خاصة
function openPrivateChat(targetUser) {
    activeChatUser = targetUser;
    currentChatId = [currentUser.uid, targetUser.uid].sort().join('_');

    if (noChatSelected) noChatSelected.style.display = 'none';
    if (chatHeader) chatHeader.style.display = 'flex';
    if (chatBox) chatBox.style.display = 'block';
    if (chatInputArea) chatInputArea.style.display = 'flex';

    if (activeChatUsername) activeChatUsername.innerText = targetUser.username;
    if (activeChatAvatar) activeChatAvatar.innerText = targetUser.username.charAt(0).toUpperCase();

    // متابعة متصل الآن وآخر ظهور للمستلم
    db.collection('users').doc(targetUser.uid).onSnapshot(doc => {
        if(doc.exists && activeUserStatus) {
            const data = doc.data();
            if(data.isOnline) {
                activeUserStatus.innerText = "متصل الآن";
                activeUserStatus.style.color = "#25d366";
            } else {
                const timeStr = data.lastSeen ? new Date(data.lastSeen.toDate()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'غير معروف';
                activeUserStatus.innerText = `آخر ظهور ${timeStr}`;
                activeUserStatus.style.color = "#888";
            }
        }
    });

    if (unsubscribeMessages) unsubscribeMessages();
    loadPrivateMessages();
}

// 3. إرسال وتعديل الرسائل ومؤشرات القراءة
if (sendBtn) sendBtn.addEventListener('click', sendMessage);
if (messageInput) {
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });
}

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
        status: 'sent', // sent, delivered, read
        deletedFor: [],
        replyTo: replyToMessageData ? replyToMessageData : null
    };

    db.collection('chats').doc(currentChatId).collection('messages').add(msgData);
    messageInput.value = '';
    cancelReplyUI();
}

// تحميل الرسائل والتنظيف التلقائي (كل 12 ساعة)
function loadPrivateMessages() {
    const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);

    unsubscribeMessages = db.collection('chats').doc(currentChatId).collection('messages')
        .orderBy('timestamp', 'asc')
        .onSnapshot((snapshot) => {
            if (!chatBox) return;
            chatBox.innerHTML = '';
            let hasAutoDeletedMessages = false;

            snapshot.forEach((doc) => {
                const data = doc.data();
                const msgId = doc.id;

                // التحقق من الحذف التلقائي للرسائل الأقدم من 12 ساعة
                if (data.timestamp && data.timestamp.toDate() < twelveHoursAgo) {
                    hasAutoDeletedMessages = true;
                    db.collection('chats').doc(currentChatId).collection('messages').doc(msgId).delete();
                    return;
                }

                // تحديث مؤشرات القراءة تلقائياً عند القراءة
                if (data.senderUid !== currentUser.uid && data.status !== 'read' && readReceiptsEnabled) {
                    db.collection('chats').doc(currentChatId).collection('messages').doc(msgId).update({
                        status: 'read'
                    });
                }

                if (!data.deletedFor || !data.deletedFor.includes(currentUser.uid)) {
                    displayMessage(data, msgId);
                }
            });

            if (hasAutoDeletedMessages) {
                renderSystemNotice("تم حذف الرسائل القديمة تلقائياً (تتجاوز 12 ساعة)");
            }

            chatBox.scrollTop = chatBox.scrollHeight;
        });
}

// عرض الرسائل والمظهر والخيارات
function displayMessage(data, msgId) {
    const msgDiv = document.createElement('div');
    const isMe = data.senderUid === currentUser.uid;

    msgDiv.style.cssText = `
        display: flex;
        flex-direction: column;
        margin: 8px 10px;
        max-width: 70%;
        align-self: ${isMe ? 'flex-end' : 'flex-start'};
        margin-left: ${isMe ? 'auto' : '0'};
        margin-right: ${isMe ? '0' : 'auto'};
    `;

    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble';
    bubble.style.cssText = `
        background: ${isMe ? (localStorage.getItem('bubble_out') || '#dcf8c6') : (localStorage.getItem('bubble_in') || '#ffffff')};
        padding: 8px 12px;
        border-radius: 8px;
        position: relative;
        box-shadow: 0 1px 2px rgba(0,0,0,0.15);
        color: #000;
    `;

    let replyHTML = '';
    if (data.replyTo) {
        replyHTML = `<div style="background:rgba(0,0,0,0.05);border-right:3px solid #075e54;padding:4px;margin-bottom:5px;font-size:12px;border-radius:3px;">
            <b>${data.replyTo.sender}:</b> ${data.replyTo.text}
        </div>`;
    }

    let statusTicks = '';
    if (isMe) {
        if (data.status === 'read') statusTicks = '<span style="color:#4fc3f7;">✓✓</span>';
        else if (data.status === 'delivered') statusTicks = '<span style="color:#888;">✓✓</span>';
        else statusTicks = '<span style="color:#888;">✓</span>';
    }

    const timeStr = data.timestamp ? new Date(data.timestamp.toDate()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'الآن';

    bubble.innerHTML = `
        ${replyHTML}
        <div style="font-size:14px;word-break:break-word;">${data.text} ${data.isEdited ? '<small style="color:#888;">(معدلة)</small>' : ''}</div>
        <div style="font-size:10px;color:#888;text-align:left;margin-top:4px;display:flex;justify-content:flex-end;gap:3px;">
            <span>${timeStr}</span>
            ${statusTicks}
        </div>
    `;

    // السحب للرد (Swipe to Reply)
    let startX = 0;
    bubble.addEventListener('touchstart', (e) => startX = e.touches[0].clientX);
    bubble.addEventListener('touchend', (e) => {
        let diffX = e.changedTouches[0].clientX - startX;
        if (diffX > 50) { // سحب لليمن
            setReplyMessage(data.text, isMe ? 'أنت' : activeChatUser.username);
        }
    });

    // قائمة الخيارات عند النقر المطول/اليمين
    bubble.oncontextmenu = (e) => {
        e.preventDefault();
        showContextMenu(e.clientX, e.clientY, data, msgId, isMe);
    };

    msgDiv.appendChild(bubble);
    chatBox.appendChild(msgDiv);
}

// رسالة النظام الظليلة في المنتصف
function renderSystemNotice(text) {
    const notice = document.createElement('div');
    notice.style.cssText = "text-align:center;margin:10px auto;background:rgba(0,0,0,0.2);color:#fff;padding:5px 12px;border-radius:15px;font-size:12px;width:fit-content;";
    notice.innerText = text;
    chatBox.appendChild(notice);
}

// 4. خيارات الرد والتعديل والحذف
function setReplyMessage(text, sender) {
    replyToMessageData = { text, sender };
    let replyPreview = document.getElementById('reply-preview');
    if (!replyPreview) {
        replyPreview = document.createElement('div');
        replyPreview.id = 'reply-preview';
        replyPreview.style.cssText = "background:#eee;padding:5px 10px;display:flex;justify-content:space-between;align-items:center;font-size:12px;";
        chatInputArea.parentNode.insertBefore(replyPreview, chatInputArea);
    }
    replyPreview.innerHTML = `<span>الرد على <b>${sender}</b>: ${text}</span><button onclick="cancelReplyUI()" style="border:none;background:none;cursor:pointer;">✕</button>`;
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
    menu.style.cssText = `position:fixed;top:${y}px;left:${x}px;background:#fff;box-shadow:0 2px 10px rgba(0,0,0,0.2);border-radius:5px;z-index:1000;padding:5px 0;`;

    let options = `<div style="padding:8px 15px;cursor:pointer;" onclick="setReplyMessage('${data.text}', '${isMe ? 'أنت' : activeChatUser.username}');removeMenu();">رد</div>`;
    options += `<div style="padding:8px 15px;cursor:pointer;" onclick="deleteForMe('${msgId}');removeMenu();">حذف لدي</div>`;

    if (isMe) {
        options += `<div style="padding:8px 15px;cursor:pointer;" onclick="editMsg('${msgId}', '${data.text}');removeMenu();">تعديل</div>`;
        options += `<div style="padding:8px 15px;cursor:pointer;color:red;" onclick="deleteForEveryone('${msgId}');removeMenu();">حذف لدى الجميع</div>`;
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

// 5. بناء عناصر الواجهة الديناميكية (زر الإعدادات و الثلاث نقاط)
function buildDynamicUI() {
    const headerContainer = document.querySelector('.sidebar-header') || appScreen;
    if (document.getElementById('custom-header-actions')) return;

    const actionsDiv = document.createElement('div');
    actionsDiv.id = 'custom-header-actions';
    actionsDiv.style.cssText = "display:flex;gap:10px;align-items:center;padding:10px;background:#075e54;color:#fff;";

    actionsDiv.innerHTML = `
        <button id="settings-btn" style="background:none;border:none;color:#fff;font-size:18px;cursor:pointer;">⚙️ الإعدادات</button>
        <button id="more-options-btn" style="background:none;border:none;color:#fff;font-size:18px;cursor:pointer;">⋮</button>
    `;

    headerContainer.prepend(actionsDiv);

    document.getElementById('settings-btn').onclick = openSettingsModal;
    document.getElementById('more-options-btn').onclick = openMoreMenu;
}

// نافذة الإعدادات
function openSettingsModal() {
    const modal = document.createElement('div');
    modal.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:2000;";
    modal.innerHTML = `
        <div style="background:#fff;padding:20px;border-radius:10px;width:80%;max-width:400px;">
            <h3>⚙️ الإعدادات</h3>
            <p><b>اسم المستخدم:</b> ${customUsername}</p>
            <hr>
            <label><input type="checkbox" id="dark-mode-toggle" ${document.body.classList.contains('dark-theme') ? 'checked' : ''}> الوضع الداكن</label><br><br>
            <label>فقاعة الرسائل الصادرة: <input type="color" id="out-bubble-color" value="${localStorage.getItem('bubble_out') || '#dcf8c6'}"></label><br><br>
            <label>فقاعة الرسائل الواردة: <input type="color" id="in-bubble-color" value="${localStorage.getItem('bubble_in') || '#ffffff'}"></label><br><br>
            <button id="close-settings" style="padding:8px 15px;background:#075e54;color:#fff;border:none;border-radius:5px;cursor:pointer;">حفظ وإغلاق</button>
        </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('close-settings').onclick = () => {
        const isDark = document.getElementById('dark-mode-toggle').checked;
        if(isDark) {
            document.body.classList.add('dark-theme');
            document.body.style.background = "#121212";
        } else {
            document.body.classList.remove('dark-theme');
            document.body.style.background = "#fff";
        }
        localStorage.setItem('bubble_out', document.getElementById('out-bubble-color').value);
        localStorage.setItem('bubble_in', document.getElementById('in-bubble-color').value);
        modal.remove();
        if(currentChatId) loadPrivateMessages();
    };
}

// قائمة الثلاث نقاط
function openMoreMenu(e) {
    removeMenu();
    const menu = document.createElement('div');
    menu.id = 'msg-context-menu';
    menu.style.cssText = `position:fixed;top:${e.clientY + 10}px;left:${e.clientX - 100}px;background:#fff;box-shadow:0 2px 10px rgba(0,0,0,0.2);border-radius:5px;z-index:1000;padding:5px 0;`;

    menu.innerHTML = `
        <div style="padding:10px 15px;cursor:pointer;" onclick="if(userSearchInput) userSearchInput.focus();removeMenu();">بدء محادثة جديدة</div>
        <div style="padding:10px 15px;cursor:pointer;" onclick="toggleReadReceipts();removeMenu();">
            مؤشرات القراءة: <b>${readReceiptsEnabled ? 'مفعلة' : 'معطلة'}</b>
        </div>
    `;
    document.body.appendChild(menu);
    setTimeout(() => document.addEventListener('click', removeMenu, {once: true}), 10);
}

function toggleReadReceipts() {
    readReceiptsEnabled = !readReceiptsEnabled;
    alert(`تم ${readReceiptsEnabled ? 'تفعيل' : 'تعطيل'} مؤشرات قراءة الرسائل`);
}
