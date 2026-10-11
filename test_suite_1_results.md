# Test Suite 1: Identity & Access Management — Execution & Bug Report

**Project:** TripBoard — Business Travel Management Platform  
**Test Suite:** Test Suite 1 — Identity & Access Management (IAM)  
**Tester:** Tester 1 (Arpita Shelke)  
**Date Executed:** 10/10/2026  
**Branch Tested:** `testing` (Commit `d4760c9`)  
**Environment:** Desktop & Mobile Viewports | Windows 11 | Microsoft Edge | Next.js `15.5.27` (`http://localhost:3001`) | Supabase Cloud (`sfdkdebfeispylbfpwmy`)  

---

## 1. Executive Summary

| Test ID | Test Case Name | Status | Summary of Findings | Linked Bug ID(s) |
| :--- | :--- | :---: | :--- | :--- |
| **TC-IAM-01** | **Admin Registration** | ❌ **FAIL (Partial)** | Registration submits to Supabase, but the required `+91` Phone Number field with Country Code Picker is completely missing from the form. Weak passwords (digits-only/letters-only) are also accepted, and duplicate emails redirect to `/verify-email` instead of showing an error. | `BUG-IAM-01`, `BUG-IAM-02`, `BUG-IAM-03`, `BUG-IAM-04` |
| **TC-IAM-02** | **Email Verification** | ⚠️ **PARTIAL PASS** | 6-digit OTP verification UI (`/verify-email`), auto-focus, clipboard paste, 60s resend timer, and invalid OTP error handling work properly. Note: Architecture uses 6-digit OTP rather than a verification link, and the Resend action still references the deleted `/auth/callback` route. | `BUG-IAM-05` |
| **TC-IAM-03** | **Sign In (Valid)** | ❌ **FAIL (Admin Crash)** | Valid credentials authenticate properly for both Admin and Employee. Employee sign-in redirects cleanly to `/employee/dashboard`. However, Admin sign-in redirects to `/admin` which immediately crashes with a Next.js 15 Server Runtime Error (`formatToINR is on the client`). | `BUG-IAM-06`, `BUG-IAM-07` |
| **TC-IAM-04** | **Sign In (Invalid)** | ✅ **PASS** | Wrong password, unregistered email, missing role selection, unconfirmed email banner, and Role Mismatch checks (`Admin` vs `Employee`) display accurate error messages and block unauthorized sign-in. | — |
| **TC-IAM-05** | **Reset Password (Request)** | ✅ **PASS** | `/forgot-password` Step 1 validates email input, dispatches the 6-digit recovery email via Supabase Auth, advances to Step 2, and enforces a 60-second resend cooldown timer. | — |
| **TC-IAM-06** | **Reset Password (Execution)** | ✅ **PASS** | Step 2 verifies the 6-digit recovery OTP, Step 3 strictly enforces password strength (min 8 chars, letter + number) and password confirmation match, updates password in Supabase, signs out recovery session, and redirects to `/login` on Step 4. | — |
| **TC-IAM-07** | **Route Protection** | ✅ **PASS** | Unauthenticated users attempting to access `/admin/*`, `/employee/*`, or `/dashboard` are immediately intercepted by `middleware.ts` and server layouts and redirected to `/login?redirect=...`. | — |
| **TC-IAM-08** | **Role-Based Access (RBAC)** | ✅ **PASS** | Authenticated Employees (`rahul.sharma@tripboard.in`, `priya.patel@tripboard.in`) attempting to access `/admin/*` routes are blocked by `app/admin/layout.tsx` and redirected back to `/employee/dashboard`. | — |

---

## 2. Detailed Test Case Execution Log

### TC-IAM-01: Admin Registration
**Scope:** Verify a new user can register as an admin using valid details. Ensure the phone number field defaults to `+91` and includes a country code picker.

