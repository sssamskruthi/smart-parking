// ==========================================================
// 🌐 SMART PARKING SYSTEM - FRONTEND SCRIPT (Render FIXED)
// ==========================================================

// IMPORTANT FIX FOR RENDER
const apiBase = "";

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

  } catch (err) {
    alert(err.message);
  }

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

  } catch (err) {
    alert(err.message);
  }

}


// ==========================================================
// 🚘 VEHICLE
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
      body: JSON.stringify({
        username: user,
        vehicles,
        slot_limit: slotLimit
      }),
    });

    const data = await res.json();

    if (!res.ok) throw new Error(data.message);

    alert("Vehicle saved!");
    window.location.href = "/dashboard";

  } catch (err) {
    alert(err.message);
  }

}


// ==========================================================
// 🚗 SLOTS
// ==========================================================

async function fetchSlots() {

  const res = await fetch(`${apiBase}/slots`);
  const slots = await res.json();

  const container = document.getElementById("slots");

  if (!container) return;

  container.innerHTML = "";

  slots.forEach((slot) => {

    const div = document.createElement("div");

    div.className = slot.booked ? "slot booked" : "slot available";

    div.innerText = "Slot " + slot.id;

    div.onclick = () => {
      if (slot.booked) releaseSlot(slot.id);
      else bookSlot(slot.id);
    };

    container.appendChild(div);

  });

}


async function bookSlot(id) {

  const username = getUser();

  const res = await fetch(`${apiBase}/book/${id}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username }),
  });

  const data = await res.json();

  if (!res.ok) return alert(data.message);

  fetchSlots();
  fetchChain();

}


// ==========================================================
// 💳 RELEASE
// ==========================================================

async function releaseSlot(id) {

  const username = getUser();

  const billRes = await fetch(
    `${apiBase}/calculate_bill/${id}?username=${username}`
  );

  const billData = await billRes.json();

  const expected = billData.expected;

  const payRes = await fetch(`${apiBase}/release/${id}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username,
      paid: expected,
    }),
  });

  const payData = await payRes.json();

  alert(payData.message);

  fetchSlots();
  fetchChain();

}


// ==========================================================
// ⛓ BLOCKCHAIN
// ==========================================================

async function fetchChain() {

  const res = await fetch(`${apiBase}/chain`);
  const chain = await res.json();

  const ledger = document.getElementById("ledger");

  if (!ledger) return;

  ledger.innerHTML = "";

  chain.reverse().forEach((b) => {

    const div = document.createElement("div");
    div.innerText = b.data;

    ledger.appendChild(div);

  });

}


// ==========================================================
// EVENTS
// ==========================================================

document.addEventListener("DOMContentLoaded", () => {

  document.getElementById("login-btn")?.addEventListener("click", loginUser);
  document.getElementById("register-btn")?.addEventListener("click", registerUser);
  document.getElementById("save-vehicle")?.addEventListener("click", saveVehicle);
  document.getElementById("refresh-slots")?.addEventListener("click", fetchSlots);
  document.getElementById("view-ledger")?.addEventListener("click", fetchChain);

  if (document.getElementById("slots")) {
    fetchSlots();
  }

});