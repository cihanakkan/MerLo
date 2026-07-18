// Firebase SDK modüllerini çekiyoruz
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, push, onChildAdded } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// Sizin kopyaladığınız MerLo projesinin canlı Firebase ayarları
const firebaseConfig = {
    apiKey: "AIzaSyCvE0TxxH9Gey9PZtGA_-VCpHpsUM7hr8E",
    authDomain: "merlo-494a7.firebaseapp.com",
    projectId: "merlo-494a7",
    storageBucket: "merlo-494a7.firebasestorage.app",
    messagingSenderId: "1001648836568",
    appId: "1:1001648836568:web:305b5d0cd9e82d18c5acad",
    measurementId: "G-FPVQL0W4H0"
};

// Firebase başlatılıyor
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const messagesRef = ref(db, "merlo_chat_messages");

let loggedInUser = null;
let currentServer = 'ciAI Merkez';
let currentChannel = 'genel';

const serverData = {
    'ciAI Merkez': { description: "Ana merkeze hoş geldin!", channels: [{ id: 'genel', name: 'genel' }, { id: 'duyurular', name: '📢-duyurular' }] },
    'Yazılımcılar': { description: "Kod ve kahve alanı.", channels: [{ id: 'javascript', name: 'javascript' }, { id: 'tasarım', name: 'tasarım' }] },
    'Bizim Tayfa': { description: "Mekan lobisi.", channels: [{ id: 'lobi', name: 'lobi' }] }
};

// DOM Elementleri
const authModal = document.getElementById('authModal');
const loginForm = document.getElementById('loginForm');
const loginUsername = document.getElementById('loginUsername');
const currentUserTitle = document.getElementById('currentUserTitle');
const userAvatar = document.getElementById('userAvatar');
const messageForm = document.getElementById('messageForm');
const messageInput = document.getElementById('messageInput');
const chatArea = document.getElementById('chatArea');
const logoutBtn = document.getElementById('logoutBtn');

// Tüm mesajların tutulacağı lokal önbellek dizisi
let localMessagesArray = [];

function checkSession() {
    const savedUser = localStorage.getItem('ciai_active_user');
    if(savedUser) {
        loggedInUser = savedUser;
        authModal.style.display = 'none';
        initApp();
    }
}

function initApp() {
    currentUserTitle.innerText = loggedInUser;
    userAvatar.innerText = loggedInUser.charAt(0).toUpperCase();
    
    renderChannels();
    listenFirebaseMessages();
}

// Giriş Yapma Tetikleyicisi
loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const username = loginUsername.value.trim();
    if(!username) return;

    loggedInUser = username;
    localStorage.setItem('ciai_active_user', loggedInUser);
    authModal.style.display = 'none';
    initApp();
});

// Çıkış Yapma Tetikleyicisi
logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('ciai_active_user');
    location.reload();
});

function renderChannels() {
    const container = document.getElementById('channelsContainer');
    container.innerHTML = '';
    
    const textHeader = document.createElement('div');
    textHeader.className = "text-xs font-semibold text-gray-400 px-2 pt-4 pb-1 tracking-wider uppercase";
    textHeader.innerText = "Yazı Kanalları";
    container.appendChild(textHeader);

    serverData[currentServer].channels.forEach(ch => {
        const div = document.createElement('div');
        const isActive = ch.id === currentChannel;
        div.className = `flex items-center px-2 py-1.5 rounded cursor-pointer transition-colors ${isActive ? 'bg-[#393c43] text-white' : 'hover:bg-[#34373c] text-gray-400'}`;
        div.onclick = () => { currentChannel = ch.id; renderChannels(); filterAndRenderMessages(); };
        div.innerHTML = `<span class="text-gray-400 mr-1.5 text-xl font-light">#</span><span class="text-sm font-medium">${ch.name}</span>`;
        container.appendChild(div);
    });
}

// Firebase'den akan canlı mesajları dinleyen fonksiyon
function listenFirebaseMessages() {
    onChildAdded(messagesRef, (snapshot) => {
        const msg = snapshot.val();
        if(msg) {
            localMessagesArray.push(msg);
            filterAndRenderMessages();
        }
    });
}

// Aktif kanal ve sunucuya göre mesajları süzüp ekrana basan yer
function filterAndRenderMessages() {
    chatArea.innerHTML = '';
    const currentPath = `${currentServer}_${currentChannel}`;
    
    const filtered = localMessagesArray.filter(m => m.path === currentPath);

    if(filtered.length === 0) {
        chatArea.innerHTML = `<div class="text-xs text-gray-500 text-center my-4">Burası çok sessiz... İlk mesajı sen salla kral!</div>`;
        return;
    }

    filtered.forEach(msg => {
        const msgDiv = document.createElement('div');
        msgDiv.className = "flex gap-4 items-start animate-fade-in";
        const isMe = msg.user === loggedInUser;
        const avatarBg = isMe ? 'bg-indigo-600' : 'bg-gray-600';

        msgDiv.innerHTML = `
            <div class="w-10 h-10 ${avatarBg} rounded-full flex items-center justify-center font-bold text-white shrink-0 shadow">${msg.user.charAt(0).toUpperCase()}</div>
            <div>
                <div class="flex items-baseline gap-2">
                    <span class="font-semibold text-white text-sm">${escapeHTML(msg.user)}</span>
                    <span class="text-xs text-gray-400">${msg.time}</span>
                </div>
                <p class="text-sm text-gray-300 mt-1">${escapeHTML(msg.text)}</p>
            </div>
        `;
        chatArea.appendChild(msgDiv);
    });
    chatArea.scrollTop = chatArea.scrollHeight;
}

// Firebase'e mesaj yollama tetikleyicisi
messageForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = messageInput.value.trim();
    if (!text) return;

    const time = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    const currentPath = `${currentServer}_${currentChannel}`;

    // Veriyi direkt senin Firebase Realtime Database'ine atıyoruz
    push(messagesRef, {
        path: currentPath,
        user: loggedInUser,
        text: text,
        time: time
    });

    messageInput.value = '';
});

// Sunucu Değiştirme Fonksiyonları
function switchServer(serverName) {
    currentServer = serverName;
    currentChannel = serverData[serverName].channels[0].id;
    document.getElementById('serverName').innerText = serverName;
    document.getElementById('channelDescription').innerText = serverData[serverName].description;
    document.getElementById('activeChannelTitle').innerText = currentChannel;
    renderChannels();
    filterAndRenderMessages();
}

// Butonlara tıklama dinleyicilerini bağlama
document.getElementById('btnServerCentric').addEventListener('click', () => switchServer('ciAI Merkez'));
document.getElementById('btnServerDev').addEventListener('click', () => switchServer('Yazılımcılar'));
document.getElementById('btnServerSquad').addEventListener('click', () => switchServer('Bizim Tayfa'));

function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag));
}

window.addEventListener('DOMContentLoaded', checkSession);