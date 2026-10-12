'use client';

import React, { useState, useEffect, useRef, Suspense, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { completeEmployeeOnboarding } from '@/app/auth/setup-password/actions';
import { Eye, EyeOff, CheckCircle2, AlertCircle, ShieldCheck } from 'lucide-react';

const OTP_LENGTH = 6;
const RESEND_COOLDOWN = 60;

function SetupPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);

  const emailParam = searchParams.get('email') || '';
  const nameParam = searchParams.get('name') || 'Team Member';
  const adminParam = searchParams.get('admin') || 'Administrator';
  const employeeCodeParam = searchParams.get('code') || '';

  const [email] = useState(emailParam);
  const [name] = useState(nameParam);
  const [admin] = useState(adminParam);
  const [employeeCode] = useState(employeeCodeParam);

  // OTP State
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isResending, setIsResending] = useState(false);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const otpSentRef = useRef(false);

  // Password State
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Status State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // 1. Session Isolation: Clear active session if belonging to a different user (e.g. Admin)
  useEffect(() => {
    async function checkActiveSession() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user && email && user.email?.toLowerCase() !== email.toLowerCase()) {
        await supabase.auth.signOut();
      }
    }
    checkActiveSession();
  }, [email, supabase]);

  const startCooldown = () => {
    setResendCooldown(RESEND_COOLDOWN);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(cooldownRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  useEffect(() => {
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, []);

  // 2. Auto-dispatch OTP on initial landing
  useEffect(() => {
    if (!email || otpSentRef.current) return;
    otpSentRef.current = true;

    async function autoSendOtp() {
      try {
        const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email);
        if (!resetErr) {
          setSuccessMsg('A 6-digit verification code has been dispatched to your email.');
          startCooldown();
        }
      } catch {
        // Silently allow manual resend button if auto-dispatch hits rate limiting
      }
    }

    autoSendOtp();
  }, [email, supabase]);

  // Handle OTP digit changes
  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const digit = value.slice(-1);
    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);

    if (digit && index < OTP_LENGTH - 1) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    if (!pasted) return;
    const newOtp = [...otp];
    for (let i = 0; i < pasted.length; i++) {
      newOtp[i] = pasted[i];
    }
    setOtp(newOtp);
    const focusIndex = Math.min(pasted.length, OTP_LENGTH - 1);
    otpRefs.current[focusIndex]?.focus();
  };

  const handleResendOtp = async () => {
    if (!email || resendCooldown > 0 || isResending) return;
    setIsResending(true);
    setError('');

    try {
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email);
      if (resetErr) {
        setError(resetErr.message || 'Failed to resend verification code.');
      } else {
        setSuccessMsg('A fresh verification code has been dispatched to your email.');
        startCooldown();
      }
    } catch {
      setError('Failed to resend verification code. Please try again.');
    } finally {
      setIsResending(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    const token = otp.join('');
    if (token.length !== OTP_LENGTH) {
      setError(`Please enter the complete ${OTP_LENGTH}-digit verification code.`);
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match. Please verify both entries.');
      return;
    }

    setLoading(true);

    try {
      // 1. Verify 6-digit OTP code
      let authUser = null;
      const { data: recoveryData, error: otpError } = await supabase.auth.verifyOtp({
        email,
        token,
        type: 'recovery',
      });

      if (!otpError && recoveryData?.user) {
        authUser = recoveryData.user;
      } else {
        // Fallback: verify as 'email' type
        const { data: emailData, error: emailOtpError } = await supabase.auth.verifyOtp({
          email,
          token,
          type: 'email',
        });

        if (!emailOtpError && emailData?.user) {
          authUser = emailData.user;
        } else {
          setError(
            otpError?.message || emailOtpError?.message || 'Invalid or expired verification code.'
          );
          setLoading(false);
          return;
        }
      }

      // 2. Set user password
      const { error: passError } = await supabase.auth.updateUser({
        password,
      });

      if (passError) {
        setError(passError.message || 'Failed to set password. Please try again.');
        setLoading(false);
        return;
      }

      // 3. Finalize onboarding in database
      if (authUser?.id) {
        await completeEmployeeOnboarding(authUser.id, email);
      }

      setSuccessMsg('Account successfully activated! Redirecting to your dashboard...');
      setTimeout(() => {
        router.replace('/employee/dashboard');
      }, 1200);
    } catch (err) {
      console.error('[SetupPassword]', err);
      setError('An unexpected error occurred. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="bg-bg-ice text-primary-blue font-sans min-h-screen flex flex-col justify-between">
      {/* NAVBAR */}
      <header
        className="min-h-[110px] md:h-[125px] relative flex flex-col md:flex-row items-center justify-between px-6 md:px-10 py-3 md:py-0 gap-3 md:gap-0 bg-cover bg-right md:bg-center bg-no-repeat shadow-nav border-b border-slate-200"
        style={{ backgroundImage: `url('/assets/bg2.png')`, backgroundColor: '#0c3370' }}
      >
        <Link href="/" className="relative z-10 flex items-center gap-3.5 group no-underline">
          <Image
            src="/assets/logo_svg.svg"
            alt="TripBoard Logo"
            width={48}
            height={48}
            className="h-12 md:h-14 w-auto drop-shadow-[0_2px_8px_rgba(0,0,0,0.35)] transition-transform duration-300 group-hover:scale-105"
            priority
          />
          <div className="flex flex-col">
            <span className="text-white font-black text-2xl md:text-[27px] tracking-[2px] leading-none drop-shadow-md">
              TRIPBOARD
            </span>
            <span className="text-sky-200/90 text-[10px] md:text-[11px] font-medium tracking-wider mt-1 leading-none drop-shadow-sm">
              Corporate Travel Management. Simplified.
            </span>
          </div>
        </Link>

        <nav className="relative z-10 flex items-center gap-6 md:gap-8">
          <Link
            href="/"
            className="text-white text-sm md:text-[15px] font-semibold drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)] transition-all duration-200 hover:text-gold-light hover:-translate-y-0.5"
          >
            Home
          </Link>
          <Link
            href="/login"
            className="text-white text-sm md:text-[15px] font-semibold drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)] transition-all duration-200 hover:text-gold-light hover:-translate-y-0.5"
          >
            Login
          </Link>
        </nav>
      </header>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex items-center justify-center p-4 md:p-8 my-6">
        <div className="w-full max-w-[620px] bg-white rounded-2xl overflow-hidden shadow-[0_20px_50px_rgba(11,42,85,0.15)] p-6 md:p-10 border border-slate-100">
          
          {/* Welcome Header */}
          <div className="text-center mb-6">
            <span className="inline-block px-3 py-1 bg-sky-100 text-brand-blue text-[11px] font-extrabold uppercase tracking-wider rounded-full mb-3">
              Corporate Onboarding Invitation
            </span>
            <h1 className="text-2xl md:text-3xl font-extrabold text-[#0B2A55] tracking-wide mb-1.5">
              Welcome, <span className="text-brand-blue">{name}</span>!
            </h1>
            <p className="text-xs md:text-sm text-slate-500 leading-relaxed max-w-md mx-auto">
              Admin <strong className="text-slate-800">{admin}</strong> has invited you to join <strong className="text-slate-800">TripBoard</strong>. Verify your corporate email and set your password to activate your account.
            </p>
          </div>

          {/* Employee Info Pill */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 mb-6 flex items-center justify-between text-xs">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Registered Email</span>
              <span className="font-bold text-primary-dark font-mono">{email || 'employee@company.com'}</span>
            </div>
            {employeeCode && (
              <div className="text-right">
                <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Employee Code</span>
                <span className="font-bold text-primary-dark font-mono">{employeeCode}</span>
              </div>
            )}
          </div>

          {/* Alerts */}
          {error && (
            <div className="mb-5 p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-5 p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Section 1: OTP Email Verification */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs uppercase font-bold text-slate-700 tracking-wider">
                  1. Enter 6-Digit Email OTP Code <span className="text-red-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={resendCooldown > 0 || isResending}
                  className="text-xs font-semibold text-[#1659A5] hover:text-gold-btn transition disabled:opacity-50 cursor-pointer"
                >
                  {resendCooldown > 0 ? `Resend OTP (${resendCooldown}s)` : isResending ? 'Sending...' : 'Send / Resend OTP'}
                </button>
              </div>
              <p className="text-[11px] text-slate-500">
                Enter the 6-digit confirmation code dispatched to your corporate inbox.
              </p>

              <div className="flex gap-2.5 justify-center py-1">
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => {
                      otpRefs.current[index] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    onPaste={handlePaste}
                    className="w-12 h-14 text-center text-xl font-bold border-2 border-[#D5E5F2] rounded-xl bg-[#F8FCFF] text-[#0B2A55] outline-none focus:border-[#1659A5] focus:bg-white focus:ring-2 focus:ring-sky-200 transition"
                  />
                ))}
              </div>
            </div>

            {/* Section 2: Password Setup */}
            <div className="border-t border-slate-100 pt-4 space-y-4">
              <span className="block text-xs uppercase font-bold text-slate-700 tracking-wider">
                2. Setup Your Account Password
              </span>

              {/* New Password */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  New Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Create a strong password (min 8 characters)"
                    className="w-full px-4 py-3 bg-[#F8FCFF] border border-[#D5E5F2] rounded-xl text-sm outline-none focus:border-[#1659A5] focus:bg-white transition pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  Confirm New Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password to confirm"
                    className="w-full px-4 py-3 bg-[#F8FCFF] border border-[#D5E5F2] rounded-xl text-sm outline-none focus:border-[#1659A5] focus:bg-white transition pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="bg-amber-50/70 border border-amber-200/70 rounded-xl p-3 text-[11px] text-amber-900 leading-relaxed flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-amber-700 flex-shrink-0" />
                <span>Password must be at least 8 characters long with alphanumeric characters.</span>
              </div>
            </div>

            {/* Action Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-gold-btn to-[#E0B82F] hover:from-gold-btn-hover hover:to-gold-btn text-white font-bold text-sm uppercase tracking-wider shadow-btn-gold transition cursor-pointer disabled:opacity-50 mt-2"
            >
              {loading ? 'ACTIVATING ACCOUNT...' : 'VERIFY & ACTIVATE ACCOUNT'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link
              href="/login"
              className="text-xs font-bold text-[#1659A5] hover:text-gold-btn transition-colors"
            >
              Already have credentials? Back to Login
            </Link>
          </div>

        </div>
      </main>

      {/* FOOTER */}
      <footer className="bg-primary-dark text-[#B8C9DA] text-center py-5 px-4 text-sm mt-auto">
        <p className="m-0">© 2026 TripBoard. All Rights Reserved.</p>
      </footer>
    </div>
  );
}

export default function SetupPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-bg-ice flex items-center justify-center">
          <div className="text-center space-y-2">
            <div className="w-8 h-8 border-4 border-brand-blue border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm font-semibold text-slate-500">Loading Invitation...</p>
          </div>
        </div>
      }
    >
      <SetupPasswordContent />
    </Suspense>
  );
}
