import { auth, db, firebaseConfig } from "./firebaseConfig.js";
import { requireRole, logout } from "./auth.js";
import {
  collection,
  query,
  orderBy,
  where,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  getDoc,
  setDoc,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import {
 createUserWithEmailAndPassword,
 getAuth
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
 initializeApp
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";

let allBans = [];       // Firestore'dan gelen tüm cezalar
let selectedUsername = null;
let pendingApprovalRequest = null; // onaylanmak üzere seçilen oturum talebi

const tabsEl = document.getElementById("username-tabs");
const banListEl = document.getElementById("ban-list");
const selectedUserTitleEl = document.getElementById("selected-username");
const addBanBtn = document.getElementById("add-ban-btn");
const modal = document.getElementById("add-ban-modal");
const addBanForm = document.getElementById("add-ban-form");
const closeModalBtn = document.getElementById("close-modal-btn");
const formError = document.getElementById("form-error");

const sessionRequestsListEl = document.getElementById("session-requests-list");
const discountRequestsListEl = document.getElementById("discount-requests-list");
const approveModal = document.getElementById("approve-session-modal");
const approveForm = document.getElementById("approve-session-form");
const approveUsernameEl = document.getElementById("approve-session-username");
const approveRoleSelect = document.getElementById("approve-role");
const approveTierLabel = document.getElementById("approve-tier-label");
const approveTierSelect = document.getElementById("approve-tier");
const approvePasswordInput = document.getElementById("approve-password");
const approveErrorEl = document.getElementById("approve-session-error");
const closeApproveModalBtn = document.getElementById("close-approve-modal-btn");

requireRole(["admin", "moderator"], (currentUser) => {
  document.getElementById("current-username").textContent = currentUser.username;
  listenToBans();
  listenToSessionRequests();
  listenToDiscountRequests();
});

document.getElementById("logout-btn").addEventListener("click", async () => {
  await logout();
});

// Üst sekme geçişleri (Cezalılar / Talepler)
document.querySelectorAll(".top-tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".top-tab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".top-tab-panel").forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(btn.dataset.toptab).classList.add("active");
  });
});

function listenToBans() {
  const q = query(collection(db, "bans"), orderBy("issuedAt", "desc"));
  onSnapshot(q, (snapshot) => {
    allBans = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderTabs();
    if (selectedUsername) renderBanList(selectedUsername);
  });
}

function renderTabs() {
  // targetUsername'e göre grupla
  const grouped = {};
  for (const ban of allBans) {
    const key = ban.targetUsername;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(ban);
  }

  const usernames = Object.keys(grouped).sort();

  if (!selectedUsername && usernames.length > 0) {
    selectedUsername = usernames[0];
  }

  tabsEl.innerHTML = "";
  usernames.forEach((username) => {
    const activeCount = grouped[username].filter((b) => isActive(b)).length;
    const tab = document.createElement("button");
    tab.className = "tab-btn" + (username === selectedUsername ? " active" : "");
    tab.textContent = `${username} (${grouped[username].length}${activeCount > 0 ? `, ${activeCount} aktif` : ""})`;
    tab.addEventListener("click", () => {
      selectedUsername = username;
      renderTabs();
      renderBanList(username);
    });
    tabsEl.appendChild(tab);
  });

  if (usernames.length === 0) {
    tabsEl.innerHTML = "<p>Henüz ceza kaydı yok.</p>";
  }
}

function isActive(ban) {
  if (ban.status !== "active") return false;
  if (!ban.expiresAt) return true;
  const expiresMs = ban.expiresAt.toMillis();
  return expiresMs > Date.now();
}

function formatRemaining(ban) {
  if (!isActive(ban)) return "Süresi doldu";
  const expiresMs = ban.expiresAt.toMillis();
  const diffMin = Math.max(0, Math.round((expiresMs - Date.now()) / 60000));
  const hours = Math.floor(diffMin / 60);
  const minutes = diffMin % 60;
  return hours > 0 ? `${hours} sa ${minutes} dk kaldı` : `${minutes} dk kaldı`;
}

