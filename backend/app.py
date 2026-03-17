# app.py
from flask import Flask, jsonify, request, render_template
from flask_cors import CORS
from datetime import datetime
import hashlib
import math
import json
import os

app = Flask(__name__)
CORS(app)

# -------------------------
# Config
# -------------------------
CHAIN_FILE = "chain.json"   # persisted chain
PARKING_RATE = 10.0         # rupees per hour (adjustable)
MINIMUM_CHARGE = 1.0        # minimum charge in rupees
SLOT_COUNT = 15

# -------------------------
# Block & Blockchain
# -------------------------
class Block:
    def __init__(self, index: int, timestamp: str, data: str, previous_hash: str, hash_value: str = None):
        self.index = index
        self.timestamp = timestamp  # ISO formatted string
        self.data = data
        self.previous_hash = previous_hash
        # If hash_value provided (loading from disk), use it; else calculate
        self.hash = hash_value if hash_value else self.calculate_hash()

    def calculate_hash(self) -> str:
        """
        Calculate SHA256 hash of the block contents (deterministic).
        """
        text = f"{self.index}|{self.timestamp}|{self.data}|{self.previous_hash}"
        return hashlib.sha256(text.encode("utf-8")).hexdigest()

    def to_dict(self):
        return {
            "index": self.index,
            "timestamp": self.timestamp,
            "data": self.data,
            "previous_hash": self.previous_hash,
            "hash": self.hash,
        }

    @classmethod
    def from_dict(cls, d):
        return cls(index=d["index"], timestamp=d["timestamp"], data=d["data"],
                   previous_hash=d["previous_hash"], hash_value=d.get("hash"))

class Blockchain:
    def __init__(self):
        self.chain = []
        # try to load persisted chain; else create genesis
        if os.path.exists(CHAIN_FILE):
            try:
                self.load_chain()
            except Exception as e:
                print("Failed to load chain.json — creating a fresh genesis block. Error:", e)
                self.create_genesis_block()
                self.save_chain()
        else:
            self.create_genesis_block()
            self.save_chain()

    def create_genesis_block(self):
        genesis = Block(0, datetime.now().strftime("%Y-%m-%d %H:%M:%S"), "🚀 Genesis Block", "0")
        # ensure correct hash
        genesis.hash = genesis.calculate_hash()
        self.chain = [genesis]

    def add_block(self, data: str):
        prev = self.chain[-1]
        new_index = prev.index + 1
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        new_block = Block(new_index, timestamp, data, prev.hash)
        new_block.hash = new_block.calculate_hash()
        self.chain.append(new_block)
        self.save_chain()
        return new_block

    def get_chain(self):
        return [b.to_dict() for b in self.chain]

    def is_valid(self):
        """
        Validates the chain:
        - Each block's stored hash equals recalculated hash
        - Each block's previous_hash equals previous block's hash
        Returns (True, None) if valid; else (False, {index, reason})
        """
        for i in range(1, len(self.chain)):
            curr = self.chain[i]
            prev = self.chain[i - 1]
            # recompute hash
            if curr.hash != curr.calculate_hash():
                return False, {"index": i, "reason": "Invalid hash (tampered data?)"}
            if curr.previous_hash != prev.hash:
                return False, {"index": i, "reason": "Previous hash mismatch (chain broken)"}
        return True, None

    def save_chain(self):
        """
        Persist chain to CHAIN_FILE as JSON.
        """
        with open(CHAIN_FILE, "w", encoding="utf-8") as f:
            json.dump(self.get_chain(), f, indent=2)

    def load_chain(self):
        """
        Load chain from CHAIN_FILE and reconstruct Block objects.
        """
        with open(CHAIN_FILE, "r", encoding="utf-8") as f:
            raw = json.load(f)
        loaded = []
        for item in raw:
            b = Block.from_dict(item)
            # if hash missing or inconsistent, recalc (but we will check validity after loading)
            if not b.hash:
                b.hash = b.calculate_hash()
            loaded.append(b)
        self.chain = loaded

