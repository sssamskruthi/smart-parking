from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

# ==========================================================
# ⚙️ INITIALIZE DATABASE
# ==========================================================
db = SQLAlchemy()


# ==========================================================
# 🚗 PARKING SLOT MODEL
# ==========================================================
class ParkingSlot(db.Model):
    __tablename__ = "parking_slot"

    id = db.Column(db.Integer, primary_key=True)
    booked = db.Column(db.Boolean, default=False)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=True)
    booked_at = db.Column(db.DateTime, nullable=True)
    released_at = db.Column(db.DateTime, nullable=True)

    def to_dict(self):
        """Convert parking slot to dictionary for JSON responses."""
        return {
            "id": self.id,
            "booked": self.booked,
            "user_id": self.user_id,
            "username": self.user.username if self.user else None,
            "booked_at": self.booked_at.strftime("%Y-%m-%d %H:%M:%S") if self.booked_at else None,
            "released_at": self.released_at.strftime("%Y-%m-%d %H:%M:%S") if self.released_at else None,
        }

    def __repr__(self):
        return f"<ParkingSlot id={self.id} booked={self.booked}>"


# ==========================================================
# 👤 USER MODEL
# ==========================================================
class User(db.Model):
    __tablename__ = "user"

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password = db.Column(db.String(120), nullable=False)
    slots = db.relationship("ParkingSlot", backref="user", lazy=True)

    def __repr__(self):
        return f"<User username={self.username}>"
