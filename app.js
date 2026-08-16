/* =========================================================
   ELD JEACHAT
   app.js - Clean Firebase Chat
========================================================= */


/* =========================
   FIREBASE
========================= */

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

auth.setPersistence(
    firebase.auth.Auth.Persistence.LOCAL
).catch(console.error);


/* =========================
   DOM HELPERS
========================= */

const $ = id => document.getElementById(id);


/* =========================
   ELEMENTS
========================= */

const loginScreen = $("login-screen");
const appScreen = $("app-screen");

const usernameModal = $("username-modal");
const settingsModal = $("settings-modal");

const googleLoginBtn = $("google-login-btn");
const loginError = $("login-error");

const usernameInput = $("username-input");
const saveUsernameBtn = $("save-username-btn");
const usernameError = $("username-error");

const loadingMsg = $("loading-msg");
const successMsg = $("success-msg");

const myAvatar = $("my-avatar");
const myUsername = $("my-username");

const addChatBtn = $("add-chat-btn");
const settingsBtn = $("settings-btn");

const searchContainer = $("search-container");
const userSearchInput = $("user-search-input");
const closeSearchBtn = $("close-search-btn");

const chatsList = $("chats-list");

const chatHeader = $("chat-header");
const activeChatAvatar = $("active-chat-avatar");
const activeChatUsername = $("active-chat-username");
const activeUserStatus = $("active-user-status");

const noChatSelected = $("no-chat-selected");
const chatBox = $("chat-box");

const chatInputArea = $("chat-input-area");
const messageInput = $("message-input");
const sendBtn = $("send-btn");

const replyPreview = $("reply-preview");
const replyPreviewUser = $("reply-preview-user");
const replyPreviewText = $("reply-preview-text");
const cancelReplyBtn = $("cancel-reply-btn");

const closeSettingsBtn = $("close-settings-btn");
const logoutBtn = $("logout-btn");

const themeToggleBtn = $("theme-toggle-btn");
const themeToggleText = $("theme-toggle-text");

const hideStatusCheckbox = $("hide-status-checkbox");

const contextMenu = $("message-context-menu");


/* =========================
   APP STATE
========================= */

let currentUser = null;
let customUsername = "";

let activeChatUser = null;
let currentChatId = null;

let unsubscribeMessages = null;
let unsubscribeTargetUser = null;

let replyToMessageData = null;
let editingMessageId = null;

let selectedContextMessage = null;

let searchTimer = null;


/* =========================
   HELPERS
========================= */

function show(element) {
    if (element) {
        element.classList.remove("hidden");
    }
}


function hide(element) {
    if (element) {
        element.classList.add("hidden");
    }
}


function setError(element, message) {

    if (!element) return;

    if (!message) {
        element.textContent = "";
        hide(element);
        return;
    }

    element.textContent = message;
    show(element);
}


function getInitial(name) {

    const value = String(name || "").trim();

    return value.charAt(0).toUpperCase() || "U";
}


function getChatId(uid1, uid2) {

    return [uid1, uid2]
        .sort()
        .join("_");
}


function formatTime(timestamp) {

    if (!timestamp) {
        return "الآن";
    }

    try {

        return timestamp
            .toDate()
            .toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit"
            });

    } catch (error) {

        return "الآن";
    }
}


/* =========================
   THEME
========================= */

function applyTheme() {

    const isDark =
        localStorage.getItem("theme") === "dark";

    document.body.classList.toggle(
        "dark-theme",
        isDark
    );

    if (themeToggleBtn) {

        themeToggleBtn.classList.toggle(
            "active",
            isDark
        );
    }

    if (themeToggleText) {

        themeToggleText.textContent =
            isDark ? "إلغاء" : "تفعيل";
    }
}


if (themeToggleBtn) {

    themeToggleBtn.addEventListener(
        "click",
        () => {

            const isDark =
                document.body.classList.toggle(
                    "dark-theme"
                );

            localStorage.setItem(
                "theme",
                isDark ? "dark" : "light"
            );

            applyTheme();
        }
    );
}


applyTheme();


/* =========================
   GOOGLE LOGIN
========================= */

googleLoginBtn.addEventListener(
    "click",
    async () => {

        setError(loginError, "");

        googleLoginBtn.disabled = true;

        try {

            const provider =
                new firebase.auth.GoogleAuthProvider();

            await auth.signInWithPopup(provider);

        } catch (error) {

            console.error(
                "Google Login Error:",
                error
            );

            setError(
                loginError,
                "تعذر تسجيل الدخول: " +
                error.message
            );

        } finally {

            googleLoginBtn.disabled = false;
        }
    }
);


