# Milestones: Employee Invitation & Password Setup Flow

**Feature Branch:** `feature/employee-invite-setup`  
**Reference Plan:** [`docs/architecture/implementation_plan(Employee Invitation and Password Setup).md`](file:///c:/projects/TripBoard/docs/architecture/implementation_plan(Employee Invitation and Password Setup).md)  
**Reference Design:** [`docs/designs/setup-password-preview.html`](file:///c:/projects/TripBoard/docs/designs/setup-password-preview.html)  

---

## Milestone 1: Admin Invitation Action & Metadata Enhancement

**Scope:**
- Query the authenticated administrator's `full_name` from `public.profiles`.
- Enhance `addAndInviteEmployee` in `app/admin/employees/actions.ts` to attach `admin_name` to user metadata (`data: { full_name, admin_name, role: 'employee', company_id }`).
- Generate direct onboarding links targeting `/auth/setup-password?token_hash=...&email=...&name=...&admin=...`.
- Update `app/admin/employees/add/page.tsx` success display with the admin's name and copyable setup link.

**Recommended Model:** `Gemini 3.8 Flash (High)`  
*Rationale: Deep server action logic and multi-parameter URL formatting.*

**Files Table:**
| File | Action |
|---|---|
| `app/admin/employees/actions.ts` | MODIFY |
| `app/admin/employees/add/page.tsx` | MODIFY |

**Gate ✅:**
- [ ] Admin creates an employee; server action fetches admin name.
- [ ] Output includes properly formatted `/auth/setup-password` link containing `name`, `admin`, `email`, and `token_hash`.
- [ ] `npm run build` passes with zero type/lint errors.

---

## Milestone 2: Onboarding Setup Page Scaffolding (`/auth/setup-password`)

**Scope:**
- Create `app/auth/setup-password/page.tsx` adhering faithfully to [`docs/designs/setup-password-preview.html`](file:///c:/projects/TripBoard/docs/designs/setup-password-preview.html).
- Read search parameters (`name`, `email`, `admin`, `token_hash`).
- Render welcome greeting: *"Welcome, [Employee Name]!"* and subtitle mentioning *"Admin [Admin Name] has invited you to join TripBoard"*.
- Build 6-digit OTP entry boxes with auto-advance and backspace navigation.
- Build new password and confirm password inputs with visibility toggle.
- Enforce desktop-first layout with smooth mobile responsiveness.

**Recommended Model:** `Gemini 3.8 Flash (High)`  
*Rationale: High velocity component generation matching exact Tailwind CSS and visual design specs.*

**Files Table:**
| File | Action |
|---|---|
| `app/auth/setup-password/page.tsx` | CREATE |

**Gate ✅:**
- [ ] `/auth/setup-password` renders with correct employee and admin names.
- [ ] Visual appearance strictly mirrors `setup-password-preview.html`.
- [ ] Form input fields and responsive layout function seamlessly.

---

## Milestone 3: Email OTP Verification & Password Provisioning Flow

**Scope:**
- Trigger 6-digit verification OTP to employee email via `supabase.auth.signInWithOtp` / `resetPasswordForEmail`.
- Implement 60-second cooldown timer for the "Resend OTP" button.
- Implement form submission handler:
  1. Verifies 6-digit OTP using `supabase.auth.verifyOtp`.
  2. Updates user password via `supabase.auth.updateUser({ password })`.
  3. Updates `public.profiles` and `public.employees` status to `'active'`.
  4. Automatically logs employee in and redirects to `/employee/dashboard`.
- Clear previous admin session cookies if opened in an existing browser session.

**Recommended Model:** `Gemini 3.8 Flash (High)`  
*Rationale: Full-stack auth state handling, OTP token verification, and session transition.*

**Files Table:**
| File | Action |
|---|---|
| `app/auth/setup-password/page.tsx` | MODIFY |
| `app/auth/setup-password/actions.ts` (if server action required) | CREATE / MODIFY |

**Gate ✅:**
- [ ] OTP code is delivered to employee email.
- [ ] Entering valid OTP and new password activates user account in Supabase Auth.
- [ ] User is signed in and lands directly on `/employee/dashboard`.

---

## Milestone 4: Integration Testing & Connectivity Verification

**Scope:**
- Verify connectivity between Admin invite dispatch, email OTP generation, and employee password activation.
- Run complete production build check (`npm run build`).
- Verify no route collision with existing `/verify-email` or `/login`.
- Update session logs in `docs/logs/2026-10-12.md`.

**Recommended Model:** `Gemini 3.8 Flash (High)`  
*Rationale: Cross-module integrity testing and compilation verification.*

**Files Table:**
| File | Action |
|---|---|
| `docs/logs/2026-10-12.md` | MODIFY |

**Gate ✅:**
- [ ] `npm run build` exits with code 0.
- [ ] End-to-end invite and password setup verified across admin and employee roles.

---

## Summary Table

| # | Milestone | Status | Model | New Files | Modified Files |
|:---:|---|:---:|---|---|---|
| 1 | Admin Invitation Action & Metadata Enhancement | ✅ Done | Gemini 3.8 Flash (High) | 0 | 2 |
| 2 | Onboarding Setup Page Scaffolding (`/auth/setup-password`) | ⏳ Next | Gemini 3.8 Flash (High) | 1 | 0 |
| 3 | Email OTP Verification & Password Provisioning Flow | — | Gemini 3.8 Flash (High) | 0 | 1 |
| 4 | Integration Testing & Connectivity Verification | — | Gemini 3.8 Flash (High) | 0 | 1 |

---

## External Tasks Guide (Supabase Dashboard Configuration)

To ensure email delivery includes the Admin's name and links to the custom setup page:

1. **Navigate to Supabase Dashboard**: Go to **Authentication** $\rightarrow$ **Email Templates** $\rightarrow$ **Invite user**.
2. **Subject Line**:
   ```
   Admin {{ .Data.admin_name }} invited you to join TripBoard
   ```
3. **Template Body**:
   ```html
   <h2>Welcome to TripBoard</h2>
   <p>Admin {{ .Data.admin_name }} has invited you to join TripBoard.</p>
   <p>
     <a href="{{ .SiteURL }}/auth/setup-password?token_hash={{ .TokenHash }}&email={{ .Email }}&name={{ .Data.full_name }}&admin={{ .Data.admin_name }}">
       Accept Invitation & Set Up Password
     </a>
   </p>
   ```
4. **URL Configuration**:
   Ensure `{{ .SiteURL }}/auth/setup-password` and `https://tripboard-dusky.vercel.app/**` are added to **Redirect URLs**.
