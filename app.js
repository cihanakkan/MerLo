import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
    getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
    onAuthStateChanged, updateProfile, signOut
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
    getDatabase, ref, push, set, get, update, remove,
    onValue, onChildAdded, off, query, orderByChild, equalTo,
    limitToLast, onDisconnect, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// ================= FIREBASE KURULUMU =================
// Bu bilgileri kendi Firebase projenden aldın, burada kalabilir (client-side public anahtarlardır).
const firebaseConfig = {
    apiKey: "AIzaSyCvE0TxxH9Gey9PZtGA_-VCpHpsUM7hr8E",
    authDomain: "merlo-494a7.firebaseapp.com",
    databaseURL: "https://merlo-494a7-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "merlo-494a7",
    storageBucket: "merlo-494a7.firebasestorage.app",
    messagingSenderId: "1001648836568",
    appId: "1:1001648836568:web:305b5d0cd9e82d18c5acad",
    measurementId: "G-FPVQL0W4H0"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// ================= DURUM (STATE) =================
let currentUserProfile = null;   // { username }
let mySeverIds = {};             // { serverId: true }
let currentServerId = null;
let currentServerData = null;    // { name, ownerId, inviteCode, channels: {...} }
let currentChannelId = null;
let currentChannelType = 'text';
let messagesListenerRef = null;
let serversListenerRef = null;
let channelsListenerRef = null;
let membersListenerRef = null;
let typingListenerRef = null;
let typingTimeoutHandle = null;
let membersCache = [];           // [{ uid, username }] - mention otomatik tamamlama için
let mentionQueryStart = -1;      // input içinde @'nin başladığı index, -1 = aktif değil

// ================= DOM ELEMANLARI =================
const loginPage = document.getElementById('loginPage');
const registerPage = document.getElementById('registerPage');
const mainAppPage = document.getElementById('mainAppPage');
const chatArea = document.getElementById('chatArea');
const serverIconList = document.getElementById('serverIconList');
const textChannelsContainer = document.getElementById('textChannelsContainer');
const voiceChannelsContainer = document.getElementById('voiceChannelsContainer');
const memberList = document.getElementById('memberList');
const serverNameEl = document.getElementById('serverName');
const activeChannelTitle = document.getElementById('activeChannelTitle');
const messageForm = document.getElementById('messageForm');
const messageInput = document.getElementById('messageInput');

// ================= YÖNLENDİRİCİ (ROUTER) =================
function handleRouting() {
    const path = window.location.hash || '#/';
    [loginPage, registerPage, mainAppPage].forEach(el => {
        el.classList.add('hidden');
        el.style.display = 'none';
    });

    if (path === '#/register') {
        registerPage.classList.remove('hidden');
        registerPage.style.display = 'flex';
    } else if (path === '#/login') {
        loginPage.classList.remove('hidden');
        loginPage.style.display = 'flex';
    } else {
        if (auth.currentUser) {
            mainAppPage.classList.remove('hidden');
            mainAppPage.style.display = 'flex';
        } else {
            window.location.hash = '#/login';
        }
    }
}
window.addEventListener('hashchange', handleRouting);
window.addEventListener('load', handleRouting);

document.getElementById('btnGoToRegister').addEventListener('click', () => { window.location.hash = '#/register'; });
document.getElementById('btnGoToLogin').addEventListener('click', () => { window.location.hash = '#/login'; });

// ================= AUTH =================
document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPassword').value;
    const username = document.getElementById('regUsername').value.trim();
    try {
        const res = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(res.user, { displayName: username });
        // Kullanıcı profilini veritabanına da yaz (üye listesinde göstermek için)
        await set(ref(db, `users/${res.user.uid}`), {
            username: username,
            createdAt: serverTimestamp()
        });
        window.location.hash = '#/';
    } catch (err) {
        alert("Kayıt Hatası: " + err.message);
    }
});

document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    try {
        await signInWithEmailAndPassword(auth, email, password);
        window.location.hash = '#/';
    } catch (err) {
        alert("Giriş Hatalı veya Kullanıcı Bulunamadı!");
    }
});

