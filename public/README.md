# TommyLC CRM — v2.0 (PostgreSQL)

## Railway Setup

### 1. Add PostgreSQL database
In your Railway project:
- Click **+ New** → **Database** → **PostgreSQL**
- Railway auto-sets `DATABASE_URL` env variable

### 2. File structure on Railway
```
/
├── public/          ← put all HTML/CSS/JS files here
│   ├── login.html
│   ├── index.html
│   ├── students.html
│   ├── groups.html
│   ├── payments.html
│   ├── teachers.html
│   ├── classrooms.html
│   ├── users.html
│   ├── shared.css
│   └── shared.js
├── server.js
├── package.json
└── README.md
```

### 3. First login
On first deploy, a default CEO account is created:
- **Phone:** 90 000 00 01
- **Password:** admin123

Change this immediately in the Users page.

## What changed from v1
- All data now stored in **PostgreSQL** (shared across all devices)
- `localStorage` fully removed — everything goes through the API
- `server.js` handles all routes
- `shared.js` uses `fetch()` instead of `getDB()`/`setDB()`
