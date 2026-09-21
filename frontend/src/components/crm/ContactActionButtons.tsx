'use client';

import React, { useState } from 'react';
import { MessageCircle, Mail, Phone, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { inboxApi } from '../../lib/api';

export interface ContactActionButtonsProps {
  contact: {
    _id?: string;
    fullName?: string;
    firstName?: string;
    lastName?: string;
    phoneNumber?: string;
    whatsappNumber?: string;
    email?: string;
    alternateEmail?: string;
  };
  onOpenEmail?: (contact: any) => void;
  onShowToast?: (message: string, type?: 'info' | 'success' | 'error') => void;
  size?: 'sm' | 'md' | 'lg';
  showLabels?: boolean;
}

export function ContactActionButtons({
  contact,
  onOpenEmail,
  onShowToast,
  size = 'sm',
  showLabels = false,
}: ContactActionButtonsProps) {
  const router = useRouter();
  const [checkingWhatsApp, setCheckingWhatsApp] = useState(false);
  const [callingState, setCallingState] = useState(false);

  const displayName =
    contact?.fullName?.trim() ||
    `${contact?.firstName || ''} ${contact?.lastName || ''}`.trim() ||
    'Contact';

  // Primary numbers and emails
  const rawWhatsApp = contact?.whatsappNumber || contact?.phoneNumber || '';
  const rawPhone = contact?.phoneNumber || contact?.whatsappNumber || '';
  const rawEmail = contact?.email || contact?.alternateEmail || '';

  // Clean digits for tel and wa.me
  const cleanWhatsAppDigits = rawWhatsApp.replace(/[^0-9]/g, '');
  const cleanPhoneDigits = rawPhone.replace(/[^0-9+]/g, '');
  const cleanEmail = rawEmail.trim();

  const hasWhatsApp = cleanWhatsAppDigits.length >= 6;
  const hasPhone = cleanPhoneDigits.replace(/[^0-9]/g, '').length >= 5;
  const hasEmail = Boolean(cleanEmail && cleanEmail.includes('@'));

  // ================= 1. WHATSAPP ACTION =================
  const handleWhatsAppClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!hasWhatsApp) {
      if (onShowToast) onShowToast('WhatsApp number is not available.', 'info');
      return;
    }

    setCheckingWhatsApp(true);
    try {
      // Priority 1: Check if an existing AutoMarket conversation exists for this contact
      const conversations = await inboxApi.getWhatsAppConversations(undefined, cleanWhatsAppDigits);
      const existingConv = (conversations || []).find((c: any) => {
        const cPhone = String(c.customerPhoneNumber || '').replace(/[^0-9]/g, '');
        const cContactId = c.contactId?._id || c.contactId;
        return (
          (contact._id && String(cContactId) === String(contact._id)) ||
          (cPhone && (cPhone.includes(cleanWhatsAppDigits) || cleanWhatsAppDigits.includes(cPhone)))
        );
      });

      if (existingConv) {
        if (onShowToast) onShowToast(`Opening conversation with ${displayName}...`, 'info');
        router.push(`/inbox/whatsapp?phone=${encodeURIComponent(cleanWhatsAppDigits)}`);
        return;
      }

      // Priority 2: Fallback to safe wa.me link in new tab without auto-sending
      if (onShowToast) onShowToast(`Opening WhatsApp chat for ${displayName}...`, 'info');
      const waUrl = `https://wa.me/${cleanWhatsAppDigits}`;
      window.open(waUrl, '_blank', 'noopener,noreferrer');
    } catch (err) {
      // Fallback directly to wa.me if conversation search is unavailable
      const waUrl = `https://wa.me/${cleanWhatsAppDigits}`;
      window.open(waUrl, '_blank', 'noopener,noreferrer');
    } finally {
      setCheckingWhatsApp(false);
    }
  };

  // ================= 2. EMAIL ACTION =================
  const handleEmailClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!hasEmail) {
      if (onShowToast) onShowToast('Email address is not available.', 'info');
      return;
    }

    if (onOpenEmail) {
      onOpenEmail(contact);
    } else {
      // Safe fallback: trigger default system mail client
      if (onShowToast) onShowToast(`Opening mail compose for ${cleanEmail}...`, 'info');
      window.location.href = `mailto:${encodeURIComponent(cleanEmail)}`;
    }
  };

  // ================= 3. CALL ACTION (LOCAL DEVICE ONLY) =================
  const handleCallClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!hasPhone) {
      if (onShowToast) onShowToast('Phone number is not available.', 'info');
      return;
    }

    setCallingState(true);
    if (onShowToast) {
      onShowToast(`Opening your device dialer for ${displayName}...`, 'info');
    }

    // Standard RFC 3966 / browser-native local device dialer trigger
    // Mobile: triggers device phone dialer
    // Desktop: triggers registered OS telephony app (Facetime, Phone Link, Skype, etc.)
    const telUrl = `tel:${cleanPhoneDigits}`;
    window.location.href = telUrl;

    setTimeout(() => {
      setCallingState(false);
    }, 1500);
  };

  const btnSizes = {
    sm: 'p-1.5 text-xs',
    md: 'px-2.5 py-1.5 text-xs',
    lg: 'px-3.5 py-2 text-sm',
  };

  const iconSizes = {
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-4.5 h-4.5',
  };

  return (
    <div
      className="inline-flex items-center gap-1 bg-slate-50/80 p-0.5 rounded-lg border border-slate-200/60 shadow-2xs"
      onClick={(e) => e.stopPropagation()}
    >
      {/* 1. WHATSAPP BUTTON */}
      <button
        type="button"
        onClick={handleWhatsAppClick}
        disabled={!hasWhatsApp || checkingWhatsApp}
        aria-label={`Chat with ${displayName} on WhatsApp`}
        title={
          hasWhatsApp
            ? `WhatsApp: ${rawWhatsApp} (Click to open chat)`
            : 'WhatsApp number is not available.'
        }
        className={`${btnSizes[size]} inline-flex items-center gap-1.5 rounded-md font-medium transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500/30 ${
          hasWhatsApp
            ? 'text-emerald-700 bg-white hover:bg-emerald-50 hover:text-emerald-800 border border-emerald-200/80 shadow-2xs cursor-pointer active:scale-95'
            : 'text-slate-300 bg-slate-100/50 cursor-not-allowed opacity-60'
        }`}
      >
        {checkingWhatsApp ? (
          <Loader2 className={`${iconSizes[size]} animate-spin text-emerald-600`} />
        ) : (
          <MessageCircle className={`${iconSizes[size]} text-emerald-600`} />
        )}
        {showLabels && <span>WhatsApp</span>}
      </button>

      {/* 2. EMAIL BUTTON */}
      <button
        type="button"
        onClick={handleEmailClick}
        disabled={!hasEmail}
        aria-label={`Send email to ${displayName}`}
        title={
          hasEmail
            ? `Email: ${cleanEmail} (Click to compose email)`
            : 'Email address is not available.'
        }
        className={`${btnSizes[size]} inline-flex items-center gap-1.5 rounded-md font-medium transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/30 ${
          hasEmail
            ? 'text-blue-700 bg-white hover:bg-blue-50 hover:text-blue-800 border border-blue-200/80 shadow-2xs cursor-pointer active:scale-95'
            : 'text-slate-300 bg-slate-100/50 cursor-not-allowed opacity-60'
        }`}
      >
        <Mail className={`${iconSizes[size]} text-blue-600`} />
        {showLabels && <span>Email</span>}
      </button>

      {/* 3. CALL BUTTON (LOCAL DEVICE ONLY) */}
      <button
        type="button"
        onClick={handleCallClick}
        disabled={!hasPhone || callingState}
        aria-label={`Call ${displayName} on local device dialer`}
        title={
          hasPhone
            ? `Call: ${rawPhone} (Opens device dialer)`
            : 'Phone number is not available.'
        }
        className={`${btnSizes[size]} inline-flex items-center gap-1.5 rounded-md font-medium transition-all focus:outline-none focus:ring-2 focus:ring-violet-500/30 ${
          hasPhone
            ? 'text-violet-700 bg-white hover:bg-violet-50 hover:text-violet-800 border border-violet-200/80 shadow-2xs cursor-pointer active:scale-95'
            : 'text-slate-300 bg-slate-100/50 cursor-not-allowed opacity-60'
        }`}
      >
        {callingState ? (
          <Loader2 className={`${iconSizes[size]} animate-spin text-violet-600`} />
        ) : (
          <Phone className={`${iconSizes[size]} text-violet-600`} />
        )}
        {showLabels && <span>Call</span>}
      </button>
    </div>
  );
}
