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
  const domain = profile.email?.split('@')[1] || 'enterprise.com';
  const companyName = `${profile.full_name || 'My'}'s Organization`;

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

  // 2. Invite user via Supabase Auth Admin (Dispatches magic link / invite email)
  let authUserId: string | null = null;
  let inviteLink: string | undefined;
  let inviteSent = false;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001';
  const callbackUrl = `${siteUrl}/auth/callback`;

  try {
    // Dispatch official Supabase invitation email with magic login link
    const { data: inviteData, error: inviteErr } = await adminClient.auth.admin.inviteUserByEmail(
      normalizedEmail,
      {
        redirectTo: callbackUrl,
        data: {
          full_name: normalizedName,
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
      // If user already exists in auth, dispatch magic link via signInWithOtp
      const { data: listData } = await adminClient.auth.admin.listUsers();
      const existingUser = listData?.users?.find((u) => u.email?.toLowerCase() === normalizedEmail);
      if (existingUser) {
        authUserId = existingUser.id;
      }
      const client = await createClient();
      await client.auth.signInWithOtp({
        email: normalizedEmail,
        options: {
          emailRedirectTo: callbackUrl,
        },
      });
      inviteSent = true;
    } else if (inviteErr) {
      console.warn('[addAndInviteEmployee] inviteUserByEmail note:', inviteErr.message);
    }

    // Also generate direct action link for immediate on-screen access
    const { data: linkData } = await adminClient.auth.admin.generateLink({
      type: 'invite',
      email: normalizedEmail,
      options: {
        redirectTo: callbackUrl,
        data: {
          full_name: normalizedName,
          role: 'employee',
          company_id: companyId,
        },
      },
    });

    if (linkData?.properties?.action_link) {
      inviteLink = linkData.properties.action_link;
      if (!authUserId && linkData.user?.id) {
        authUserId = linkData.user.id;
      }
    }
  } catch (authErr) {
    console.error('[addAndInviteEmployee] Auth invite error:', authErr);
  }

  // If user was created in auth, ensure public.profiles row is synchronized with company
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

  // 3. Insert record into public.employees
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
    inviteLink,
    inviteSent,
  };
}
