# CLAUDE.md — RadioSync Project Guide

คู่มือนี้ให้ Claude อ่านก่อนเริ่มงานทุกครั้ง เพื่อให้เข้าใจโครงสร้างและขั้นตอนที่ถูกต้องโดยไม่ต้องอธิบายซ้ำ

---

## ภาพรวมโปรเจกต์

**RadioSync** คือระบบยืม-คืนวิทยุสื่อสารสำหรับองค์กร ทำงานเป็น PWA (Progressive Web App)
- URL: `https://supasiao7896th.github.io/RadioSync/`
- ภาษาของ UI: **ภาษาไทย**
- รูปแบบ: Single-page app — โค้ดทั้งหมดอยู่ใน `index.html` ไฟล์เดียว

---

## Tech Stack

| ส่วน | เทคโนโลยี |
|------|-----------|
| Frontend | HTML + Tailwind CSS (CDN) + Vanilla JavaScript |
| Font | Sarabun (Thai), Fraunces (display) — Google Fonts |
| Database | Firebase Firestore (real-time) |
| Auth | Firebase Anonymous Auth + `inMemoryPersistence` |
| Push Notification | Firebase Cloud Messaging (FCM) |
| Background Logic | Firebase Cloud Functions v2 (Node 20) |
| Hosting | GitHub Pages (static files) |
| CI/CD | GitHub Actions |
| PWA Cache | Service Worker (`sw.js`) |

---

## โครงสร้างไฟล์

```
RadioSync/
├── index.html          ← แอปทั้งหมด (UI + logic รวมกัน)
├── sw.js               ← Service Worker: cache + FCM background handler
├── manifest.json       ← PWA metadata
├── icon-192.png        ← App icon
├── icon-512.png        ← App icon
├── firestore.rules     ← Firestore security rules (deploy แยก — ดูหัวข้อด้านล่าง)
├── firebase.json       ← Firebase project config
├── .firebaserc         ← Firebase project alias
├── .github/
│   └── workflows/
│       └── deploy.yml  ← CI/CD: deploy Pages + Cloud Functions
└── functions/
    ├── index.js        ← Cloud Function: ส่ง push notification เมื่ออุปกรณ์เปลี่ยนสถานะ
    └── package.json    ← dependencies: firebase-admin, firebase-functions
```

---

## Firestore Database Schema

```
artifacts/{appId}/public/data/
├── equipment/{docId}
│   ├── id, name, serial, status
│   ├── currentBorrower: { empId, empName }
│   ├── borrowedAt (timestamp ms)
│   └── updatedAt
├── logs/{docId}          ← create-only, ห้ามแก้/ลบ (audit trail)
│   ├── id, equipId, equipName
│   ├── empId, empName
│   ├── action ('borrow'|'return'|'approve'|'force_recall'|'reassign')
│   ├── timestamp (ms)
│   └── comment (optional)
└── adminTokens/{docId}   ← FCM tokens ของ admin
    ├── token (string)
    └── createdAt (ms)
```

**สถานะอุปกรณ์ที่ถูกต้อง:** `'available' | 'borrowed' | 'pending_return'`

---

## กฎสำคัญที่ต้องจำ

### 1. Service Worker Cache — ต้อง bump version ทุกครั้งที่แก้ `index.html` หรือ `sw.js`

ไฟล์: `sw.js` บรรทัด `const CACHE_NAME = 'radiosync-vX'`

- เปลี่ยน `vX` → `v(X+1)` ทุกครั้งที่มี PR ใหม่
- ถ้าไม่ bump → มือถือที่ cache ไว้จะยังเห็นเวอร์ชันเก่า

**version ปัจจุบัน:** ตรวจสอบจาก `sw.js` ก่อนทุกครั้ง

### 2. Firestore Rules — **deploy แยก ไม่ผ่าน CI**

`deploy.yml` deploy เฉพาะ:
- GitHub Pages (job: `deploy-pages`) ✅
- Cloud Functions (job: `deploy-functions`) ✅

`firestore.rules` **ไม่ได้ deploy อัตโนมัติ** — ถ้าแก้ rules ต้อง deploy manual ผ่าน Firebase Console หรือ CLI:
```bash
npx firebase-tools deploy --only firestore:rules
```

