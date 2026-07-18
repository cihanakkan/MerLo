import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, updateProfile, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getDatabase, ref, push, onChildAdded, off } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyCvE0TxxH9Gey9PZtGA_-VCpHpsUM7hr8E",
    authDomain: "merlo-494a7.firebaseapp.com",
    projectId: "merlo-494a7",
    storageBucket: "merlo-494a7.firebasestorage.app",
    messagingSenderId: "1001648836568",
    appId: "1:1001648836568:web:305b5d0cd9e82d18c5acad",
    measurementId: "G-FPVQL0W4H0"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);
const messagesRef = ref(db, "chat_records");

let currentServer = 'MerLo Merkez';
let currentChannel = 'genel';

const serverData = {
    'MerLo Merkez': { channels: [{ id: 'genel', name: 'genel' }, { id: 'duyurular', name: '📢-duyurular' }] },
    'Yazılımcılar': { channels: [{ id: 'javascript', name: 'javascript' }, { id: 'tasarım', name: 'tasarım' }] },
    'Pendikspor': { channels: [{ id: 'tribun', name: '🔴⚪-tribün' }, { id: 'transfer-gundemi', name: 'transfer-gündemi' }] }
};

// DOM Elemanları
const loginPage = document.getElementById('loginPage');
const registerPage = document.getElementById('registerPage');
const mainAppPage = document.getElementById('mainAppPage');
const chatArea = document.getElementById('chatArea');

// ================= YÖNLENDİRİCİ (ROUTER) MOTORU =================
function handleRouting() {
    const path = window.location.hash || '#/';

    // Hepsini önce bir gizle
    loginPage.classList.add('hidden');
    registerPage.classList.add('hidden');
    mainAppPage.classList.add('hidden');
    loginPage.style.display = 'none';
    registerPage.style.display = 'none';
    mainAppPage.style.display = 'none';

    // URL'ye göre ilgili sayfayı aç
    if (path === '#/register') {
        registerPage.classList.remove('hidden');
        registerPage.style.display = 'flex';
    } else if (path === '#/login') {
        loginPage.classList.remove('hidden');
        loginPage.style.display = 'flex';
    } else {
        // Eğer kullanıcı giriş yapmadıysa ve direkt ana sayfaya gitmeye çalışıyorsa Auth kontrolü tetiklenecek
        if (auth.currentUser) {
            mainAppPage.classList.remove('hidden');
            mainAppPage.style.display = 'flex';
        } else {
            // Giriş yoksa zorla login'e at
            window.location.hash = '#/login';
        }
    }
}

// URL Değişikliklerini ve Sayfa Yüklenmesini Dinle
window.addEventListener('hashchange', handleRouting);
window.addEventListener('load', handleRouting);

// Buton Tıklamalarıyla URL Değiştirme
document.getElementById('btnGoToRegister').addEventListener('click', () => { window.location.hash = '#/register'; });
document.getElementById('btnGoToLogin').addEventListener('click', () => { window.location.hash = '#/login'; });


// ================= FİRÈBASE İŞLEMLERİ =================

// Kayıt Olma
document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPassword').value;
    const username = document.getElementById('regUsername').value.trim();
    try {
        const res = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(res.user, { displayName: username });
        window.location.hash = '#/'; // Başarılıysa ana sayfaya uçur
    } catch (err) { alert("Kayıt Hatası: " + err.message); }
});

// Giriş Yapma
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    try { 
        await signInWithEmailAndPassword(auth, email, password); 
        window.location.hash = '#/'; 
    } catch (err) { alert("Giriş Hatalı veya Kullanıcı Bulunamadı!"); }
});

// Canlı Canlı Oturum Takibi
onAuthStateChanged(auth, (user) => {
    if(user) {
        document.getElementById('currentUserTitle').innerText = user.displayName || "Kullanıcı";
        document.getElementById('userAvatar').innerText = (user.displayName || "K").charAt(0).toUpperCase();
        if(window.location.hash === '#/login' || window.location.hash === '#/register') {
            window.location.hash = '#/';
        }
        renderChannels();
        listenMessages();
    } else {
        if(window.location.hash !== '#/register') {
            window.location.hash = '#/login';
        }
    }
    handleRouting();
});

// Çıkış
document.getElementById('logoutBtn').addEventListener('click', () => { 
    signOut(auth).then(() => { window.location.hash = '#/login'; }); 
});

// Arayüz Çizimleri
function renderChannels() {
    const container = document.getElementById('channelsContainer');
    container.innerHTML = '';
    serverData[currentServer].channels.forEach(ch => {
        const div = document.createElement('div');
        const isActive = ch.id === currentChannel;
        div.className = `flex items-center px-2 py-1.5 rounded cursor-pointer mt-1 ${isActive ? 'bg-[#404249] text-white' : 'text-gray-400 hover:bg-[#35373c]'}`;
        div.onclick = () => { 
            currentChannel = ch.id; 
            document.getElementById('activeChannelTitle').innerText = ch.name; 
            renderChannels(); 
            listenMessages(); 
        };
        div.innerHTML = `<span class="text-gray-500 mr-2">#</span><span class="text-sm font-medium">${ch.name}</span>`;
        container.appendChild(div);
    });
}

function listenMessages() {
    chatArea.innerHTML = '';
    off(messagesRef);

    onChildAdded(messagesRef, (snapshot) => {
        const msg = snapshot.val();
        const currentPath = `${currentServer}_${currentChannel}`;
        
        if (msg && msg.path === currentPath) {
            const div = document.createElement('div');
            div.className = "flex flex-col bg-[#383a40] p-2.5 rounded shadow-sm max-w-xl self-start w-fit mt-1";
            div.innerHTML = `
                <div class="flex items-center gap-2 mb-1">
                    <span class="font-bold text-indigo-400 text-xs">${escapeHTML(msg.user)}</span>
                    <span class="text-[10px] text-gray-500">${msg.time}</span>
                </div>
                <p class="text-gray-200 text-sm">${escapeHTML(msg.text)}</p>
            `;
            chatArea.appendChild(div);
            chatArea.scrollTop = chatArea.scrollHeight;
        }
    });
}

document.getElementById('messageForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('messageInput');
    const text = input.value.trim();
    if(!text || !auth.currentUser) return;

    const time = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    const currentPath = `${currentServer}_${currentChannel}`;

    push(messagesRef, {
        path: currentPath,
        user: auth.currentUser.displayName || "Anonim",
        text: text,
        time: time
    });

    input.value = '';
});

function switchServer(name) {
    currentServer = name;
    currentChannel = serverData[name].channels[0].id;
    document.getElementById('serverName').innerText = name;
    document.getElementById('activeChannelTitle').innerText = serverData[name].channels[0].name;
    renderChannels();
    listenMessages();
}

document.getElementById('btnServerCentric').addEventListener('click', () => switchServer('MerLo Merkez'));
document.getElementById('btnServerDev').addEventListener('click', () => switchServer('Yazılımcılar'));
document.getElementById('btnServerPendik').addEventListener('click', () => switchServer('Pendikspor'));

function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag));
}
