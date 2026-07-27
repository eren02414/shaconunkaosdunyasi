import { db } from "./firebaseConfig.js";
import { requireRole, logout } from "./auth.js";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";


const TIER_PERKS = {
  "RP+": ["Özel RP oda erişimi", "Ceza indirimi hakkı", "Öncelikli destek"],
  "Modlu+": ["Ekstra kozmetik eşyalar", "Ceza indirimi hakkı", "Öncelikli destek"],
  "Youtuber": ["İçerik üretici rozeti", "Ceza indirimi hakkı", "Sunucu etkinliklerine erken erişim"],
  "VIP": ["VIP oda erişimi", "Ceza indirimi hakkı", "Öncelikli destek", "Özel isim rengi"]
};

let myBans = [];
let myUser = null;

const tierBadgeEl = document.getElementById("tier-badge");
const tierPerksEl = document.getElementById("tier-perks");
const tierSection = document.getElementById("tier-section");
const banListEl = document.getElementById("my-ban-list");
const tabButtons = document.querySelectorAll(".panel-tab-btn");
const tabPanels = document.querySelectorAll(".panel-tab");
const discountBanSelect = document.getElementById("discount-ban-select");
const discountForm = document.getElementById("discount-form");
const discountError = document.getElementById("discount-error");
const myRequestsEl = document.getElementById("my-discount-requests");

requireRole(["player", "member"], (currentUser) => {
  myUser = currentUser;
  document.getElementById("current-username").textContent = currentUser.username;

  if (currentUser.tier) {
    tierSection.style.display = "block";
    tierBadgeEl.textContent = currentUser.tier;
    tierPerksEl.innerHTML = (TIER_PERKS[currentUser.tier] || [])
      .map((p) => `<li>${p}</li>`)
      .join("");
    document.getElementById("discount-tab-btn").style.display = "inline-block";
  } else {
    tierSection.style.display = "none";
    document.getElementById("discount-tab-btn").style.display = "none";
  }

  listenToMyBans(currentUser.username);
  listenToMyDiscountRequests();
});

document.getElementById("logout-btn").addEventListener("click", async () => {
  await logout();
});

// Sekme geçişleri
tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    tabButtons.forEach((b) => b.classList.remove("active"));
    tabPanels.forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(btn.dataset.tab).classList.add("active");
  });
});

function listenToMyBans(username) {
  const q = query(
    collection(db, "bans"),
    where("targetUsername", "==", username),
    orderBy("issuedAt", "desc")
  );
  onSnapshot(q, (snapshot) => {
    myBans = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderMyBans();
    renderDiscountBanOptions();
  });
}

function isActive(ban) {
  if (ban.status !== "active") return false;
  if (!ban.expiresAt) return true;
  return ban.expiresAt.seconds * 1000 > Date.now();
}

function formatRemaining(ban) {
  if (!isActive(ban)) return "Süresi doldu";
  const diffMin = Math.max(0, Math.round((ban.expiresAt.seconds * 1000 - Date.now()) / 60000));
  const hours = Math.floor(diffMin / 60);
  const minutes = diffMin % 60;
  return hours > 0 ? `${hours} sa ${minutes} dk kaldı` : `${minutes} dk kaldı`;
}

function renderMyBans() {
  banListEl.innerHTML = "";

  if (myBans.length === 0) {
    banListEl.innerHTML = "<p>Herhangi bir cezanız bulunmuyor.</p>";
    return;
  }

  myBans.forEach((ban) => {
    const row = document.createElement("div");
    row.className = "ban-row" + (isActive(ban) ? " ban-active" : " ban-expired");
    row.innerHTML = `
      <div class="ban-main">
        <strong>${ban.reason}</strong>
        <span>${isActive(ban) ? formatRemaining(ban) : "Geçmiş ceza"}</span>
      </div>
      <div class="ban-meta">
        <span>Süre: ${ban.durationMinutes} dk</span>
        <span>${ban.appliedInGame ? "Oyuna uyarlanmış" : "Oyuna uyarlanmadı, lütfen uyarlayın"}</span>
      </div>
    `;
    banListEl.appendChild(row);
  });
}

function renderDiscountBanOptions() {
  if (!discountBanSelect) return;
  const activeBans = myBans.filter((b) => isActive(b));
  discountBanSelect.innerHTML = activeBans.length
    ? activeBans.map((b) => `<option value="${b.id}">${b.reason} — ${formatRemaining(b)}</option>`).join("")
    : `<option value="">Aktif cezanız yok</option>`;
}

function listenToMyDiscountRequests() {
  const q = query(
    collection(db, "discountRequests"),
    where("requestedBy", "==", myUser.uid),
    orderBy("createdAt", "desc")
  );
  onSnapshot(q, (snapshot) => {
    const requests = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    myRequestsEl.innerHTML = requests.length
      ? requests.map((r) => `
          <div class="ban-row">
            <div class="ban-main">
              <span>${r.discountHours} saat indirim talebi</span>
              <span class="status-${r.status}">${statusText(r.status)}</span>
            </div>
          </div>
        `).join("")
      : "<p>Henüz bir indirim talebiniz yok.</p>";
  });
}

function statusText(status) {
  if (status === "approved") return "Onaylandı";
  if (status === "rejected") return "Reddedildi";
  return "Beklemede";
}

if (discountForm) {
  discountForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    discountError.textContent = "";

    const banId = discountBanSelect.value;
    const discountHours = Number(document.getElementById("discount-hours").value);

    if (!banId || !discountHours) {
      discountError.textContent = "Lütfen bir ceza ve süre seçin.";
      return;
    }

    const submitBtn = discountForm.querySelector("button[type=submit]");
    submitBtn.disabled = true;

    try {
await addDoc(collection(db, "discountRequests"), {
  banId,
  requestedBy: myUser.uid,
  requestedUsername: myUser.username,
  tier: myUser.tier,
  discountHours,
  status: "pending",
  createdAt: serverTimestamp()
});
      discountForm.reset();
    } catch (err) {
      discountError.textContent = "Gönderilemedi: " + err.message;
    } finally {
      submitBtn.disabled = false;
    }
  });
}