| Sub-ID | Test Scenario | Test Data / Action | Expected Result | Actual Result | Status |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **TC-IAM-01.1** | Valid Admin Registration | Full Name: `Test Admin`, Email: `<valid-email>`, Pass: `Admin@12345` on `/login` (`Register Admin` tab) | Account registered with `role: 'admin'` and redirected to `/verify-email` | Account created in Supabase Auth and redirected to `/verify-email?email=...` | ✅ PASS |
| **TC-IAM-01.2** | India Phone Input (`+91` default & Country Code Picker) | Inspect `Register Admin` form on `/login` | Phone number field present, defaulting to `+91` with a country code selector | **No phone number field exists** on the `Register Admin` form in `app/login/page.tsx` | ❌ **FAIL** (`BUG-IAM-01`) |
| **TC-IAM-01.3** | Duplicate Email Registration | Register with existing email `admin@tripboard.in` and password `Demo@1234` | Error message: `"An account with this email already exists. Please log in."` | Redirected to `/verify-email?email=admin%40tripboard.in` without showing an existing-account error | ❌ **FAIL** (`BUG-IAM-02`) |
| **TC-IAM-01.4** | Empty / Whitespace Full Name | Full Name: `"   "` | Error message: `"Please enter your full name."` | Error banner displayed as expected | ✅ PASS |
| **TC-IAM-01.5** | Password Length `< 8` Characters | Password: `Ab1!` (4 chars) | Error message: `"Password must be at least 8 characters long."` | Error banner displayed as expected | ✅ PASS |
| **TC-IAM-01.6** | Password Missing Letter or Number | Password: `12345678` (digits only) or `abcdefgh` (letters only) | Blocked per placeholder (`"Min 8 characters, letter & number"`) | Form accepts `12345678` / `abcdefgh` because `handleRegister` only checks `regPassword.length < 8` | ❌ **FAIL** (`BUG-IAM-03`) |
| **TC-IAM-01.7** | Confirm Password Mismatch | Password: `Admin@12345`, Confirm: `Admin@99999` | Error message: `"Passwords do not match."` | Error banner displayed as expected | ✅ PASS |
| **TC-IAM-01.8** | Direct `/register` Route Navigation | Navigate to `http://localhost:3001/register` | Redirects to `/login` with the `Register Admin` tab open | Redirects to `/login` with the `Sign In` tab active instead of `Register Admin` | ❌ **FAIL** (`BUG-IAM-04`) |

---

### TC-IAM-02: Email Verification
**Scope:** Verify the user receives a verification email upon registration and can successfully verify their account.

| Sub-ID | Test Scenario | Test Data / Action | Expected Result | Actual Result | Status |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **TC-IAM-02.1** | Verification Mechanism (OTP vs Link) | Complete registration and inspect `/verify-email` | User verifies email via 6-digit OTP code (per ADR-003 OTP migration) | `/verify-email` renders 6-digit OTP input boxes; note that `test_plan.md` still mentions "via the link" | ⚠️ INFO |
| **TC-IAM-02.2** | Valid 6-Digit OTP Verification | Enter valid 6-digit OTP from email and click `VERIFY & CONTINUE` | Displays success banner and redirects to `/admin` | Verified and redirected to `/admin` | ✅ PASS |
| **TC-IAM-02.3** | OTP Auto-Focus, Backspace & Paste | Type digits `1–6`, press `Backspace`, or paste 6-digit code | Auto-advances cursor, deletes cleanly, and populates all 6 boxes on paste | Works as expected | ✅ PASS |
| **TC-IAM-02.4** | Invalid / Expired OTP Code | Enter `000000` and submit | Red error banner displayed | Error banner displayed (`"Token has expired or is invalid"`) | ✅ PASS |
| **TC-IAM-02.5** | Resend Verification Email & 60s Cooldown | Click `Resend Email` on `/verify-email` | Resends OTP and starts 60s countdown timer | Timer starts (`60s` → `0s`), but `handleResend` passes `emailRedirectTo: .../auth/callback` (a deleted route) | ⚠️ WARN (`BUG-IAM-05`) |

---

### TC-IAM-03: Sign In (Valid)
**Scope:** Verify users can sign in with valid credentials and are redirected to the correct dashboard based on their role.

