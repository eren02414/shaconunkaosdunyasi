// Firebase konsolundan (console.firebase.google.com) proje ayarlarından
// "Web app" eklediğinizde size bu bilgiler verilecek. Aynen buraya yapıştırın.
// Project Settings > General > Your apps > SDK setup and configuration

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { getFunctions } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-functions.js";

export const firebaseConfig = {
    apiKey: "AIzaSyBUZVhgO54KJ7O5TvD3czuUFJ6cw8ZtEaM",
    authDomain: "shaconun-kaos-dunyasi.firebaseapp.com",
    projectId: "shaconun-kaos-dunyasi",
    storageBucket: "shaconun-kaos-dunyasi.firebasestorage.app",
    messagingSenderId: "903126882517",
    appId: "1:903126882517:web:b4af62f0fc14074a6c6a5c",
    measurementId: "G-PRMX2WXE90"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);

// DİKKAT: En alttaki "export { firebaseConfig };" satırı silindi çünkü yukarıda zaten "export const" ile dışarı aktardık.