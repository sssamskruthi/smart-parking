// ==========================================================
// 🌐 SMART PARKING SYSTEM - FRONTEND SCRIPT (Multi Vehicle + Multi Payment)
// ==========================================================

const apiBase = "http://127.0.0.1:5000";

// ==========================================================
// 🔐 USER SESSION MANAGEMENT
// ==========================================================
function saveUser(username) { localStorage.setItem("currentUser", username); }
function getUser() { return localStorage.getItem("currentUser"); }
function clearUser() { localStorage.removeItem("currentUser"); }

// ==========================================================
// 🔐 LOGIN & REGISTER
// ==========================================================
async function loginUser() {
  const username = document.getElementById("username")?.value.trim();
  const password = document.getElementById("password")?.value.trim();

  if (!username || !password) return alert("⚠️ Enter username & password!");

  try {
    const res = await fetch(`${apiBase}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message);

    saveUser(username);
    window.location.href = "/vehicle_form";

  } catch (err) { alert(err.message); }
}

async function registerUser() {
  const username = document.getElementById("username")?.value.trim();
  const password = document.getElementById("password")?.value.trim();

  if (!username || !password) return alert("⚠️ Enter username & password!");

  try {
    const res = await fetch(`${apiBase}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message);

    saveUser(username);
    window.location.href = "/vehicle_form";

  } catch (err) { alert(err.message); }
}

// ==========================================================
// 🚘 MULTI VEHICLE ENTRY + SLOT LIMIT
// ==========================================================
async function saveVehicle() {
  const user = getUser();
  if (!user) return window.location.href = "/";

  const count = parseInt(document.getElementById("vehicle-count")?.value);
  const slotLimit = parseInt(document.getElementById("slot-limit")?.value);

  if (!count) return alert("Enter number of vehicles!");
  if (!slotLimit) return alert("Enter required slots!");
  if (slotLimit > count) return alert("Slot limit cannot exceed number of vehicles!");

  const vehicles = [];

  for (let i = 1; i <= count; i++) {
    const plate = document.getElementById(`plate-${i}`)?.value.trim();
    const vtype = document.getElementById(`vtype-${i}`)?.value;

    if (!plate) return alert(`Enter number for Vehicle ${i}`);
    vehicles.push({ plate, vtype });
  }

  try {
    const res = await fetch(`${apiBase}/set_vehicle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: user, vehicles, slot_limit: slotLimit }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message);

    alert("Vehicle details saved!");
    window.location.href = "/dashboard";

  } catch (err) { alert(err.message); }
}

// ==========================================================
// 🚗 SLOT SYSTEM
// ==========================================================
async function fetchSlots() {
  try {
    const res = await fetch(`${apiBase}/slots`);
    const slots = await res.json();

    const container = document.getElementById("slots");
    if (!container) return;
    container.innerHTML = "";

    slots.forEach((slot) => {
      const div = document.createElement("div");
      div.classList.add("slot", slot.booked ? "booked" : "available");
      div.innerHTML = `🚗 Slot ${slot.id}`;

      div.onclick = () => {
        if (slot.booked) releaseSlot(slot.id);
        else bookSlot(slot.id);
      };

      container.appendChild(div);
    });

  } catch (err) {
    alert("Error loading slots!");
  }
}

async function bookSlot(id) {
  const username = getUser();
  if (!username) return alert("Login first!");

  try {
    const res = await fetch(`${apiBase}/book/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message);

    fetchSlots();
    fetchChain();

  } catch (err) { alert(err.message); }
}

// ==========================================================
// 💳 RELEASE SLOT + MULTI PAYMENT GATEWAY
// ==========================================================
async function releaseSlot(id) {
  const username = getUser();
  if (!username) return alert("Login first!");

  try {
    const res = await fetch(`${apiBase}/calculate_bill/${id}?username=${username}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);

    const expected = data.expected;

    showPaymentModal(expected, async () => {
      const payRes = await fetch(`${apiBase}/release/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, paid: expected }),
      });

      const payData = await payRes.json();
      if (!payRes.ok) throw new Error(payData.message);

      alert(payData.message);
      fetchSlots();
      fetchChain();
    });

  } catch (err) { alert(err.message); }
}

// ==========================================================
// 💰 MULTI-PAYMENT MODAL (UPI + CARD + QR)
// ==========================================================
function showPaymentModal(amount, onConfirm) {
  const modal = document.createElement("div");
  modal.className = "payment-modal";

  modal.innerHTML = `
    <div class="payment-box">
        <h2>💳 Payment Gateway</h2>
        <p class="amount-text">Total Amount: <strong>₹${amount}</strong></p>

        <div id="payment-methods">
            <button class="pay-option" onclick="showUPIForm(${amount})">📱 UPI</button>
            <button class="pay-option" onclick="showCardForm(${amount})">💳 Card</button>
            <button class="pay-option" onclick="showQRForm(${amount})">🟦 QR Code</button>
            <button class="cancel-btn" onclick="closePaymentModal()">Cancel</button>
        </div>

        <div id="payment-form"></div>
    </div>
  `;

  document.body.appendChild(modal);
  setTimeout(() => modal.classList.add("show"), 10);

  window.paymentSuccessCallback = onConfirm;
}