| Sub-ID | Test Scenario | Test Data / Action | Expected Result | Actual Result | Status |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **TC-IAM-03.1** | Valid Admin Sign In & Dashboard Load | `admin@tripboard.in` / `Demo@1234` / Role: `Admin` | Redirects to `/admin` and loads Admin Dashboard | Redirects to `/admin`, which **crashes immediately** with Server Runtime Error: `Attempted to call formatToINR() from the server` | ❌ **FAIL** (`BUG-IAM-06`) |
| **TC-IAM-03.2** | Valid Employee (Coordinator) Sign In | `rahul.sharma@tripboard.in` / `Demo@1234` / Role: `Employee` | Redirects to `/employee/dashboard` | Redirects to `/employee/dashboard` and loads cleanly | ✅ PASS |
| **TC-IAM-03.3** | Valid Employee (Traveler) Sign In | `priya.patel@tripboard.in` & `amit.verma@tripboard.in` / `Demo@1234` / Role: `Employee` | Redirects to `/employee/dashboard` | Redirects to `/employee/dashboard` and loads cleanly | ✅ PASS |
| **TC-IAM-03.4** | Password Eye Icon Show/Hide Toggle | Click eye icon in password input | Toggles between masked (`password`) and visible (`text`) | Toggles properly | ✅ PASS |
| **TC-IAM-03.5** | Authenticated User Visiting `/login` | Visit `/login` while already logged in | Redirects to role dashboard (`/admin` or `/employee/dashboard`) | Middleware redirects to `/dashboard`, which contains a broken `Sign Out` form (`POST /auth/signout` → 404) | ❌ **FAIL** (`BUG-IAM-07`) |

---

### TC-IAM-04: Sign In (Invalid)
**Scope:** Verify appropriate error messages appear for incorrect email, password, or mismatched role.

| Sub-ID | Test Scenario | Test Data / Action | Expected Result | Actual Result | Status |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **TC-IAM-04.1** | Incorrect Password | `admin@tripboard.in` / `WrongPass123` / Role: `Admin` | Error: `"Invalid email or password."` | Red error banner displays `"Invalid email or password."` | ✅ PASS |
| **TC-IAM-04.2** | Unregistered Email | `unknown@tripboard.in` / `Demo@1234` / Role: `Employee` | Error: `"Invalid email or password."` | Red error banner displays `"Invalid email or password."` | ✅ PASS |
| **TC-IAM-04.3** | Role Mismatch (Admin selecting Employee) | `admin@tripboard.in` / `Demo@1234` / Role: `Employee` | Error: `"Access denied: Your account role is 'admin', not 'employee'."` | Displays exact error message and terminates session | ✅ PASS |
| **TC-IAM-04.4** | Role Mismatch (Employee selecting Admin) | `rahul.sharma@tripboard.in` / `Demo@1234` / Role: `Admin` | Error: `"Access denied: Your account role is 'employee', not 'admin'."` | Displays exact error message and terminates session | ✅ PASS |
| **TC-IAM-04.5** | Missing Role Selection | Leave `Login As` unselected (`Select your role`) | Form submission blocked | Blocked by required field validation | ✅ PASS |

---

### TC-IAM-05 & TC-IAM-06: Reset Password (Request & Execution)
**Scope:** Verify `/forgot-password` sends a recovery code and allows changing the password and logging in with the new password.

| Sub-ID | Test Scenario | Test Data / Action | Expected Result | Actual Result | Status |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **TC-IAM-05.1** | Step 1: Request Recovery Code | Enter registered email on `/forgot-password` and click `SEND RECOVERY CODE` | Dispatches recovery OTP email, moves to Step 2, starts 60s resend cooldown | Works as expected | ✅ PASS |
| **TC-IAM-06.1** | Step 2: Invalid Recovery OTP | Enter `000000` and click `VERIFY CODE` | Error: `"Invalid or expired code."` | Error banner displayed; remains on Step 2 | ✅ PASS |
| **TC-IAM-06.2** | Step 2: Valid Recovery OTP | Enter 6-digit recovery OTP from email | Advances to Step 3 (`Set your new password`) | Advances to Step 3 | ✅ PASS |
| **TC-IAM-06.3** | Step 3: Weak New Password Validation | Test `< 8` chars, numbers-only (`12345678`), letters-only (`abcdefgh`), and mismatched confirm password | Blocked by `validatePasswordStrength()` with specific error messages | All weak/mismatched passwords blocked accurately | ✅ PASS |
| **TC-IAM-06.4** | Step 3 & 4: Password Update & Re-Login | Enter valid new password, submit, wait 3s for redirect to `/login`, and sign in | Password updated, session signed out, redirects to `/login`, new password signs in | Works as expected | ✅ PASS |

