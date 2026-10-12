# Security Audit: Employee Invitation & Password Setup Flow

**Scope:** Employee Onboarding, Magic Links, OTP Delivery, Password Provisioning, and Role Redirection.  
**Reference Document:** `C:\projects\Prebuild Assets\Vibe_Coder_Attacks_Guide.pdf`  
**Date:** 2026-10-12  

---

## 1. Executive Summary

The employee invitation flow connects Admin privilege actions to unauthenticated user onboarding. Because invitation links grant access to corporate systems, the generation, transmission, verification, and credential-setting steps must adhere strictly to zero-trust principles.

---

## 2. Threat Modeling & Vulnerability Findings

### 🔴 Finding 1: Token Overwrite / Invalidation Race Condition (CRITICAL - FIXED IN DESIGN)
- **Risk:** Calling `admin.auth.admin.inviteUserByEmail()` followed immediately by `admin.auth.admin.generateLink()` caused Supabase Auth to regenerate the internal token hash. This immediately invalidated the token in the sent email.
- **Remediation:** Decouple email dispatch from link generation. If generating an on-screen link, construct the link with a single persistent token or dedicated onboarding token hash.
- **Rating:** 🔴 Critical

### 🟡 Finding 2: Session Pollution on Same-Browser Link Verification (MEDIUM - ADDRESSED)
- **Risk:** When an administrator generates an invitation and tests it in the same browser, active Admin session cookies (`sb-*-auth-token`) override the incoming request if the link relies on client-side hash fragments (`#access_token=...`).
- **Remediation:** 
  1. The onboarding link must route to `/auth/setup-password`, which operates independently of active session cookies until OTP verification is performed.
  2. If an active session belongs to a different user, `/auth/setup-password` warns or signs out the existing session before establishing the employee's session.
- **Rating:** 🟡 Medium

### 🟡 Finding 3: OTP Brute Force & Rate Limiting (MEDIUM)
- **Risk:** Attackers attempting to guess the 6-digit OTP could make rapid repeated requests.
- **Remediation:**
  1. Strict UI constraint: entry field enforces `maxLength={6}` and numeric-only characters.
  2. Client & Server 60-second cooldown on OTP resend requests.
  3. Supabase Auth built-in rate-limiting prevents rapid OTP attempts.
- **Rating:** 🟡 Medium

### 🟢 Finding 4: Password Strength Enforcement (LOW)
- **Risk:** Employees choosing weak passwords during onboarding.
- **Remediation:** Enforce client and server validation: minimum 8 characters, requiring mixed alphanumeric characters, verified on both client form and Supabase Auth policy.
- **Rating:** 🟢 Low

### ✅ Finding 5: Organization Tenant Isolation (CLEAN)
- **Status:** Verified. `addAndInviteEmployee` uses `ensureAdminCompany()` to scope employees strictly under `company_id`. An invited employee can only access trips and data scoped to their assigned company.
- **Rating:** ✅ Clean

---

## 3. Summary of Security Ratings

| Area | Component | Threat Mitigated | Status |
|---|---|---|---|
| Token Integrity | `actions.ts` | Token invalidation race condition | 🟢 Mitigated in Plan |
| Session Guard | `/auth/setup-password` | Admin session pollution | 🟢 Isolated |
| OTP Rate Limit | Email OTP verification | Brute-force entry & spamming | 🟢 Enforced (60s cooldown, max 6 digits) |
| Tenant Boundary | `public.employees` | Multi-tenant cross-talk | ✅ Clean |