# instantiate blockchain
blockchain = Blockchain()

# -------------------------
# Parking state
# -------------------------
SLOTS = [
    {"id": i, "booked": False, "user": None, "start_time": None, "end_time": None}
    for i in range(1, SLOT_COUNT + 1)
]

users = {}      # username -> password (in-memory)
vehicles = {}   # username -> {vehicles: [...], slot_limit: n}

# -------------------------
# Helpers
# -------------------------
def compute_bill_minutes(start_iso: str, end_iso: str):
    fmt = "%Y-%m-%d %H:%M:%S"
    start = datetime.strptime(start_iso, fmt)
    end = datetime.strptime(end_iso, fmt)
    seconds = (end - start).total_seconds()
    minutes = max(1, math.ceil(seconds / 60.0))
    price_per_min = PARKING_RATE / 60.0
    bill = round(minutes * price_per_min, 2)
    # enforce minimum charge
    if bill < MINIMUM_CHARGE:
        bill = MINIMUM_CHARGE
    return minutes, bill

# -------------------------
# Routes - Auth & user
# -------------------------
@app.route("/register", methods=["POST"])
def register():
    data = request.json or {}
    username = data.get("username", "").strip()
    password = data.get("password", "").strip()
    if not username or not password:
        return jsonify({"message": "Provide username and password"}), 400
    if username in users:
        return jsonify({"message": "Username already exists"}), 400
    users[username] = password
    blockchain.add_block(f"👤 New user registered: {username}")
    return jsonify({"message": "Registration successful!"})

@app.route("/login", methods=["POST"])
def login():
    data = request.json or {}
    username = data.get("username", "").strip()
    password = data.get("password", "").strip()
    if users.get(username) == password:
        blockchain.add_block(f"🔐 {username} logged in.")
        return jsonify({"message": "Login successful!"})
    return jsonify({"message": "Invalid username/password"}), 401

# -------------------------
# Vehicle details
# -------------------------
@app.route("/set_vehicle", methods=["POST"])
def set_vehicle():
    data = request.json or {}
    username = data.get("username")
    # Accept two formats for compatibility:
    # - older apps: plate & vtype (single vehicle)
    # - newer multi: vehicles (list) and slot_limit
    if not username:
        return jsonify({"message": "Provide username"}), 400

    # multi-vehicle JSON (preferred)
    if isinstance(data.get("vehicles"), list):
        vehicles_list = data.get("vehicles")
        slot_limit = int(data.get("slot_limit") or len(vehicles_list))
        # validate
        if slot_limit > len(vehicles_list):
            return jsonify({"message": "slot_limit cannot exceed number of vehicles"}), 400
        vehicles[username] = {"vehicles": vehicles_list, "slot_limit": slot_limit}
        blockchain.add_block(f"🚗 {username} registered {len(vehicles_list)} vehicle(s), slot limit = {slot_limit}")
        return jsonify({"message": "Vehicle(s) saved"})
    # fallback single vehicle format
    plate = data.get("plate")
    vtype = data.get("vtype")
    if plate and vtype:
        vehicles[username] = {"vehicles": [{"plate": plate, "type": vtype}], "slot_limit": 1}
        blockchain.add_block(f"🚗 {username} saved vehicle: {plate} ({vtype})")
        return jsonify({"message": "Vehicle saved"})
    return jsonify({"message": "Provide vehicle details"}), 400

# -------------------------
# Slots endpoints
# -------------------------
@app.route("/slots", methods=["GET"])
def get_slots():
    return jsonify(SLOTS)