---

### TC-IAM-07: Route Protection (Unauthenticated Access)
**Scope:** Verify an unauthenticated user cannot access `/admin/*` or `/employee/*` routes and is redirected to `/login`.

| Sub-ID | Target Route Tested (Logged Out / Incognito) | Expected Result | Actual Result | Status |
| :--- | :--- | :--- | :--- | :---: |
| **TC-IAM-07.1** | `http://localhost:3001/admin` | Redirect to `/login?redirect=%2Fadmin` | Redirected to `/login?redirect=%2Fadmin` | ✅ PASS |
| **TC-IAM-07.2** | `http://localhost:3001/admin/employees` & `/admin/employees/add` | Redirect to `/login?redirect=...` | Redirected to `/login?redirect=...` | ✅ PASS |
| **TC-IAM-07.3** | `http://localhost:3001/admin/trips` & `/admin/trips/create` | Redirect to `/login?redirect=...` | Redirected to `/login?redirect=...` | ✅ PASS |
| **TC-IAM-07.4** | `http://localhost:3001/employee/dashboard` | Redirect to `/login?redirect=%2Femployee%2Fdashboard` | Redirected to `/login?redirect=%2Femployee%2Fdashboard` | ✅ PASS |
| **TC-IAM-07.5** | `http://localhost:3001/employee/documents` | Redirect to `/login?redirect=%2Femployee%2Fdocuments` | Redirected to `/login?redirect=%2Femployee%2Fdocuments` | ✅ PASS |
| **TC-IAM-07.6** | `http://localhost:3001/employee/trips/t1000000-0000-0000-0000-000000000001/coordinator` | Redirect to `/login?redirect=...` | Redirected to `/login?redirect=...` | ✅ PASS |

---

### TC-IAM-08: Role-Based Access Control (Authenticated Employee)
**Scope:** Verify an authenticated employee cannot access `/admin/*` routes.

| Sub-ID | Logged-In Persona | Route Attempted | Expected Result | Actual Result | Status |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **TC-IAM-08.1** | Employee (`rahul.sharma@tripboard.in`) | `http://localhost:3001/admin` | Blocked and redirected to `/employee/dashboard` | Redirected to `/employee/dashboard` | ✅ PASS |
| **TC-IAM-08.2** | Employee (`rahul.sharma@tripboard.in`) | `http://localhost:3001/admin/employees` & `/admin/employees/add` | Blocked and redirected to `/employee/dashboard` | Redirected to `/employee/dashboard` | ✅ PASS |
| **TC-IAM-08.3** | Employee (`priya.patel@tripboard.in`) | `http://localhost:3001/admin/trips` & `/admin/trips/create` | Blocked and redirected to `/employee/dashboard` | Redirected to `/employee/dashboard` | ✅ PASS |

---

## 3. Formal Bug Reports (For Developer Review)

### `BUG-IAM-06` (CRITICAL BLOCKER — Discovered During `TC-IAM-03` Admin Sign-In)
1. **Title:** `[Admin Dashboard / app/admin/page.tsx]` Server Runtime Crash (`formatToINR` called from Server Component) immediately after Admin Sign-In
2. **Steps to Reproduce:**
   1. Navigate to `http://localhost:3001/login` on the **Sign In** tab.
   2. Enter Email: `admin@tripboard.in`, Password: `Demo@1234`, and select Login As: `Admin`.
   3. Click the **LOGIN** button.
   4. Observe automatic redirect to `http://localhost:3001/admin`.
