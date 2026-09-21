# Marketing Automation Software

A production-ready Marketing Automation Platform built with **NestJS**, **MongoDB Atlas**, **Next.js**, and a **Durable Queue Engine**, featuring a minimal, clean, modern light UI.

---

## 🚀 Architecture Overview

```
├── backend/                  # NestJS + TypeScript Modular REST API
│   ├── src/
│   │   ├── common/           # AES-256-GCM Crypto, Exception Filters, Pagination DTOs
│   │   ├── config/           # Environment & Application Settings
│   │   ├── database/         # MongoDB Schemas & Compound Indexes
│   │   └── modules/
│   │       ├── contacts/     # Contacts CRUD, Normalization, & Deduplication
│   │       ├── custom-fields/# Dynamic Custom Field Management
│   │       ├── imports/      # Multi-format Parsers (CSV, XLSX, XLS, XML) & Mapping Wizard
│   │       ├── whatsapp/     # Meta Cloud API Adapter, Webhook HMAC-SHA256, & QR Bridge
│   │       ├── email/        # Multi-Provider SMTP/IMAP, Credential Encryption, Quota Tracker
│   │       ├── inbox/        # Separate WhatsApp Inbox & Email Inbox
│   │       ├── campaigns/    # Campaign State Machine & Recipient Resolution
│   │       ├── sending/      # Durable Queue Worker, Email Rotation, & Throttling
│   │       └── settings/     # System Throttle & Webhook Configuration
└── frontend/                 # Next.js 14 App Router + Tailwind CSS Light Theme
    ├── src/
    │   ├── app/
    │   │   ├── page.tsx              # Overview Dashboard & Metrics
    │   │   ├── contacts/             # Contact Table, Search, Filters, & Duplicate Flags
    │   │   │   └── import/           # 4-Step Data Import Wizard
    │   │   ├── whatsapp/             # Meta Official API, Template Catalog, & Regular QR
    │   │   ├── email/                # Email Account Manager & SMTP/IMAP Quota Meters
    │   │   ├── inbox/
    │   │   │   ├── whatsapp/         # Dedicated 2-Way WhatsApp Chat Interface
    │   │   │   └── email/            # Dedicated Multi-Account Mail Client
    │   │   ├── campaigns/            # Live Broadcast Overview, Progress, & Audit Logs
    │   │   │   └── new/              # 5-Step Campaign Builder Wizard
    │   │   └── settings/             # System Throttles & Webhook Endpoint Details
    │   └── lib/                      # Typed API Client Wrapper
```

---

## 🛠️ Key Features

### 1. Data Import & Contact Database
- Safe multi-format parser for **CSV** (with BOM handling), **XLSX / XLS** (multi-sheet), and **XML** (with strict XXE protection).
- Dynamic column mapping to standard fields or on-the-fly custom fields.
- E.164 phone normalization and lowercase email validation.
- Non-destructive duplicate detection (identifies matching records without silent overwrites).
- Full import history and audit logs.

### 2. Official WhatsApp Business API
- Meta WhatsApp Business Platform adapter (Cloud API v20.0+).
- Template catalog synchronization (`APPROVED`, `PENDING`, `REJECTED`) with variable extraction (`{{1}}`, `{{2}}`).
- Secure Webhook controller (`GET` hub verification, `POST` HMAC-SHA256 signature check using `X-Hub-Signature-256`).
- Webhook idempotency layer to prevent duplicate event execution.

### 3. Regular WhatsApp QR Connection
- Isolated QR session manager with WebSocket/bridge architecture.
- Real-time QR code generation streamable to frontend.
- Connection state tracking (`qr_ready`, `connected`, `disconnected`).
- Explicit platform safety controls and disclaimers.

### 4. Email Account Management & Inbox Sync
- Multi-provider support: **Gmail**, **Zoho Mail**, **Microsoft Outlook**, and **Custom SMTP/IMAP**.
- AES-256-GCM encryption for stored credentials.
- SMTP `verify()` automated connection tester.
- IMAP Inbox synchronization engine for inbound thread ingestion.
- Per-account hourly and daily quota meters.

### 5. Dedicated Inboxes
- **WhatsApp Inbox**: Real-time conversation listing, message bubbles, delivery ticks (`sent`, `delivered`, `read`), and outbound reply composer.
- **Email Inbox**: Multi-account mailbox switcher, HTML thread reader, and SMTP reply drawer.

### 6. Campaign Engine & Sending Scheduler
- Broadcast wizard for WhatsApp and Email channels.
- Policy-aware multi-account email rotation (Round-Robin & Least-Used).
- Configurable per-message delay, batch size, and batch pause duration.
- Durable queue processor (`queue_jobs`) supporting Pause, Resume, Cancel, and Retry Failed.

---

## ⚙️ Configuration & Environment Variables

Create `.env` inside `backend/`:

```env
PORT=4000
MONGODB_URI=mongodb://127.0.0.1:27017/marketing_automation
ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
META_VERIFY_TOKEN=marketing_auto_meta_verify_token_2026
DEFAULT_SENDING_DELAY_SEC=2
DEFAULT_BATCH_SIZE=50
DEFAULT_BATCH_PAUSE_SEC=60
```

---

## 🚦 Running Locally

### Backend:
```powershell
cd backend
npm.cmd run start:dev
```
Backend API will start on `http://localhost:4000`

### Frontend:
```powershell
cd frontend
npm.cmd run dev
```
Frontend Web UI will start on `http://localhost:3000`

---

## 🧪 Testing

```powershell
cd backend
npm.cmd test
```