// ==========================================================
// 📱 UPI PAYMENT
// ==========================================================
function showUPIForm(amount) {
  document.getElementById("payment-form").innerHTML = `
    <h3>📱 UPI Payment</h3>
    <input type="text" id="upi-id" placeholder="example@upi">
    <button class="pay-btn" onclick="processUPI(${amount})">Pay ₹${amount}</button>
    <button class="back-btn" onclick="resetPaymentBox()">⬅ Back</button>
  `;
}

function processUPI(amount) {
  const upi = document.getElementById("upi-id").value.trim();
  if (!upi.includes("@")) return alert("Enter valid UPI ID!");

  alert("📲 Request sent to UPI app...");
  setTimeout(() => {
    paymentSuccessCallback(amount);
    closePaymentModal();
    alert("✅ UPI Payment Successful!");
  }, 1500);
}

// ==========================================================
// 💳 FIXED CARD PAYMENT  ✔✔✔
// ==========================================================
function showCardForm(amount) {
  document.getElementById("payment-form").innerHTML = `
    <h3>💳 Card Payment</h3>
    <input id="cardName" placeholder="Name on Card">
    <input id="cardNumber" maxlength="16" placeholder="Card Number (16 digits)">
    
    <div class="inline-fields">
        <input id="expiry" maxlength="5" placeholder="MM/YY">
        <input id="cvv" maxlength="3" placeholder="CVV">
    </div>

    <button class="pay-btn" onclick="processCard(${amount})">Pay ₹${amount}</button>
    <button class="back-btn" onclick="resetPaymentBox()">⬅ Back</button>
  `;
}

function processCard(amount) {
  const name = document.getElementById("cardName").value.trim();
  const num  = document.getElementById("cardNumber").value.trim();
  const exp  = document.getElementById("expiry").value.trim();
  const cv   = document.getElementById("cvv").value.trim();

  if (!name || num.length !== 16 || exp.length !== 5 || cv.length !== 3)
    return alert("Enter valid card details!");

  alert("💳 Processing Payment...");

  setTimeout(() => {
    paymentSuccessCallback(amount);
    closePaymentModal();
    alert("✅ Card Payment Successful!");
  }, 1500);
}

// ==========================================================
// 🟦 QR PAYMENT
// ==========================================================
function showQRForm(amount) {
  document.getElementById("payment-form").innerHTML = `
    <h3>🟦 Scan QR Code</h3>
    <img class="qr-img" src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=PAY₹${amount}">
    <p>Scan using any UPI app</p>

    <button class="pay-btn" onclick="processQR(${amount})">I have paid</button>
    <button class="back-btn" onclick="resetPaymentBox()">⬅ Back</button>
  `;
}

function processQR(amount) {
  alert("⏳ Verifying...");
  setTimeout(() => {
    paymentSuccessCallback(amount);
    closePaymentModal();
    alert("✅ QR Payment Successful!");
  }, 1500);
}

// ==========================================================
// 🔄 RESET PAYMENT BOX
// ==========================================================
function resetPaymentBox() {
  document.getElementById("payment-form").innerHTML = "";
}

// ==========================================================
// ❌ CLOSE PAYMENT MODAL
// ==========================================================
function closePaymentModal() {
  const modal = document.querySelector(".payment-modal");
  if (modal) {
    modal.classList.remove("show");
    setTimeout(() => modal.remove(), 200);
  }
}

// ==========================================================
// ⛓ BLOCKCHAIN LEDGER
// ==========================================================
async function fetchChain() {
  try {
    const res = await fetch(`${apiBase}/chain`);
    const chain = await res.json();

    const ledger = document.getElementById("ledger");
    if (!ledger) return;

    ledger.innerHTML = "";
    chain.slice().reverse().forEach((block) => {
      const div = document.createElement("div");
      div.classList.add("ledger-entry");
      div.innerHTML = block.data;
      ledger.appendChild(div);
    });

  } catch (err) { console.error(err); }
}

// ==========================================================
// ⚙ EVENT LISTENERS
// ==========================================================
document.addEventListener("DOMContentLoaded", () => {

  const loginBtn = document.getElementById("login-btn");
  const registerBtn = document.getElementById("register-btn");
  const saveVehicleBtn = document.getElementById("save-vehicle");
  const refreshSlots = document.getElementById("refresh-slots");
  const viewLedger = document.getElementById("view-ledger");

  if (loginBtn) loginBtn.onclick = loginUser;
  if (registerBtn) registerBtn.onclick = registerUser;
  if (saveVehicleBtn) saveVehicleBtn.onclick = saveVehicle;
  if (refreshSlots) refreshSlots.onclick = fetchSlots;
  if (viewLedger) viewLedger.onclick = fetchChain;

  if (document.getElementById("slots")) fetchSlots();
});