document.getElementById('logoutBtn').addEventListener('click', () => {
    signOut(auth).then(() => { window.location.hash = '#/login'; });
});

onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('currentUserTitle').innerText = user.displayName || "Kullanıcı";
        document.getElementById('userAvatar').innerText = (user.displayName || "K").charAt(0).toUpperCase();
        if (window.location.hash === '#/login' || window.location.hash === '#/register') {
            window.location.hash = '#/';
        }
        setupPresence(user.uid);
        listenMyServers(user.uid);
    } else {
        cleanupListeners();
        if (window.location.hash !== '#/register') {
            window.location.hash = '#/login';
        }
    }
    handleRouting();
});

function cleanupListeners() {
    if (serversListenerRef) { off(serversListenerRef); serversListenerRef = null; }
    if (channelsListenerRef) { off(channelsListenerRef); channelsListenerRef = null; }
    if (membersListenerRef) { off(membersListenerRef); membersListenerRef = null; }
    if (messagesListenerRef) { off(messagesListenerRef); messagesListenerRef = null; }
    if (typingListenerRef) { off(typingListenerRef); typingListenerRef = null; }
    if (currentServerId && currentChannelId && auth.currentUser) {
        remove(typingRef()).catch(() => {});
    }
    currentServerId = null;
    currentChannelId = null;
}

// Basit online/offline takibi (Firebase'in klasik presence deseni)
function setupPresence(uid) {
    const connectedRef = ref(db, '.info/connected');
    onValue(connectedRef, (snap) => {
        if (snap.val() === true) {
            const userStatusRef = ref(db, `status/${uid}`);
            onDisconnect(userStatusRef).set({ state: 'offline', lastSeen: serverTimestamp() });
            set(userStatusRef, { state: 'online', lastSeen: serverTimestamp() });
        }
    });
}

// ================= SUNUCULAR =================
function listenMyServers(uid) {
    const userServersRef = ref(db, `users/${uid}/servers`);
    serversListenerRef = userServersRef;
    onValue(userServersRef, async (snap) => {
        mySeverIds = snap.val() || {};
        await renderServerIcons();

        // Hiç sunucu seçili değilse, ilkini otomatik seç
        const ids = Object.keys(mySeverIds);
        if (ids.length > 0 && !currentServerId) {
            selectServer(ids[0]);
        } else if (ids.length === 0) {
            serverNameEl.innerText = 'Bir sunucu seç';
            textChannelsContainer.innerHTML = '';
            voiceChannelsContainer.innerHTML = '';
            chatArea.innerHTML = '<p class="text-gray-500 text-sm">Henüz bir sunucun yok. Sol alttaki + butonuyla bir sunucu oluştur ya da davet koduyla katıl.</p>';
        }
    });
}

async function renderServerIcons() {
    serverIconList.innerHTML = '';
    const ids = Object.keys(mySeverIds);
    for (const serverId of ids) {
        const snap = await get(ref(db, `servers/${serverId}/name`));
        const name = snap.val() || '?';
        const initials = name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();

        const btn = document.createElement('div');
        const isActive = serverId === currentServerId;
        btn.className = `w-12 h-12 shrink-0 ${isActive ? 'bg-[#5865f2] rounded-2xl' : 'bg-[#2b2d31] rounded-3xl hover:rounded-2xl hover:bg-[#5865f2]'} flex items-center justify-center text-white font-black text-sm transition-all cursor-pointer`;
        btn.innerText = initials;
        btn.title = name;
        btn.onclick = () => selectServer(serverId);
        serverIconList.appendChild(btn);
    }
}

function selectServer(serverId) {
    currentServerId = serverId;
    currentChannelId = null;
    if (channelsListenerRef) off(channelsListenerRef);
    if (membersListenerRef) off(membersListenerRef);

    renderServerIcons();
    listenServerData(serverId);
    listenMembers(serverId);
}

function listenServerData(serverId) {
    const serverRef = ref(db, `servers/${serverId}`);
    channelsListenerRef = serverRef;
    onValue(serverRef, (snap) => {
        currentServerData = snap.val();
        if (!currentServerData) return;
        serverNameEl.innerText = currentServerData.name;
        renderChannels(currentServerData.channels || {});
    });
}

