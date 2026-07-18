'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Phone,
  Mail,
  Globe,
  MapPin,
  MessageSquare,
  Send,
  CheckCircle2,
  Clock,
  Headphones,
  ExternalLink,
  Copy,
  Check,
  HelpCircle,
  ChevronDown,
  Sparkles,
  ShieldCheck,
  Zap,
} from 'lucide-react';

const CONTACT_INFO = {
  mobile: '6281288314',
  formattedMobile: '+91 62812 88314',
  email: 'official.gamanext@gmail.com',
  website: 'gamanext.com',
  websiteUrl: 'https://gamanext.com',
  address: 'Chandramouli nagar, Nellore, Andhra Pradesh, India',
};

const FAQS = [
  {
    question: 'How do I record a partial or full payment for an order?',
    answer:
      'Open the order details page by clicking on any order card or eye icon. Click on the "Manage Payment" button at the top or inside the Payment Summary card to record new payments, edit existing transactions, or view the complete payment history.',
  },
  {
    question: 'How do order status updates work across slots?',
    answer:
      'Orders move through 11 distinct stages (Order Created, Moved to Manufacturing, Manufacturing Started, etc.). You can change the order status directly from the status badge dropdown or from the Order Details page.',
  },
  {
    question: 'Can I restrict payment amounts from exceeding the bill total?',
    answer:
      'Yes! The system automatically caps payment inputs to the exact remaining balance due, ensuring you never record payments exceeding the customer\'s total bill.',
  },
  {
    question: 'How do I add new items or update price lists?',
    answer:
      'Navigate to the "Items" or "Price List" section in the top menu bar to manage categories, units, manufacturing descriptions, and unit prices.',
  },
  {
    question: 'Who should I contact if I experience network or system downtime?',
    answer:
      'You can reach our dedicated technical support line directly at +91 62812 88314 or email official.gamanext@gmail.com for instant technical assistance.',
  },
];

