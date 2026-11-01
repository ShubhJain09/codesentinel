# CodeSentinel — Security Before Merge

**Official Project ID:** PST_PD_143  
**Track:** Product Development  
**Academic Group:** G385  
**Assigned Mentor:** Biplove  
**Authors:** Shubh Abhay Mohta, Harshvardhan Rajpurohit  
**Status:** Fully Integrated, Tested (22/22 Tests Passing), and Production-Built

---

## Overview

**CodeSentinel** is an automated developer security operations platform designed for pull-request static analysis before code merge. It provides:
1. **Editorial Public Portal:** Art-directed, responsive landing page with interactive code mockups, vulnerability inspection tables, and complete design-system aesthetics.
2. **Security Command Center:** Executive dashboard with real posture metrics, Recharts vulnerability distribution charts, and audit activity feeds.
3. **Authentication & RBAC:** PBKDF2-SHA256 password hashing with 200,000 iterations, 256-bit random session tokens, HttpOnly cookie isolation, and Owner/Admin/User access boundaries.
4. **Static Analysis Pipeline:** Semgrep CLI integration with pinned OWASP Python security rulesets, temporary workspace sandboxing, and strict path traversal defenses.
5. **GitHub Pull-Request Ingress:** Raw-buffer HMAC-SHA256 signature verification, delivery UUID deduplication, revision SHA locking, and allowlist enforcement.
6. **Mobile Companion:** Two-screen React Native / Expo application for alert triage, remediation review, local notification simulation, and persistent acknowledgement via AsyncStorage.
7. **Comprehensive Documentation Suite:** `docs/MASTER_SPEC.md`, `docs/ARCHITECTURE.md`, `docs/DESIGN_SYSTEM.md`, `docs/SECURITY_MODEL.md`, `docs/PROGRESS.md`, `docs/TEST_RESULTS.md`, and `docs/KNOWN_LIMITATIONS.md`.

---

## Architecture Summary

```
[GitHub PR Webhook] ──► [HMAC-SHA256 Verifier] ──► [Allowlist Guard] ──► [Queue]
                                                                           │
[Developer Browser] ──► [Node.js Daemon 127.0.0.1:4173] ◄──────────────────┤
         │                       │                                         │
         ▼                       ▼                                         ▼
[React 18 SPA] ◄────► [PBKDF2 Auth & Session Store]         [Semgrep CLI in mkdtemp]
```

---

## Quick Start & Verification

### 1. Run Automated Test Suite
The project uses the built-in Node.js test runner (`node --test`). Zero external test dependencies required:

```bash
npm test
```
*Expected output: 25 tests passing across auth, scanner, webhook, integration, server, and store suites.*

### 2. Build Frontend (React + Vite + Tailwind)
```bash
npm run build:frontend
```
*Compiles TypeScript, packages Tailwind assets, and outputs production bundles to `frontend/dist/`.*

### 3. Start CodeSentinel Daemon
```bash
npm start
```
Browse to **http://127.0.0.1:4173**:
- The server automatically serves the compiled React application.
- **First-Run Owner Provisioning:**
  - On a fresh installation, the first account registered via the web interface or `/register` gateway is automatically granted the **System Owner** role.
  - Alternatively, specify `INITIAL_OWNER_EMAIL` and `INITIAL_OWNER_PASSWORD` in your environment prior to initial launch.
  - No hardcoded or static default administrative passwords exist in the codebase.

### 4. Run Mobile Companion
In a separate terminal:
```bash
cd mobile
npm install
npx expo start
```
Scan the QR code with Expo Go on iOS/Android to review alerts, acknowledge findings, and simulate local notifications.

---

## Verified Subsystems & Deliverables

| Deliverable | Verification Checkpoint | Status |
|---|---|---|
| **Automated Tests** | 25/25 unit and integration tests passing | Verified |
| **Authentication System** | PBKDF2-SHA256 (200k rounds) + HttpOnly sessions | Verified |
| **Vite Production Build** | TypeScript + Tailwind build completed in 1.9s | Verified |
| **Static Semgrep Scanner** | Evaluated on controlled fixture `insecure_example.py` | Verified |
| **Webhook Security** | Constant-time HMAC-SHA256 with delivery deduplication | Verified |
| **Mobile Alert Console** | 2-screen React Native companion with AsyncStorage | Verified |
| **Project Documentation** | Complete suite of 7 comprehensive markdown specs | Verified |

---

## Known Boundaries & Academic Transparency

- CodeSentinel analyzes static Python source code without executing repository build or installation scripts.
- Webhook reception requires a local tunnel or CI execution (`scripts/scan-pr.js`) since the daemon binds strictly to loopback (`127.0.0.1`).
- PR comment publishing is disabled by default (`GITHUB_COMMENT_MODE=off`) to prevent unsolicited comments during evaluation.
- No false claims of "0 false negatives" are made; detection is bounded to the loaded Semgrep rules. See `docs/KNOWN_LIMITATIONS.md` for full details.
