'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Building2,
  Phone,
  Mail,
  MapPin,
  FileText,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  Receipt,
  Copy,
  Check,
  HelpCircle,
  Globe,
  Store,
  Printer,
} from 'lucide-react';
import { db } from '@/lib/firebase';
import { doc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { toast } from '@/context/ToastContext';
import { logAuditEvent } from '@/lib/auditLogger';
import { BusinessSettings, DEFAULT_BUSINESS_SETTINGS } from '@/lib/businessSettings';

export default function SettingsClient() {
  const { user, employeeProfile } = useAuth();
  const [formData, setFormData] = useState<BusinessSettings>(DEFAULT_BUSINESS_SETTINGS);
  const [savedData, setSavedData] = useState<BusinessSettings>(DEFAULT_BUSINESS_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'preview'>('profile');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Check if current user has edit permission
  const canEdit = useMemo(() => {
    if (!employeeProfile) return true;
    if (employeeProfile.isSuperAdmin) return true;
    if (user?.email && !employeeProfile) return true;
    return Boolean(employeeProfile.permissions?.settings?.edit ?? true);
  }, [employeeProfile, user]);

  // Load settings from Firestore in real-time
  useEffect(() => {
    const docRef = doc(db, 'settings', 'business');
    const unsubscribe = onSnapshot(
      docRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as BusinessSettings;
          const merged: BusinessSettings = {
            ...DEFAULT_BUSINESS_SETTINGS,
            ...data,
          };
          setSavedData(merged);
          setFormData(merged);
        } else {
          // Initialize with default settings if document doesn't exist
          setSavedData(DEFAULT_BUSINESS_SETTINGS);
          setFormData(DEFAULT_BUSINESS_SETTINGS);
        }
        setIsLoading(false);
      },
      (error) => {
        console.error('Error fetching business settings:', error);
        toast.error('Failed to load settings', error.message);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Check for dirty state
  const isDirty = useMemo(() => {
    return JSON.stringify(formData) !== JSON.stringify(savedData);
  }, [formData, savedData]);

  const handleChange = (field: keyof BusinessSettings, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));

    // Clear error on edit
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const copyToClipboard = (text: string, fieldName: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    toast.info(`Copied ${fieldName} to clipboard`);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.businessName.trim()) {
      newErrors.businessName = 'Business Name is required';
    }

    if (!formData.mobile.trim()) {
      newErrors.mobile = 'Mobile Number is required';
    } else {
      const cleanPhone = formData.mobile.replace(/[\s\-()+]/g, '');
      if (cleanPhone.length < 10) {
        newErrors.mobile = 'Please enter a valid mobile number (at least 10 digits)';
      }
    }

    if (!formData.address.trim()) {
      newErrors.address = 'Business Address is required';
    }

    // GST Number validation (optional or 15-chars standard alphanumeric)
    if (formData.gstNumber.trim()) {
      const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/i;
      const cleanGst = formData.gstNumber.trim().toUpperCase();
      if (cleanGst.length > 0 && cleanGst.length !== 15) {
        newErrors.gstNumber = 'GSTIN must be 15 characters long (e.g. 33AAAAA0000A1Z5)';
      }
    }

    // Email validation (optional)
    if (formData.email && formData.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email.trim())) {
        newErrors.email = 'Please enter a valid email address';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!canEdit) {
      toast.warning('Permission Denied', 'You do not have permission to edit business settings.');
      return;
    }

    if (!validateForm()) {
      toast.error('Validation Error', 'Please correct the highlighted fields before saving.');
      return;
    }

    setIsSaving(true);
    try {
      const docRef = doc(db, 'settings', 'business');
      const currentUserEmail = user?.email || employeeProfile?.mobile || employeeProfile?.empId || 'admin';
      const currentUserName = employeeProfile?.name || (user?.email ? user.email.split('@')[0] : 'Admin');

      const payload = {
        ...formData,
        businessName: formData.businessName.trim(),
        mobile: formData.mobile.trim(),
        alternateMobile: formData.alternateMobile?.trim() || '',
        address: formData.address.trim(),
        city: formData.city?.trim() || '',
        state: formData.state?.trim() || '',
        pincode: formData.pincode?.trim() || '',
        gstNumber: formData.gstNumber.trim().toUpperCase(),
        email: formData.email.trim(),
        tagline: formData.tagline?.trim() || '',
        fssaiNumber: formData.fssaiNumber?.trim() || '',
        website: formData.website?.trim() || '',
        footerNote: formData.footerNote?.trim() || '',
        updatedAt: serverTimestamp(),
        updatedBy: currentUserEmail,
        updatedByName: currentUserName,
      };

      await setDoc(docRef, payload, { merge: true });

      // Record in audit logs
      await logAuditEvent({
        action: 'Settings Updated',
        actionType: 'general',
        description: `Updated business profile settings for ${formData.businessName}`,
        employeeId: employeeProfile?.id || user?.uid || 'admin',
        employeeName: currentUserName,
        employeeRole: employeeProfile?.isSuperAdmin ? 'SuperAdmin' : 'Administrator',
      });

      setSavedData(formData);
      toast.success('Settings Saved Successfully', 'Business details updated across the application.');
    } catch (err: any) {
      console.error('Error saving settings:', err);
      toast.error('Failed to save settings', err?.message || 'An unexpected error occurred.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setFormData(savedData);
    setErrors({});
    toast.info('Changes discarded', 'Reverted back to last saved values.');
  };

  // Format date helper
  const formattedLastUpdated = useMemo(() => {
    if (!savedData.updatedAt) return 'Never / Default';
    try {
      if (savedData.updatedAt.toDate) {
        return savedData.updatedAt.toDate().toLocaleString('en-IN', {
          dateStyle: 'medium',
          timeStyle: 'short',
        });
      }
      return new Date(savedData.updatedAt).toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
    } catch (e) {
      return 'Recently';
    }
  }, [savedData.updatedAt]);

  return (
    <div className="space-y-6 pb-12">
      {/* ── TOP HEADER BAR ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-lg border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-lg bg-[#02626D]/10 text-[#02626D] flex items-center justify-center border border-[#02626D]/20 shadow-2xs">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">Business Settings</h1>
              <span className="px-2 py-0.5 text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Sync
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Configure your business identity, contact details, GST, and bill printing headers.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          {isDirty && (
            <button
              type="button"
              onClick={handleReset}
              disabled={isSaving}
              className="h-9 px-3.5 text-xs font-semibold rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <RotateCcw size={14} />
              Discard
            </button>
          )}

          <button
            type="button"
            onClick={() => handleSave()}
            disabled={!canEdit || isSaving || !isDirty}
            className={`h-9 px-4 text-xs font-semibold rounded-md flex items-center gap-2 shadow-2xs transition-all cursor-pointer ${
              !canEdit || !isDirty || isSaving
                ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                : 'bg-[#02626D] text-white hover:bg-[#014d56] border border-[#02626D]'
            }`}
          >
            {isSaving ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save size={14} />
                <span>Save Changes</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── UNSAVED CHANGES BANNER ── */}
      {isDirty && (
        <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-lg flex items-center justify-between gap-3 text-amber-900 animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5 text-xs">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>Unsaved changes detected.</strong> Click <em>&quot;Save Changes&quot;</em> to apply updates to all billing slips, thermal printers, and invoices.
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleReset}
              className="text-xs underline font-semibold text-amber-800 hover:text-amber-900 cursor-pointer"
            >
              Discard
            </button>
            <button
              onClick={() => handleSave()}
              disabled={isSaving}
              className="h-7 px-3 text-[11px] font-bold rounded bg-amber-600 text-white hover:bg-amber-700 shadow-2xs cursor-pointer"
            >
              Save Now
            </button>
          </div>
        </div>
      )}

      {/* ── TABS NAVIGATION ── */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('profile')}
          className={`h-8 px-3.5 text-xs font-semibold rounded-md flex items-center gap-2 cursor-pointer transition-colors ${
            activeTab === 'profile'
              ? 'bg-[#02626D] text-white shadow-2xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Building2 size={14} />
          <span>Business Details</span>
        </button>

        <button
          onClick={() => setActiveTab('preview')}
          className={`h-8 px-3.5 text-xs font-semibold rounded-md flex items-center gap-2 cursor-pointer transition-colors ${
            activeTab === 'preview'
              ? 'bg-[#02626D] text-white shadow-2xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Receipt size={14} />
          <span>Receipt & Bill Preview</span>
        </button>
      </div>

      {/* ── TAB 1: BUSINESS PROFILE FORM ── */}
      {activeTab === 'profile' && (
        <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main Form Fields */}
          <div className="lg:col-span-8 space-y-6">
            {/* Primary Business Identity Card */}
            <div className="bg-white rounded-lg border border-slate-200 shadow-2xs p-6 space-y-5">
              <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Store className="w-4 h-4 text-[#02626D]" />
                    Company & Identity Details
                  </h2>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Official business registration name, tagline, and tax credentials.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Business Name (Required) */}
                <div className="md:col-span-2 space-y-1.5">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1">
                    Business Name <span className="text-rose-600 font-bold">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={formData.businessName}
                      onChange={(e) => handleChange('businessName', e.target.value)}
                      placeholder="e.g. Pattabiram Sweets"
                      disabled={!canEdit}
                      className={`w-full h-9 px-3 text-xs rounded-md border bg-white focus:outline-none focus:ring-1 transition-all ${
                        errors.businessName
                          ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-200'
                          : 'border-slate-300 focus:border-[#02626D] focus:ring-[#02626D]/20'
                      }`}
                    />
                  </div>
                  {errors.businessName && (
                    <p className="text-[11px] text-rose-600 flex items-center gap-1">
                      <AlertCircle size={12} /> {errors.businessName}
                    </p>
                  )}
                  <p className="text-[11px] text-slate-400">
                    This name will appear as the main header on all receipts, dispatch notes, and invoices.
                  </p>
                </div>

                {/* Tagline / Slogan */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1">
                    Tagline / Subtitle <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={formData.tagline || ''}
                    onChange={(e) => handleChange('tagline', e.target.value)}
                    placeholder="e.g. Traditional Sweets & Savouries"
                    disabled={!canEdit}
                    className="w-full h-9 px-3 text-xs rounded-md border border-slate-300 bg-white focus:outline-none focus:border-[#02626D] focus:ring-1 focus:ring-[#02626D]/20"
                  />
                  <p className="text-[11px] text-slate-400">Printed directly below the store name.</p>
                </div>

                {/* GST Number */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      GST Number (GSTIN) <span className="text-slate-400 font-normal">(Optional)</span>
                    </span>
                    {formData.gstNumber && (
                      <button
                        type="button"
                        onClick={() => copyToClipboard(formData.gstNumber, 'GST Number')}
                        className="text-[10px] text-[#02626D] hover:underline flex items-center gap-0.5 cursor-pointer"
                      >
                        {copiedField === 'GST Number' ? <Check size={10} /> : <Copy size={10} />}
                        <span>Copy</span>
                      </button>
                    )}
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      maxLength={15}
                      value={formData.gstNumber}
                      onChange={(e) => handleChange('gstNumber', e.target.value.toUpperCase())}
                      placeholder="e.g. 33AAAAA0000A1Z5"
                      disabled={!canEdit}
                      className={`w-full h-9 px-3 font-mono text-xs uppercase rounded-md border bg-white focus:outline-none focus:ring-1 transition-all ${
                        errors.gstNumber
                          ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-200'
                          : 'border-slate-300 focus:border-[#02626D] focus:ring-[#02626D]/20'
                      }`}
                    />
                  </div>
                  {errors.gstNumber ? (
                    <p className="text-[11px] text-rose-600 flex items-center gap-1">
                      <AlertCircle size={12} /> {errors.gstNumber}
                    </p>
                  ) : (
                    <p className="text-[11px] text-slate-400">15-digit Goods and Services Tax Identification Number.</p>
                  )}
                </div>

                {/* FSSAI License Number */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1">
                    FSSAI License No. <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    maxLength={14}
                    value={formData.fssaiNumber || ''}
                    onChange={(e) => handleChange('fssaiNumber', e.target.value)}
                    placeholder="e.g. 12419008000123"
                    disabled={!canEdit}
                    className="w-full h-9 px-3 font-mono text-xs rounded-md border border-slate-300 bg-white focus:outline-none focus:border-[#02626D] focus:ring-1 focus:ring-[#02626D]/20"
                  />
                  <p className="text-[11px] text-slate-400">Food Safety and Standards Authority license number.</p>
                </div>

                {/* Website */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1">
                    Website URL <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <div className="relative flex items-center">
                    <Globe className="w-3.5 h-3.5 absolute left-3 text-slate-400 pointer-events-none" />
                    <input
                      type="url"
                      value={formData.website || ''}
                      onChange={(e) => handleChange('website', e.target.value)}
                      placeholder="https://pattabiramsweets.com"
                      disabled={!canEdit}
                      className="w-full h-9 pl-9 pr-3 text-xs rounded-md border border-slate-300 bg-white focus:outline-none focus:border-[#02626D] focus:ring-1 focus:ring-[#02626D]/20"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Contact & Communication Card */}
            <div className="bg-white rounded-lg border border-slate-200 shadow-2xs p-6 space-y-5">
              <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Phone className="w-4 h-4 text-[#02626D]" />
                    Contact & Communication
                  </h2>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Official phone numbers and email used on customer bills & dispatch SMS.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Mobile Number (Required) */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      Primary Mobile Number <span className="text-rose-600 font-bold">*</span>
                    </span>
                    {formData.mobile && (
                      <button
                        type="button"
                        onClick={() => copyToClipboard(formData.mobile, 'Mobile')}
                        className="text-[10px] text-[#02626D] hover:underline flex items-center gap-0.5 cursor-pointer"
                      >
                        {copiedField === 'Mobile' ? <Check size={10} /> : <Copy size={10} />}
                        <span>Copy</span>
                      </button>
                    )}
                  </label>
                  <div className="relative flex items-center">
                    <Phone className="w-3.5 h-3.5 absolute left-3 text-slate-400 pointer-events-none" />
                    <input
                      type="tel"
                      value={formData.mobile}
                      onChange={(e) => handleChange('mobile', e.target.value)}
                      placeholder="e.g. 9840000000"
                      disabled={!canEdit}
                      className={`w-full h-9 pl-9 pr-3 text-xs rounded-md border bg-white focus:outline-none focus:ring-1 transition-all ${
                        errors.mobile
                          ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-200'
                          : 'border-slate-300 focus:border-[#02626D] focus:ring-[#02626D]/20'
                      }`}
                    />
                  </div>
                  {errors.mobile && (
                    <p className="text-[11px] text-rose-600 flex items-center gap-1">
                      <AlertCircle size={12} /> {errors.mobile}
                    </p>
                  )}
                  <p className="text-[11px] text-slate-400">Primary customer support & enquiry hotline.</p>
                </div>

                {/* Alternate Mobile */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1">
                    Alternate Mobile / Landline <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="tel"
                    value={formData.alternateMobile || ''}
                    onChange={(e) => handleChange('alternateMobile', e.target.value)}
                    placeholder="e.g. 044-26800000"
                    disabled={!canEdit}
                    className="w-full h-9 px-3 text-xs rounded-md border border-slate-300 bg-white focus:outline-none focus:border-[#02626D] focus:ring-1 focus:ring-[#02626D]/20"
                  />
                  <p className="text-[11px] text-slate-400">Secondary contact number for billing receipts.</p>
                </div>

                {/* Email Address (Optional) */}
                <div className="md:col-span-2 space-y-1.5">
                  <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      Email Address <span className="text-slate-400 font-normal">(Optional)</span>
                    </span>
                    {formData.email && (
                      <button
                        type="button"
                        onClick={() => copyToClipboard(formData.email, 'Email')}
                        className="text-[10px] text-[#02626D] hover:underline flex items-center gap-0.5 cursor-pointer"
                      >
                        {copiedField === 'Email' ? <Check size={10} /> : <Copy size={10} />}
                        <span>Copy</span>
                      </button>
                    )}
                  </label>
                  <div className="relative flex items-center">
                    <Mail className="w-3.5 h-3.5 absolute left-3 text-slate-400 pointer-events-none" />
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleChange('email', e.target.value)}
                      placeholder="e.g. info@pattabiramsweets.com"
                      disabled={!canEdit}
                      className={`w-full h-9 pl-9 pr-3 text-xs rounded-md border bg-white focus:outline-none focus:ring-1 transition-all ${
                        errors.email
                          ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-200'
                          : 'border-slate-300 focus:border-[#02626D] focus:ring-[#02626D]/20'
                      }`}
                    />
                  </div>
                  {errors.email && (
                    <p className="text-[11px] text-rose-600 flex items-center gap-1">
                      <AlertCircle size={12} /> {errors.email}
                    </p>
                  )}
                  <p className="text-[11px] text-slate-400">
                    Used for sending automated reports, OTP verification emails, and invoice copies.
                  </p>
                </div>
              </div>
            </div>

            {/* Business Address Card */}
            <div className="bg-white rounded-lg border border-slate-200 shadow-2xs p-6 space-y-5">
              <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-[#02626D]" />
                    Business Physical Address
                  </h2>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Physical location printed on tax invoices, delivery notes, and thermal slips.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Full Address (Required) */}
                <div className="md:col-span-3 space-y-1.5">
                  <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      Complete Street Address <span className="text-rose-600 font-bold">*</span>
                    </span>
                    {formData.address && (
                      <button
                        type="button"
                        onClick={() => copyToClipboard(formData.address, 'Address')}
                        className="text-[10px] text-[#02626D] hover:underline flex items-center gap-0.5 cursor-pointer"
                      >
                        {copiedField === 'Address' ? <Check size={10} /> : <Copy size={10} />}
                        <span>Copy</span>
                      </button>
                    )}
                  </label>
                  <textarea
                    rows={3}
                    value={formData.address}
                    onChange={(e) => handleChange('address', e.target.value)}
                    placeholder="e.g. No. 12, Main Bazaar Road, Pattabiram, Chennai"
                    disabled={!canEdit}
                    className={`w-full p-3 text-xs rounded-md border bg-white focus:outline-none focus:ring-1 allow-any-height transition-all resize-y ${
                      errors.address
                        ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-200'
                        : 'border-slate-300 focus:border-[#02626D] focus:ring-[#02626D]/20'
                    }`}
                  />
                  {errors.address && (
                    <p className="text-[11px] text-rose-600 flex items-center gap-1">
                      <AlertCircle size={12} /> {errors.address}
                    </p>
                  )}
                </div>

                {/* City */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-800">City / District</label>
                  <input
                    type="text"
                    value={formData.city || ''}
                    onChange={(e) => handleChange('city', e.target.value)}
                    placeholder="e.g. Chennai"
                    disabled={!canEdit}
                    className="w-full h-9 px-3 text-xs rounded-md border border-slate-300 bg-white focus:outline-none focus:border-[#02626D] focus:ring-1 focus:ring-[#02626D]/20"
                  />
                </div>

                {/* State */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-800">State</label>
                  <input
                    type="text"
                    value={formData.state || ''}
                    onChange={(e) => handleChange('state', e.target.value)}
                    placeholder="e.g. Tamil Nadu"
                    disabled={!canEdit}
                    className="w-full h-9 px-3 text-xs rounded-md border border-slate-300 bg-white focus:outline-none focus:border-[#02626D] focus:ring-1 focus:ring-[#02626D]/20"
                  />
                </div>

                {/* Pincode */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-800">Postal Code (PIN)</label>
                  <input
                    type="text"
                    maxLength={6}
                    value={formData.pincode || ''}
                    onChange={(e) => handleChange('pincode', e.target.value)}
                    placeholder="e.g. 600072"
                    disabled={!canEdit}
                    className="w-full h-9 px-3 font-mono text-xs rounded-md border border-slate-300 bg-white focus:outline-none focus:border-[#02626D] focus:ring-1 focus:ring-[#02626D]/20"
                  />
                </div>
              </div>
            </div>

            {/* Bill & Invoice Footer Message Card */}
            <div className="bg-white rounded-lg border border-slate-200 shadow-2xs p-6 space-y-4">
              <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[#02626D]" />
                    Receipt Footer & Greeting Note
                  </h2>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Custom greeting message printed at the bottom of customer receipts.
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <input
                  type="text"
                  value={formData.footerNote || ''}
                  onChange={(e) => handleChange('footerNote', e.target.value)}
                  placeholder="e.g. Thank you for choosing Pattabiram Sweets! Visit again!"
                  disabled={!canEdit}
                  className="w-full h-9 px-3 text-xs rounded-md border border-slate-300 bg-white focus:outline-none focus:border-[#02626D] focus:ring-1 focus:ring-[#02626D]/20"
                />
                <p className="text-[11px] text-slate-400">
                  Displays centered at the very end of POS bills and packing slips.
                </p>
              </div>
            </div>
          </div>

          {/* Right Sidebar: Live Preview Card & Fast Actions */}
          <div className="lg:col-span-4 space-y-6">
            {/* Live Business Card Widget */}
            <div className="bg-gradient-to-br from-[#02626D] to-[#014048] text-white p-5 rounded-lg shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-white/20 pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-teal-200" />
                  <span className="text-xs font-extrabold uppercase tracking-wider text-teal-100">
                    Live Business Identity
                  </span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-white/10 text-white font-mono">
                  Active
                </span>
              </div>

              <div>
                <h3 className="text-lg font-extrabold tracking-tight text-white leading-tight">
                  {formData.businessName || 'Your Business Name'}
                </h3>
                {formData.tagline && (
                  <p className="text-xs text-teal-100 font-medium italic mt-0.5">
                    {formData.tagline}
                  </p>
                )}
              </div>

              <div className="space-y-2 text-xs text-teal-50 pt-1">
                <div className="flex items-start gap-2">
                  <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5 text-teal-300" />
                  <span className="line-clamp-2 leading-relaxed">
                    {formData.address || 'Address not set'}
                    {formData.pincode ? ` - ${formData.pincode}` : ''}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 shrink-0 text-teal-300" />
                  <span>{formData.mobile || 'Mobile not set'}</span>
                  {formData.alternateMobile && (
                    <span className="text-teal-200 text-[11px]">/ {formData.alternateMobile}</span>
                  )}
                </div>

                {formData.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 shrink-0 text-teal-300" />
                    <span className="truncate">{formData.email}</span>
                  </div>
                )}

                {formData.gstNumber && (
                  <div className="flex items-center gap-2 pt-1 border-t border-white/15">
                    <span className="text-[10px] font-bold text-teal-200">GSTIN:</span>
                    <span className="font-mono text-xs font-semibold">{formData.gstNumber}</span>
                  </div>
                )}

                {formData.fssaiNumber && (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-teal-200">FSSAI:</span>
                    <span className="font-mono text-xs font-semibold">{formData.fssaiNumber}</span>
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-white/15 flex items-center justify-between text-[11px] text-teal-200">
                <span>Status</span>
                <span className="font-semibold text-white">Verified Profile</span>
              </div>
            </div>

            {/* Quick Summary / Status Card */}
            <div className="bg-white rounded-lg border border-slate-200 shadow-2xs p-5 space-y-3.5">
              <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wider">
                <Clock size={14} className="text-[#02626D]" />
                Metadata & Sync Status
              </h4>

              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Last Modified:</span>
                  <span className="font-semibold text-slate-800">{formattedLastUpdated}</span>
                </div>

                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Modified By:</span>
                  <span className="font-semibold text-slate-800">
                    {savedData.updatedByName || savedData.updatedBy || 'Administrator'}
                  </span>
                </div>

                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Database Record:</span>
                  <span className="font-mono text-[11px] font-bold text-[#02626D]">
                    settings/business
                  </span>
                </div>

                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Real-time Updates:</span>
                  <span className="inline-flex items-center gap-1 text-emerald-600 font-bold text-[11px]">
                    <CheckCircle2 size={12} /> Enabled
                  </span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('preview')}
                  className="w-full h-8 text-xs font-semibold rounded bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Receipt size={13} />
                  <span>Preview on Thermal Printer</span>
                </button>
              </div>
            </div>

            {/* Help / Guidance Card */}
            <div className="bg-slate-50 rounded-lg border border-slate-200 p-4 space-y-2 text-xs text-slate-600">
              <div className="flex items-center gap-1.5 font-bold text-slate-800">
                <HelpCircle size={14} className="text-[#02626D]" />
                <span>How are these settings used?</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-600 pl-1 leading-relaxed">
                <li>
                  <strong>POS & Billing:</strong> Appears on thermal receipts (58mm/80mm).
                </li>
                <li>
                  <strong>Order Dispatch:</strong> Printed on packing slips and invoice bills.
                </li>
                <li>
                  <strong>GST Compliance:</strong> Printed on B2B wholesaler tax invoices.
                </li>
                <li>
                  <strong>Customer SMS & Email:</strong> Sent as sender identification info.
                </li>
              </ul>
            </div>
          </div>
        </form>
      )}

      {/* ── TAB 2: RECEIPT & BILL PREVIEW ── */}
      {activeTab === 'preview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Thermal Slip 80mm Preview */}
          <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-4 shadow-2xs">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-[#02626D]" />
                <h3 className="text-sm font-bold text-slate-900">
                  Thermal Receipt Preview (3&quot; / 80mm)
                </h3>
              </div>
              <span className="text-[10px] font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-600">
                48 Columns
              </span>
            </div>

            {/* Paper Bill Simulation */}
            <div className="bg-amber-50/40 p-6 rounded-md border border-dashed border-slate-300 font-mono text-xs text-slate-900 max-w-sm mx-auto shadow-inner space-y-3">
              {/* Receipt Header */}
              <div className="text-center space-y-1 pb-2 border-b border-dashed border-slate-400">
                <p className="font-extrabold text-sm tracking-wider uppercase">
                  {formData.businessName || 'PATTABIRAM SWEETS'}
                </p>
                {formData.tagline && (
                  <p className="text-[10px] text-slate-600 italic">{formData.tagline}</p>
                )}
                <p className="text-[11px] leading-tight text-slate-700">
                  {formData.address || '12, Main Road, Pattabiram, Chennai - 600072'}
                </p>
                <p className="text-[11px] text-slate-700">
                  Phone: {formData.mobile || '9840000000'}
                  {formData.alternateMobile ? `, ${formData.alternateMobile}` : ''}
                </p>
                {formData.gstNumber && (
                  <p className="text-[11px] font-bold text-slate-800">
                    GSTIN: {formData.gstNumber}
                  </p>
                )}
                {formData.fssaiNumber && (
                  <p className="text-[10px] text-slate-600">
                    FSSAI Lic: {formData.fssaiNumber}
                  </p>
                )}
              </div>

              {/* Sample Items */}
              <div className="space-y-1 text-[11px] py-2 border-b border-dashed border-slate-400">
                <div className="flex justify-between font-bold text-slate-800">
                  <span>ITEM</span>
                  <span>QTY</span>
                  <span>AMT</span>
                </div>
                <div className="flex justify-between">
                  <span>Mysore Pak (Spl Ghee)</span>
                  <span>1.000 kg</span>
                  <span>₹680.00</span>
                </div>
                <div className="flex justify-between">
                  <span>Motichoor Laddu</span>
                  <span>0.500 kg</span>
                  <span>₹260.00</span>
                </div>
                <div className="flex justify-between">
                  <span>Special Mixture</span>
                  <span>0.250 kg</span>
                  <span>₹110.00</span>
                </div>
              </div>

              {/* Total */}
              <div className="space-y-1 text-[11px] py-1 border-b border-dashed border-slate-400">
                <div className="flex justify-between font-extrabold text-xs">
                  <span>TOTAL AMOUNT</span>
                  <span>₹1,050.00</span>
                </div>
                <div className="flex justify-between text-slate-600 text-[10px]">
                  <span>PAYMENT MODE:</span>
                  <span>UPI / CASH</span>
                </div>
              </div>

              {/* Footer */}
              <div className="text-center pt-2 text-[10px] text-slate-600 space-y-0.5">
                <p className="font-semibold">{formData.footerNote || 'Thank you! Visit again!'}</p>
                {formData.website && <p className="text-[9px]">{formData.website}</p>}
                <p className="text-[9px] text-slate-400 pt-1">*** END OF BILL ***</p>
              </div>
            </div>
          </div>

          {/* A4 Tax Invoice Header Preview */}
          <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-4 shadow-2xs">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#02626D]" />
                <h3 className="text-sm font-bold text-slate-900">
                  A4 Tax Invoice Header Preview
                </h3>
              </div>
              <span className="text-[10px] font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-600">
                B2B Invoice
              </span>
            </div>

            {/* A4 Invoice Preview */}
            <div className="bg-white p-5 rounded-md border border-slate-300 text-slate-800 shadow-sm space-y-4">
              <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4">
                <div>
                  <h4 className="text-lg font-black tracking-tight text-slate-900">
                    {formData.businessName || 'PATTABIRAM SWEETS'}
                  </h4>
                  <p className="text-[11px] text-slate-500 font-medium">
                    {formData.tagline || 'Traditional Sweets & Savouries'}
                  </p>
                  <p className="text-xs text-slate-700 mt-1 max-w-xs leading-tight">
                    {formData.address || 'Address'}
                    {formData.city ? `, ${formData.city}` : ''}
                    {formData.pincode ? ` - ${formData.pincode}` : ''}
                  </p>
                  <p className="text-xs text-slate-700 mt-0.5">
                    Phone: {formData.mobile} | Email: {formData.email || 'N/A'}
                  </p>
                </div>

                <div className="text-right space-y-1">
                  <span className="px-2 py-1 text-xs font-extrabold uppercase bg-slate-100 border border-slate-300 rounded text-slate-800">
                    TAX INVOICE
                  </span>
                  <p className="text-xs text-slate-600 pt-2">
                    GSTIN: <span className="font-mono font-bold text-slate-900">{formData.gstNumber || 'N/A'}</span>
                  </p>
                  {formData.fssaiNumber && (
                    <p className="text-xs text-slate-600">
                      FSSAI: <span className="font-mono font-bold text-slate-900">{formData.fssaiNumber}</span>
                    </p>
                  )}
                </div>
              </div>

              <div className="bg-slate-50 p-3 rounded border border-slate-200 text-xs text-slate-600">
                <p className="font-bold text-slate-800 mb-1">Live Information Consistency</p>
                <p className="text-[11px] leading-relaxed">
                  The business details above are dynamically pulled by all order modules, PDF generators, dispatch packing slips, and ESC/POS thermal printers in real-time.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