/* =========================
   AUTH STATE
========================= */

auth.onAuthStateChanged(
    async user => {

        if (!user) {

            cleanupChatListeners();

            currentUser = null;
            customUsername = "";

            show(loginScreen);
            hide(appScreen);
            hide(usernameModal);
            hide(settingsModal);

            return;
        }


        currentUser = user;

        hide(loginScreen);


        try {

            const userDoc =
                await db
                    .collection("users")
                    .doc(user.uid)
                    .get();


            if (
                userDoc.exists &&
                userDoc.data().username
            ) {

                const data = userDoc.data();

                customUsername =
                    data.username;

                hide(usernameModal);

                hideStatusCheckbox.checked =
                    data.hideStatus === true;

                setupApp();

            } else {

                hide(appScreen);

                show(usernameModal);

                usernameInput.value = "";

                setError(
                    usernameError,
                    ""
                );

                setTimeout(
                    () => usernameInput.focus(),
                    100
                );
            }

        } catch (error) {

            console.error(
                "Auth state error:",
                error
            );

            alert(
                "حدث خطأ أثناء تحميل بيانات الحساب."
            );
        }
    }
);


/* =========================
   USERNAME
========================= */

usernameInput.addEventListener(
    "input",
    () => {

        usernameInput.value =
            usernameInput.value
                .replace(/\s/g, "")
                .toLowerCase();

        setError(
            usernameError,
            ""
        );
    }
);


usernameInput.addEventListener(
    "keydown",
    event => {

        if (event.key === "Enter") {
            saveUsernameBtn.click();
        }
    }
);


saveUsernameBtn.addEventListener(
    "click",
    saveUsername
);


async function saveUsername() {

    if (!currentUser) {
        return;
    }


    const username =
        usernameInput.value
            .trim()
            .toLowerCase();


    if (!/^[a-z0-9_.-]{3,30}$/.test(username)) {

        setError(
            usernameError,
            "اسم المستخدم يجب أن يحتوي على 3 إلى 30 حرفاً إنجليزياً أو أرقاماً أو _ أو - أو ."
        );

        return;
    }


    saveUsernameBtn.disabled = true;

    hide(usernameError);
    show(loadingMsg);
    hide(successMsg);


    const usernameRef =
        db.collection("usernames")
            .doc(username);


    const userRef =
        db.collection("users")
            .doc(currentUser.uid);


    try {

        await db.runTransaction(
            async transaction => {

                const usernameDoc =
                    await transaction.get(
                        usernameRef
                    );


                if (usernameDoc.exists) {

                    throw new Error(
                        "USERNAME_TAKEN"
                    );
                }


                transaction.set(
                    usernameRef,
                    {
                        username: username,
                        uid: currentUser.uid,

                        createdAt:
                            firebase.firestore
                                .FieldValue
                                .serverTimestamp()
                    }
                );


                transaction.set(
                    userRef,
                    {
                        username: username,

                        email:
                            currentUser.email || "",

                        uid:
                            currentUser.uid,

                        lastSeen:
                            firebase.firestore
                                .FieldValue
                                .serverTimestamp(),

                        isOnline: true,

                        hideStatus: false
                    },
                    {
                        merge: true
                    }
                );
            }
        );


        customUsername = username;

        hide(loadingMsg);
        show(successMsg);


        setTimeout(
            () => {

                hide(usernameModal);

                setupApp();

            },
            800
        );


    } catch (error) {

        console.error(
            "Username error:",
            error
        );


        hide(loadingMsg);


        if (
            error.message ===
            "USERNAME_TAKEN"
        ) {

            setError(
                usernameError,
                "هذا الاسم مستخدم بالفعل، اختر اسماً آخر."
            );

        } else {

            setError(
                usernameError,
                "تعذر حفظ اسم المستخدم. تأكد من اتصالك بالإنترنت وقواعد Firebase."
            );
        }

    } finally {

        saveUsernameBtn.disabled = false;
    }
}


/* =========================
   SETUP APP
========================= */

function setupApp() {

    hide(loginScreen);
    hide(usernameModal);

    show(appScreen);


    myUsername.textContent =
        customUsername;

    myAvatar.textContent =
        getInitial(customUsername);


    applyTheme();

    updateUserPresence(true);
}


/* =========================
   USER PRESENCE
========================= */

