'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/AuthContext';
import { IndiaDatePicker } from '@/components/ui/IndiaDatePicker';
import { IndiaPhoneInput } from '@/components/ui/IndiaPhoneInput';
import { addAndInviteEmployee } from '@/app/admin/employees/actions';
import { User, ArrowLeft, CheckCircle2, Copy, Check } from 'lucide-react';

export default function AddEmployeePage() {
  const router = useRouter();

  const [fullName, setFullName] = useState('');
  const [employeeCode, setEmployeeCode] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('+91 ');
  const [department, setDepartment] = useState('IT');
  const [designation, setDesignation] = useState('');
  const [joiningDate, setJoiningDate] = useState('01/10/2026');
  const [passportNumber, setPassportNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successInfo, setSuccessInfo] = useState<{ inviteLink?: string; inviteSent?: boolean; adminName?: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!fullName.trim() || !employeeCode.trim() || !email.trim()) {
      setError('Please fill in all required fields.');
      return;
    }

    setLoading(true);

    try {
      const result = await addAndInviteEmployee({
        fullName: fullName.trim(),
        employeeCode: employeeCode.trim(),
        email: email.trim(),
        phone: phone.trim(),
        department: department.trim(),
        designation: designation.trim() || 'Staff',
        passportNumber: passportNumber.trim() || undefined,
      });

      if (!result.success) {
        setError(result.error || 'Failed to add employee.');
        setLoading(false);
        return;
      }

      setSuccessInfo({
        inviteLink: result.inviteLink,
        inviteSent: result.inviteSent,
        adminName: result.adminName,
      });
      setLoading(false);
    } catch (err) {
      console.error('[AddEmployee]', err instanceof Error ? err.message : String(err));
      setError('An unexpected error occurred. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Heading */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-primary-dark tracking-wide">
            ADD NEW EMPLOYEE
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Register a company team member into the central travel directory.
          </p>
        </div>
        <Link
          href="/admin/employees"
          className="text-sm font-bold text-[#1659A5] hover:text-gold-btn transition flex items-center gap-1.5"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Directory
        </Link>
      </div>

      {/* Form Card (matching add-employee.html layout) */}
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl p-8 md:p-10 shadow-card border border-slate-100 space-y-6"
      >
        <div className="flex items-center gap-4 pb-4 border-b border-slate-100">
          <div className="w-12 h-12 bg-sky-50 text-brand-blue rounded-xl flex items-center justify-center">
            <User className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-primary-dark">Employee Information</h2>
            <p className="text-xs text-slate-500">Provide official identity and contact details.</p>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        {successInfo && (
          <div className="p-5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl space-y-3">
            <div className="flex items-center gap-2.5 font-bold text-sm text-emerald-800">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <span>
                Employee added successfully! An invitation from Admin &quot;{successInfo.adminName || 'Admin'}&quot; has been dispatched.
              </span>
            </div>
            {successInfo.inviteLink && (
              <div className="space-y-1.5 pt-1">
                <p className="text-xs text-slate-600 font-medium">Direct Onboarding Link (Welcome & Password Setup):</p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={successInfo.inviteLink}
                    className="flex-1 px-3 py-2 bg-white border border-emerald-300 rounded-xl text-xs font-mono text-slate-700 select-all outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(successInfo.inviteLink!);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>
            )}
            <div className="pt-2 flex items-center gap-3">
              <Link
                href="/admin/employees"
                className="px-4 py-2 bg-primary-dark hover:bg-primary-blue text-white rounded-xl text-xs font-bold transition"
              >
                Go to Employees Directory →
              </Link>
              <button
                type="button"
                onClick={() => {
                  setSuccessInfo(null);
                  setFullName('');
                  setEmployeeCode('');
                  setEmail('');
                  setPhone('+91 ');
                  setDesignation('');
                  setPassportNumber('');
                }}
                className="px-4 py-2 bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-100/50 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                + Add Another Employee
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Full Name */}
          <div>
            <label className="block text-xs uppercase font-bold text-slate-600 mb-1.5">
              Full Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Rahul Sharma"
              className="w-full px-4 py-2.5 bg-[#F8FCFF] border border-[#D5E5F2] rounded-xl text-sm outline-none focus:border-brand-blue font-medium"
              required
            />
          </div>

          {/* Employee ID */}
          <div>
            <label className="block text-xs uppercase font-bold text-slate-600 mb-1.5">
              Employee ID Code <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={employeeCode}
              onChange={(e) => setEmployeeCode(e.target.value)}
              placeholder="e.g. EMP001"
              className="w-full px-4 py-2.5 bg-[#F8FCFF] border border-[#D5E5F2] rounded-xl text-sm outline-none focus:border-brand-blue font-medium font-mono uppercase"
              required
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs uppercase font-bold text-slate-600 mb-1.5">
              Work Email Address <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="employee@company.com"
              className="w-full px-4 py-2.5 bg-[#F8FCFF] border border-[#D5E5F2] rounded-xl text-sm outline-none focus:border-brand-blue font-medium"
              required
            />
          </div>

          {/* Phone (India Phone Standard with +91 and picker) */}
          <IndiaPhoneInput
            label="Phone Number"
            value={phone}
            onChange={(full) => setPhone(full)}
            required
          />

          {/* Department */}
          <div>
            <label className="block text-xs uppercase font-bold text-slate-600 mb-1.5">
              Department
            </label>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="w-full px-4 py-2.5 bg-[#F8FCFF] border border-[#D5E5F2] rounded-xl text-sm outline-none focus:border-brand-blue font-medium cursor-pointer"
            >
              <option value="IT">IT & Engineering</option>
              <option value="Finance">Finance & Accounts</option>
              <option value="HR">Human Resources</option>
              <option value="Marketing">Marketing & Growth</option>
              <option value="Sales">Sales & BD</option>
              <option value="Operations">Operations</option>
              <option value="Legal">Legal & Compliance</option>
            </select>
          </div>

          {/* Designation */}
          <div>
            <label className="block text-xs uppercase font-bold text-slate-600 mb-1.5">
              Designation / Role
            </label>
            <input
              type="text"
              value={designation}
              onChange={(e) => setDesignation(e.target.value)}
              placeholder="e.g. Software Engineer"
              className="w-full px-4 py-2.5 bg-[#F8FCFF] border border-[#D5E5F2] rounded-xl text-sm outline-none focus:border-brand-blue font-medium"
            />
          </div>

          {/* Joining Date (India Date Picker in DD/MM/YYYY) */}
          <IndiaDatePicker
            label="Date of Joining"
            value={joiningDate}
            onChange={(formatted) => setJoiningDate(formatted)}
          />

          {/* Passport Number */}
          <div>
            <label className="block text-xs uppercase font-bold text-slate-600 mb-1.5">
              Passport Number (Optional)
            </label>
            <input
              type="text"
              value={passportNumber}
              onChange={(e) => setPassportNumber(e.target.value)}
              placeholder="e.g. Z1234567"
              className="w-full px-4 py-2.5 bg-[#F8FCFF] border border-[#D5E5F2] rounded-xl text-sm outline-none focus:border-brand-blue font-medium font-mono uppercase"
            />
          </div>
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-end gap-4 pt-4 border-t border-slate-100">
          <Link
            href="/admin/employees"
            className="px-6 py-3 rounded-xl border border-slate-300 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="px-8 py-3 bg-gradient-to-r from-gold-btn to-[#E0B82F] hover:from-gold-btn-hover hover:to-gold-btn text-white font-bold text-sm rounded-xl shadow-btn-gold transition cursor-pointer disabled:opacity-50"
          >
            {loading ? 'SAVING...' : 'SAVE EMPLOYEE'}
          </button>
        </div>
      </form>
    </div>
  );
}
