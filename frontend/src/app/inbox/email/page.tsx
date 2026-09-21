'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import {
  Inbox,
  Star,
  Clock,
  Send,
  FileEdit,
  Tag,
  ShieldAlert,
  Trash2,
  Archive,
  Search,
  RefreshCw,
  SlidersHorizontal,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Paperclip,
  CheckSquare,
  Square,
  MinusSquare,
  Mail,
  MailOpen,
  Reply,
  ReplyAll,
  Forward,
  MoreVertical,
  Maximize2,
  Minimize2,
  X,
  Plus,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  Printer,
  Sparkles,
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Link as LinkIcon,
  Smile,
  ArrowLeft,
  FolderInput,
  Bookmark,
  Check,
} from 'lucide-react';
import { inboxApi, emailApi, extractErrorMessage } from '../../../lib/api';

const PREDEFINED_LABELS = [
  { name: 'Work', color: 'bg-blue-500 text-blue-500' },
  { name: 'Leads', color: 'bg-emerald-500 text-emerald-500' },
  { name: 'Urgent', color: 'bg-rose-500 text-rose-500' },
  { name: 'Clients', color: 'bg-purple-500 text-purple-500' },
  { name: 'Support', color: 'bg-amber-500 text-amber-500' },
];

export default function EmailInboxPage() {
  // Accounts
  const [accounts, setAccounts] = useState<any[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');

  // Folders & Navigation
  const [currentFolder, setCurrentFolder] = useState<string>('inbox');
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Lists & Thread Selection
  const [conversations, setConversations] = useState<any[]>([]);
  const [totalConversations, setTotalConversations] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [folderCounts, setFolderCounts] = useState<any>({
    inbox: 0,
    starred: 0,
    sent: 0,
    drafts: 0,
    spam: 0,
    trash: 0,
    important: 0,
    snoozed: 0,
  });

  const [selectedConversation, setSelectedConversation] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [searchHasAttachment, setSearchHasAttachment] = useState(false);
  const [searchIsStarred, setSearchIsStarred] = useState(false);
  const [searchIsUnread, setSearchIsUnread] = useState(false);

  // Loading & Sync States
  const [loadingList, setLoadingList] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Compose Modal State
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [isComposeMinimized, setIsComposeMinimized] = useState(false);
  const [isComposeMaximized, setIsComposeMaximized] = useState(false);
  const [composeAccountId, setComposeAccountId] = useState('');
  const [composeTo, setComposeTo] = useState('');
  const [composeCc, setComposeCc] = useState('');
  const [composeBcc, setComposeBcc] = useState('');
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [composeAttachments, setComposeAttachments] = useState<any[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);

  // In-Thread Quick Reply State
  const [replyMode, setReplyMode] = useState<'reply' | 'reply_all' | 'forward'>('reply');
  const [replyBody, setReplyBody] = useState('');
  const [replySubject, setReplySubject] = useState('');
  const [replyCc, setReplyCc] = useState('');
  const [replyBcc, setReplyBcc] = useState('');
  const [showReplyCc, setShowReplyCc] = useState(false);
  const [replyAttachments, setReplyAttachments] = useState<any[]>([]);
  const [sendingReply, setSendingReply] = useState(false);
  const [isReplying, setIsReplying] = useState(false);

  // Dropdown Menus
  const [showMoveMenu, setShowMoveMenu] = useState(false);
  const [showLabelMenu, setShowLabelMenu] = useState(false);
  const [showSelectMenu, setShowSelectMenu] = useState(false);

  const selectedConvRef = useRef<any | null>(null);
  selectedConvRef.current = selectedConversation;

  // Show Toast
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  };

  // 1. Initial Load: Fetch Accounts
  useEffect(() => {
    emailApi
      .getAccounts()
      .then((accs) => {
        setAccounts(accs || []);
        if (accs && accs.length > 0 && !selectedAccountId) {
          setSelectedAccountId(accs[0]._id);
          setComposeAccountId(accs[0]._id);
        }
      })
      .catch((err) => {
        showToast(`Failed to load email accounts: ${extractErrorMessage(err)}`, 'error');
      });
  }, []);

  // 2. Fetch Counts
  const loadCounts = useCallback(async () => {
    try {
      const counts = await inboxApi.getEmailCounts(selectedAccountId || undefined);
      if (counts) setFolderCounts(counts);
    } catch (err) {
      // ignore background count error
    }
  }, [selectedAccountId]);

  // 3. Fetch Conversations
  const loadConversations = useCallback(
    async (isBackground = false) => {
      if (!isBackground) setLoadingList(true);
      try {
        const res = await inboxApi.getEmailConversations({
          accountId: selectedAccountId || undefined,
          folder: currentFolder,
          search: activeSearch || undefined,
          page: currentPage,
          limit: 25,
          label: selectedLabel || undefined,
        });

        if (res && res.items) {
          setConversations(res.items);
          setTotalConversations(res.total || res.items.length);
          setTotalPages(res.totalPages || 1);
        } else if (Array.isArray(res)) {
          setConversations(res);
          setTotalConversations(res.length);
          setTotalPages(1);
        }

        loadCounts();
      } catch (err) {
        if (!isBackground) {
          showToast(`Error loading emails: ${extractErrorMessage(err)}`, 'error');
        }
      } finally {
        if (!isBackground) setLoadingList(false);
      }
    },
    [selectedAccountId, currentFolder, activeSearch, currentPage, selectedLabel, loadCounts],
  );

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // 4. Background Polling (15s if IMAP is enabled)
  const currentAccount = accounts.find((a) => a._id === selectedAccountId);
  const isImapDisabled = currentAccount?.imapStatus === 'disabled_by_provider';

  useEffect(() => {
    if (isImapDisabled) return;
    const interval = setInterval(() => {
      loadConversations(true);
    }, 15000);
    return () => clearInterval(interval);
  }, [isImapDisabled, loadConversations]);

  // Select a Conversation to View Thread
  const handleSelectConversation = async (conv: any) => {
    setSelectedConversation(conv);
    setIsReplying(false);
    setReplySubject(conv.subject?.startsWith('Re:') ? conv.subject : `Re: ${conv.subject || ''}`);
    setReplyBody('');
    setReplyAttachments([]);
    setLoadingMessages(true);
    try {
      const msgs = await inboxApi.getEmailMessages(conv._id);
      setMessages(msgs || []);
      // Update local unread count
      setConversations((prev) =>
        prev.map((c) => (c._id === conv._id ? { ...c, unreadCount: 0 } : c)),
      );
      loadCounts();
    } catch (err) {
      showToast(`Failed to load email thread: ${extractErrorMessage(err)}`, 'error');
    } finally {
      setLoadingMessages(false);
    }
  };

  // Sync Action
  const handleSyncAccount = async () => {
    if (!selectedAccountId) return;
    setSyncing(true);
    try {
      const res = await emailApi.syncInbox(selectedAccountId);
      const accs = await emailApi.getAccounts();
      setAccounts(accs || []);
      await loadConversations();
      showToast(res.message || 'Synchronization complete', res.success ? 'success' : 'info');
    } catch (err) {
      showToast(`IMAP sync error: ${extractErrorMessage(err)}`, 'error');
    } finally {
      setSyncing(false);
    }
  };

  // Star / Unstar
  const handleToggleStar = async (e: React.MouseEvent, conv: any) => {
    e.stopPropagation();
    const newStarred = !conv.isStarred;
    setConversations((prev) =>
      prev.map((c) => (c._id === conv._id ? { ...c, isStarred: newStarred } : c)),
    );
    if (selectedConversation?._id === conv._id) {
      setSelectedConversation({ ...selectedConversation, isStarred: newStarred });
    }
    try {
      await inboxApi.updateEmailConversation(conv._id, { isStarred: newStarred });
      loadCounts();
    } catch (err) {
      showToast(`Failed to update star: ${extractErrorMessage(err)}`, 'error');
    }
  };

  // Important Toggle
  const handleToggleImportant = async (e: React.MouseEvent, conv: any) => {
    e.stopPropagation();
    const newImp = !conv.isImportant;
    setConversations((prev) =>
      prev.map((c) => (c._id === conv._id ? { ...c, isImportant: newImp } : c)),
    );
    try {
      await inboxApi.updateEmailConversation(conv._id, { isImportant: newImp });
      loadCounts();
    } catch (err) {
      showToast(`Failed to update tag: ${extractErrorMessage(err)}`, 'error');
    }
  };

  // Multi-Selection handlers
  const handleToggleSelectAll = () => {
    if (selectedIds.size === conversations.length && conversations.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(conversations.map((c) => c._id)));
    }
  };

  const handleSelectSubset = (type: 'all' | 'none' | 'read' | 'unread' | 'starred') => {
    setShowSelectMenu(false);
    if (type === 'none') {
      setSelectedIds(new Set());
    } else if (type === 'all') {
      setSelectedIds(new Set(conversations.map((c) => c._id)));
    } else if (type === 'read') {
      setSelectedIds(new Set(conversations.filter((c) => c.unreadCount === 0).map((c) => c._id)));
    } else if (type === 'unread') {
      setSelectedIds(new Set(conversations.filter((c) => (c.unreadCount || 0) > 0).map((c) => c._id)));
    } else if (type === 'starred') {
      setSelectedIds(new Set(conversations.filter((c) => c.isStarred).map((c) => c._id)));
    }
  };

  const handleToggleRowSelect = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  // Bulk Actions
  const handleBulkAction = async (action: string, payload?: any) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    try {
      await inboxApi.bulkEmailAction({ ids, action, ...payload });
      setSelectedIds(new Set());
      setShowMoveMenu(false);
      setShowLabelMenu(false);
      await loadConversations();
      showToast(`Action '${action}' applied to ${ids.length} conversation(s)`, 'success');
    } catch (err) {
      showToast(`Bulk action failed: ${extractErrorMessage(err)}`, 'error');
    }
  };

  // Single Conversation Actions from Thread View
  const handleSingleMoveFolder = async (folder: string) => {
    if (!selectedConversation) return;
    try {
      await inboxApi.updateEmailConversation(selectedConversation._id, { folder });
      showToast(`Moved to ${folder}`, 'success');
      setSelectedConversation(null);
      loadConversations();
    } catch (err) {
      showToast(`Failed to move: ${extractErrorMessage(err)}`, 'error');
    }
  };

  const handleSingleDelete = async () => {
    if (!selectedConversation) return;
    try {
      await inboxApi.deleteEmailConversation(selectedConversation._id);
      showToast('Moved to Trash', 'success');
      setSelectedConversation(null);
      loadConversations();
    } catch (err) {
      showToast(`Delete failed: ${extractErrorMessage(err)}`, 'error');
    }
  };

  // In-Thread Reply Send
  const handleSendReply = async () => {
    if (!selectedConversation || !replyBody.trim()) {
      showToast('Please enter a message body', 'error');
      return;
    }
    setSendingReply(true);
    try {
      const ccList = replyCc.split(',').map((s) => s.trim()).filter(Boolean);
      const bccList = replyBcc.split(',').map((s) => s.trim()).filter(Boolean);

      let fullHtml = replyBody;
      if (replyMode === 'forward') {
        fullHtml = `<p>${replyBody}</p><hr/><p><strong>---------- Forwarded message ---------</strong></p>` +
          `<p><strong>From:</strong> ${selectedConversation.customerEmail}</p>` +
          `<p><strong>Subject:</strong> ${selectedConversation.subject}</p>` +
          `<p><strong>Date:</strong> ${new Date(selectedConversation.lastMessageAt).toLocaleString()}</p>`;
      }

      await inboxApi.replyEmail(
        selectedConversation._id,
        {
          subject: replySubject,
          bodyHtml: fullHtml,
          cc: ccList,
          bcc: bccList,
          attachments: replyAttachments,
        },
      );

      showToast('Reply sent successfully via Zoho SMTP!', 'success');
      setReplyBody('');
      setReplyAttachments([]);
      setIsReplying(false);

      // Refresh messages
      const updatedMsgs = await inboxApi.getEmailMessages(selectedConversation._id);
      setMessages(updatedMsgs || []);
      loadCounts();
    } catch (err) {
      showToast(`Failed to send reply: ${extractErrorMessage(err)}`, 'error');
    } finally {
      setSendingReply(false);
    }
  };

  // Compose Modal Send
  const handleSendCompose = async () => {
    if (!composeTo.trim()) {
      showToast('Please specify a recipient email address', 'error');
      return;
    }
    if (!composeSubject.trim()) {
      showToast('Please add a subject line', 'error');
      return;
    }
    if (!composeBody.trim()) {
      showToast('Please enter email body content', 'error');
      return;
    }

    setIsSending(true);
    try {
      const ccList = composeCc.split(',').map((s) => s.trim()).filter(Boolean);
      const bccList = composeBcc.split(',').map((s) => s.trim()).filter(Boolean);

      await emailApi.sendEmail({
        accountId: composeAccountId || selectedAccountId,
        toEmail: composeTo.trim(),
        subject: composeSubject.trim(),
        bodyHtml: `<div style="font-family: sans-serif; line-height: 1.6; color: #1e293b;">${composeBody.replace(/\n/g, '<br/>')}</div>`,
        bodyText: composeBody,
        cc: ccList,
        bcc: bccList,
        attachments: composeAttachments,
      });

      showToast(`Email sent successfully to ${composeTo.trim()}`, 'success');
      setIsComposeOpen(false);
      resetComposeForm();
      loadConversations();
    } catch (err) {
      showToast(`Sending failed: ${extractErrorMessage(err)}`, 'error');
    } finally {
      setIsSending(false);
    }
  };

  // Save Draft
  const handleSaveDraft = async () => {
    if (!composeAccountId && !selectedAccountId) return;
    setIsSavingDraft(true);
    try {
      const res = await inboxApi.saveEmailDraft({
        accountId: composeAccountId || selectedAccountId,
        toEmail: composeTo,
        subject: composeSubject,
        bodyHtml: composeBody,
        bodyText: composeBody,
        cc: composeCc.split(',').map((s) => s.trim()).filter(Boolean),
        bcc: composeBcc.split(',').map((s) => s.trim()).filter(Boolean),
        attachments: composeAttachments,
        draftId: activeDraftId || undefined,
      });

      if (res && res.draftId) {
        setActiveDraftId(res.draftId);
      }
      showToast('Draft saved', 'info');
      loadCounts();
    } catch (err) {
      showToast(`Draft save failed: ${extractErrorMessage(err)}`, 'error');
    } finally {
      setIsSavingDraft(false);
    }
  };

  const resetComposeForm = () => {
    setComposeTo('');
    setComposeCc('');
    setComposeBcc('');
    setComposeSubject('');
    setComposeBody('');
    setComposeAttachments([]);
    setShowCc(false);
    setShowBcc(false);
    setActiveDraftId(null);
  };

  // Attachments handler
  const handleAddAttachment = (e: React.ChangeEvent<HTMLInputElement>, isReply = false) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        const newAtt = {
          filename: file.name,
          contentType: file.type || 'application/octet-stream',
          size: file.size,
          content: base64,
        };

        if (isReply) {
          setReplyAttachments((prev) => [...prev, newAtt]);
        } else {
          setComposeAttachments((prev) => [...prev, newAtt]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  // HTML Sanitizer for Safe Email Rendering
  const sanitizeEmailHtml = (rawHtml: string) => {
    if (!rawHtml) return '';
    // Strip scripts, malicious inline handlers, iframes, objects
    return rawHtml
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/on\w+\s*=\s*(["'])[\s\S]*?\1/gi, '')
      .replace(/javascript:/gi, 'blocked:');
  };

  // Format Dates nicely like Gmail
  const formatGmailDate = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();

    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    const isThisYear = date.getFullYear() === now.getFullYear();
    if (isThisYear) {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
    return date.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
  };

  // Navigation Items
  const NAV_ITEMS = [
    { id: 'inbox', label: 'Inbox', icon: Inbox, count: folderCounts.inbox, unreadHighlight: true },
    { id: 'starred', label: 'Starred', icon: Star, count: folderCounts.starred },
    { id: 'snoozed', label: 'Snoozed', icon: Clock, count: folderCounts.snoozed },
    { id: 'sent', label: 'Sent', icon: Send, count: folderCounts.sent },
    { id: 'drafts', label: 'Drafts', icon: FileEdit, count: folderCounts.drafts },
    { id: 'important', label: 'Important', icon: Bookmark, count: folderCounts.important },
    { id: 'spam', label: 'Spam', icon: ShieldAlert, count: folderCounts.spam },
    { id: 'trash', label: 'Trash', icon: Trash2, count: folderCounts.trash },
    { id: 'all', label: 'All Mail', icon: Archive },
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-4.25rem)] bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden font-sans">
      {/* ========================================================================= */}
      {/* 1. TOP HEADER & OMNI-SEARCH BAR                                            */}
      {/* ========================================================================= */}
      <header className="h-16 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 flex items-center justify-between gap-4 flex-shrink-0 z-20">
        {/* Left: App/Folder Title & Account Selector */}
        <div className="flex items-center gap-3 min-w-max">
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-2 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors md:flex hidden"
            title="Toggle Sidebar"
          >
            <SlidersHorizontal className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold text-base leading-none text-slate-900 dark:text-white flex items-center gap-2">
                Gmail-Style Mail
                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400 capitalize">
                  {selectedLabel ? `Label: ${selectedLabel}` : currentFolder}
                </span>
              </h1>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                {currentAccount?.emailAddress || 'No account selected'}
              </div>
            </div>
          </div>
        </div>

        {/* Center: Omni-Search Bar */}
        <div className="flex-1 max-w-2xl relative">
          <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 px-3.5 py-1.5 focus-within:ring-2 focus-within:ring-indigo-500/30 focus-within:border-indigo-500 transition-all shadow-sm">
            <Search className="w-4 h-4 text-slate-400 mr-2 flex-shrink-0" />
            <input
              type="text"
              placeholder="Search in mail (sender, subject, keyword)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') setActiveSearch(searchQuery);
              }}
              className="bg-transparent border-none outline-none text-sm w-full text-slate-800 dark:text-slate-200 placeholder-slate-400"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setActiveSearch('');
                }}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={() => setShowAdvancedSearch(!showAdvancedSearch)}
              className={`p-1.5 ml-1 rounded-lg text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors ${
                showAdvancedSearch ? 'text-indigo-600 bg-slate-200 dark:bg-slate-700' : ''
              }`}
              title="Filter Options"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Advanced Search Filter Modal */}
          {showAdvancedSearch && (
            <div className="absolute top-12 left-0 right-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xl z-30 animate-in fade-in zoom-in-95">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                Filter Search Criteria
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs mb-3">
                <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={searchHasAttachment}
                    onChange={(e) => setSearchHasAttachment(e.target.checked)}
                    className="rounded text-indigo-600"
                  />
                  <span>Has Attachment</span>
                </label>
                <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={searchIsStarred}
                    onChange={(e) => setSearchIsStarred(e.target.checked)}
                    className="rounded text-indigo-600"
                  />
                  <span>Starred Only</span>
                </label>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setSearchHasAttachment(false);
                    setSearchIsStarred(false);
                    setShowAdvancedSearch(false);
                  }}
                  className="px-3 py-1 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                >
                  Reset
                </button>
                <button
                  onClick={() => {
                    setActiveSearch(searchQuery);
                    setShowAdvancedSearch(false);
                  }}
                  className="px-4 py-1.5 text-xs bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 shadow-sm"
                >
                  Apply Filters
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right: Account Switcher & Actions */}
        <div className="flex items-center gap-2.5">
          {/* Account Switcher */}
          <div className="relative">
            <select
              value={selectedAccountId}
              onChange={(e) => {
                setSelectedAccountId(e.target.value);
                setComposeAccountId(e.target.value);
                setSelectedConversation(null);
              }}
              className="text-xs font-medium bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-xl px-3 py-2 pr-8 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer appearance-none max-w-[210px] truncate"
            >
              {accounts.map((acc) => (
                <option key={acc._id} value={acc._id}>
                  {acc.name} ({acc.emailAddress})
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Sync Button */}
          <button
            onClick={handleSyncAccount}
            disabled={syncing}
            className="p-2 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors relative"
            title="Sync / Fetch Updates"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin text-indigo-600' : ''}`} />
          </button>

          {/* Direct Link to Hub Settings */}
          <Link
            href="/email/hub"
            className="text-xs px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center gap-1.5"
            title="Account Management"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Accounts</span>
          </Link>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* 2. MAIN 3-PANE WORKSPACE                                                  */}
      {/* ========================================================================= */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* ----------------------------------------------------------------------- */}
        {/* LEFT GMAIL SIDEBAR (Collapsible)                                         */}
        {/* ----------------------------------------------------------------------- */}
        <aside
          className={`bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col flex-shrink-0 transition-all duration-300 z-10 ${
            sidebarCollapsed ? 'w-16 p-2' : 'w-60 p-3'
          }`}
        >
          {/* Primary "Compose" Button */}
          <button
            onClick={() => {
              setIsComposeOpen(true);
              setIsComposeMinimized(false);
            }}
            className={`flex items-center justify-center gap-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-semibold rounded-2xl shadow-lg shadow-indigo-500/25 transition-all mb-4 ${
              sidebarCollapsed ? 'w-12 h-12 p-0 mx-auto' : 'w-full py-3.5 px-4'
            }`}
          >
            <Plus className="w-5 h-5 flex-shrink-0 stroke-[2.5]" />
            {!sidebarCollapsed && <span>Compose</span>}
          </button>

          {/* Navigation Folders */}
          <nav className="flex-1 space-y-0.5 overflow-y-auto pr-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = currentFolder === item.id && !selectedLabel;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setCurrentFolder(item.id);
                    setSelectedLabel(null);
                    setSelectedConversation(null);
                    setCurrentPage(1);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                  title={item.label}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`} />
                    {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                  </div>
                  {!sidebarCollapsed && item.count !== undefined && item.count > 0 && (
                    <span
                      className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${
                        item.unreadHighlight && isActive
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}

            {/* Custom Labels Section */}
            {!sidebarCollapsed && (
              <div className="pt-4 mt-4 border-t border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between px-3 mb-2">
                  <span className="text-[11px] font-bold tracking-wider uppercase text-slate-400">
                    Labels
                  </span>
                </div>
                <div className="space-y-0.5">
                  {PREDEFINED_LABELS.map((label) => {
                    const isLabelActive = selectedLabel === label.name;
                    return (
                      <button
                        key={label.name}
                        onClick={() => {
                          setSelectedLabel(label.name);
                          setSelectedConversation(null);
                          setCurrentPage(1);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-xs transition-all ${
                          isLabelActive
                            ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 font-bold'
                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span className={`w-2.5 h-2.5 rounded-full ${label.color.split(' ')[0]}`} />
                          <span>{label.name}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </nav>

          {/* Account Health Footer */}
          {!sidebarCollapsed && (
            <div className="p-2.5 rounded-xl bg-slate-100/70 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 mt-auto">
              <div className="flex items-center justify-between text-[11px] font-medium mb-1">
                <span className="text-slate-500">SMTP: Outbound</span>
                <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Active
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] font-medium">
                <span className="text-slate-500">IMAP: Inbound</span>
                <span className={`flex items-center gap-1 font-semibold ${isImapDisabled ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isImapDisabled ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                  {isImapDisabled ? 'Disabled by Zoho' : 'Active'}
                </span>
              </div>
            </div>
          )}
        </aside>

        {/* ----------------------------------------------------------------------- */}
        {/* CENTER THREAD LIST & BULK ACTION BAR                                    */}
        {/* ----------------------------------------------------------------------- */}
        <main
          className={`flex-1 flex flex-col min-w-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 overflow-hidden ${
            selectedConversation ? 'hidden md:flex md:w-5/12 lg:w-4/12' : 'flex w-full'
          }`}
        >
          {/* Provider IMAP Warning Banner (if disabled) */}
          {isImapDisabled && (
            <div className="bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800/80 px-4 py-2.5 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5 text-amber-900 dark:text-amber-200">
                <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <span>
                  <strong>IMAP Disabled by Zoho:</strong> Enable IMAP Access in Zoho Mail Settings &rarr; Mail Accounts. Outgoing SMTP sending is fully operational.
                </span>
              </div>
              <button
                onClick={handleSyncAccount}
                disabled={syncing}
                className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-semibold flex-shrink-0 transition-colors shadow-sm"
              >
                {syncing ? 'Checking...' : 'Retry Sync'}
              </button>
            </div>
          )}

          {/* Bulk Action Toolbar */}
          <div className="h-12 border-b border-slate-200 dark:border-slate-800 px-3 flex items-center justify-between gap-2 flex-shrink-0 bg-slate-50/50 dark:bg-slate-900/50">
            {/* Master Select & Actions */}
            <div className="flex items-center gap-2">
              <div className="relative flex items-center">
                <button
                  onClick={handleToggleSelectAll}
                  className="p-1.5 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 rounded"
                >
                  {selectedIds.size === 0 ? (
                    <Square className="w-4 h-4" />
                  ) : selectedIds.size === conversations.length ? (
                    <CheckSquare className="w-4 h-4 text-indigo-600" />
                  ) : (
                    <MinusSquare className="w-4 h-4 text-indigo-600" />
                  )}
                </button>
                <button
                  onClick={() => setShowSelectMenu(!showSelectMenu)}
                  className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <ChevronDown className="w-3 h-3" />
                </button>

                {showSelectMenu && (
                  <div className="absolute top-8 left-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg py-1 z-30 w-32 text-xs">
                    <button
                      onClick={() => handleSelectSubset('all')}
                      className="w-full text-left px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      All
                    </button>
                    <button
                      onClick={() => handleSelectSubset('none')}
                      className="w-full text-left px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      None
                    </button>
                    <button
                      onClick={() => handleSelectSubset('read')}
                      className="w-full text-left px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      Read
                    </button>
                    <button
                      onClick={() => handleSelectSubset('unread')}
                      className="w-full text-left px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      Unread
                    </button>
                    <button
                      onClick={() => handleSelectSubset('starred')}
                      className="w-full text-left px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      Starred
                    </button>
                  </div>
                )}
              </div>

              {/* Bulk Action Buttons (visible when items selected) */}
              {selectedIds.size > 0 ? (
                <div className="flex items-center gap-1 pl-2 border-l border-slate-200 dark:border-slate-800 animate-in fade-in">
                  <button
                    onClick={() => handleBulkAction('mark_read')}
                    className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg"
                    title="Mark as Read"
                  >
                    <MailOpen className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleBulkAction('mark_unread')}
                    className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg"
                    title="Mark as Unread"
                  >
                    <Mail className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleBulkAction('star')}
                    className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg"
                    title="Star"
                  >
                    <Star className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleBulkAction('move_folder', { folder: 'trash' })}
                    className="p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg"
                    title="Move to Trash"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleBulkAction('move_folder', { folder: 'spam' })}
                    className="p-1.5 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-lg"
                    title="Report Spam"
                  >
                    <ShieldAlert className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => loadConversations()}
                  className="p-1.5 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg"
                  title="Refresh List"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingList ? 'animate-spin' : ''}`} />
                </button>
              )}
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>
                {conversations.length > 0 ? (currentPage - 1) * 25 + 1 : 0}-
                {Math.min(currentPage * 25, totalConversations)} of {totalConversations}
              </span>
              <div className="flex items-center">
                <button
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="p-1 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 disabled:opacity-30 disabled:pointer-events-none rounded"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="p-1 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 disabled:opacity-30 disabled:pointer-events-none rounded"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Thread List Rows */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
            {loadingList ? (
              <div className="p-8 text-center text-slate-400 space-y-3">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-500" />
                <div className="text-xs">Loading email threads...</div>
              </div>
            ) : conversations.length === 0 ? (
              <div className="p-12 text-center text-slate-400 space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
                  <Inbox className="w-7 h-7" />
                </div>
                <h3 className="font-semibold text-sm text-slate-700 dark:text-slate-300">
                  {currentFolder === 'trash'
                    ? 'Trash is empty'
                    : currentFolder === 'spam'
                    ? 'No spam messages'
                    : currentFolder === 'starred'
                    ? 'No starred messages'
                    : currentFolder === 'drafts'
                    ? 'No saved drafts'
                    : 'Your inbox is clear'}
                </h3>
                <p className="text-xs max-w-sm mx-auto text-slate-500">
                  {isImapDisabled
                    ? 'Inbound synchronization is waiting on Zoho IMAP activation. Use the Compose button to test real outbound emails!'
                    : 'No messages match this filter.'}
                </p>
              </div>
            ) : (
              conversations.map((conv) => {
                const isSelected = selectedConversation?._id === conv._id;
                const isChecked = selectedIds.has(conv._id);
                const isUnread = (conv.unreadCount || 0) > 0;

                return (
                  <div
                    key={conv._id}
                    onClick={() => handleSelectConversation(conv)}
                    className={`flex items-center gap-3 px-3.5 py-3 cursor-pointer select-none transition-colors border-l-4 ${
                      isSelected
                        ? 'bg-indigo-50/70 dark:bg-indigo-950/40 border-l-indigo-600'
                        : isChecked
                        ? 'bg-indigo-50/30 dark:bg-indigo-950/20 border-l-indigo-400'
                        : isUnread
                        ? 'bg-white dark:bg-slate-900 border-l-indigo-500 font-semibold'
                        : 'bg-slate-50/40 dark:bg-slate-900/40 hover:bg-slate-100/60 dark:hover:bg-slate-800/40 border-l-transparent text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {/* Row Checkbox */}
                    <button
                      onClick={(e) => handleToggleRowSelect(e, conv._id)}
                      className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-0.5"
                    >
                      {isChecked ? (
                        <CheckSquare className="w-4 h-4 text-indigo-600" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>

                    {/* Star Toggle */}
                    <button
                      onClick={(e) => handleToggleStar(e, conv)}
                      className={`p-0.5 transition-colors ${
                        conv.isStarred
                          ? 'text-amber-400 hover:text-amber-500 fill-amber-400'
                          : 'text-slate-300 dark:text-slate-600 hover:text-amber-400'
                      }`}
                    >
                      <Star className={`w-4 h-4 ${conv.isStarred ? 'fill-amber-400' : ''}`} />
                    </button>

                    {/* Important Tag Toggle */}
                    <button
                      onClick={(e) => handleToggleImportant(e, conv)}
                      className={`p-0.5 transition-colors ${
                        conv.isImportant
                          ? 'text-amber-500'
                          : 'text-slate-300 dark:text-slate-600 hover:text-amber-500'
                      }`}
                    >
                      <Bookmark className={`w-3.5 h-3.5 ${conv.isImportant ? 'fill-amber-500' : ''}`} />
                    </button>

                    {/* Sender Info */}
                    <div className="w-36 flex-shrink-0 truncate">
                      <span
                        className={`text-xs truncate block ${
                          isUnread
                            ? 'font-bold text-slate-900 dark:text-white'
                            : 'text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {conv.customerName || conv.customerEmail}
                      </span>
                    </div>

                    {/* Subject & Snippet */}
                    <div className="flex-1 min-w-0 flex items-center gap-2">
                      <span
                        className={`text-xs truncate ${
                          isUnread
                            ? 'font-bold text-slate-900 dark:text-white'
                            : 'text-slate-800 dark:text-slate-200'
                        }`}
                      >
                        {conv.subject || '(no subject)'}
                      </span>
                      <span className="text-xs text-slate-400 dark:text-slate-500 truncate hidden sm:inline">
                        — {conv.snippet || conv.subject}
                      </span>

                      {/* Labels Pill */}
                      {conv.labels && conv.labels.length > 0 && (
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-800 font-medium text-slate-700 dark:text-slate-300 flex-shrink-0">
                          {conv.labels[0]}
                        </span>
                      )}

                      {/* Message Count Badge */}
                      {(conv.messageCount || 1) > 1 && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold">
                          {conv.messageCount}
                        </span>
                      )}
                    </div>

                    {/* Attachment Paperclip */}
                    {conv.hasAttachments && (
                      <Paperclip className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    )}

                    {/* Timestamp */}
                    <div className="text-[11px] text-slate-400 dark:text-slate-500 flex-shrink-0 text-right w-16">
                      {formatGmailDate(conv.lastMessageAt)}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </main>

        {/* ----------------------------------------------------------------------- */}
        {/* RIGHT THREAD DETAIL VIEW                                                */}
        {/* ----------------------------------------------------------------------- */}
        <section
          className={`flex-1 flex flex-col min-w-0 bg-white dark:bg-slate-900 overflow-hidden ${
            selectedConversation ? 'flex' : 'hidden md:flex items-center justify-center'
          }`}
        >
          {selectedConversation ? (
            <>
              {/* Thread Action Header */}
              <div className="h-12 border-b border-slate-200 dark:border-slate-800 px-4 flex items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-900/50 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedConversation(null)}
                    className="p-1.5 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg flex items-center gap-1 text-xs"
                    title="Back to List"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span className="hidden sm:inline">Back</span>
                  </button>

                  <div className="h-4 w-px bg-slate-200 dark:bg-slate-800 mx-1" />

                  <button
                    onClick={() => handleSingleMoveFolder('trash')}
                    className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors"
                    title="Move to Trash"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleSingleMoveFolder('spam')}
                    className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 rounded-lg transition-colors"
                    title="Report Spam"
                  >
                    <ShieldAlert className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleToggleStar({ stopPropagation: () => {} } as any, selectedConversation)}
                    className="p-1.5 text-slate-500 hover:text-amber-500 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    title="Star Thread"
                  >
                    <Star
                      className={`w-4 h-4 ${
                        selectedConversation.isStarred ? 'text-amber-400 fill-amber-400' : ''
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => window.print()}
                    className="p-1.5 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg text-xs flex items-center gap-1"
                    title="Print Thread"
                  >
                    <Printer className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Thread Messages Container */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Subject Header */}
                <div className="pb-4 border-b border-slate-200 dark:border-slate-800">
                  <div className="flex items-start justify-between gap-4">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white leading-tight">
                      {selectedConversation.subject || '(no subject)'}
                    </h2>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className="text-xs px-2.5 py-1 rounded-lg font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {selectedConversation.folder || 'inbox'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Message Cards */}
                {loadingMessages ? (
                  <div className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-500 mb-2" />
                    <span className="text-xs">Loading message thread...</span>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="p-8 rounded-2xl bg-slate-50 dark:bg-slate-800/40 text-center text-slate-500 text-xs">
                    No individual messages found in this conversation thread.
                  </div>
                ) : (
                  messages.map((msg, idx) => {
                    const isOutbound = msg.direction === 'outbound';
                    return (
                      <div
                        key={msg._id || idx}
                        className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4"
                      >
                        {/* Message Header */}
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-sm ${
                                isOutbound
                                  ? 'bg-gradient-to-tr from-indigo-600 to-violet-600'
                                  : 'bg-gradient-to-tr from-emerald-600 to-teal-600'
                              }`}
                            >
                              {(msg.from || 'U')[0].toUpperCase()}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sm text-slate-900 dark:text-white">
                                  {isOutbound ? 'You (Outbound)' : msg.from}
                                </span>
                                <span className="text-xs text-slate-400">&lt;{msg.from}&gt;</span>
                              </div>
                              <div className="text-xs text-slate-500">
                                to {msg.to}
                                {msg.cc && msg.cc.length > 0 && ` • cc: ${msg.cc.join(', ')}`}
                              </div>
                            </div>
                          </div>

                          <div className="text-right text-xs text-slate-400">
                            {new Date(msg.date).toLocaleString()}
                          </div>
                        </div>

                        {/* Email Body Rendering (Safe Sanitized HTML) */}
                        <div className="pt-2 text-sm text-slate-800 dark:text-slate-200 leading-relaxed font-normal overflow-x-auto">
                          {msg.bodyHtml ? (
                            <div
                              dangerouslySetInnerHTML={{
                                __html: sanitizeEmailHtml(msg.bodyHtml),
                              }}
                            />
                          ) : (
                            <pre className="whitespace-pre-wrap font-sans text-sm text-slate-800 dark:text-slate-200">
                              {msg.bodyText || '(Empty message body)'}
                            </pre>
                          )}
                        </div>

                        {/* Attachments Section */}
                        {msg.attachments && msg.attachments.length > 0 && (
                          <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                            <div className="text-xs font-semibold text-slate-500 mb-2 flex items-center gap-1.5">
                              <Paperclip className="w-3.5 h-3.5" />
                              <span>Attachments ({msg.attachments.length})</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {msg.attachments.map((att: any, aIdx: number) => (
                                <div
                                  key={aIdx}
                                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                                >
                                  <Paperclip className="w-3.5 h-3.5 text-indigo-500" />
                                  <span className="truncate max-w-[180px]">{att.filename}</span>
                                  {att.size && (
                                    <span className="text-[10px] text-slate-400">
                                      ({Math.round(att.size / 1024)} KB)
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}

                {/* In-Thread Reply Box */}
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/60 p-4 space-y-3">
                  {!isReplying ? (
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => {
                          setIsReplying(true);
                          setReplyMode('reply');
                        }}
                        className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2 shadow-sm"
                      >
                        <Reply className="w-4 h-4 text-indigo-500" />
                        Reply
                      </button>
                      <button
                        onClick={() => {
                          setIsReplying(true);
                          setReplyMode('reply_all');
                        }}
                        className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2 shadow-sm"
                      >
                        <ReplyAll className="w-4 h-4 text-indigo-500" />
                        Reply All
                      </button>
                      <button
                        onClick={() => {
                          setIsReplying(true);
                          setReplyMode('forward');
                        }}
                        className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2 shadow-sm"
                      >
                        <Forward className="w-4 h-4 text-indigo-500" />
                        Forward
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800 text-xs">
                        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300 font-semibold capitalize">
                          {replyMode === 'reply' && <Reply className="w-4 h-4 text-indigo-500" />}
                          {replyMode === 'reply_all' && <ReplyAll className="w-4 h-4 text-indigo-500" />}
                          {replyMode === 'forward' && <Forward className="w-4 h-4 text-indigo-500" />}
                          <span>{replyMode.replace('_', ' ')} to {selectedConversation.customerEmail}</span>
                        </div>
                        <button
                          onClick={() => setIsReplying(false)}
                          className="text-slate-400 hover:text-slate-600"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Reply Textarea */}
                      <textarea
                        rows={5}
                        placeholder={`Write your ${replyMode}...`}
                        value={replyBody}
                        onChange={(e) => setReplyBody(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3 text-xs text-slate-900 dark:text-white placeholder-slate-400 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />

                      {/* Attached Chips */}
                      {replyAttachments.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {replyAttachments.map((att, idx) => (
                            <div
                              key={idx}
                              className="text-[11px] bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg flex items-center gap-1.5"
                            >
                              <Paperclip className="w-3 h-3 text-indigo-500" />
                              <span>{att.filename}</span>
                              <button
                                onClick={() =>
                                  setReplyAttachments((prev) => prev.filter((_, i) => i !== idx))
                                }
                                className="text-slate-400 hover:text-rose-500"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Reply Footer Controls */}
                      <div className="flex items-center justify-between pt-2">
                        <div className="flex items-center gap-2">
                          <label className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
                            <Paperclip className="w-4 h-4" />
                            <input
                              type="file"
                              multiple
                              className="hidden"
                              onChange={(e) => handleAddAttachment(e, true)}
                            />
                          </label>
                        </div>

                        <button
                          onClick={handleSendReply}
                          disabled={sendingReply || !replyBody.trim()}
                          className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-md shadow-indigo-500/20 disabled:opacity-50 transition-all"
                        >
                          {sendingReply ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Send className="w-3.5 h-3.5" />
                          )}
                          <span>Send</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="p-12 text-center text-slate-400 space-y-3">
              <div className="w-16 h-16 rounded-3xl bg-slate-100 dark:bg-slate-800/80 flex items-center justify-center mx-auto text-slate-400">
                <MailOpen className="w-8 h-8" />
              </div>
              <h3 className="font-semibold text-base text-slate-700 dark:text-slate-300">
                Select an Email Thread
              </h3>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                Choose an email from the list on the left to inspect complete message history, download attachments, and send replies.
              </p>
            </div>
          )}
        </section>
      </div>

      {/* ========================================================================= */}
      {/* 3. DOCKABLE / FLOATING GMAIL COMPOSE MODAL                                */}
      {/* ========================================================================= */}
      {isComposeOpen && (
        <div
          className={`fixed transition-all duration-300 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl rounded-2xl flex flex-col overflow-hidden ${
            isComposeMaximized
              ? 'inset-6 w-auto h-auto'
              : isComposeMinimized
              ? 'bottom-0 right-8 w-72 h-12'
              : 'bottom-0 right-8 w-[580px] h-[580px] max-w-[calc(100vw-2rem)] max-h-[calc(100vh-5rem)]'
          }`}
        >
          {/* Modal Header Bar */}
          <div className="h-11 bg-slate-100 dark:bg-slate-800 px-4 flex items-center justify-between flex-shrink-0 cursor-pointer select-none">
            <span className="font-bold text-xs text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <FileEdit className="w-3.5 h-3.5 text-indigo-500" />
              New Message
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsComposeMinimized(!isComposeMinimized)}
                className="p-1 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 rounded"
                title="Minimize"
              >
                <Minimize2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => {
                  setIsComposeMaximized(!isComposeMaximized);
                  setIsComposeMinimized(false);
                }}
                className="p-1 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 rounded"
                title="Maximize / Restore"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setIsComposeOpen(false)}
                className="p-1 text-slate-500 hover:text-rose-500 rounded"
                title="Close"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Modal Body (Hidden if minimized) */}
          {!isComposeMinimized && (
            <div className="flex-1 flex flex-col p-4 overflow-y-auto space-y-3">
              {/* From Account */}
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800 text-xs">
                <span className="text-slate-400 w-12">From:</span>
                <select
                  value={composeAccountId}
                  onChange={(e) => setComposeAccountId(e.target.value)}
                  className="bg-transparent font-medium text-slate-800 dark:text-slate-200 focus:outline-none flex-1"
                >
                  {accounts.map((acc) => (
                    <option key={acc._id} value={acc._id}>
                      {acc.senderName || acc.name} &lt;{acc.emailAddress}&gt;
                    </option>
                  ))}
                </select>
              </div>

              {/* To Recipient */}
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800 text-xs">
                <span className="text-slate-400 w-12">To:</span>
                <input
                  type="email"
                  placeholder="recipient@example.com"
                  value={composeTo}
                  onChange={(e) => setComposeTo(e.target.value)}
                  className="bg-transparent text-slate-800 dark:text-slate-200 focus:outline-none flex-1"
                />
                <div className="flex items-center gap-2 text-[11px] text-slate-400">
                  {!showCc && (
                    <button onClick={() => setShowCc(true)} className="hover:text-indigo-500">
                      Cc
                    </button>
                  )}
                  {!showBcc && (
                    <button onClick={() => setShowBcc(true)} className="hover:text-indigo-500">
                      Bcc
                    </button>
                  )}
                </div>
              </div>

              {/* Optional Cc */}
              {showCc && (
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800 text-xs">
                  <span className="text-slate-400 w-12">Cc:</span>
                  <input
                    type="text"
                    placeholder="cc1@example.com, cc2@example.com"
                    value={composeCc}
                    onChange={(e) => setComposeCc(e.target.value)}
                    className="bg-transparent text-slate-800 dark:text-slate-200 focus:outline-none flex-1"
                  />
                  <button onClick={() => setShowCc(false)} className="text-slate-400 hover:text-slate-600">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}

              {/* Optional Bcc */}
              {showBcc && (
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800 text-xs">
                  <span className="text-slate-400 w-12">Bcc:</span>
                  <input
                    type="text"
                    placeholder="bcc@example.com"
                    value={composeBcc}
                    onChange={(e) => setComposeBcc(e.target.value)}
                    className="bg-transparent text-slate-800 dark:text-slate-200 focus:outline-none flex-1"
                  />
                  <button onClick={() => setShowBcc(false)} className="text-slate-400 hover:text-slate-600">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}

              {/* Subject */}
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800 text-xs">
                <span className="text-slate-400 w-12">Subject:</span>
                <input
                  type="text"
                  placeholder="Subject line"
                  value={composeSubject}
                  onChange={(e) => setComposeSubject(e.target.value)}
                  className="bg-transparent text-slate-800 dark:text-slate-200 font-semibold focus:outline-none flex-1"
                />
              </div>

              {/* Message Body Textarea */}
              <div className="flex-1 flex flex-col min-h-[140px]">
                <textarea
                  placeholder="Compose your email message..."
                  value={composeBody}
                  onChange={(e) => setComposeBody(e.target.value)}
                  className="flex-1 w-full bg-transparent resize-none text-xs text-slate-800 dark:text-slate-200 focus:outline-none leading-relaxed"
                />
              </div>

              {/* Attachments Preview Chips */}
              {composeAttachments.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  {composeAttachments.map((att, idx) => (
                    <div
                      key={idx}
                      className="text-xs bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-xl flex items-center gap-2 border border-slate-200 dark:border-slate-700"
                    >
                      <Paperclip className="w-3 h-3 text-indigo-500" />
                      <span className="truncate max-w-[150px]">{att.filename}</span>
                      <button
                        onClick={() =>
                          setComposeAttachments((prev) => prev.filter((_, i) => i !== idx))
                        }
                        className="text-slate-400 hover:text-rose-500"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Compose Action Footer */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {/* Send Button */}
                  <button
                    onClick={handleSendCompose}
                    disabled={isSending || !composeTo || !composeSubject}
                    className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-indigo-500/20 disabled:opacity-50 transition-all"
                  >
                    {isSending ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    <span>Send</span>
                  </button>

                  {/* Attach File */}
                  <label className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors" title="Attach Files">
                    <Paperclip className="w-4 h-4" />
                    <input
                      type="file"
                      multiple
                      className="hidden"
                      onChange={(e) => handleAddAttachment(e, false)}
                    />
                  </label>

                  {/* Save Draft */}
                  <button
                    onClick={handleSaveDraft}
                    disabled={isSavingDraft}
                    className="px-3 py-2 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                  >
                    {isSavingDraft ? 'Saving...' : 'Save Draft'}
                  </button>
                </div>

                {/* Discard Draft */}
                <button
                  onClick={() => {
                    resetComposeForm();
                    setIsComposeOpen(false);
                  }}
                  className="p-2 text-slate-400 hover:text-rose-500 rounded-xl transition-colors"
                  title="Discard Draft"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. TOAST NOTIFICATIONS                                                    */}
      {/* ========================================================================= */}
      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl shadow-xl border text-xs font-semibold flex items-center gap-2 animate-in fade-in slide-in-from-bottom-4 ${
            toast.type === 'error'
              ? 'bg-rose-50 dark:bg-rose-950 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
              : toast.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
              : 'bg-slate-900 dark:bg-slate-100 border-slate-800 dark:border-slate-200 text-white dark:text-slate-900'
          }`}
        >
          {toast.type === 'error' ? (
            <AlertCircle className="w-4 h-4 text-rose-500" />
          ) : toast.type === 'success' ? (
            <Check className="w-4 h-4 text-emerald-500" />
          ) : (
            <Sparkles className="w-4 h-4 text-indigo-400" />
          )}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}