async function updateUserPresence(
    isOnline
) {

    if (!currentUser) {
        return;
    }


    const hiddenStatus =
        hideStatusCheckbox.checked;


    try {

        await db
            .collection("users")
            .doc(currentUser.uid)
            .set(
                {
                    isOnline:
                        hiddenStatus
                            ? false
                            : isOnline,

                    hideStatus:
                        hiddenStatus,

                    lastSeen:
                        firebase.firestore
                            .FieldValue
                            .serverTimestamp()
                },
                {
                    merge: true
                }
            );

    } catch (error) {

        console.error(
            "Presence error:",
            error
        );
    }
}


hideStatusCheckbox.addEventListener(
    "change",
    () => {
        updateUserPresence(true);
    }
);


/* =========================
   SETTINGS
========================= */

settingsBtn.addEventListener(
    "click",
    () => {

        applyTheme();

        show(settingsModal);
    }
);


closeSettingsBtn.addEventListener(
    "click",
    () => {

        hide(settingsModal);

        updateUserPresence(true);
    }
);


settingsModal.addEventListener(
    "click",
    event => {

        if (
            event.target ===
            settingsModal
        ) {

            hide(settingsModal);
        }
    }
);


/* =========================
   LOGOUT
========================= */

logoutBtn.addEventListener(
    "click",
    async () => {

        try {

            await updateUserPresence(
                false
            );

            cleanupChatListeners();

            await auth.signOut();

            hide(settingsModal);

        } catch (error) {

            console.error(
                "Logout error:",
                error
            );

            alert(
                "تعذر تسجيل الخروج."
            );
        }
    }
);


/* =========================
   NEW CHAT SEARCH
========================= */

addChatBtn.addEventListener(
    "click",
    () => {

        const hidden =
            searchContainer
                .classList
                .contains("hidden");


        if (hidden) {

            show(searchContainer);

            userSearchInput.value = "";

            renderSearchEmpty();

            userSearchInput.focus();

        } else {

            hide(searchContainer);

            userSearchInput.value = "";

            renderDefaultList();
        }
    }
);


closeSearchBtn.addEventListener(
    "click",
    () => {

        hide(searchContainer);

        userSearchInput.value = "";

        renderDefaultList();
    }
);


userSearchInput.addEventListener(
    "input",
    () => {

        clearTimeout(searchTimer);


        const query =
            userSearchInput.value
                .trim()
                .toLowerCase();


        if (!query) {

            renderSearchEmpty();

            return;
        }


        if (query.length < 2) {

            chatsList.innerHTML = `
                <div class="empty-list-notice">
                    اكتب حرفين على الأقل للبحث.
                </div>
            `;

            return;
        }


        searchTimer = setTimeout(
            () => searchUsers(query),
            300
        );
    }
);


/* =========================
   SEARCH UI
========================= */

function renderSearchEmpty() {

    chatsList.innerHTML = `
        <div class="empty-list-notice">
            <div class="empty-icon">🔎</div>
            <strong>ابحث عن مستخدم</strong>
            <span>
                اكتب اسم المستخدم للعثور عليه.
            </span>
        </div>
    `;
}


function renderDefaultList() {

    chatsList.innerHTML = `
        <div class="empty-list-notice">
            <div class="empty-icon">💬</div>
            <strong>لا توجد محادثات</strong>
            <span>
                اضغط على ➕ لبدء محادثة جديدة
            </span>
        </div>
    `;
}


/* =========================
   SEARCH USERS
========================= */

async function searchUsers(query) {

    chatsList.innerHTML = `
        <div class="empty-list-notice">
            جاري البحث... ⏳
        </div>
    `;


    try {

        const snapshot =
            await db
                .collection("users")
                .where(
                    "username",
                    ">=",
                    query
                )
                .where(
                    "username",
                    "<=",
                    query + "\uf8ff"
                )
                .limit(20)
                .get();


        chatsList.innerHTML = "";

        let count = 0;


        snapshot.forEach(
            doc => {

                const user =
                    doc.data();


                if (
                    !user.uid ||
                    user.uid ===
                    currentUser.uid
                ) {

                    return;
                }


                count++;

                renderUserItem(user);
            }
        );


        if (count === 0) {

            chatsList.innerHTML = `
                <div class="empty-list-notice">
                    <div class="empty-icon">😕</div>
                    <strong>
                        لم يتم العثور على مستخدم
                    </strong>
                    <span>
                        تأكد من كتابة الاسم بشكل صحيح.
                    </span>
                </div>
            `;
        }

    } catch (error) {

        console.error(
            "Search error:",
            error
        );

        chatsList.innerHTML = `
            <div class="empty-list-notice">
                تعذر تنفيذ البحث.
            </div>
        `;
    }
}