function renderBanList(username) {
  selectedUserTitleEl.textContent = username;
  const userBans = allBans.filter((b) => b.targetUsername === username);

  banListEl.innerHTML = "";
  userBans.forEach((ban) => {
    const row = document.createElement("div");
    row.className = "ban-row" + (isActive(ban) ? " ban-active" : " ban-expired");

    row.innerHTML = `
      <div class="ban-main">
        <strong>${ban.reason}</strong>
        <span>${isActive(ban) ? formatRemaining(ban) : "Geçmiş ceza"}</span>
      </div>
      <div class="ban-meta">
        <span>Steam ID: ${ban.steamId || "-"}</span>
        <span>IP: ${ban.ip || "-"}</span>
        <span>Süre: ${ban.durationMinutes} dk</span>
      </div>
      <label class="applied-toggle">
        <input type="checkbox" ${ban.appliedInGame ? "checked" : ""} data-ban-id="${ban.id}" />
        <span class="applied-text">${ban.appliedInGame ? "Oyuna uyarlanmış" : "Oyuna uyarlanmadı, lütfen uyarlayın"}</span>
      </label>
    `;

    const checkbox = row.querySelector("input[type=checkbox]");
    checkbox.addEventListener("change", async (e) => {
      const applied = e.target.checked;
      checkbox.disabled = true;
      try {
        await updateDoc(doc(db, "bans", ban.id), {
  appliedInGame: applied,
  appliedBy: auth.currentUser.uid,
  appliedAt: serverTimestamp()
});
      } catch (err) {
        alert("Güncellenemedi: " + err.message);
        checkbox.checked = !applied;
      } finally {
        checkbox.disabled = false;
      }
    });

    banListEl.appendChild(row);
  });

  if (userBans.length === 0) {
    banListEl.innerHTML = "<p>Bu kullanıcı için ceza kaydı yok.</p>";
  }
}

// Modal aç/kapat
addBanBtn.addEventListener("click", () => {
  formError.textContent = "";
  addBanForm.reset();
  modal.showModal();
});

closeModalBtn.addEventListener("click", () => modal.close());

addBanForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  formError.textContent = "";

  const targetUsername = document.getElementById("ban-username").value.trim();
  const steamId = document.getElementById("ban-steamid").value.trim();
  const ip = document.getElementById("ban-ip").value.trim();
  const reason = document.getElementById("ban-reason").value.trim();
  const durationMinutes = Number(document.getElementById("ban-duration").value);

  if (!targetUsername || !reason || !durationMinutes) {
    formError.textContent = "Lütfen tüm zorunlu alanları doldurun.";
    return;
  }

  const submitBtn = addBanForm.querySelector("button[type=submit]");
  submitBtn.disabled = true;

  try {
    await addDoc(collection(db, "bans"), {
  targetUsername,
  steamId,
  ip,
  reason,
  durationMinutes,
  issuedBy: auth.currentUser.uid,
  issuedAt: serverTimestamp(),
  expiresAt: new Date(Date.now() + durationMinutes * 60000),
  status: "active",
  appliedInGame: false
});
    selectedUsername = targetUsername;
    modal.close();
  } catch (err) {
    formError.textContent = "Kaydedilemedi: " + err.message;
  } finally {
    submitBtn.disabled = false;
  }
});

// ---------- Oturum Talepleri ----------

function listenToSessionRequests() {
  const q = query(
    collection(db, "sessionRequests"),
    where("status", "==", "pending"),
    orderBy("createdAt", "desc")
  );
  onSnapshot(q, (snapshot) => {
    const requests = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderSessionRequests(requests);
  });
}

function renderSessionRequests(requests) {
  sessionRequestsListEl.innerHTML = requests.length
    ? "" : "<p>Bekleyen oturum talebi yok.</p>";

  requests.forEach((reqData) => {
    const row = document.createElement("div");
    row.className = "request-row";
    row.innerHTML = `
      <div>
        <strong>${reqData.username}</strong> ${reqData.steamId ? `(${reqData.steamId})` : ""}
        <div style="font-size:13px; color:#555;">${reqData.reason}</div>
      </div>
      <div class="request-actions">
        <button data-action="approve">Onayla</button>
        <button data-action="reject">Reddet</button>
      </div>
    `;

    row.querySelector('[data-action="approve"]').addEventListener("click", () => {
      openApproveModal(reqData);
    });

    row.querySelector('[data-action="reject"]').addEventListener("click", async () => {
      if (!confirm(`${reqData.username} adlı talebi reddetmek istediğinize emin misiniz?`)) return;
      try {
        await updateDoc(doc(db, "sessionRequests", reqData.id), {
  status: "rejected",
  handledBy: auth.currentUser.uid,
  handledAt: serverTimestamp()
});
      } catch (err) {
        alert("Reddedilemedi: " + err.message);
      }
    });

    sessionRequestsListEl.appendChild(row);
  });
}

function openApproveModal(reqData) {
  pendingApprovalRequest = reqData;
  approveErrorEl.textContent = "";
  approveForm.reset();
  approveUsernameEl.textContent = `Kullanıcı: ${reqData.username}`;
  approveTierLabel.style.display = "none";
  approveModal.showModal();
}