async function createServer(name) {
    const uid = auth.currentUser.uid;
    const newServerRef = push(ref(db, 'servers'));
    const serverId = newServerRef.key;
    const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    await set(newServerRef, {
        name: name,
        ownerId: uid,
        inviteCode: inviteCode,
        createdAt: serverTimestamp(),
        channels: {
            genel: { name: 'genel', type: 'text', position: 0 },
            'sesli-oda': { name: 'Genel Sesli Oda', type: 'voice', position: 1 }
        },
        members: {
            [uid]: { role: 'owner', joinedAt: serverTimestamp() }
        }
    });

    await set(ref(db, `users/${uid}/servers/${serverId}`), true);
    selectServer(serverId);
}

async function joinServerByCode(code) {
    const serversRef = ref(db, 'servers');
    const q = query(serversRef, orderByChild('inviteCode'), equalTo(code.trim().toUpperCase()));
    const snap = await get(q);

    if (!snap.exists()) {
        throw new Error('Geçersiz davet kodu.');
    }

    const serverId = Object.keys(snap.val())[0];
    const uid = auth.currentUser.uid;

    await set(ref(db, `servers/${serverId}/members/${uid}`), {
        role: 'member', joinedAt: serverTimestamp()
    });
    await set(ref(db, `users/${uid}/servers/${serverId}`), true);
    selectServer(serverId);
}

// ================= KANALLAR =================
function renderChannels(channels) {
    textChannelsContainer.innerHTML = '';
    voiceChannelsContainer.innerHTML = '';

    const entries = Object.entries(channels).sort((a, b) => (a[1].position || 0) - (b[1].position || 0));

    entries.forEach(([channelId, ch]) => {
        const isActive = channelId === currentChannelId;
        const div = document.createElement('div');
        div.className = `flex items-center px-2 py-1.5 rounded cursor-pointer ${isActive ? 'bg-[#404249] text-white' : 'text-gray-400 hover:bg-[#35373c]'}`;

        if (ch.type === 'voice') {
            div.innerHTML = `<i class="fa-solid fa-volume-high text-gray-500 mr-2 text-sm"></i><span class="text-sm font-medium">${escapeHTML(ch.name)}</span>`;
            div.onclick = () => joinVoiceChannelPlaceholder(ch.name);
            voiceChannelsContainer.appendChild(div);
        } else {
            div.innerHTML = `<span class="text-gray-500 mr-2">#</span><span class="text-sm font-medium">${escapeHTML(ch.name)}</span>`;
            div.onclick = () => selectTextChannel(channelId, ch.name);
            textChannelsContainer.appendChild(div);
        }
    });

    // İlk metin kanalını otomatik seç
    if (!currentChannelId) {
        const firstText = entries.find(([, ch]) => ch.type === 'text');
        if (firstText) selectTextChannel(firstText[0], firstText[1].name);
    }
}

function selectTextChannel(channelId, name) {
    currentChannelId = channelId;
    currentChannelType = 'text';
    activeChannelTitle.innerText = name;
    renderChannels(currentServerData.channels || {});
    listenMessages();
    listenTyping();
}

function joinVoiceChannelPlaceholder(name) {
    // Gerçek sesli oda (WebRTC) sonraki fazda eklenecek.
    // Şimdilik kullanıcıya net bir bilgi veriyoruz, sessizce hiçbir şey yapmıyoruz.
    alert(`"${name}" sesli odasına katılma özelliği yakında geliyor 🎙️ (WebRTC entegrasyonu bir sonraki fazda eklenecek)`);
}

async function createChannel(name, type) {
    const slug = name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-ığüşöçİĞÜŞÖÇ]/g, '');
    if (!slug) return;
    const channelId = `${slug}-${Date.now().toString(36)}`;
    const existingChannels = currentServerData.channels || {};
    const position = Object.keys(existingChannels).length;

    await set(ref(db, `servers/${currentServerId}/channels/${channelId}`), {
        name: type === 'voice' ? name.trim() : slug,
        type: type,
        position: position
    });
}