/* =========================
   USER ITEM
========================= */

function renderUserItem(user) {

    const item =
        document.createElement("button");

    item.type = "button";
    item.className = "user-result";


    const avatar =
        document.createElement("div");

    avatar.className = "avatar";

    avatar.textContent =
        getInitial(user.username);


    const info =
        document.createElement("div");

    info.className =
        "user-result-info";


    const name =
        document.createElement("strong");

    name.textContent =
        user.username;


    info.appendChild(name);

    item.appendChild(avatar);
    item.appendChild(info);


    item.addEventListener(
        "click",
        () => openPrivateChat(user)
    );


    chatsList.appendChild(item);
}


/* =========================
   OPEN PRIVATE CHAT
========================= */

function openPrivateChat(
    targetUser
) {

    if (!currentUser) {
        return;
    }


    activeChatUser =
        targetUser;


    currentChatId =
        getChatId(
            currentUser.uid,
            targetUser.uid
        );


    show(chatHeader);
    show(chatBox);
    show(chatInputArea);

    hide(noChatSelected);


    activeChatUsername.textContent =
        targetUser.username;


    activeChatAvatar.textContent =
        getInitial(
            targetUser.username
        );


    appScreen.classList.add(
        "chat-open"
    );


    cleanupChatListenersOnly();


    listenToTargetUser(
        targetUser.uid
    );


    loadPrivateMessages();


    messageInput.focus();
}


/* =========================
   CLEAN ONLY LISTENERS
========================= */

function cleanupChatListenersOnly() {

    if (unsubscribeMessages) {

        unsubscribeMessages();

        unsubscribeMessages = null;
    }


    if (unsubscribeTargetUser) {

        unsubscribeTargetUser();

        unsubscribeTargetUser = null;
    }
}


/* =========================
   USER STATUS
========================= */

function listenToTargetUser(uid) {

    unsubscribeTargetUser =
        db
            .collection("users")
            .doc(uid)
            .onSnapshot(
                doc => {

                    if (!doc.exists) {
                        return;
                    }


                    const data =
                        doc.data();


                    activeUserStatus
                        .classList
                        .remove("online");


                    if (data.hideStatus) {

                        activeUserStatus.textContent =
                            "آخر ظهور مخفي";

                        return;
                    }


                    if (data.isOnline) {

                        activeUserStatus.textContent =
                            "متصل الآن";

                        activeUserStatus
                            .classList
                            .add("online");

                        return;
                    }


                    if (data.lastSeen) {

                        activeUserStatus.textContent =
                            `آخر ظهور ${formatTime(
                                data.lastSeen
                            )}`;

                    } else {

                        activeUserStatus.textContent =
                            "غير متصل";
                    }
                }
            );
}


/* =========================
   MESSAGE REFERENCE
========================= */

function getMessagesRef() {

    return db
        .collection("chats")
        .doc(currentChatId)
        .collection("messages");
}


/* =========================
   LOAD MESSAGES
========================= */

function loadPrivateMessages() {

    if (!currentChatId) {
        return;
    }


    const twelveHoursAgo =
        Date.now() -
        12 * 60 * 60 * 1000;


    unsubscribeMessages =
        getMessagesRef()
            .orderBy(
                "timestamp",
                "asc"
            )
            .onSnapshot(
                snapshot => {

                    chatBox.innerHTML = "";


                    const notice =
                        document.createElement(
                            "div"
                        );

                    notice.className =
                        "chat-notice";

                    notice.textContent =
                        "🔒 يتم الاحتفاظ بالرسائل لمدة 12 ساعة.";

                    chatBox.appendChild(
                        notice
                    );


                    const deletions = [];


                    snapshot.forEach(
                        doc => {

                            const data =
                                doc.data();


                            if (
                                data.timestamp &&
                                data.timestamp.toMillis() <
                                twelveHoursAgo
                            ) {

                                deletions.push(
                                    getMessagesRef()
                                        .doc(doc.id)
                                        .delete()
                                );

                                return;
                            }


                            const deletedFor =
                                Array.isArray(
                                    data.deletedFor
                                )
                                    ? data.deletedFor
                                    : [];


                            if (
                                deletedFor.includes(
                                    currentUser.uid
                                )
                            ) {

                                return;
                            }


                            displayMessage(
                                data,
                                doc.id
                            );
                        }
                    );


                    if (
                        deletions.length
                    ) {

                        Promise.all(
                            deletions
                        ).catch(console.error);
                    }


                    requestAnimationFrame(
                        () => {

                            chatBox.scrollTop =
                                chatBox.scrollHeight;
                        }
                    );
                },

                error => {

                    console.error(
                        "Message listener error:",
                        error
                    );
                }
            );
}


