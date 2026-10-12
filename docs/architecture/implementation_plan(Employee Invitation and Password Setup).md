# Implementation Plan: Employee Invitation & Password Setup Flow

**Branch:** `feature/employee-invite-setup`  
**Reference Design:** [`docs/designs/setup-password-preview.html`](file:///c:/projects/TripBoard/docs/designs/setup-password-preview.html)  
**Security Reference:** [`docs/architecture/security_audit.md`](file:///c:/projects/TripBoard/docs/architecture/security_audit.md)  

---

## 1. Background

When an administrator creates a new employee in TripBoard (`/admin/employees/add`), the system must onboard the employee through an email invitation and secure credential provisioning process:
1. **Admin Name Visibility**: The email must explicitly communicate who invited them: *"Admin [Admin Name] has invited you to join TripBoard"*.
2. **Dedicated Welcome & Onboarding Page**: Rather than dropping the employee onto a generic login screen or encountering session conflicts with the admin's existing browser cookies, the invitation link must route to a custom onboarding page (`/auth/setup-password`).
3. **Email Verification & Password Setup via OTP**: On this page, the employee is greeted by name (*"Welcome, [Employee Name]!"*), receives an OTP in their email to verify email ownership, inputs the 6-digit code, sets their permanent password, and is automatically authenticated and directed to `/employee/dashboard`.

---

## 2. Core Model Flow

```
[ Admin in Admin Portal ]
      │
      ▼
Submits Employee Form (/admin/employees/add)
      │
      ├─► Fetches current Admin's name from profiles.full_name
      ├─► Inserts employee into public.employees with tenant company_id
      ├─► Dispatches Invitation Email via Supabase Auth
      │     (Subject: "Admin [Admin Name] invited you to join TripBoard")
      │     (Button: Link pointing to /auth/setup-password?token_hash=...&email=...)
      └─► Displays on-screen copyable link for immediate testing
            │
            ▼
[ Employee Clicks Invitation Link ]
            │
            ▼
[ Custom Onboarding Page: /auth/setup-password ]
      │
      ├─► Displays: "Welcome, [Employee Name]!"
      ├─► Informs: "Admin [Admin Name] has invited you to join TripBoard"
      ├─► Automatically sends 6-digit verification OTP to employee email
      │
      ├─► Employee inputs:
      │     1. 6-Digit Email OTP
      │     2. New Password (min 8 chars)
      │     3. Confirm New Password
      │
      ▼
[ Form Submission: Server Action / Auth Call ]
      │
      ├─► Verifies OTP via supabase.auth.verifyOtp({ email, token: otp, type: 'email' | 'recovery' })
      ├─► Updates user password via supabase.auth.updateUser({ password })
      ├─► Confirms employee profile & marks status = 'active'
      │
      ▼
[ Authenticated Employee Session Established ]
      │
      ▼
Redirected to /employee/dashboard
```

---

## 3. What Is Being Removed

| Component / File | What Is Being Removed | Reason |
|---|---|---|
| `app/admin/employees/actions.ts` | Dual conflicting calls (`inviteUserByEmail` immediately followed by `generateLink`) | Calling both in immediate succession caused Supabase to overwrite and invalidate the email token. |
| `app/admin/employees/actions.ts` | Generic redirect URL to `/auth/callback` without destination parameters | Replacing with explicit redirect to `/auth/setup-password` containing employee and admin context. |
| `app/admin/employees/add/page.tsx` | Raw Supabase verify URL in copyable link input | Replacing with direct application URL pointing to `/auth/setup-password` with `token_hash`. |

---

## 4. Proposed Changes

### A. Server Action: `app/admin/employees/actions.ts`
- Query the authenticated administrator's `full_name` from `public.profiles`.
- Pass `admin_name: adminProfile.full_name` inside user metadata during invitation.
- Generate the direct onboarding link targeting `/auth/setup-password`:
  ```ts
  const inviteLink = `${siteUrl}/auth/setup-password?token_hash=${linkData.properties.hashed_token}&email=${encodeURIComponent(normalizedEmail)}&name=${encodeURIComponent(normalizedName)}&admin=${encodeURIComponent(adminName)}`;
  ```
- Send the invitation email with user metadata (`full_name`, `admin_name`, `company_name`).
- Return `adminName`, `inviteLink`, and `inviteSent` to the client.

### B. New Page: `app/auth/setup-password/page.tsx`
- **Route**: `/auth/setup-password`
- **Visual Reference**: Faithfully implements [`docs/designs/setup-password-preview.html`](file:///c:/projects/TripBoard/docs/designs/setup-password-preview.html).
- **Features**:
  - Extracts `email`, `name`, `admin`, and `token_hash` from search parameters.
  - Displays personalized greeting: *"Welcome, [Employee Name]!"* and *"Admin [Admin Name] has invited you to join TripBoard"*.
  - Displays employee email pill and corporate verification badge.
  - Automatically triggers 6-digit OTP dispatch on page load (or upon clicking "Send OTP").
  - 6-digit OTP input boxes with auto-focus and 60-second resend countdown timer.
  - Password & Confirm Password input fields with show/hide toggle.
  - Client-side validation: minimum 8 characters, password match check.
  - On submit: verifies OTP, calls `updateUser({ password })`, synchronizes profile, and routes to `/employee/dashboard`.
  - Clears any stale session cookies if the browser was previously logged into another account.

### C. Update: `app/admin/employees/add/page.tsx`
- Updates the success card to show the admin's name used in the invitation.
- Provides the direct `/auth/setup-password` link in the copyable clipboard input.
- Displays explicit instructions for testing in an incognito window or sending to the employee.

### D. Supabase Email Template Configuration Guide
- Document exact template changes required in the Supabase Dashboard:
  - **Subject**: `Admin {{ .Data.admin_name }} invited you to join TripBoard`
  - **Body**: Custom HTML matching corporate branding, directing user to `{{ .SiteURL }}/auth/setup-password`.

---

## 5. File Change Summary

| File | Action | What Changes |
|---|---|---|
| `docs/designs/setup-password-preview.html` | Created | Standalone visual preview for UI verification |
| `docs/architecture/security_audit.md` | Created | Security audit for invitation and OTP flow |
| `app/auth/setup-password/page.tsx` | Create | Welcome screen, OTP verification, and password creation |
| `app/admin/employees/actions.ts` | Modify | Fetch admin name, add to metadata, construct `/auth/setup-password` link |
| `app/admin/employees/add/page.tsx` | Modify | Update success message and direct setup link |
| `docs/logs/2026-10-12.md` | Modify | Progress log entry |

---

## 6. Verification Checklist

1. [ ] Administrator navigates to `/admin/employees/add` and creates a new employee.
2. [ ] Invitation email is dispatched with subject indicating `Admin [Admin Name] has invited you`.
3. [ ] Direct onboarding link points to `/auth/setup-password?token_hash=...&email=...&name=...&admin=...`.
4. [ ] Opening link in incognito browser renders personalized welcome: *"Welcome, [Employee Name]!"*.
5. [ ] 6-digit OTP is received at employee's email.
6. [ ] Employee enters OTP, enters new password, and confirms password.
7. [ ] Form verifies OTP and sets password successfully.
8. [ ] Employee is immediately signed in and redirected to `/employee/dashboard`.
9. [ ] Full project builds with 0 errors via `npm run build`.
