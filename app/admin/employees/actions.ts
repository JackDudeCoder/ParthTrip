'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export interface AddEmployeeInput {
  fullName: string;
  employeeCode: string;
  email: string;
  phone?: string;
  department?: string;
  designation?: string;
  passportNumber?: string;
}

export interface AddEmployeeResult {
  success: boolean;
  error?: string;
  inviteLink?: string;
  inviteSent?: boolean;
  adminName?: string;
}

/**
 * Ensures the authenticated admin has an active company_id.
 * If company_id is null, provisions a dedicated tenant company and links the admin's profile.
 */
export async function ensureAdminCompany(): Promise<{ companyId: string | null; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { companyId: null, error: 'Unauthorized: No active session.' };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, company_id')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'admin') {
    return { companyId: null, error: 'Forbidden: Admin privileges required.' };
  }

  if (profile.company_id) {
    return { companyId: profile.company_id };
  }

  // Provision new company using privileged Admin client
  const adminClient = createAdminClient();
  const rawDomain = profile.email?.split('@')[1] || 'enterprise.com';
  const prefix = profile.email?.split('@')[0]?.replace(/[^a-z0-9]/gi, '') || 'org';
  const companyName = `${profile.full_name || 'My'}'s Organization`;

  // Public email providers or existing domains must have unique tenant slugs
  const publicProviders = [
    'gmail.com',
    'yahoo.com',
    'hotmail.com',
    'outlook.com',
    'icloud.com',
    'live.com',
    'aol.com',
    'proton.me',
    'protonmail.com',
  ];
  let domain = rawDomain.toLowerCase();

  const isPublicProvider = publicProviders.includes(domain);
  const { data: existingDomain } = await adminClient
    .from('companies')
    .select('id')
    .eq('domain', domain)
    .maybeSingle();

  if (isPublicProvider || existingDomain) {
    domain = `${prefix}-${user.id.slice(0, 6)}.${domain}`;
  }

  const { data: newCompany, error: compErr } = await adminClient
    .from('companies')
    .insert({
      name: companyName,
      domain: domain,
    })
    .select('id')
    .single();

  if (compErr || !newCompany) {
    console.error('[ensureAdminCompany] Company creation failed:', compErr);
    return { companyId: null, error: 'Failed to provision organization workspace.' };
  }

  // Link to profile
  const { error: profErr } = await adminClient
    .from('profiles')
    .update({ company_id: newCompany.id })
    .eq('id', user.id);

  if (profErr) {
    console.error('[ensureAdminCompany] Profile update failed:', profErr);
    return { companyId: null, error: 'Failed to link organization to admin profile.' };
  }

  return { companyId: newCompany.id };
}

/**
 * Adds an employee to public.employees and sends an invitation via Supabase Auth.
 */
export async function addAndInviteEmployee(input: AddEmployeeInput): Promise<AddEmployeeResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Unauthorized: Please log in.' };
  }

  const { companyId, error: compError } = await ensureAdminCompany();
  if (compError || !companyId) {
    return { success: false, error: compError || 'Could not identify your organization.' };
  }

  const adminClient = createAdminClient();
  const normalizedEmail = input.email.trim().toLowerCase();
  const normalizedCode = input.employeeCode.trim().toUpperCase();
  const normalizedName = input.fullName.trim();
  const normalizedPhone = input.phone?.trim() || null;
  const normalizedDept = input.department?.trim() || 'General';
  const normalizedDesig = input.designation?.trim() || 'Staff';
  const normalizedPassport = input.passportNumber?.trim() || null;

  // 1. Check if employee already exists in this company
  const { data: existingEmp } = await adminClient
    .from('employees')
    .select('id, employee_code, email')
    .eq('company_id', companyId)
    .or(`email.eq.${normalizedEmail},employee_code.eq.${normalizedCode}`)
    .maybeSingle();

  if (existingEmp) {
    if (existingEmp.email === normalizedEmail) {
      return { success: false, error: 'An employee with this email already exists in your company.' };
    }
    return { success: false, error: 'An employee with this Employee Code already exists.' };
  }

  // 2. Fetch administrator profile to personalize the invite
  const { data: adminProfile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .maybeSingle();

  const adminName = adminProfile?.full_name || 'Organization Admin';

  // 3. Prepare target setup-password onboarding URL (Use production Vercel domain)
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL && !process.env.NEXT_PUBLIC_SITE_URL.includes('localhost')
      ? process.env.NEXT_PUBLIC_SITE_URL
      : 'https://tripboard-dusky.vercel.app';
  const setupUrl = `${siteUrl}/auth/setup-password`;
  const directOnboardingUrl = `${setupUrl}?email=${encodeURIComponent(normalizedEmail)}&name=${encodeURIComponent(normalizedName)}&admin=${encodeURIComponent(adminName)}`;

  let authUserId: string | null = null;
  let inviteSent = false;

  try {
    // Dispatch official Supabase invitation email with admin metadata and custom redirect
    const { data: inviteData, error: inviteErr } = await adminClient.auth.admin.inviteUserByEmail(
      normalizedEmail,
      {
        redirectTo: directOnboardingUrl,
        data: {
          full_name: normalizedName,
          admin_name: adminName,
          role: 'employee',
          company_id: companyId,
        },
      }
    );

    if (!inviteErr && inviteData?.user) {
      authUserId = inviteData.user.id;
      inviteSent = true;
    } else if (
      inviteErr?.message?.toLowerCase().includes('already registered') ||
      inviteErr?.message?.toLowerCase().includes('already been registered')
    ) {
      // If user already exists in auth, look up existing user ID
      const { data: listData } = await adminClient.auth.admin.listUsers();
      const existingUser = listData?.users?.find((u) => u.email?.toLowerCase() === normalizedEmail);
      if (existingUser) {
        authUserId = existingUser.id;
      }
      inviteSent = true;
    } else if (inviteErr) {
      console.warn('[addAndInviteEmployee] inviteUserByEmail note:', inviteErr.message);
    }
  } catch (authErr) {
    console.error('[addAndInviteEmployee] Auth invite error:', authErr);
  }

  // 4. Synchronize public.profiles with company and metadata
  if (authUserId) {
    await adminClient.from('profiles').upsert({
      id: authUserId,
      company_id: companyId,
      full_name: normalizedName,
      email: normalizedEmail,
      role: 'employee',
      phone: normalizedPhone,
      department: normalizedDept,
    });
  }

  // 5. Insert record into public.employees
  const { error: empInsertErr } = await adminClient.from('employees').insert({
    company_id: companyId,
    user_id: authUserId,
    full_name: normalizedName,
    employee_code: normalizedCode,
    email: normalizedEmail,
    phone: normalizedPhone,
    department: normalizedDept,
    designation: normalizedDesig,
    status: 'active',
    passport_number: normalizedPassport,
  });

  if (empInsertErr) {
    console.error('[addAndInviteEmployee] Employee table insert error:', empInsertErr);
    return { success: false, error: empInsertErr.message || 'Failed to save employee record.' };
  }

  return {
    success: true,
    inviteLink: directOnboardingUrl,
    inviteSent,
    adminName,
  };
}