/* =========================
   SEND MESSAGE
========================= */

sendBtn.addEventListener(
    "click",
    sendMessage
);


messageInput.addEventListener(
    "keydown",
    event => {

        if (
            event.key === "Enter" &&
            !event.shiftKey
        ) {

            event.preventDefault();

            sendMessage();
        }
    }
);


async function sendMessage() {

    const text =
        messageInput.value.trim();


    if (
        !text ||
        !currentChatId ||
        !currentUser
    ) {

        return;
    }


    try {

        /* EDIT */

        if (editingMessageId) {

            await getMessagesRef()
                .doc(editingMessageId)
                .update({
                    text: text,
                    isEdited: true
                });


            editingMessageId = null;

            messageInput.value = "";

            cancelReply();

            return;
        }


        /* NEW MESSAGE */

        await getMessagesRef().add({

            text: text,

            senderUid:
                currentUser.uid,

            timestamp:
                firebase.firestore
                    .FieldValue
                    .serverTimestamp(),

            status: "sent",

            deletedFor: [],

            replyTo:
                replyToMessageData || null
        });


        messageInput.value = "";

        cancelReply();


    } catch (error) {

        console.error(
            "Send message error:",
            error
        );

        alert(
            "تعذر إرسال الرسالة."
        );
    }
}


/* =========================
   DISPLAY MESSAGE
========================= */

function displayMessage(
    data,
    messageId
) {

    const isMe =
        data.senderUid ===
        currentUser.uid;


    const wrapper =
        document.createElement("div");

    wrapper.className =
        `message ${
            isMe
                ? "outgoing"
                : "incoming"
        }`;


    const bubble =
        document.createElement("div");

    bubble.className =
        "msg-bubble";


    /* REPLY */

    if (data.replyTo) {

        const quote =
            document.createElement("div");

        quote.className =
            "reply-quote";


        const sender =
            document.createElement("strong");

        sender.textContent =
            data.replyTo.sender || "";


        const replyText =
            document.createElement("span");

        replyText.textContent =
            data.replyTo.text || "";


        quote.appendChild(sender);

        quote.appendChild(replyText);

        bubble.appendChild(quote);
    }


    /* TEXT */

    const text =
        document.createElement("div");

    text.className =
        "message-text";

    text.textContent =
        data.text || "";


    bubble.appendChild(text);


    /* META */

    const meta =
        document.createElement("div");

    meta.className =
        "message-meta";


    const time =
        document.createElement("span");

    time.textContent =
        formatTime(data.timestamp);


    meta.appendChild(time);


    if (data.isEdited) {

        const edited =
            document.createElement("span");

        edited.className =
            "edited-label";

        edited.textContent =
            "(معدلة)";

        meta.appendChild(edited);
    }


    if (isMe) {

        const ticks =
            document.createElement("span");

        ticks.className =
            "message-ticks";

        ticks.textContent =
            "✓✓";

        meta.appendChild(ticks);
    }


    bubble.appendChild(meta);


    /* TOUCH REPLY */

    let startX = 0;


    bubble.addEventListener(
        "touchstart",
        event => {

            startX =
                event.touches[0].clientX;
        },
        {
            passive: true
        }
    );


    bubble.addEventListener(
        "touchend",
        event => {

            const endX =
                event.changedTouches[0].clientX;


            if (
                endX - startX > 50
            ) {

                setReplyMessage(
                    data.text,
                    isMe
                        ? "أنت"
                        : activeChatUser.username
                );
            }
        },
        {
            passive: true
        }
    );


    /* RIGHT CLICK */

    bubble.addEventListener(
        "contextmenu",
        event => {

            event.preventDefault();


            showContextMenu(
                event.clientX,
                event.clientY,
                data,
                messageId,
                isMe
            );
        }
    );


    wrapper.appendChild(bubble);

    chatBox.appendChild(wrapper);
}


/* =========================
   REPLY
========================= */

function setReplyMessage(
    text,
    sender
) {

    replyToMessageData = {
        text: String(text || ""),
        sender: String(sender || "")
    };


    replyPreviewUser.textContent =
        replyToMessageData.sender;


    replyPreviewText.textContent =
        replyToMessageData.text;


    show(replyPreview);

    messageInput.focus();
}


