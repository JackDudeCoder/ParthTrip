'use server';

import { createAdminClient } from '@/lib/supabase/admin';

export interface OnboardingCompleteResult {
  success: boolean;
  error?: string;
}

/**
 * Finalizes employee account activation.
 * Synchronizes profiles and employees tables to 'active' status.
 */
export async function completeEmployeeOnboarding(
  userId: string,
  email: string
): Promise<OnboardingCompleteResult> {
  if (!userId || !email) {
    return { success: false, error: 'Missing user identification.' };
  }

  try {
    const adminClient = createAdminClient();
    const normalizedEmail = email.trim().toLowerCase();

    // 1. Update public.profiles
    const { error: profErr } = await adminClient
      .from('profiles')
      .update({
        role: 'employee',
      })
      .eq('id', userId);

    if (profErr) {
      console.warn('[completeEmployeeOnboarding] Profile update warning:', profErr.message);
    }

    // 2. Update public.employees status to 'active'
    const { error: empErr } = await adminClient
      .from('employees')
      .update({
        status: 'active',
        user_id: userId,
      })
      .eq('email', normalizedEmail);

    if (empErr) {
      console.warn('[completeEmployeeOnboarding] Employee status warning:', empErr.message);
    }

    return { success: true };
  } catch (err) {
    console.error('[completeEmployeeOnboarding] Error:', err);
    return { success: false, error: 'Internal database synchronization error.' };
  }
}