export default function SupportClient() {
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // Contact Form state
  const [formName, setFormName] = useState('');
  const [formContact, setFormContact] = useState('');
  const [formSubject, setFormSubject] = useState('');
  const [formPriority, setFormPriority] = useState<'Normal' | 'High' | 'Urgent'>('Normal');
  const [formMessage, setFormMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [ticketSent, setTicketSent] = useState(false);

  const handleCopy = (text: string, type: 'email' | 'phone') => {
    navigator.clipboard.writeText(text);
    if (type === 'email') {
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2000);
    } else {
      setCopiedPhone(true);
      setTimeout(() => setCopiedPhone(false), 2000);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName || !formMessage) return;

    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setTicketSent(true);
      setFormName('');
      setFormContact('');
      setFormSubject('');
      setFormMessage('');
    }, 1000);
  };

  return (
    <div className="w-full flex flex-col gap-8 font-sans pb-12">

      {/* ── 1. Hero Header Banner ──────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-900 via-indigo-800 to-violet-900 text-white p-6 sm:p-10 shadow-xl border border-indigo-700/50">
        {/* Subtle decorative grid background */}
        <div className="absolute inset-0 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px] opacity-10 pointer-events-none" />

        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs font-semibold text-indigo-200">
            <Sparkles size={14} className="text-amber-300 animate-pulse" />
            <span>Gamanext Official Technical Support</span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight">
            How can we help you today?
          </h1>
          <p className="text-sm sm:text-base text-indigo-100/90 leading-relaxed">
            Get instant support for Pattabiram Sweets Management Software. Contact our technical engineering team directly or send a message for quick resolution.
          </p>

          <div className="flex flex-wrap gap-4 pt-2">
            <div className="flex items-center gap-2 text-xs font-semibold bg-emerald-500/20 text-emerald-200 px-3.5 py-1.5 rounded-xl border border-emerald-400/30">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>All Systems Operational</span>
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold bg-white/10 text-white px-3.5 py-1.5 rounded-xl border border-white/20">
              <Clock size={14} className="text-indigo-300" />
              <span>Avg. Response Time: &lt; 15 mins</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── 2. Primary Contact Touchpoints Grid ─────────────────────── */}
      <div>
        <h2 className="text-base font-extrabold text-slate-900 mb-4 flex items-center gap-2">
          <Headphones size={18} className="text-indigo-600" />
          Direct Support Channels
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">

          {/* 1. Phone / Mobile Card */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs hover:shadow-md transition-all space-y-4 group">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Phone size={22} />
              </div>
              <button
                onClick={() => handleCopy(CONTACT_INFO.mobile, 'phone')}
                className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100 transition-colors"
                title="Copy phone number"
              >
                {copiedPhone ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} />}
              </button>
            </div>

            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Mobile Support</p>
              <h3 className="text-lg font-extrabold text-slate-900 mt-0.5">{CONTACT_INFO.formattedMobile}</h3>
              <p className="text-xs text-slate-500 mt-1">Available 24/7 for urgent technical assistance</p>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
              <a
                href={`tel:${CONTACT_INFO.mobile}`}
                className="flex-1 flex items-center justify-center gap-1.5 px-[8px] py-[4px] h-[30px] rounded-[6px] bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors"
              >
                <Phone size={13} /> Call Now
              </a>
              <a
                href={`https://wa.me/91${CONTACT_INFO.mobile}`}
                target="_blank"
                rel="noreferrer"
                className="flex-1 flex items-center justify-center gap-1.5 px-[8px] py-[4px] h-[30px] rounded-[6px] bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors"
              >
                <MessageSquare size={13} /> WhatsApp
              </a>
            </div>
          </div>

          {/* 2. Email Support Card */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs hover:shadow-md transition-all space-y-4 group">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-2xl bg-violet-50 text-violet-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Mail size={22} />
              </div>
              <button
                onClick={() => handleCopy(CONTACT_INFO.email, 'email')}
                className="p-1.5 text-slate-400 hover:text-violet-600 rounded-lg hover:bg-slate-100 transition-colors"
                title="Copy email address"
              >
                {copiedEmail ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} />}
              </button>
            </div>

            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Email Helpdesk</p>
              <h3 className="text-sm font-extrabold text-slate-900 mt-0.5 break-all">{CONTACT_INFO.email}</h3>
              <p className="text-xs text-slate-500 mt-1">Send your queries or feature requests anytime</p>
            </div>

            <div className="pt-2 border-t border-slate-100">
              <a
                href={`mailto:${CONTACT_INFO.email}`}
                className="w-full flex items-center justify-center gap-1.5 px-[8px] py-[4px] h-[30px] rounded-[6px] bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold transition-colors"
              >
                <Mail size={13} /> Send Email
              </a>
            </div>
          </div>

          {/* 3. Official Website Card */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs hover:shadow-md transition-all space-y-4 group">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Globe size={22} />
              </div>
              <ExternalLink size={16} className="text-slate-400" />
            </div>

            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Official Website</p>
              <h3 className="text-lg font-extrabold text-slate-900 mt-0.5">{CONTACT_INFO.website}</h3>
              <p className="text-xs text-slate-500 mt-1">Visit GamaNext official portal & products</p>
            </div>

            <div className="pt-2 border-t border-slate-100">
              <a
                href={CONTACT_INFO.websiteUrl}
                target="_blank"
                rel="noreferrer"
                className="w-full flex items-center justify-center gap-1.5 px-[8px] py-[4px] h-[30px] rounded-[6px] bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold transition-colors"
              >
                <Globe size={13} /> Visit Website <ExternalLink size={12} />
              </a>
            </div>
          </div>

          {/* 4. Office Address Card */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs hover:shadow-md transition-all space-y-4 group">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                <MapPin size={22} />
              </div>
            </div>

            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Office Location</p>
              <p className="text-xs font-extrabold text-slate-900 mt-1 leading-snug">{CONTACT_INFO.address}</p>
            </div>

            <div className="pt-2 border-t border-slate-100">
              <a
                href={`https://maps.google.com/?q=${encodeURIComponent(CONTACT_INFO.address)}`}
                target="_blank"
                rel="noreferrer"
                className="w-full flex items-center justify-center gap-1.5 px-[8px] py-[4px] h-[30px] rounded-[6px] bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition-colors"
              >
                <MapPin size={13} /> View on Map
              </a>
            </div>
          </div>

        </div>
      </div>

      {/* ── 3. Interactive Form & FAQ Grid ───────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Support Request Form (2 cols) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                <MessageSquare size={20} />
              </div>
              <div>
                <h2 className="text-sm font-extrabold text-slate-900">Send Support Request</h2>
                <p className="text-xs text-slate-500 mt-0.5">Submit a message directly to GamaNext engineering team</p>
              </div>
            </div>
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
              Direct Ticket
            </span>
          </div>

          <div className="p-6">
            {ticketSent ? (
              <div className="py-10 text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-200">
                  <CheckCircle2 size={32} />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900">Support Ticket Sent!</h3>
                  <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                    Thank you for reaching out. Our engineering team at GamaNext has received your message and will contact you shortly.
                  </p>
                </div>
                <button
                  onClick={() => setTicketSent(false)}
                  className="px-[8px] py-[4px] h-[30px] rounded-[6px] bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  Send Another Message
                </button>
              </div>
            ) : (
              <form onSubmit={handleFormSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Your Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Pattabiram Sweets Admin"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 bg-slate-50/50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Contact Number / Email</label>
                    <input
                      type="text"
                      placeholder="e.g. 6281288314 or email@domain.com"
                      value={formContact}
                      onChange={(e) => setFormContact(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 bg-slate-50/50"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Subject</label>
                    <input
                      type="text"
                      placeholder="e.g. Need assistance with printer configuration"
                      value={formSubject}
                      onChange={(e) => setFormSubject(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 bg-slate-50/50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Priority Level</label>
                    <select
                      value={formPriority}
                      onChange={(e) => setFormPriority(e.target.value as any)}
                      className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 bg-slate-50/50 font-semibold text-slate-700"
                    >
                      <option value="Normal">Normal Priority</option>
                      <option value="High">High Priority</option>
                      <option value="Urgent">Urgent / Downtime</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Message Details <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    required
                    rows={4}
                    placeholder="Describe your issue, feature request, or technical query in detail..."
                    value={formMessage}
                    onChange={(e) => setFormMessage(e.target.value)}
                    className="w-full p-3.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 bg-slate-50/50 resize-none"
                  />
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex items-center gap-2 px-[8px] py-[4px] h-[30px] rounded-[6px] bg-gradient-to-br from-indigo-600 to-indigo-800 hover:from-indigo-700 hover:to-indigo-900 text-white text-xs font-bold shadow-sm transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Send size={14} />
                    <span>{isSubmitting ? 'Sending Request…' : 'Submit Support Request'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* FAQs Accordion (1 col) */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <HelpCircle size={16} className="text-indigo-600" />
              Frequently Asked Questions
            </h2>
          </div>

          <div className="p-4 divide-y divide-slate-100">
            {FAQS.map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div key={idx} className="py-3">
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full flex items-center justify-between text-left gap-3 focus:outline-none group"
                  >
                    <span className="text-xs font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">
                      {faq.question}
                    </span>
                    <ChevronDown
                      size={14}
                      className={`text-slate-400 transition-transform duration-200 flex-shrink-0 ${
                        isOpen ? 'rotate-180 text-indigo-600' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <p className="text-xs text-slate-500 mt-2 leading-relaxed pl-1 border-l-2 border-indigo-500/30">
                      {faq.answer}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* ── 4. Brand & SLA Footer Banner ────────────────────────────── */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-4 border border-slate-700/80 shadow-md">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600/30 border border-indigo-400/30 text-indigo-300 flex items-center justify-center flex-shrink-0">
            <ShieldCheck size={26} />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-white">GamaNext Business Solutions</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Official software provider for Pattabiram Sweets • Chandramouli nagar, Nellore, AP
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          <a
            href={CONTACT_INFO.websiteUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 px-[8px] py-[4px] h-[30px] rounded-[6px] bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors"
          >
            <Zap size={14} /> GamaNext Portal
          </a>
        </div>
      </div>

    </div>
  );
}