3. **Expected Behavior:** The Admin Dashboard (`/admin`) should load cleanly and display KPI summary cards including the formatted Allocated Budget (`₹ 3,55,000`).
4. **Actual Behavior:** Next.js throws a fatal Server Runtime Error:
   > `Runtime Error (Server): Attempted to call formatToINR() from the server but formatToINR is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.` at `app/admin/page.tsx (97:29)`.
5. **Environment:** Desktop (Windows 11, Microsoft Edge, Next.js `15.5.27`).
   - **Developer Root Cause & Affected Files:**
     - `components/ui/RupeeInput.tsx` (line 1) and `components/ui/IndiaDatePicker.tsx` (line 1) are marked `'use client';`.
     - Server Components `app/admin/page.tsx` (lines 97, 180, 181, 194), `app/admin/trips/page.tsx` (lines 135, 154, 162, 172), and `app/admin/trips/[id]/page.tsx` (lines 105, 114, 127, 139) import and invoke `formatToINR()` and `toDDMMYYYY()` directly on the server.
     - **Recommended Fix:** Move `formatToINR`, `toDDMMYYYY`, and `toISODate` into a non-client utility file (e.g., `lib/format.ts`).

---

### `BUG-IAM-01` (MEDIUM — Discovered During `TC-IAM-01` Admin Registration)
1. **Title:** `[Admin Registration / app/login/page.tsx]` Missing Phone Number (`+91` default & Country Code Picker) field on Register Admin form
2. **Steps to Reproduce:**
   1. Navigate to `http://localhost:3001/login`.
   2. Click the **Register Admin** tab.
   3. Inspect the form input fields.
3. **Expected Behavior:** Per `TC-IAM-01` and `AGENTS.md` Rule 7, the Admin Registration form should include a Phone Number field defaulting to `+91` with a Country Code Picker (`<IndiaPhoneInput />`).
4. **Actual Behavior:** Only `Full Name`, `Work Email Address`, `Password`, and `Confirm Password` fields are rendered (`app/login/page.tsx` lines 445–551); the phone number field is completely missing.
5. **Environment:** Desktop & Mobile (Windows 11, Microsoft Edge).

---

### `BUG-IAM-02` (MEDIUM — Discovered During `TC-IAM-01` Duplicate Registration)
1. **Title:** `[Admin Registration / app/login/page.tsx]` Registering with an already-existing email redirects to `/verify-email` instead of displaying duplicate account error
2. **Steps to Reproduce:**
   1. Navigate to `http://localhost:3001/login` and select the **Register Admin** tab.
   2. Enter an already registered email (`admin@tripboard.in`), Full Name (`Test Admin`), and matching passwords (`Admin@12345`).
   3. Click **CREATE ADMIN ACCOUNT**.
3. **Expected Behavior:** An error message `"An account with this email already exists. Please log in."` should be displayed on the registration form.
4. **Actual Behavior:** Because Supabase returns a user object with an empty `identities: []` array (and `session: null`) when email confirmation is enabled, `app/login/page.tsx` (line 173) treats it as a new signup and redirects to `/verify-email?email=admin%40tripboard.in`.
5. **Environment:** Desktop (Windows 11, Microsoft Edge).

---

### `BUG-IAM-03` (LOW/MEDIUM — Discovered During `TC-IAM-01` Password Validation)
1. **Title:** `[Admin Registration / app/login/page.tsx]` Admin Registration allows weak passwords without letters or numbers
2. **Steps to Reproduce:**
   1. Navigate to `http://localhost:3001/login` → **Register Admin** tab.
   2. Enter Password: `12345678` (digits only) or `abcdefgh` (letters only) and matching Confirm Password.
   3. Click **CREATE ADMIN ACCOUNT**.
