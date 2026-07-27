import { auth, db } from "./firebaseConfig.js";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

/**
 * Kullanıcı adıyla giriş yapar.
 * Akış: username -> usernames/{username} dokümanından gizli email bulunur
 *       -> o email + girilen şifreyle Firebase Auth'a giriş yapılır.
 */
export async function loginWithUsername(username, password) {
  const usernameKey = username.trim().toLowerCase();
  const usernameRef = doc(db, "usernames", usernameKey);
  const usernameSnap = await getDoc(usernameRef);

  if (!usernameSnap.exists()) {
    throw new Error("Bu kullanıcı adına ait bir hesap bulunamadı.");
  }

  const { email } = usernameSnap.data();

  const cred = await signInWithEmailAndPassword(auth, email, password);

  // Rol/tier bilgisini users/{uid} dokümanından çekip döndürüyoruz,
  // panel yönlendirmesi bu bilgiye göre yapılacak.
const userSnap = await getDoc(
  doc(db,"users",cred.user.uid)
);

if (!userSnap.exists()) {
  throw new Error("Kullanıcı kaydı eksik.");
}

const userData = userSnap.data();
  return { 
  uid: cred.user.uid, 
  ...userData 
};
}

export async function logout() {
  await signOut(auth);
}

/**
 * Sayfa yüklendiğinde oturum durumunu kontrol eder ve role göre
 * doğru panele yönlendirir. Her panel HTML dosyasının başında çağrılmalı.
 */
export function requireRole(allowedRoles, onReady) {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = "/index.html";
      return;
    }

    const userSnap = await getDoc(doc(db, "users", user.uid));
    if (!userSnap.exists()) {
      window.location.href = "/index.html";
      return;
    }

    const userData = userSnap.data();

    if (!allowedRoles.includes(userData.role)) {
      // Yetkisi olmayan bir panele girmeye çalışıyor
      window.location.href = "/index.html";
      return;
    }

    onReady({ uid: user.uid, ...userData });
  });
}