approveRoleSelect.addEventListener("change", () => {
  approveTierLabel.style.display = approveRoleSelect.value === "member" ? "block" : "none";
});

closeApproveModalBtn.addEventListener("click", () => approveModal.close());

approveForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  approveErrorEl.textContent = "";

  const password = approvePasswordInput.value.trim();
  if (!password) {
    approveErrorEl.textContent = "Geçici şifre girin.";
    return;
  }

  const submitBtn = approveForm.querySelector("button[type=submit]");
  submitBtn.disabled = true;

  try {
const username = pendingApprovalRequest.username;
const email = `${username.toLowerCase()}@scpslpanel.com`;

const secondaryApp = initializeApp(firebaseConfig, "Secondary");

const secondaryAuth = getAuth(secondaryApp);

let uid;

try {
  const newUser = await createUserWithEmailAndPassword(
    secondaryAuth,
    email,
    password
  );

  uid = newUser.user.uid;

} catch (err) {

  if (err.code === "auth/email-already-in-use") {

    // Hesap zaten oluşturulmuşsa tekrar oluşturmaya çalışma
    const existingUser = await getDocs(
      query(
        collection(db, "users"),
        where("email", "==", email)
      )
    );

    if (!existingUser.empty) {
      uid = existingUser.docs[0].id;
    } else {
      throw err;
    }

  } else {
    throw err;
  }
}

await setDoc(doc(db, "users", uid), {
  username: username,
  email: email,
  steamId: pendingApprovalRequest.steamId,
  role: approveRoleSelect.value,
  tier: approveRoleSelect.value === "member"
    ? approveTierSelect.value
    : null,
  createdAt: serverTimestamp()
});

await setDoc(doc(db, "usernames", username.toLowerCase()), {
  email: email
});

alert(
`Hesap oluşturuldu!\n\nKullanıcı adı: ${username}`
);

await updateDoc(doc(db, "sessionRequests", pendingApprovalRequest.id), {
  status: "approved",
  handledBy: auth.currentUser.uid,
  handledAt: serverTimestamp()
});

    approveModal.close();
  } catch (err) {
    approveErrorEl.textContent = "Onaylanamadı: " + err.message;
  } finally {
    submitBtn.disabled = false;
  }
});

// ---------- Ceza İndirimi Talepleri ----------

function listenToDiscountRequests() {
  const q = query(
    collection(db, "discountRequests"),
    where("status", "==", "pending"),
    orderBy("createdAt", "desc")
  );
  onSnapshot(q, (snapshot) => {
    const requests = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderDiscountRequests(requests);
  });
}

function renderDiscountRequests(requests) {
  discountRequestsListEl.innerHTML = requests.length
    ? "" : "<p>Bekleyen ceza indirimi talebi yok.</p>";

  requests.forEach((reqData) => {
    const row = document.createElement("div");
    row.className = "request-row";
    row.innerHTML = `
      <div>
        <strong>${reqData.requestedUsername}</strong> (${reqData.tier})
        <div style="font-size:13px; color:#555;">${reqData.discountHours} saat indirim talep ediyor</div>
      </div>
      <div class="request-actions">
        <button data-action="approve">Onayla</button>
        <button data-action="reject">Reddet</button>
      </div>
    `;

row.querySelector('[data-action="approve"]').addEventListener("click", async () => {
  try {

    const banRef = doc(db, "bans", reqData.banId);
    const banSnap = await getDoc(banRef);

    if (banSnap.exists()) {
      const ban = banSnap.data();

      const newExpires =
        ban.expiresAt.toMillis() -
        (reqData.discountHours * 60 * 60 * 1000);

      await updateDoc(banRef, {
        expiresAt: new Date(newExpires),
        status: newExpires <= Date.now() ? "expired" : "active"
      });
    }

    await updateDoc(doc(db,"discountRequests",reqData.id),{
      status:"approved",
      reviewedBy:auth.currentUser.uid,
      reviewedAt:serverTimestamp()
    });

  } catch (err) {
    alert("Onaylanamadı: " + err.message);
  }
});

    row.querySelector('[data-action="reject"]').addEventListener("click", async () => {
      try {
        await updateDoc(doc(db,"discountRequests",reqData.id),{
  status:"rejected",
  reviewedBy:auth.currentUser.uid,
  reviewedAt:serverTimestamp()
});
      } catch (err) {
        alert("Reddedilemedi: " + err.message);
      }
    });

    discountRequestsListEl.appendChild(row);
  });
}