// ================= ÜYELER =================
function listenMembers(serverId) {
    const membersRef = ref(db, `servers/${serverId}/members`);
    membersListenerRef = membersRef;
    onValue(membersRef, async (snap) => {
        const members = snap.val() || {};
        memberList.innerHTML = '';
        membersCache = [];

        for (const uid of Object.keys(members)) {
            const [profileSnap, statusSnap] = await Promise.all([
                get(ref(db, `users/${uid}`)),
                get(ref(db, `status/${uid}`))
            ]);
            const profile = profileSnap.val() || { username: 'Bilinmeyen' };
            const status = statusSnap.val() || { state: 'offline' };
            const isOnline = status.state === 'online';

            membersCache.push({ uid, username: profile.username || 'Bilinmeyen' });

            const div = document.createElement('div');
            div.className = 'flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[#35373c] cursor-default';
            div.innerHTML = `
                <div class="relative shrink-0">
                    <div class="w-7 h-7 bg-indigo-600 rounded-full flex items-center justify-center font-bold text-xs text-white">${escapeHTML((profile.username || '?').charAt(0).toUpperCase())}</div>
                    <span class="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#2b2d31] ${isOnline ? 'bg-emerald-500' : 'bg-gray-500'}"></span>
                </div>
                <span class="text-sm ${isOnline ? 'text-gray-200' : 'text-gray-500'} truncate">${escapeHTML(profile.username || 'Bilinmeyen')}</span>
            `;
            memberList.appendChild(div);
        }
    });
}

// ================= MESAJLAR =================
function listenMessages() {
    if (messagesListenerRef) off(messagesListenerRef);
    chatArea.innerHTML = '';

    if (!currentServerId || !currentChannelId) return;

    const msgsRef = query(
        ref(db, `servers/${currentServerId}/channels/${currentChannelId}/messages`),
        limitToLast(50)
    );
    messagesListenerRef = msgsRef;

    onChildAdded(msgsRef, (snapshot) => {
        const msg = snapshot.val();
        if (!msg) return;
        const div = document.createElement('div');
        div.className = "flex flex-col bg-[#383a40] p-2.5 rounded shadow-sm max-w-xl self-start w-fit mt-1 animate-fade-in";
        div.innerHTML = `
            <div class="flex items-center gap-2 mb-1">
                <span class="font-bold text-indigo-400 text-xs">${escapeHTML(msg.user)}</span>
                <span class="text-[10px] text-gray-500">${escapeHTML(msg.time)}</span>
            </div>
            <p class="text-gray-200 text-sm">${highlightMentions(msg.text)}</p>
        `;
        chatArea.appendChild(div);
        chatArea.scrollTop = chatArea.scrollHeight;
    });
}

messageForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = messageInput.value.trim();
    if (!text || !auth.currentUser || !currentServerId || !currentChannelId) return;

    const time = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

    push(ref(db, `servers/${currentServerId}/channels/${currentChannelId}/messages`), {
        user: auth.currentUser.displayName || "Anonim",
        userId: auth.currentUser.uid,
        text: text,
        time: time,
        createdAt: serverTimestamp()
    });

    messageInput.value = '';
    hideMentionDropdown();
    setTypingState(false);
});

// ================= YAZIYOR... GÖSTERGESİ =================
const typingIndicatorEl = document.getElementById('typingIndicator');

function typingRef() {
    return ref(db, `servers/${currentServerId}/channels/${currentChannelId}/typing/${auth.currentUser.uid}`);
}

function setTypingState(isTyping) {
    if (!currentServerId || !currentChannelId || !auth.currentUser) return;
    if (isTyping) {
        set(typingRef(), { username: auth.currentUser.displayName || 'Anonim', ts: Date.now() });
    } else {
        remove(typingRef());
    }
}

// Kullanıcı yazarken tetiklenir, 2.5sn boyunca durursa otomatik "yazıyor" durumunu kapatır
function handleTypingActivity() {
    setTypingState(true);
    clearTimeout(typingTimeoutHandle);
    typingTimeoutHandle = setTimeout(() => setTypingState(false), 2500);
}

