# 🏠 Family Chore Chart

A real-time family chore tracker built with React + Firebase. All family members see the same progress instantly. Checkboxes reset every Monday. Saturday deep-clean assignments rotate weekly.

---

## Setup Guide

Follow these steps once and you'll have a permanent URL your whole family can bookmark.

---

### Step 1 — Create a Firebase project

1. Go to [https://console.firebase.google.com](https://console.firebase.google.com)
2. Click **Add project** → give it a name (e.g. `family-chore-chart`) → click through the prompts
3. Once inside the project, click **Build** in the left sidebar → **Realtime Database**
4. Click **Create Database** → choose **Start in test mode** → pick any location → click **Enable**
5. Click the **gear icon** (top left) → **Project settings**
6. Scroll down to **Your apps** → click the `</>` (Web) icon → register the app (any nickname) → click **Register app**
7. You'll see a `firebaseConfig` block. Copy these values — you'll need them in Step 3:
   - `apiKey`
   - `authDomain`
   - `databaseURL`
   - `projectId`
   - `storageBucket`
   - `messagingSenderId`
   - `appId`

---

### Step 2 — Create a GitHub repository

1. Go to [https://github.com/new](https://github.com/new)
2. Name it `chore-chart` (or anything you like)
3. Set it to **Public** (required for free GitHub Pages)
4. Click **Create repository**
5. Upload all the files from this project into the repo (drag and drop onto the GitHub page, or use `git push`)

---

### Step 3 — Add Firebase secrets to GitHub

1. In your GitHub repo, go to **Settings** → **Secrets and variables** → **Actions** → **New repository secret**
2. Add each of the following secrets using the values from your Firebase config:

| Secret name | Value |
|---|---|
| `VITE_FIREBASE_API_KEY` | your `apiKey` |
| `VITE_FIREBASE_AUTH_DOMAIN` | your `authDomain` |
| `VITE_FIREBASE_DATABASE_URL` | your `databaseURL` |
| `VITE_FIREBASE_PROJECT_ID` | your `projectId` |
| `VITE_FIREBASE_STORAGE_BUCKET` | your `storageBucket` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | your `messagingSenderId` |
| `VITE_FIREBASE_APP_ID` | your `appId` |
| `VITE_BASE_URL` | `/chore-chart/` ← use your exact repo name with slashes |

---

### Step 4 — Enable GitHub Pages

1. In your GitHub repo, go to **Settings** → **Pages**
2. Under **Source**, select **Deploy from a branch**
3. Set branch to `gh-pages`, folder to `/ (root)` → click **Save**

---

### Step 5 — Trigger your first deploy

1. Go to the **Actions** tab in your repo
2. Click **Deploy to GitHub Pages** → **Run workflow** → **Run workflow**
3. Wait about 60 seconds for it to finish
4. Your app will be live at:

```
https://YOUR-GITHUB-USERNAME.github.io/chore-chart/
```

Bookmark that URL and share it with your family. Any time you push a change to `main`, it redeploys automatically.

---

### Updating chores later

Open `src/App.jsx` and edit the `DAILY_CHORE_ROTATION` array. Commit and push — GitHub Actions will redeploy automatically within a minute.

---

## How it works

- **Firebase Realtime Database** stores checkboxes and names, synced live across all devices
- **Weekly reset** — checkboxes are stored under a key like `2025-W20`. Each Monday a new key is used automatically, so the old week's data is simply ignored
- **Saturday rotation** — assignments shift by one kid each week based on the ISO week number, cycling back every 4 weeks
- **Names** — stored in Firebase so renaming on one device updates all devices