@app.route("/book/<int:slot_id>", methods=["POST"])
def book_slot(slot_id):
    data = request.json or {}
    username = data.get("username")
    if not username:
        return jsonify({"message": "Provide username"}), 400
    # enforce user's slot_limit (if registered)
    user_info = vehicles.get(username)
    if user_info:
        # count how many slots currently booked by this user
        booked_by_user = sum(1 for s in SLOTS if s["booked"] and s["user"] == username)
        if booked_by_user >= user_info.get("slot_limit", len(user_info.get("vehicles", []))):
            return jsonify({"message": "Slot booking limit reached for your account"}), 403

    for s in SLOTS:
        if s["id"] == slot_id:
            if s["booked"]:
                return jsonify({"message": f"Slot {slot_id} already booked"}), 400
            s["booked"] = True
            s["user"] = username
            s["start_time"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            s["end_time"] = None
            blockchain.add_block(f"🅿️ {username} booked Slot {slot_id} at {s['start_time']}")
            return jsonify({"message": f"Slot {slot_id} booked"})
    return jsonify({"message": "Slot not found"}), 404

@app.route("/calculate_bill/<int:slot_id>", methods=["GET"])
def calculate_bill(slot_id):
    username = request.args.get("username")
    for s in SLOTS:
        if s["id"] == slot_id:
            if not s["booked"]:
                return jsonify({"message": "Slot not booked"}), 400
            if s["user"] != username:
                return jsonify({"message": "You do not own this booking"}), 403
            end_iso = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            minutes, bill = compute_bill_minutes(s["start_time"], end_iso)
            return jsonify({"minutes": minutes, "expected": bill})
    return jsonify({"message": "Slot not found"}), 404

@app.route("/release/<int:slot_id>", methods=["POST"])
def release_slot(slot_id):
    data = request.json or {}
    username = data.get("username")
    paid = data.get("paid", None)  # client sends paid amount

    if username is None:
        return jsonify({"message": "Provide username"}), 400

    for s in SLOTS:
        if s["id"] == slot_id:
            if not s["booked"]:
                return jsonify({"message": "Slot not booked"}), 400
            if s["user"] != username:
                return jsonify({"message": f"🚫 You cannot release this slot — it belongs to {s['user']}!"}), 403

            s["end_time"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            minutes, bill = compute_bill_minutes(s["start_time"], s["end_time"])

            # If client hasn't sent a 'paid' amount, return 402 with expected amount (like "payment required")
            if paid is None:
                return jsonify({"message": "Payment required", "amount_due": bill}), 402

            try:
                paid_val = float(paid)
            except Exception:
                return jsonify({"message": "Provide a numeric paid amount", "expected": bill}), 400

            if paid_val + 1e-9 < bill:
                return jsonify({"message": f"Incorrect payment amount! Expected ₹{bill}.", "expected": bill}), 400

            # success -> release slot
            username_released = s["user"]
            s["booked"] = False
            s["user"] = None
            s["start_time"] = None
            s["end_time"] = None
            blockchain.add_block(f"💰 {username_released} released Slot {slot_id}. Duration: {minutes} min, Paid ₹{paid_val}")
            return jsonify({"message": f"Slot {slot_id} released. Bill: ₹{bill} ({minutes} min). Paid: ₹{paid_val}"})
    return jsonify({"message": "Slot not found"}), 404

# -------------------------
# Blockchain endpoints
# -------------------------
@app.route("/chain", methods=["GET"])
def get_chain():
    return jsonify(blockchain.get_chain())

@app.route("/validate_chain", methods=["GET"])
def validate_chain():
    valid, info = blockchain.is_valid()
    if valid:
        return jsonify({"valid": True, "message": "Chain is valid"})
    else:
        return jsonify({"valid": False, "error": info}), 500

# -------------------------
# Frontend routes (templates)
# -------------------------
@app.route("/")
def index():
    return render_template("login.html")

@app.route("/register_page")
def register_page():
    return render_template("register.html")

@app.route("/vehicle_form")
def vehicle_form():
    return render_template("vehicle_form.html")

@app.route("/dashboard")
def dashboard():
    return render_template("dashboard.html")

# -------------------------
# Run
# -------------------------
if __name__ == "__main__":
    # create chain file if doesn't exist (blockchain constructor already does)
    app.run(debug=True)