function listenTyping() {
    if (typingListenerRef) off(typingListenerRef);
    typingIndicatorEl.innerText = '';
    if (!currentServerId || !currentChannelId) return;

    const tRef = ref(db, `servers/${currentServerId}/channels/${currentChannelId}/typing`);
    typingListenerRef = tRef;

    onValue(tRef, (snap) => {
        const typingData = snap.val() || {};
        const myUid = auth.currentUser?.uid;
        const now = Date.now();
        // Kendisi hariç, son 4 saniye içinde yazan kullanıcılar
        const names = Object.entries(typingData)
            .filter(([uid, data]) => uid !== myUid && data.ts && (now - data.ts) < 4000)
            .map(([, data]) => data.username);

        if (names.length === 0) {
            typingIndicatorEl.innerText = '';
        } else if (names.length === 1) {
            typingIndicatorEl.innerText = `${names[0]} yazıyor...`;
        } else if (names.length <= 3) {
            typingIndicatorEl.innerText = `${names.join(', ')} yazıyor...`;
        } else {
            typingIndicatorEl.innerText = `${names.length} kişi yazıyor...`;
        }
    });
}

// ================= @MENTION OTOMATİK TAMAMLAMA =================
const mentionDropdown = document.getElementById('mentionDropdown');

function getMentionQuery(text, cursorPos) {
    // İmlecin hemen solundaki @token'ı bul (boşluğa kadar geriye git)
    const upToCursor = text.slice(0, cursorPos);
    const match = upToCursor.match(/@([a-zA-Z0-9ığüşöçİĞÜŞÖÇ_]*)$/);
    if (!match) return null;
    return { query: match[1].toLowerCase(), start: cursorPos - match[0].length };
}

function showMentionDropdown(matches) {
    if (matches.length === 0) { hideMentionDropdown(); return; }
    mentionDropdown.innerHTML = matches.map((m, i) => `
        <div class="mention-item${i === 0 ? ' active' : ''}" data-username="${escapeHTML(m.username)}">
            <div class="w-5 h-5 bg-indigo-600 rounded-full flex items-center justify-center text-[10px] font-bold text-white">${escapeHTML(m.username.charAt(0).toUpperCase())}</div>
            ${escapeHTML(m.username)}
        </div>
    `).join('');
    mentionDropdown.classList.remove('hidden');

    mentionDropdown.querySelectorAll('.mention-item').forEach(item => {
        item.addEventListener('click', () => insertMention(item.dataset.username));
    });
}

function hideMentionDropdown() {
    mentionDropdown.classList.add('hidden');
    mentionDropdown.innerHTML = '';
    mentionQueryStart = -1;
}

function insertMention(username) {
    const text = messageInput.value;
    const cursorPos = messageInput.selectionStart;
    const q = getMentionQuery(text, cursorPos);
    if (!q) return;

    const before = text.slice(0, q.start);
    const after = text.slice(cursorPos);
    const newText = `${before}@${username} ${after}`;
    messageInput.value = newText;

    const newCursorPos = before.length + username.length + 2;
    messageInput.setSelectionRange(newCursorPos, newCursorPos);
    hideMentionDropdown();
    messageInput.focus();
}

messageInput.addEventListener('input', () => {
    handleTypingActivity();

    const cursorPos = messageInput.selectionStart;
    const q = getMentionQuery(messageInput.value, cursorPos);
    if (!q) { hideMentionDropdown(); return; }

    mentionQueryStart = q.start;
    const matches = membersCache.filter(m => m.username.toLowerCase().startsWith(q.query)).slice(0, 6);
    showMentionDropdown(matches);
});

messageInput.addEventListener('keydown', (e) => {
    if (mentionDropdown.classList.contains('hidden')) return;
    const items = mentionDropdown.querySelectorAll('.mention-item');
    if (items.length === 0) return;

    let activeIndex = Array.from(items).findIndex(i => i.classList.contains('active'));

    if (e.key === 'ArrowDown') {
        e.preventDefault();
        items[activeIndex]?.classList.remove('active');
        activeIndex = (activeIndex + 1) % items.length;
        items[activeIndex].classList.add('active');
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        items[activeIndex]?.classList.remove('active');
        activeIndex = (activeIndex - 1 + items.length) % items.length;
        items[activeIndex].classList.add('active');
    } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const active = mentionDropdown.querySelector('.mention-item.active') || items[0];
        insertMention(active.dataset.username);
    } else if (e.key === 'Escape') {
        hideMentionDropdown();
    }
});