function cancelReply() {

    replyToMessageData = null;

    hide(replyPreview);
}


cancelReplyBtn.addEventListener(
    "click",
    cancelReply
);


/* =========================
   CONTEXT MENU
========================= */

function showContextMenu(
    x,
    y,
    data,
    messageId,
    isMe
) {

    selectedContextMessage = {
        data,
        messageId,
        isMe
    };


    const editButton =
        contextMenu.querySelector(
            '[data-action="edit"]'
        );


    const deleteAllButton =
        contextMenu.querySelector(
            '[data-action="delete-all"]'
        );


    editButton.classList.toggle(
        "hidden",
        !isMe
    );


    deleteAllButton.classList.toggle(
        "hidden",
        !isMe
    );


    show(contextMenu);


    const width =
        contextMenu.offsetWidth;


    const height =
        contextMenu.offsetHeight;


    let left = x;
    let top = y;


    if (
        left + width >
        window.innerWidth
    ) {

        left =
            window.innerWidth -
            width -
            10;
    }


    if (
        top + height >
        window.innerHeight
    ) {

        top =
            window.innerHeight -
            height -
            10;
    }


    contextMenu.style.left =
        `${Math.max(10, left)}px`;


    contextMenu.style.top =
        `${Math.max(10, top)}px`;
}


/* =========================
   CONTEXT ACTIONS
========================= */

contextMenu.addEventListener(
    "click",
    async event => {

        const button =
            event.target.closest(
                "button[data-action]"
            );


        if (!button) {
            return;
        }


        if (!selectedContextMessage) {
            return;
        }


        const action =
            button.dataset.action;


        const {
            data,
            messageId,
            isMe
        } = selectedContextMessage;


        hide(contextMenu);


        if (action === "reply") {

            setReplyMessage(
                data.text,
                isMe
                    ? "أنت"
                    : activeChatUser.username
            );

            return;
        }


        if (action === "delete-me") {

            await deleteForMe(
                messageId
            );

            return;
        }


        if (
            action === "edit" &&
            isMe
        ) {

            editMessage(
                messageId,
                data.text
            );

            return;
        }


        if (
            action === "delete-all" &&
            isMe
        ) {

            await deleteForEveryone(
                messageId
            );
        }
    }
);


/* =========================
   CLOSE CONTEXT MENU
========================= */

document.addEventListener(
    "click",
    event => {

        if (
            !contextMenu.contains(
                event.target
            )
        ) {

            hide(contextMenu);
        }
    }
);


window.addEventListener(
    "resize",
    () => hide(contextMenu)
);


/* =========================
   DELETE FOR ME
========================= */

async function deleteForMe(
    messageId
) {

    try {

        await getMessagesRef()
            .doc(messageId)
            .update({

                deletedFor:
                    firebase.firestore
                        .FieldValue
                        .arrayUnion(
                            currentUser.uid
                        )
            });

    } catch (error) {

        console.error(
            "Delete for me error:",
            error
        );

        alert(
            "تعذر حذف الرسالة."
        );
    }
}


/* =========================
   DELETE EVERYWHERE
========================= */

async function deleteForEveryone(
    messageId
) {

    try {

        await getMessagesRef()
            .doc(messageId)
            .delete();

    } catch (error) {

        console.error(
            "Delete everyone error:",
            error
        );

        alert(
            "تعذر حذف الرسالة."
        );
    }
}


/* =========================
   EDIT MESSAGE
========================= */

function editMessage(
    messageId,
    oldText
) {

    editingMessageId =
        messageId;


    messageInput.value =
        oldText || "";


    messageInput.focus();
}


/* =========================
   CLEANUP
========================= */

function cleanupChatListeners() {

    if (unsubscribeMessages) {

        unsubscribeMessages();

        unsubscribeMessages = null;
    }


    if (unsubscribeTargetUser) {

        unsubscribeTargetUser();

        unsubscribeTargetUser = null;
    }


    currentChatId = null;
    activeChatUser = null;

    editingMessageId = null;

    cancelReply();

    hide(contextMenu);
}


/* =========================
   VISIBILITY
========================= */

document.addEventListener(
    "visibilitychange",
    () => {

        if (!currentUser) {
            return;
        }


        updateUserPresence(
            document.visibilityState === "visible"
        );
    }
);


/* =========================
   START
========================= */

applyTheme();
