# 🎬 Video Editor Hiring Web Application

A complete, lightweight, and modern recruitment platform built with **Node.js, Express, SQLite3, and Vanilla HTML/CSS/JS + Tailwind CSS**.

---

## ⚡ Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment (Optional)
A default `.env` is created automatically with:
```env
PORT=3000
ADMIN_PASSWORD=admin123
```
You can change `ADMIN_PASSWORD` anytime to your desired secret password.

### 3. Start the Server
```bash
# Start production server
node server.js
# or
npm start

# Or start with automatic reloading (Node 18+)
npm run dev
```

### 4. Open in Browser
- 🌐 **Public Hiring Page**: [http://localhost:3000](http://localhost:3000)
- 🔒 **Admin Portal**: [http://localhost:3000/admin.html](http://localhost:3000/admin.html) *(Password: `admin123`)*

---

## ✨ Features

### 🌟 Public Application Page (`public/index.html`)
- **Hero & Transparent Compensation**: Pay-per-video rates for Short-Form ($25–$45), YouTube Long-Form ($75–$150), and Lead Editor Retainers ($1,200+/month) with terms, turnarounds, and bonuses.
- **Sample Task Video Section**: Instructions to download raw 28-second test footage, editing criteria (pacing, captions, sound design, color grade), and direct asset download button.
- **Application Form**:
  - Full Name (Mandatory)
  - City / Location (Optional)
  - Video Editing Experience (Beginner / 1-2 Years / 3+ Years)
  - Past Channels / Projects with "Never worked before" fresh talent toggle
  - WhatsApp Number with country code validation (Mandatory)
  - Alternative Phone, Telegram handle, Instagram handle
  - Multi-skill selectors (Premiere Pro, After Effects, DaVinci Resolve, CapCut, etc.)
  - Edited Task Submission Link (Mandatory: Google Drive / YouTube)
  - Success modal with application ID.

### 🛡️ Private Admin Dashboard (`public/admin.html`)
- **Password Gate**: Protected with session-persisted admin token.
- **Metrics Bar**: Total Applicants, Submitted Today, Pending Review, Reviewing, Shortlisted, Hired.
- **Direct WhatsApp Chat**: One-click `https://wa.me/...` button with prefilled candidate greeting.
- **Interactive Review Flow**: Change status directly (`Pending`, `Reviewing`, `Shortlisted`, `Hired`, `Rejected`) with instant sync.
- **Search & Filters**: Live search by name, phone, handle, or skills; filter by experience level or status.
- **Table & Grid Views**: Toggle between compact table and visual card layout.
- **Full Details Modal**: View all candidate socials, portfolio, and save reviewer notes.
- **Candidate Deletion**: Delete rejected or test candidates with confirmation dialog.

### 🔌 API Endpoints

| Method | Route | Description | Auth Required |
|---|---|---|---|
| `POST` | `/api/apply` | Submit new editor application | No |
| `POST` | `/api/admin/verify` | Verify admin password | No |
| `GET` | `/api/admin/stats` | Overview submission counts | Yes (`x-admin-password`) |
| `GET` | `/api/admin/applications` | List submissions with filters | Yes (`x-admin-password`) |
| `GET` | `/api/admin/applications/:id` | Get single application | Yes (`x-admin-password`) |
| `PATCH` | `/api/admin/applications/:id` | Update candidate status & notes | Yes (`x-admin-password`) |
| `DELETE` | `/api/admin/applications/:id` | Delete candidate application | Yes (`x-admin-password`) |
| `GET` | `/api/health` | Health check endpoint | No |

---

## 🗄️ Database

Uses a self-contained SQLite database stored at `applications.db`. No database server installation required. Tables and indexes are created automatically on the first run.