// Mesajda geçen @kullanıcıadı ifadelerini (bilinen üyelerle eşleşenleri) vurgular
function highlightMentions(text) {
    const escaped = escapeHTML(text);
    if (membersCache.length === 0) return escaped;

    const usernamePattern = membersCache
        .map(m => m.username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .sort((a, b) => b.length - a.length) // uzun isimler önce eşleşsin
        .join('|');
    if (!usernamePattern) return escaped;

    const regex = new RegExp(`@(${usernamePattern})\\b`, 'gi');
    return escaped.replace(regex, '<span class="mention">@$1</span>');
}

// ================= MODAL: SUNUCU OLUŞTUR / KATIL =================
const serverModal = document.getElementById('serverModal');
document.getElementById('btnAddServer').addEventListener('click', () => {
    document.getElementById('serverModalError').classList.add('hidden');
    serverModal.classList.remove('hidden');
    serverModal.style.display = 'flex';
});
document.getElementById('closeServerModal').addEventListener('click', () => {
    serverModal.classList.add('hidden');
    serverModal.style.display = 'none';
});
document.getElementById('btnCreateServer').addEventListener('click', async () => {
    const name = document.getElementById('newServerName').value.trim();
    if (!name) return;
    await createServer(name);
    document.getElementById('newServerName').value = '';
    serverModal.classList.add('hidden');
    serverModal.style.display = 'none';
});
document.getElementById('btnJoinServer').addEventListener('click', async () => {
    const code = document.getElementById('joinServerCode').value.trim();
    const errorEl = document.getElementById('serverModalError');
    if (!code) return;
    try {
        await joinServerByCode(code);
        document.getElementById('joinServerCode').value = '';
        errorEl.classList.add('hidden');
        serverModal.classList.add('hidden');
        serverModal.style.display = 'none';
    } catch (err) {
        errorEl.innerText = err.message;
        errorEl.classList.remove('hidden');
    }
});

// ================= MODAL: KANAL OLUŞTUR =================
const channelModal = document.getElementById('channelModal');
let pendingChannelType = 'text';

function openChannelModal(type) {
    pendingChannelType = type;
    document.getElementById('channelModalTitle').innerText = type === 'voice' ? 'Sesli Kanal Oluştur' : 'Yazı Kanalı Oluştur';
    document.getElementById('newChannelName').value = '';
    channelModal.classList.remove('hidden');
    channelModal.style.display = 'flex';
}
document.getElementById('btnAddTextChannel').addEventListener('click', () => openChannelModal('text'));
document.getElementById('btnAddVoiceChannel').addEventListener('click', () => openChannelModal('voice'));
document.getElementById('closeChannelModal').addEventListener('click', () => {
    channelModal.classList.add('hidden');
    channelModal.style.display = 'none';
});
document.getElementById('btnCreateChannel').addEventListener('click', async () => {
    const name = document.getElementById('newChannelName').value.trim();
    if (!name || !currentServerId) return;
    await createChannel(name, pendingChannelType);
    channelModal.classList.add('hidden');
    channelModal.style.display = 'none';
});

// ================= MODAL: DAVET KODU =================
const inviteModal = document.getElementById('inviteModal');
document.getElementById('btnServerInfo').addEventListener('click', () => {
    if (!currentServerData) return;
    document.getElementById('inviteCodeDisplay').innerText = currentServerData.inviteCode || '—';
    inviteModal.classList.remove('hidden');
    inviteModal.style.display = 'flex';
});
document.getElementById('closeInviteModal').addEventListener('click', () => {
    inviteModal.classList.add('hidden');
    inviteModal.style.display = 'none';
});

// ================= YARDIMCI =================
function escapeHTML(str) {
    return String(str).replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag));
}