3. **Expected Behavior:** Password input placeholder specifies `"Min 8 characters, letter & number"`, so passwords lacking letters or numbers should be rejected using `validatePasswordStrength()` from `lib/security.ts`.
4. **Actual Behavior:** `handleRegister` in `app/login/page.tsx` (line 139) only checks `if (regPassword.length < 8)` and allows weak passwords through.
5. **Environment:** Desktop (Windows 11, Microsoft Edge).

---

### `BUG-IAM-04` (LOW — Discovered During `TC-IAM-01` `/register` Redirect)
1. **Title:** `[Register Route / app/register/page.tsx]` Navigating to `/register` opens the "Sign In" tab instead of "Register Admin"
2. **Steps to Reproduce:**
   1. Navigate directly to `http://localhost:3001/register`.
3. **Expected Behavior:** Should redirect to `/login` with the **Register Admin** tab selected (as stated in the code comment on line 10 of `app/register/page.tsx`).
4. **Actual Behavior:** Redirects to `/login` with the default **Sign In** tab active.
5. **Environment:** Desktop (Windows 11, Microsoft Edge).

---

### `BUG-IAM-05` (LOW — Discovered During `TC-IAM-02` Email Verification Resend)
1. **Title:** `[Email Verification / app/verify-email/page.tsx & app/login/page.tsx]` Resend Verification Email passes deleted `/auth/callback` URL in `emailRedirectTo`
2. **Steps to Reproduce:**
   1. Inspect `handleResend` in `app/verify-email/page.tsx` (line 161) and the unconfirmed email resend button in `app/login/page.tsx` (line 305).
3. **Expected Behavior:** Since `app/auth/callback/route.ts` was removed during the OTP-only migration (`ADR-003`), `emailRedirectTo` should not point to `/auth/callback`.
4. **Actual Behavior:** Both files still pass `options: { emailRedirectTo: '${window.location.origin}/auth/callback' }`.
5. **Environment:** Desktop (Windows 11, Microsoft Edge).

---

### `BUG-IAM-07` (MEDIUM — Discovered During `TC-IAM-03` Authenticated Redirect)
1. **Title:** `[Middleware & Dashboard / lib/supabase/middleware.ts & app/dashboard/page.tsx]` Authenticated user visiting `/login` is redirected to `/dashboard` where "Sign Out" button is broken (`POST /auth/signout` 404)
2. **Steps to Reproduce:**
   1. Log in as an Employee (`rahul.sharma@tripboard.in` / `Demo@1234`).
   2. Manually navigate to `http://localhost:3001/login`.
   3. Middleware redirects to `http://localhost:3001/dashboard`.
   4. Click the **Sign Out** button on `/dashboard`.
3. **Expected Behavior:** Middleware should redirect authenticated users directly to their role portal (`/admin` or `/employee/dashboard`), or the Sign Out button on `/dashboard` should sign the user out cleanly.
4. **Actual Behavior:** `app/dashboard/page.tsx` (line 51) submits `<form action="/auth/signout" method="POST">`, which does not exist, resulting in an HTTP 404/405 error.
5. **Environment:** Desktop (Windows 11, Microsoft Edge).

---

### `BUG-ENV-01` (INFRASTRUCTURE / GIT — Discovered During Initial Clone & Run)
1. **Title:** `[Git Configuration / .gitignore]` Brand header assets (`public/assets/logo_svg.svg` and `public/assets/bg2.png`) ignored by Git on Windows due to case-insensitive `Assets/` rule
2. **Steps to Reproduce:**
   1. Clone `https://github.com/pranavsbuilds/TripBoard.git` and checkout `testing`.
   2. Run `npm install` and `npm run dev`.
   3. Load `http://localhost:3001` or `http://localhost:3001/login`.
3. **Expected Behavior:** Header logo (`/assets/logo_svg.svg`) and header background (`/assets/bg2.png`) should load with HTTP 200.
4. **Actual Behavior:** `public/assets/` is missing from the `testing` branch because `.gitignore` line 33 contains `Assets/` (without a leading slash `/Assets/`), which matches `public/assets/` case-insensitively on Windows, causing `GET /assets/logo_svg.svg 404` and `GET /assets/bg2.png 404`.
5. **Environment:** Windows 11 / Git.
