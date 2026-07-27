import { db } from "./firebaseConfig.js";
import {
  collection,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const form = document.getElementById("session-request-form");
const errorEl = document.getElementById("error-message");
const successEl = document.getElementById("success-message");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  errorEl.textContent = "";
  successEl.textContent = "";

  const username = document.getElementById("username").value.trim();
  const steamId = document.getElementById("steamid").value.trim();
  const reason = document.getElementById("reason").value.trim();

  if (!username || !reason) {
    errorEl.textContent = "Kullanıcı adı ve talep sebebi zorunludur.";
    return;
  }

  const submitBtn = form.querySelector("button[type=submit]");
  submitBtn.disabled = true;

  try {
    await addDoc(collection(db, "sessionRequests"), {
      username,
      steamId: steamId || null,
      reason,
      status: "pending",
      createdAt: serverTimestamp()
    });
    successEl.textContent = "Talebiniz alındı. Bir yetkili onayladığında size şifreniz ulaştırılacak.";
    form.reset();
  } catch (err) {
    errorEl.textContent = "Gönderilemedi: " + err.message;
  } finally {
    submitBtn.disabled = false;
  }
});
