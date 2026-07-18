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
    measurementId: "G-FPVQL0W4H0",
    // TAMİR NOKTASI: Konsoldaki gerçek Avrupa sunucusu adresini buraya çaktık
    databaseURL: "https://merlo-494a7-default-rtdb.europe-west1.firebasedatabase.app"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);
const messagesRef = ref(db, "chat_records");

// GERİ KALAN KODLAR AYNEN KALSIN...
// ================= EKRANLAR ARASI GEÇİŞ TETİKCİLERİ =================

// Giriş ekranındaki "Kaydol" linkine tıklayınca kayıt ekranını aç
const goToRegister = document.querySelector('a[href*="Kaydol"]') || document.getElementById('goToRegister'); 
// Not: Eğer Kaydol linkine özel bir id verdiysen (örn: id="toRegister"), yukarıyı document.getElementById('toRegister') yapabilirsin.

if (goToRegister) {
    goToRegister.addEventListener('click', (e) => {
        e.preventDefault();
        const loginCard = document.getElementById('loginCard');
        const registerCard = document.getElementById('registerCard');
        
        if (loginCard) loginCard.classList.add('hidden');
        if (registerCard) registerCard.classList.remove('hidden');
    });
}

// Kayıt ekranındaki "Giriş yap" linkine tıklayınca giriş ekranına geri dön
const goToLogin = document.querySelector('a[href*="Giriş"]') || document.getElementById('goToLogin');

if (goToLogin) {
    goToLogin.addEventListener('click', (e) => {
        e.preventDefault();
        const loginCard = document.getElementById('loginCard');
        const registerCard = document.getElementById('registerCard');
        
        if (registerCard) registerCard.classList.add('hidden');
        if (loginCard) loginCard.classList.remove('hidden');
    });
}
