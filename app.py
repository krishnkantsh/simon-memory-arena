import os
import re
from flask import Flask, render_template, request, jsonify, session
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError

app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET_KEY", "local-development-key-change-me")

database_url = os.environ.get("DATABASE_URL", "").strip()
if database_url.startswith("postgres://"):
    database_url = database_url.replace("postgres://", "postgresql://", 1)

if database_url:
    # Azure PostgreSQL connection strings may use postgres:// or postgresql://.
    app.config["SQLALCHEMY_DATABASE_URI"] = database_url
else:
    # Local testing fallback. For Azure persistence across restarts, configure DATABASE_URL.
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///simon_arena.db"

app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
db = SQLAlchemy(app)


class Player(db.Model):
    __tablename__ = "players"
    id = db.Column(db.String(18), primary_key=True)  # game ID, uppercase
    name = db.Column(db.String(20), nullable=False)
    best_score = db.Column(db.Integer, nullable=False, default=0)
    last_score = db.Column(db.Integer, nullable=False, default=0)


with app.app_context():
    db.create_all()


def clean_player_id(value):
    value = (value or "").strip().upper()
    if not re.fullmatch(r"[A-Z0-9_]{3,18}", value):
        return None
    return value


@app.get("/")
def index():
    return render_template("index.html")


@app.post("/api/register")
def register():
    payload = request.get_json(silent=True) or {}
    player_id = clean_player_id(payload.get("id"))
    name = (payload.get("name") or "").strip()
    if not player_id:
        return jsonify(error="Use 3–18 letters, numbers, or underscores for your game ID."), 400
    if not name or len(name) > 20:
        return jsonify(error="Enter a display name of 1–20 characters."), 400
    if db.session.get(Player, player_id):
        return jsonify(error="That game ID already exists. Choose another or sign in with your existing ID."), 409
    player = Player(id=player_id, name=name)
    db.session.add(player)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify(error="That game ID already exists."), 409
    session["player_id"] = player.id
    return jsonify(player=player_json(player))


@app.post("/api/login")
def login():
    payload = request.get_json(silent=True) or {}
    player_id = clean_player_id(payload.get("id"))
    if not player_id:
        return jsonify(error="Use 3–18 letters, numbers, or underscores for your game ID."), 400
    player = db.session.get(Player, player_id)
    if not player:
        return jsonify(error="Game ID not found. Create a new ID first."), 404
    # ID-only sign-in is convenient but is not secure: anyone who knows an ID can use it.
    session["player_id"] = player.id
    return jsonify(player=player_json(player))


@app.post("/api/logout")
def logout():
    session.pop("player_id", None)
    return jsonify(ok=True)


def player_json(player):
    return {"id": player.id, "name": player.name, "best": player.best_score, "lastScore": player.last_score}


@app.get("/api/me")
def me():
    player_id = session.get("player_id")
    if not player_id:
        return jsonify(player=None)
    player = db.session.get(Player, player_id)
    if not player:
        session.pop("player_id", None)
        return jsonify(player=None)
    return jsonify(player=player_json(player))


@app.post("/api/score")
def save_score():
    player_id = session.get("player_id")
    if not player_id:
        return jsonify(error="Sign in before saving a score."), 401
    player = db.session.get(Player, player_id)
    if not player:
        session.pop("player_id", None)
        return jsonify(error="Player not found. Please sign in again."), 401
    payload = request.get_json(silent=True) or {}
    try:
        score = int(payload.get("score"))
    except (TypeError, ValueError):
        return jsonify(error="Score must be a whole number."), 400
    if score < 0 or score > 100000:
        return jsonify(error="Score is out of range."), 400
    player.last_score = score
    player.best_score = max(player.best_score, score)
    db.session.commit()
    return jsonify(player=player_json(player), leaderboard=top_players())


def top_players():
    players = Player.query.order_by(Player.best_score.desc(), func.lower(Player.name).asc()).limit(3).all()
    return [{"id": p.id, "name": p.name, "best": p.best_score} for p in players]


@app.get("/api/leaderboard")
def leaderboard():
    return jsonify(players=top_players())


@app.get("/health")
def health():
    return jsonify(status="ok")


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", "8000")), debug=False)
