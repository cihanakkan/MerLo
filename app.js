import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
    getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
    onAuthStateChanged, updateProfile, signOut
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
    getDatabase, ref, push, set, get, update, remove,
    onValue, onChildAdded, onChildRemoved, off, query, orderByChild, equalTo,
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

// --- Arkadaşlık / DM durumu ---
let currentView = 'server';      // 'server' | 'dm'
let currentDmUid = null;
let currentDmUsername = null;
let friendsListenerRef = null;
let friendRequestsListenerRef = null;
let dmMessagesListenerRef = null;
let friendsCache = [];           // [{ uid, username }]

// --- Sesli sohbet (WebRTC) durumu ---
const RTC_CONFIG = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
};
let localStream = null;
let peerConnections = {};        // { otherUid: RTCPeerConnection }
let peerListenerRefs = {};       // { otherUid: [refs to off() on cleanup] }
let currentVoiceChannelId = null;
let currentVoiceChannelName = null;
let voiceMembersListenerRef = null;
let voiceRowListeners = [];      // kanal listesindeki "kimler sesli odada" göstergeleri
let isMuted = false;

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
        // Kullanıcı adı → uid eşlemesi (arkadaş ararken kullanılıyor)
        await set(ref(db, `usernames/${username}`), res.user.uid);
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
    if (currentVoiceChannelId) leaveVoiceChannel();
    signOut(auth).then(() => { window.location.hash = '#/login'; });
});

onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('currentUserTitle').innerText = user.displayName || "Kullanıcı";
        document.getElementById('userAvatar').innerText = (user.displayName || "K").charAt(0).toUpperCase();

        // Kullanıcı adını veritabanıyla senkronize et — eski hesaplarda bu kayıt hiç
        // oluşmamış olabilir (üye listesinde "Bilinmeyen" görünmesinin sebebi buydu).
        update(ref(db, `users/${user.uid}`), {
            username: user.displayName || 'Kullanıcı'
        }).catch(() => {});
        // Kullanıcı adı arama index'ini de garantiye al (eski hesaplar için)
        if (user.displayName) {
            set(ref(db, `usernames/${user.displayName}`), user.uid).catch(() => {});
        }

        if (window.location.hash === '#/login' || window.location.hash === '#/register') {
            window.location.hash = '#/';
        }
        setupPresence(user.uid);
        listenMyServers(user.uid);
        listenFriendRequests();
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
    if (friendsListenerRef) { off(friendsListenerRef); friendsListenerRef = null; }
    if (friendRequestsListenerRef) { off(friendRequestsListenerRef); friendRequestsListenerRef = null; }
    if (dmMessagesListenerRef) { off(dmMessagesListenerRef); dmMessagesListenerRef = null; }
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
    if (currentVoiceChannelId) leaveVoiceChannel();
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
    voiceRowListeners.forEach(r => off(r));
    voiceRowListeners = [];
    textChannelsContainer.innerHTML = '';
    voiceChannelsContainer.innerHTML = '';

    const entries = Object.entries(channels).sort((a, b) => (a[1].position || 0) - (b[1].position || 0));

    entries.forEach(([channelId, ch]) => {
        const isActive = channelId === currentChannelId;
        const div = document.createElement('div');

        if (ch.type === 'voice') {
            const isJoined = channelId === currentVoiceChannelId;
            const wrapper = document.createElement('div');
            wrapper.className = `flex flex-col px-2 py-1.5 rounded cursor-pointer ${isJoined ? 'bg-[#2f3c37]' : 'hover:bg-[#35373c]'}`;
            wrapper.innerHTML = `
                <div class="flex items-center">
                    <i class="fa-solid fa-volume-high ${isJoined ? 'text-emerald-500' : 'text-gray-500'} mr-2 text-sm"></i>
                    <span class="text-sm font-medium ${isJoined ? 'text-emerald-400' : 'text-gray-400'}">${escapeHTML(ch.name)}</span>
                </div>
                <div class="voice-row-members flex flex-col gap-0.5 mt-1 ml-6"></div>
            `;
            wrapper.querySelector('div').onclick = () => toggleVoiceChannel(channelId, ch.name);
            voiceChannelsContainer.appendChild(wrapper);

            // O sesli kanalda kimlerin olduğunu canlı göster
            const membersEl = wrapper.querySelector('.voice-row-members');
            const vmRef = ref(db, `servers/${currentServerId}/channels/${channelId}/voiceMembers`);
            voiceRowListeners.push(vmRef);
            onValue(vmRef, (snap) => {
                const members = snap.val() || {};
                const names = Object.values(members).map(m => m.username);
                membersEl.innerHTML = names.map(n => `
                    <div class="flex items-center gap-1.5 text-xs text-gray-400">
                        <div class="w-4 h-4 bg-indigo-600 rounded-full flex items-center justify-center text-[9px] font-bold text-white">${escapeHTML(n.charAt(0).toUpperCase())}</div>
                        <span class="truncate">${escapeHTML(n)}</span>
                    </div>
                `).join('');
            });
        } else {
            div.className = `flex items-center px-2 py-1.5 rounded cursor-pointer ${isActive ? 'bg-[#404249] text-white' : 'text-gray-400 hover:bg-[#35373c]'}`;
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
    closeLeftPanel();
}

// ================= SESLİ SOHBET (WebRTC) =================

function pairKey(a, b) {
    return [a, b].sort().join('__');
}

function toggleVoiceChannel(channelId, name) {
    if (currentVoiceChannelId === channelId) {
        leaveVoiceChannel();
    } else {
        joinVoiceChannel(channelId, name);
    }
}

async function joinVoiceChannel(channelId, name) {
    if (currentVoiceChannelId) {
        await leaveVoiceChannel();
    }

    try {
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    } catch (err) {
        alert('Mikrofon erişimi alınamadı: ' + err.message + '\nTarayıcı ayarlarından MerLo\'ya mikrofon izni verdiğinden emin ol.');
        return;
    }

    currentVoiceChannelId = channelId;
    currentVoiceChannelName = name;
    isMuted = false;
    updateVoiceStatusBar();
    renderChannels(currentServerData.channels || {});

    const uid = auth.currentUser.uid;
    const myVoiceRef = ref(db, `servers/${currentServerId}/channels/${channelId}/voiceMembers/${uid}`);
    await set(myVoiceRef, {
        username: auth.currentUser.displayName || 'Anonim',
        joinedAt: serverTimestamp()
    });
    onDisconnect(myVoiceRef).remove();

    // Şu an odada olanlarla bağlantı kur
    const existingSnap = await get(ref(db, `servers/${currentServerId}/channels/${channelId}/voiceMembers`));
    const existing = existingSnap.val() || {};
    Object.keys(existing).forEach(otherUid => {
        if (otherUid !== uid) connectToPeer(channelId, otherUid);
    });

    // Yeni katılan / ayrılan üyeleri dinle
    const voiceMembersRef = ref(db, `servers/${currentServerId}/channels/${channelId}/voiceMembers`);
    voiceMembersListenerRef = voiceMembersRef;

    onChildAdded(voiceMembersRef, (snap) => {
        const otherUid = snap.key;
        if (otherUid === uid || peerConnections[otherUid] || currentVoiceChannelId !== channelId) return;
        connectToPeer(channelId, otherUid);
    });
    onChildRemoved(voiceMembersRef, (snap) => {
        disconnectPeer(snap.key);
    });
}

function connectToPeer(channelId, otherUid) {
    const myUid = auth.currentUser.uid;
    const key = pairKey(myUid, otherUid);
    const basePath = `servers/${currentServerId}/channels/${channelId}/rtc/${key}`;

    const pc = new RTCPeerConnection(RTC_CONFIG);
    peerConnections[otherUid] = pc;
    peerListenerRefs[otherUid] = [];

    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

    pc.ontrack = (event) => playRemoteAudio(otherUid, event.streams[0]);

    const myCandidatesRef = ref(db, `${basePath}/candidates/${myUid}`);
    pc.onicecandidate = (event) => {
        if (event.candidate) push(myCandidatesRef, event.candidate.toJSON());
    };

    // Çakışmayı önlemek için uid'i küçük olan taraf her zaman "offer" atar
    const amInitiator = myUid < otherUid;

    if (amInitiator) {
        pc.createOffer().then(async (offer) => {
            await pc.setLocalDescription(offer);
            set(ref(db, `${basePath}/offer`), { sdp: offer.sdp, type: offer.type });
        });

        const answerRef = ref(db, `${basePath}/answer`);
        peerListenerRefs[otherUid].push(answerRef);
        onValue(answerRef, (snap) => {
            const answer = snap.val();
            if (answer && !pc.currentRemoteDescription) {
                pc.setRemoteDescription(new RTCSessionDescription(answer)).catch(() => {});
            }
        });
    } else {
        const offerRef = ref(db, `${basePath}/offer`);
        peerListenerRefs[otherUid].push(offerRef);
        onValue(offerRef, async (snap) => {
            const offer = snap.val();
            if (offer && !pc.currentRemoteDescription) {
                await pc.setRemoteDescription(new RTCSessionDescription(offer));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                set(ref(db, `${basePath}/answer`), { sdp: answer.sdp, type: answer.type });
            }
        });
    }

    const theirCandidatesRef = ref(db, `${basePath}/candidates/${otherUid}`);
    peerListenerRefs[otherUid].push(theirCandidatesRef);
    onChildAdded(theirCandidatesRef, (snap) => {
        const candidate = snap.val();
        if (candidate) pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
    });
}

function disconnectPeer(otherUid) {
    const pc = peerConnections[otherUid];
    if (pc) {
        pc.close();
        delete peerConnections[otherUid];
    }
    removeRemoteAudio(otherUid);
    if (peerListenerRefs[otherUid]) {
        peerListenerRefs[otherUid].forEach(r => off(r));
        delete peerListenerRefs[otherUid];
    }
}

async function leaveVoiceChannel() {
    if (!currentVoiceChannelId) return;
    const uid = auth.currentUser.uid;
    const channelId = currentVoiceChannelId;
    const connectedPeers = Object.keys(peerConnections);

    connectedPeers.forEach(disconnectPeer);

    if (localStream) {
        localStream.getTracks().forEach(t => t.stop());
        localStream = null;
    }

    if (voiceMembersListenerRef) {
        off(voiceMembersListenerRef);
        voiceMembersListenerRef = null;
    }

    await remove(ref(db, `servers/${currentServerId}/channels/${channelId}/voiceMembers/${uid}`)).catch(() => {});

    // Eski sinyalleşme verisini temizle — aksi halde tekrar bağlanınca eski (bayat)
    // offer/answer verisiyle karışabilir.
    connectedPeers.forEach(otherUid => {
        const key = pairKey(uid, otherUid);
        remove(ref(db, `servers/${currentServerId}/channels/${channelId}/rtc/${key}`)).catch(() => {});
    });

    currentVoiceChannelId = null;
    currentVoiceChannelName = null;
    updateVoiceStatusBar();
    if (currentServerData) renderChannels(currentServerData.channels || {});
}

function toggleMute() {
    if (!localStream) return;
    isMuted = !isMuted;
    localStream.getAudioTracks().forEach(t => { t.enabled = !isMuted; });
    updateVoiceStatusBar();
}

function playRemoteAudio(uid, stream) {
    let audioEl = document.getElementById(`remoteAudio-${uid}`);
    if (!audioEl) {
        audioEl = document.createElement('audio');
        audioEl.id = `remoteAudio-${uid}`;
        audioEl.autoplay = true;
        document.body.appendChild(audioEl);
    }
    audioEl.srcObject = stream;
}

function removeRemoteAudio(uid) {
    const el = document.getElementById(`remoteAudio-${uid}`);
    if (el) el.remove();
}

function updateVoiceStatusBar() {
    const bar = document.getElementById('voiceStatusBar');
    if (!currentVoiceChannelId) {
        bar.classList.add('hidden');
        return;
    }
    bar.classList.remove('hidden');
    document.getElementById('voiceStatusChannelName').innerText = currentVoiceChannelName;
    const muteBtn = document.getElementById('btnToggleMute');
    muteBtn.innerHTML = isMuted ? '<i class="fa-solid fa-microphone-slash"></i>' : '<i class="fa-solid fa-microphone"></i>';
    muteBtn.classList.toggle('bg-red-600', isMuted);
    muteBtn.classList.toggle('text-white', isMuted);
}

document.getElementById('btnToggleMute').addEventListener('click', toggleMute);
document.getElementById('btnLeaveVoice').addEventListener('click', leaveVoiceChannel);

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
    if (!text || !auth.currentUser) return;

    const time = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

    if (currentView === 'dm') {
        if (!currentDmUid) return;
        const dmKey = pairKey(auth.currentUser.uid, currentDmUid);
        push(ref(db, `dms/${dmKey}/messages`), {
            senderId: auth.currentUser.uid,
            user: auth.currentUser.displayName || "Anonim",
            text: text,
            time: time,
            createdAt: serverTimestamp()
        });
    } else {
        if (!currentServerId || !currentChannelId) return;
        push(ref(db, `servers/${currentServerId}/channels/${currentChannelId}/messages`), {
            user: auth.currentUser.displayName || "Anonim",
            userId: auth.currentUser.uid,
            text: text,
            time: time,
            createdAt: serverTimestamp()
        });
        setTypingState(false);
    }

    messageInput.value = '';
    hideMentionDropdown();
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

// ================= ANA SAYFA / DM GÖRÜNÜM GEÇİŞİ =================
const channelBarPanel = document.getElementById('channelBarPanel');
const dmBarPanel = document.getElementById('dmBarPanel');
const btnHome = document.getElementById('btnHome');

function switchToDmView() {
    if (currentVoiceChannelId) leaveVoiceChannel();
    currentView = 'dm';
    currentChannelId = null; // yazıyor göstergesinin yanlış kanala yazmaması için
    channelBarPanel.classList.add('hidden');
    dmBarPanel.classList.remove('hidden');
    dmBarPanel.classList.add('flex');
    document.getElementById('voiceStatusBar').classList.add('hidden');
    rightPanel.style.display = 'none';
    btnHome.classList.add('bg-[#5865f2]');
    btnHome.classList.remove('bg-[#2b2d31]');

    if (!currentDmUid) {
        activeChannelTitle.innerText = 'Bir arkadaş seç';
        chatArea.innerHTML = '<p class="text-gray-500 text-sm">Sol taraftan bir arkadaşına tıkla ve sohbete başla.</p>';
    }
    renderServerIcons();
    listenFriendRequests();
    listenFriends();
    closeLeftPanel();
}

function switchToServerView() {
    currentView = 'server';
    currentDmUid = null;
    currentDmUsername = null;
    if (dmMessagesListenerRef) { off(dmMessagesListenerRef); dmMessagesListenerRef = null; }
    dmBarPanel.classList.add('hidden');
    dmBarPanel.classList.remove('flex');
    channelBarPanel.classList.remove('hidden');
    rightPanel.style.display = '';
    btnHome.classList.remove('bg-[#5865f2]');
    btnHome.classList.add('bg-[#2b2d31]');

    const ids = Object.keys(mySeverIds);
    if (ids.length > 0) {
        selectServer(currentServerId || ids[0]);
    } else {
        serverNameEl.innerText = 'Bir sunucu seç';
        textChannelsContainer.innerHTML = '';
        voiceChannelsContainer.innerHTML = '';
        activeChannelTitle.innerText = 'kanal seç';
        chatArea.innerHTML = '<p class="text-gray-500 text-sm">Henüz bir sunucun yok. Sol alttaki + butonuyla bir sunucu oluştur ya da davet koduyla katıl.</p>';
    }
    renderServerIcons();
}

btnHome.addEventListener('click', () => {
    if (currentView === 'dm') switchToServerView(); else switchToDmView();
});
document.getElementById('btnCloseLeftPanel2').addEventListener('click', closeLeftPanel);

// ================= ARKADAŞLIK İSTEKLERİ =================
async function sendFriendRequest(targetUsername) {
    const errorEl = document.getElementById('addFriendError');
    errorEl.classList.add('hidden');

    const myUid = auth.currentUser.uid;
    const myUsername = auth.currentUser.displayName;

    if (!targetUsername || targetUsername === myUsername) {
        errorEl.innerText = 'Geçerli bir kullanıcı adı gir.';
        errorEl.classList.remove('hidden');
        return;
    }

    const uidSnap = await get(ref(db, `usernames/${targetUsername}`));
    if (!uidSnap.exists()) {
        errorEl.innerText = 'Bu kullanıcı adında biri bulunamadı.';
        errorEl.classList.remove('hidden');
        return;
    }
    const targetUid = uidSnap.val();

    if (targetUid === myUid) {
        errorEl.innerText = 'Kendine istek gönderemezsin.';
        errorEl.classList.remove('hidden');
        return;
    }

    const alreadyFriend = await get(ref(db, `friends/${myUid}/${targetUid}`));
    if (alreadyFriend.exists()) {
        errorEl.innerText = 'Zaten arkadaşsınız.';
        errorEl.classList.remove('hidden');
        return;
    }

    await set(ref(db, `friendRequests/${targetUid}/${myUid}`), {
        username: myUsername,
        sentAt: serverTimestamp()
    });

    document.getElementById('addFriendInput').value = '';
}

document.getElementById('btnSendFriendRequest').addEventListener('click', () => {
    sendFriendRequest(document.getElementById('addFriendInput').value.trim());
});
document.getElementById('addFriendInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendFriendRequest(document.getElementById('addFriendInput').value.trim());
});

function listenFriendRequests() {
    if (!auth.currentUser) return;
    const myUid = auth.currentUser.uid;
    const reqRef = ref(db, `friendRequests/${myUid}`);
    friendRequestsListenerRef = reqRef;

    onValue(reqRef, (snap) => {
        const requests = snap.val() || {};
        const entries = Object.entries(requests);
        const badge = document.getElementById('friendRequestBadge');
        const section = document.getElementById('friendRequestsSection');
        const listEl = document.getElementById('friendRequestsList');

        if (entries.length === 0) {
            badge.classList.add('hidden');
            section.classList.add('hidden');
            listEl.innerHTML = '';
            return;
        }

        badge.classList.remove('hidden');
        badge.classList.add('flex');
        badge.innerText = entries.length;
        section.classList.remove('hidden');

        listEl.innerHTML = '';
        entries.forEach(([fromUid, data]) => {
            const row = document.createElement('div');
            row.className = 'flex items-center justify-between bg-[#1e1f22] rounded px-2 py-1.5';
            row.innerHTML = `
                <span class="text-sm text-gray-200 truncate">${escapeHTML(data.username)}</span>
                <div class="flex items-center gap-1.5 shrink-0">
                    <button class="w-6 h-6 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center accept-btn"><i class="fa-solid fa-check text-xs"></i></button>
                    <button class="w-6 h-6 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center decline-btn"><i class="fa-solid fa-xmark text-xs"></i></button>
                </div>
            `;
            row.querySelector('.accept-btn').onclick = () => acceptFriendRequest(fromUid, data.username);
            row.querySelector('.decline-btn').onclick = () => declineFriendRequest(fromUid);
            listEl.appendChild(row);
        });
    });
}

async function acceptFriendRequest(fromUid, fromUsername) {
    const myUid = auth.currentUser.uid;
    await set(ref(db, `friends/${myUid}/${fromUid}`), true);
    await set(ref(db, `friends/${fromUid}/${myUid}`), true);
    await remove(ref(db, `friendRequests/${myUid}/${fromUid}`));
}

async function declineFriendRequest(fromUid) {
    await remove(ref(db, `friendRequests/${auth.currentUser.uid}/${fromUid}`));
}

// ================= ARKADAŞ LİSTESİ =================
function listenFriends() {
    if (!auth.currentUser) return;
    const myUid = auth.currentUser.uid;
    const fRef = ref(db, `friends/${myUid}`);
    friendsListenerRef = fRef;

    onValue(fRef, async (snap) => {
        const friends = snap.val() || {};
        const listEl = document.getElementById('friendsList');
        listEl.innerHTML = '';
        friendsCache = [];

        const uids = Object.keys(friends);
        if (uids.length === 0) {
            listEl.innerHTML = '<p class="text-xs text-gray-500 px-1">Henüz arkadaşın yok. Yukarıdan kullanıcı adıyla ekleyebilirsin.</p>';
            return;
        }

        for (const uid of uids) {
            const [profileSnap, statusSnap] = await Promise.all([
                get(ref(db, `users/${uid}`)),
                get(ref(db, `status/${uid}`))
            ]);
            const profile = profileSnap.val() || { username: 'Bilinmeyen' };
            const status = statusSnap.val() || { state: 'offline' };
            const isOnline = status.state === 'online';

            friendsCache.push({ uid, username: profile.username });

            const isActive = currentView === 'dm' && currentDmUid === uid;
            const row = document.createElement('div');
            row.className = `flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer ${isActive ? 'bg-[#404249]' : 'hover:bg-[#35373c]'}`;
            row.innerHTML = `
                <div class="relative shrink-0">
                    <div class="w-7 h-7 bg-indigo-600 rounded-full flex items-center justify-center font-bold text-xs text-white">${escapeHTML((profile.username || '?').charAt(0).toUpperCase())}</div>
                    <span class="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#2b2d31] ${isOnline ? 'bg-emerald-500' : 'bg-gray-500'}"></span>
                </div>
                <span class="text-sm ${isActive ? 'text-white' : 'text-gray-300'} truncate">${escapeHTML(profile.username)}</span>
            `;
            row.onclick = () => openDm(uid, profile.username);
            listEl.appendChild(row);
        }
    });
}

// ================= ÖZEL MESAJLAR (DM) =================
function openDm(uid, username) {
    currentDmUid = uid;
    currentDmUsername = username;
    activeChannelTitle.innerText = username;
    listenFriends(); // aktif satırı vurgulamak için listeyi yeniden çiz
    listenDmMessages();
    closeLeftPanel();
}

function listenDmMessages() {
    if (dmMessagesListenerRef) off(dmMessagesListenerRef);
    chatArea.innerHTML = '';
    if (!currentDmUid) return;

    const dmKey = pairKey(auth.currentUser.uid, currentDmUid);
    const msgsRef = query(ref(db, `dms/${dmKey}/messages`), limitToLast(50));
    dmMessagesListenerRef = msgsRef;

    onChildAdded(msgsRef, (snapshot) => {
        const msg = snapshot.val();
        if (!msg) return;
        const isMine = msg.senderId === auth.currentUser.uid;
        const div = document.createElement('div');
        div.className = `flex flex-col ${isMine ? 'bg-[#3f4bd1]/20 self-end' : 'bg-[#383a40] self-start'} p-2.5 rounded shadow-sm max-w-xl w-fit mt-1 animate-fade-in`;
        div.innerHTML = `
            <div class="flex items-center gap-2 mb-1">
                <span class="font-bold text-indigo-400 text-xs">${escapeHTML(msg.user)}</span>
                <span class="text-[10px] text-gray-500">${escapeHTML(msg.time)}</span>
            </div>
            <p class="text-gray-200 text-sm">${escapeHTML(msg.text)}</p>
        `;
        chatArea.appendChild(div);
        chatArea.scrollTop = chatArea.scrollHeight;
    });
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

// ================= MOBİL PANEL (DRAWER) KONTROLÜ =================
const leftPanel = document.getElementById('leftPanel');
const rightPanel = document.getElementById('rightPanel');
const mobileBackdrop = document.getElementById('mobileBackdrop');

function openLeftPanel() {
    closeRightPanel();
    leftPanel.classList.remove('-translate-x-full');
    mobileBackdrop.classList.remove('hidden');
}
function closeLeftPanel() {
    leftPanel.classList.add('-translate-x-full');
    if (rightPanel.classList.contains('translate-x-full')) mobileBackdrop.classList.add('hidden');
}
function openRightPanel() {
    closeLeftPanel();
    rightPanel.classList.remove('translate-x-full');
    mobileBackdrop.classList.remove('hidden');
}
function closeRightPanel() {
    rightPanel.classList.add('translate-x-full');
    if (leftPanel.classList.contains('-translate-x-full')) mobileBackdrop.classList.add('hidden');
}
function closeAllPanels() {
    closeLeftPanel();
    closeRightPanel();
    mobileBackdrop.classList.add('hidden');
}

document.getElementById('btnOpenLeftPanel').addEventListener('click', openLeftPanel);
document.getElementById('btnCloseLeftPanel').addEventListener('click', closeLeftPanel);
document.getElementById('btnOpenRightPanel').addEventListener('click', openRightPanel);
document.getElementById('btnCloseRightPanel').addEventListener('click', closeRightPanel);
mobileBackdrop.addEventListener('click', closeAllPanels);
