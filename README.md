# Simon Memory Arena — Flask + Azure

This package converts the supplied Simon Memory Arena HTML prototype into a Flask app with server-side player records and a top-3 leaderboard.

## Files
- `app.py` — Flask routes and database models
- `templates/index.html` — Simon game UI
- `static/game.js` — game logic and API calls
- `requirements.txt` — Python dependencies
- `.gitignore` — excludes local secrets and database files

## Local run
1. Install Python 3.10+.
2. Create/activate a virtual environment (optional but recommended).
3. Install dependencies:
   `python -m pip install -r requirements.txt`
4. Run:
   `python -m flask --app app run`
5. Open `http://127.0.0.1:5000`.

Local fallback uses SQLite in `instance/simon_arena.db`.

## Azure App Service
1. Create a Linux Web App using a supported Python runtime.
2. Configure app settings:
   - `FLASK_SECRET_KEY`: a long random secret value
   - `DATABASE_URL`: connection string for Azure Database for PostgreSQL Flexible Server (recommended for persistent shared leaderboard)
3. For PostgreSQL, use a connection URL like:
   `postgresql+psycopg://USERNAME:PASSWORD@SERVER.postgres.database.azure.com:5432/DATABASE?sslmode=require`
   URL-encode special characters in the username/password if needed.
4. Set Startup Command to:
   `gunicorn --bind=0.0.0.0 --timeout 600 app:app`
5. Deploy the repository from GitHub Actions or ZIP deploy.

If `DATABASE_URL` is not set on Azure, the app falls back to SQLite. SQLite is suitable for local testing only; its file may not be a reliable shared/persistent database for a scaled or redeployed App Service. Use PostgreSQL for a persistent leaderboard.

## GitHub upload from VS Code
From this folder:
```powershell
git init
git add .
git status
git commit -m "Add Simon Memory Arena Flask app"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPOSITORY.git
git push -u origin main
```
If you already have a Git remote, use `git remote -v` and don't add `origin` again.

## Important sign-in limitation
This version keeps the requested simple ID-only sign-in (no password/passcode). That is convenient for a demo but not secure: anyone who knows another player's ID can sign in as them and submit scores. For a public game with trustworthy scores, add proper authentication before sharing it widely.
