import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, updateProfile, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getDatabase, ref, push, onChildAdded } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// Senin getirdiğin nokta atışı gerçek MerLo projesi anahtarları
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

// Kart Değişim Elemanları
const loginCard = document.getElementById('loginCard');
const registerCard = document.getElementById('registerCard');
const appContainer = document.getElementById('appContainer');

document.getElementById('toRegisterBtn').addEventListener('click', () => {
    loginCard.classList.add('hidden');
    registerCard.classList.remove('hidden');
});

document.getElementById('toLoginBtn').addEventListener('click', () => {
    registerCard.classList.add('hidden');
    loginCard.classList.remove('hidden');
});

// ================= FİREBASE KAYIT FONKSİYONU =================
document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPassword').value;
    const username = document.getElementById('regUsername').value.trim();

    try {
        const credential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(credential.user, { displayName: username });
        alert("Kayıt ok! MerLo lobiye yönlendiriliyorsun.");
    } catch (err) {
        alert("Kayıt oluşturulamadı: " + err.message);
    }
});

// ================= FİREBASE GİRİŞ FONKSİYONU =================
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
        alert("Giriş Patladı: E-posta veya şifre yanlış reiz.");
    }
});

// ================= CANLI OTURUM KONTROLÜ =================
onAuthStateChanged(auth, (user) => {
    if(user) {
        loginCard.classList.add('hidden');
        registerCard.classList.add('hidden');
        appContainer.classList.remove('hidden');
        document.getElementById('currentUserTitle').innerText = user.displayName || "MerLo Üyesi";
        
        loadRealtimeMessages();
    } else {
        appContainer.classList.add('hidden');
        loginCard.classList.remove('hidden');
    }
});

// Çıkış
document.getElementById('logoutBtn').addEventListener('click', () => {
    signOut(auth);
});

// ================= CANLI MESAJLAŞMA MOTORU =================
function loadRealtimeMessages() {
    const chatArea = document.getElementById('chatArea');
    chatArea.innerHTML = '';

    onChildAdded(messagesRef, (snapshot) => {
        const msg = snapshot.val();
        if(msg) {
            const div = document.createElement('div');
            div.className = "mb-2 animate-fade-in";
            div.innerHTML = `<strong class="text-[#5865f2]">${msg.user}:</strong> <span class="text-gray-100">${msg.text}</span> <span class="text-[10px] text-gray-500 ml-2">${msg.time}</span>`;
            chatArea.appendChild(div);
            chatArea.scrollTop = chatArea.scrollHeight;
        }
    });
}

document.getElementById('messageForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('messageInput');
    if(!input.value.trim() || !auth.currentUser) return;

    const time = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    
    push(messagesRef, {
        user: auth.currentUser.displayName || "İsimsiz",
        text: input.value.trim(),
        time: time
    });

    input.value = '';
});