### 3. Firebase Auth — ใช้ `inMemoryPersistence` เสมอ

เหตุผล: LINE / Facebook / Instagram WebView บน iOS และ Android บล็อก IndexedDB
ถ้าเปลี่ยนกลับเป็น default persistence → auth จะพังใน in-app browser

ตำแหน่งในโค้ด: ฟังก์ชัน `_initFirebase()` ใน `index.html`

### 4. Cloud Functions Token — `deploy-functions` อาจ fail

`FIREBASE_TOKEN` secret ใน GitHub อาจหมดอายุ → job `deploy-functions` จะ fail แต่ **ไม่กระทบ `deploy-pages`** ทั้งสอง job รันแยกกัน แก้โดย regenerate token แล้วอัพเดต GitHub Secret

---

## ขั้นตอน Deploy ที่ถูกต้อง

```
1. แก้โค้ดใน index.html และ/หรือ sw.js
2. bump CACHE_NAME ใน sw.js (vX → v(X+1)) ← อย่าลืม!
3. git add, git commit, git push → branch: claude/... หรือ feature branch
4. เปิด PR → merge to main
5. GitHub Actions รันอัตโนมัติ → deploy Pages + Functions
6. ตรวจสอบ Actions tab ว่า deploy-pages ✅
```

---

## ฟีเจอร์หลักของแอป

| ฟีเจอร์ | รายละเอียด |
|---------|-----------|
| ยืม-คืนอุปกรณ์ | พนักงานกรอก empId + กดยืม → admin อนุมัติ |
| Force Recall | admin บังคับคืนพร้อมบันทึกเหตุผล |
| Reassign | admin โอนอุปกรณ์จากคนหนึ่งไปอีกคน |
| Overdue Tracking | badge แสดงระยะเวลายืม + แจ้งเตือนเกินกำหนด (default 3 วัน) |
| In-app History | drawer แสดง log ทั้งหมด + ค้นหา + กรองประเภท |
| Push Notification | admin รับ notification เมื่ออุปกรณ์เปลี่ยนสถานะ |
| Export CSV | export log ทั้งหมดเป็น CSV |
| Admin PIN | SHA-256 hash + lockout 5 ครั้ง/5 นาที |
| LINE Banner | แจ้งเตือน iOS ให้เปิดใน Safari, Android ให้เปิดใน Chrome |

---

## LINE / WebView Handling

Banner HTML: `#line-banner` ใน `index.html` (~บรรทัด 99-145)
- ตรวจ UA ว่าอยู่ใน LINE / FB / IG browser
- iOS: แสดงวิธีเปิดใน Safari + ปุ่มคัดลอกลิงก์
- Android: แสดงวิธีเปิดใน Chrome + ปุ่มคัดลอกลิงก์
- ซ่อน banner อัตโนมัติเมื่อ sync status เป็น `'online'`

---

## Firebase Project Config

```
Project ID:    radiosync-6662c
App ID:        1:605359206228:web:bfbc3514675887d666e2c1
Sender ID:     605359206228
Auth Domain:   radiosync-6662c.firebaseapp.com
Storage:       radiosync-6662c.firebasestorage.app
```

---

## ฟีเจอร์ที่เลื่อนไว้ (Deferred)

- **สถานะซ่อม/ชำรุด (maintenance)** — ต้องเพิ่ม `'maintenance'` ใน `firestore.rules` line 16 status enum แล้ว deploy rules manual ก่อน จึงค่อยเพิ่ม UI

---

## คำแนะนำสำหรับ Claude

- อธิบายเป็น**ภาษาไทย** เสมอ
- ก่อนแก้ไขโค้ดใดๆ ให้ **Read ไฟล์จริงก่อน** อย่า assume จาก context
- ทุกครั้งที่แก้ `index.html` → ให้ bump `CACHE_NAME` ใน `sw.js` ด้วยเสมอ
- อย่า deploy `firestore.rules` ผ่าน CI (workflow ไม่รองรับ)
- branch สำหรับ development: `claude/...` ตาม convention ที่กำหนดใน session
