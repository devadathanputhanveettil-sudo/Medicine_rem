const $ = (id) => document.getElementById(id);
let token = localStorage.getItem("medireminder_token") || "";
let currentUser = null;
let medicines = [];
let logs = [];
let authMode = "login";
let activePage = "dashboard";
const notifiedToday = new Set();

function api(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(`/api${path}`, { ...options, headers }).then(async response => {
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401 && token) logout(false);
      throw new Error(data.error || "Something went wrong.");
    }
    return data;
  });
}
function toast(message, bad = false) {
  const node = $("toast");
  node.textContent = message;
  node.className = "toast show" + (bad ? " bad" : "");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => node.className = "toast", 3200);
}
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[char]));
}
function prettyTime(time) {
  if (!time) return "Time not set";
  const [h, m] = time.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function switchAuth(mode) {
  authMode = mode;
  $("loginTab").classList.toggle("active", mode === "login");
  $("registerTab").classList.toggle("active", mode === "register");
  $("nameField").classList.toggle("hidden", mode !== "register");
  $("authName").required = mode === "register";
  $("authPassword").autocomplete = mode === "login" ? "current-password" : "new-password";
  $("authSubmit").textContent = mode === "login" ? "Log in" : "Create account";
  $("authError").textContent = "";
}
$("loginTab").addEventListener("click", () => switchAuth("login"));
$("registerTab").addEventListener("click", () => switchAuth("register"));

$("authForm").addEventListener("submit", async event => {
  event.preventDefault();
  $("authError").textContent = "";
  $("authSubmit").disabled = true;
  try {
    const payload = {
      name: $("authName").value.trim(),
      email: $("authEmail").value.trim(),
      password: $("authPassword").value
    };
    const result = await api(authMode === "login" ? "/login" : "/register", {
      method: "POST", body: JSON.stringify(payload)
    });
    token = result.token;
    currentUser = result.user;
    localStorage.setItem("medireminder_token", token);
    $("authPassword").value = "";
    await enterApp();
  } catch (error) {
    $("authError").textContent = error.message;
  } finally {
    $("authSubmit").disabled = false;
  }
});

async function enterApp() {
  $("authView").classList.add("hidden");
  $("appView").classList.remove("hidden");
  $("userName").textContent = currentUser.name;
  $("userEmail").textContent = currentUser.email;
  $("userAvatar").textContent = currentUser.name.slice(0, 1).toUpperCase();
  $("welcomeText").textContent = `Welcome back, ${currentUser.name.split(" ")[0]}!`;
  $("todayLabel").textContent = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }).toUpperCase();
  await refreshData();
  showPage("dashboard");
}
async function refreshData() {
  const [medData, logData] = await Promise.all([api("/medicines"), api("/logs")]);
  medicines = medData.medicines;
  logs = logData.logs;
  renderAll();
}
function showPage(page) {
  activePage = page;
  ["dashboard", "medicines", "history"].forEach(name => {
    $(`${name}Page`).classList.toggle("hidden", name !== page);
  });
  document.querySelectorAll(".nav-item").forEach(btn => btn.classList.toggle("active", btn.dataset.page === page));
  $("pageTitle").textContent = ({dashboard:"Dashboard",medicines:"My medicines",history:"Dose history"})[page];
}
document.querySelectorAll(".nav-item").forEach(btn => btn.addEventListener("click", () => showPage(btn.dataset.page)));
$("logoutBtn").addEventListener("click", () => logout(true));
function logout(showMessage = true) {
  token = ""; currentUser = null; medicines = []; logs = [];
  localStorage.removeItem("medireminder_token");
  $("appView").classList.add("hidden");
  $("authView").classList.remove("hidden");
  if (showMessage) toast("You have logged out.");
}
function renderAll() {
  $("totalCount").textContent = medicines.length;
  $("reminderCount").textContent = medicines.length;
  $("takenCount").textContent = logs.filter(l => l.status === "taken" && l.date === today()).length;
  renderMedicines($("scheduleList"), medicines);
  renderMedicines($("allMedicines"), medicines);
  renderHistory();
}
function renderMedicines(container, list) {
  if (!list.length) {
    container.innerHTML = `<div class="empty-state"><strong>No medicines added yet</strong>Add a medicine to start building your daily schedule.</div>`;
    return;
  }
  container.innerHTML = list.map(m => `
    <article class="medicine-card">
      <div class="med-symbol">✚</div>
      <div class="med-info">
        <h3>${escapeHtml(m.name)}</h3>
        <p>${escapeHtml(m.dosage)}${m.instructions ? " · " + escapeHtml(m.instructions) : ""}</p>
        <div class="med-meta">${m.refillDate ? "Refill date: " + escapeHtml(m.refillDate) : "No refill date set"}</div>
      </div>
      <div class="med-time">${escapeHtml(prettyTime(m.time))}</div>
      <div class="med-actions">
        <button class="small-btn taken" data-action="taken" data-id="${m.id}">✓ Taken</button>
        <button class="small-btn missed" data-action="missed" data-id="${m.id}">Mark missed</button>
        <button class="small-btn" data-action="edit" data-id="${m.id}">Edit</button>
        <button class="small-btn" data-action="delete" data-id="${m.id}">Delete</button>
      </div>
    </article>`).join("");
}
function renderHistory() {
  if (!logs.length) {
    $("historyRows").innerHTML = `<tr><td colspan="4"><div class="empty-state">No dose history yet. Use “Taken” or “Mark missed” on a medicine.</div></td></tr>`;
    return;
  }
  $("historyRows").innerHTML = logs.map(log => `
    <tr>
      <td><strong>${escapeHtml(log.medicineName)}</strong><br><span class="muted">${escapeHtml(log.dosage)}</span></td>
      <td>${escapeHtml(log.date)}</td>
      <td>${new Date(log.recordedAt).toLocaleString()}</td>
      <td><span class="status ${log.status}">${log.status === "taken" ? "Taken" : "Missed"}</span></td>
    </tr>`).join("");
}
$("scheduleList").addEventListener("click", handleMedicineAction);
$("allMedicines").addEventListener("click", handleMedicineAction);
async function handleMedicineAction(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const { action, id } = button.dataset;
  const medicine = medicines.find(m => m.id === id);
  if (!medicine) return;
  try {
    if (action === "taken" || action === "missed") {
      await api("/logs", { method: "POST", body: JSON.stringify({ medicineId: id, status: action, date: today() }) });
      await refreshData();
      toast(action === "taken" ? "Dose recorded as taken." : "Dose recorded as missed.");
    } else if (action === "edit") {
      openMedicineModal(medicine);
    } else if (action === "delete") {
      if (!confirm(`Delete ${medicine.name} from your list?`)) return;
      await api(`/medicines/${id}`, { method: "DELETE" });
      await refreshData();
      toast("Medicine deleted.");
    }
  } catch (error) { toast(error.message, true); }
}
function openMedicineModal(medicine = null) {
  $("medicineForm").reset();
  $("medicineError").textContent = "";
  $("medicineId").value = medicine ? medicine.id : "";
  $("modalTitle").textContent = medicine ? "Edit medicine" : "Add medicine";
  $("medicineName").value = medicine?.name || "";
  $("dosage").value = medicine?.dosage || "";
  $("medicineTime").value = medicine?.time || "09:00";
  $("instructions").value = medicine?.instructions || "";
  $("refillDate").value = medicine?.refillDate || "";
  $("medicineModal").classList.remove("hidden");
  $("medicineName").focus();
}
function closeMedicineModal() { $("medicineModal").classList.add("hidden"); }
$("addMedicineBtn").addEventListener("click", () => openMedicineModal());
$("addFromDashboard").addEventListener("click", () => openMedicineModal());
$("closeModal").addEventListener("click", closeMedicineModal);
$("cancelModal").addEventListener("click", closeMedicineModal);
$("medicineModal").addEventListener("click", event => { if (event.target === $("medicineModal")) closeMedicineModal(); });
$("medicineForm").addEventListener("submit", async event => {
  event.preventDefault();
  $("medicineError").textContent = "";
  const id = $("medicineId").value;
  const payload = {
    name: $("medicineName").value.trim(),
    dosage: $("dosage").value.trim(),
    time: $("medicineTime").value,
    instructions: $("instructions").value.trim(),
    refillDate: $("refillDate").value
  };
  try {
    await api(id ? `/medicines/${id}` : "/medicines", { method: id ? "PUT" : "POST", body: JSON.stringify(payload) });
    closeMedicineModal();
    await refreshData();
    toast(id ? "Medicine updated." : "Medicine added.");
  } catch (error) { $("medicineError").textContent = error.message; }
});

$("notificationBtn").addEventListener("click", async () => {
  if (!("Notification" in window)) return toast("This browser does not support notifications.", true);
  const permission = await Notification.requestPermission();
  if (permission === "granted") {
    toast("Notifications enabled. Keep this page open for reminder alerts.");
    $("notificationBtn").textContent = "✓ Notifications enabled";
    checkReminders();
  } else toast("Notification permission was not granted.", true);
});
function checkReminders() {
  if (!token || !("Notification" in window) || Notification.permission !== "granted") return;
  const now = new Date();
  const hhmm = `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
  medicines.forEach(m => {
    const key = `${today()}-${m.id}-${hhmm}`;
    if (m.time === hhmm && !notifiedToday.has(key)) {
      notifiedToday.add(key);
      new Notification("MediReminder: scheduled dose", { body: `${m.name} — ${m.dosage}. Check your prescription instructions.` });
    }
  });
}
setInterval(checkReminders, 15000);

(async function init() {
  try {
    if (token) {
      const result = await api("/me");
      currentUser = result.user;
      await enterApp();
    }
  } catch (error) {
    console.warn("Session could not be restored:", error.message);
  }
})();
