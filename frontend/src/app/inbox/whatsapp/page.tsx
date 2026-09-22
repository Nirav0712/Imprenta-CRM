'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  MessageSquare,
  Search,
  Send,
  RefreshCw,
  Check,
  CheckCheck,
  Clock,
  User,
  AlertCircle,
  Pin,
  PinOff,
  Trash2,
  Plus,
  X,
  Copy,
  Smile,
  ArrowDown,
  MoreVertical,
  Sparkles,
  RotateCcw,
  Paperclip,
  Image as ImageIcon,
  FileText,
  Mic,
  MapPin,
  UserPlus,
  Download,
  ExternalLink,
  Play,
  Pause,
  Reply,
  Maximize2,
  File,
  Film,
  HelpCircle,
} from 'lucide-react';
import { inboxApi, whatsappApi, contactsApi, extractErrorMessage } from '../../../lib/api';

// Supported Message types
export type WhatsAppMessageType =
  | 'text'
  | 'image'
  | 'video'
  | 'audio'
  | 'voice'
  | 'document'
  | 'sticker'
  | 'location'
  | 'contact'
  | 'reaction'
  | 'interactive'
  | 'unsupported';

export interface WhatsAppMsg {
  _id: string;
  conversationId: string;
  connectionId: string;
  contactId?: string;
  direction: 'inbound' | 'outbound';
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  providerMessageId?: string;
  messageBody: string;
  messageType?: WhatsAppMessageType | string;
  mediaUrl?: string;
  mediaBase64?: string;
  mimetype?: string;
  filename?: string;
  fileSize?: number;
  thumbnail?: string;
  duration?: number;
  latitude?: number;
  longitude?: number;
  vcard?: string;
  quotedMessage?: {
    id: string;
    body?: string;
    sender?: string;
  };
  reactionEmoji?: string;
  decryptionStatus?: 'decrypted' | 'decryption_pending' | 'media_pending' | 'failed';
  senderPhoneNumber?: string;
  recipientPhoneNumber?: string;
  externalParticipantPhone?: string;
  senderName?: string;
  errorMessage?: string;
  timestamp: string;
}

export interface WhatsAppConv {
  _id: string;
  connectionId: any;
  contactId?: any;
  customerPhoneNumber: string;
  customerName?: string;
  lastMessageText?: string;
  lastMessageType?: string;
  unreadCount: number;
  isPinned?: boolean;
  isMuted?: boolean;
  isArchived?: boolean;
  lastActivityAt: string;
}

interface PendingAttachment {
  type: 'image' | 'video' | 'audio' | 'voice' | 'document';
  file?: File;
  base64: string;
  mimetype: string;
  filename: string;
  fileSize: number;
  duration?: number;
  previewUrl?: string;
}

export default function WhatsAppInboxPage() {
  const [connections, setConnections] = useState<any[]>([]);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string>('');
  const [filterTab, setFilterTab] = useState<'all' | 'unread' | 'pinned'>('all');
  const [conversations, setConversations] = useState<WhatsAppConv[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<WhatsAppConv | null>(null);
  const [messages, setMessages] = useState<WhatsAppMsg[]>([]);
  const [replyText, setReplyText] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [sendingReply, setSendingReply] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Attachment & Quoted Message State
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState<PendingAttachment | null>(null);
  const [attachmentCaption, setAttachmentCaption] = useState('');
  const [quotedMessage, setQuotedMessage] = useState<{ id: string; body: string; sender: string } | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // Modals for Location & Contact
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [locationLat, setLocationLat] = useState('28.6139');
  const [locationLng, setLocationLng] = useState('77.2090');
  const [locationName, setLocationName] = useState('New Delhi, India');

  const [showContactModal, setShowContactModal] = useState(false);
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');

  // Quick Emoji picker state
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [activeMenuConvId, setActiveMenuConvId] = useState<string | null>(null);
  const [activeReactionMsgId, setActiveReactionMsgId] = useState<string | null>(null);

  // New Chat Modal state
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [newChatPhone, setNewChatPhone] = useState('');
  const [newChatName, setNewChatName] = useState('');
  const [newChatMessage, setNewChatMessage] = useState('');
  const [availableContacts, setAvailableContacts] = useState<any[]>([]);
  const [startingChat, setStartingChat] = useState(false);

  // Audio Playback Map: msgId -> HTMLAudioElement
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());

  // Drag & Drop highlight state
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  // Hidden File Inputs
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const docInputRef = useRef<HTMLInputElement | null>(null);
  const audioInputRef = useRef<HTMLInputElement | null>(null);

  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const selectedConvRef = useRef<WhatsAppConv | null>(null);
  selectedConvRef.current = selectedConversation;

  // Toast auto-dismiss
  useEffect(() => {
    if (successToast) {
      const t = setTimeout(() => setSuccessToast(null), 3000);
      return () => clearTimeout(t);
    }
  }, [successToast]);

  // Load connections list
  useEffect(() => {
    whatsappApi
      .getConnections()
      .then((conns) => {
        setConnections(conns || []);
        if (conns && conns.length > 0 && !selectedConnectionId) {
          setSelectedConnectionId(conns[0]._id);
        }
      })
      .catch((err) => {
        setErrorBanner(`Failed to load WhatsApp connections: ${extractErrorMessage(err)}`);
      });
  }, []);

  // Load available contacts for New Chat modal
  useEffect(() => {
    if (showNewChatModal && availableContacts.length === 0) {
      contactsApi
        .getAll({ limit: 100 })
        .then((res) => {
          setAvailableContacts(res.contacts || res.data || (Array.isArray(res) ? res : []));
        })
        .catch(() => {});
    }
  }, [showNewChatModal, availableContacts.length]);

  // Load conversations list
  const loadConversations = useCallback(
    async (isBackground = false) => {
      if (!isBackground) setLoading(true);
      setErrorBanner(null);
      try {
        const convs = await inboxApi.getWhatsAppConversations(
          selectedConnectionId || undefined,
          search || undefined,
          filterTab,
        );
        setConversations(convs || []);

        if (!selectedConvRef.current && convs && convs.length > 0 && !isBackground) {
          handleSelectConversation(convs[0]);
        }
      } catch (err) {
        if (!isBackground) {
          setErrorBanner(`Error loading WhatsApp chats: ${extractErrorMessage(err)}`);
        }
      } finally {
        if (!isBackground) setLoading(false);
      }
    },
    [selectedConnectionId, search, filterTab],
  );

  // Load recent messages for selected conversation
  const loadMessagesForConversation = async (conv: WhatsAppConv, limit = 50) => {
    setLoadingMessages(true);
    try {
      const msgs = await inboxApi.getWhatsAppMessages(conv._id, limit);
      setMessages(msgs || []);
      setHasMoreMessages((msgs || []).length >= limit);
      // Auto-scroll to bottom
      setTimeout(() => {
        if (messagesContainerRef.current) {
          messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
        }
      }, 50);
    } catch (err) {
      setErrorBanner(`Failed to load messages: ${extractErrorMessage(err)}`);
    } finally {
      setLoadingMessages(false);
    }
  };

  // Load older messages on upward scroll
  const loadOlderMessages = async () => {
    if (!selectedConversation || loadingOlder || !hasMoreMessages || messages.length === 0) return;
    setLoadingOlder(true);
    const oldestTimestamp = messages[0]?.timestamp;
    const previousScrollHeight = messagesContainerRef.current?.scrollHeight || 0;

    try {
      const olderMsgs = await inboxApi.getWhatsAppMessages(selectedConversation._id, 30, oldestTimestamp);
      if (!olderMsgs || olderMsgs.length === 0) {
        setHasMoreMessages(false);
      } else {
        setMessages((prev) => {
          const existingIds = new Set(prev.map((m) => m._id));
          const uniqueOlder = olderMsgs.filter((m: any) => !existingIds.has(m._id));
          return [...uniqueOlder, ...prev];
        });
        setHasMoreMessages(olderMsgs.length >= 30);

        // Preserve scroll position
        setTimeout(() => {
          if (messagesContainerRef.current) {
            const newScrollHeight = messagesContainerRef.current.scrollHeight;
            messagesContainerRef.current.scrollTop = newScrollHeight - previousScrollHeight;
          }
        }, 30);
      }
    } catch (err) {
      // ignore background pagination failure
    } finally {
      setLoadingOlder(false);
    }
  };

  // Refresh active messages silently in background polling
  const refreshActiveMessages = useCallback(async () => {
    if (!selectedConvRef.current) return;
    try {
      const latestMsgs = await inboxApi.getWhatsAppMessages(selectedConvRef.current._id, 50);
      if (latestMsgs) {
        setMessages((prev) => {
          const prevMap = new Map(prev.map((m) => [m._id, m]));
          const pendingItems = prev.filter((m) => m.status === 'pending');

          for (const m of latestMsgs) {
            prevMap.set(m._id, m);
          }
          for (const p of pendingItems) {
            if (!latestMsgs.some((m: any) => m.providerMessageId === p.providerMessageId && p.providerMessageId)) {
              prevMap.set(p._id, p);
            }
          }
          return Array.from(prevMap.values()).sort(
            (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
          );
        });
      }
    } catch (err) {
      // background error ignored
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [selectedConnectionId, search, filterTab, loadConversations]);

  // Real-time polling loop every 3 seconds for fast responsiveness (pauses when tab is hidden)
  useEffect(() => {
    const timer = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      loadConversations(true);
      if (selectedConvRef.current) {
        refreshActiveMessages();
      }
    }, 3000);

    return () => clearInterval(timer);
  }, [loadConversations, refreshActiveMessages]);

  const handleSelectConversation = (conv: WhatsAppConv) => {
    setSelectedConversation(conv);
    setQuotedMessage(null);
    setPendingAttachment(null);
    loadMessagesForConversation(conv);
    setConversations((prev) =>
      prev.map((c) => (c._id === conv._id ? { ...c, unreadCount: 0 } : c)),
    );
  };

  // Helper to convert file to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Strip data:...;base64, header
        const base64 = result.split(',')[1] || result;
        resolve(base64);
      };
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(file);
    });
  };

  // Handle file input selection
  const processSelectedFile = async (file: File) => {
    setShowAttachMenu(false);
    setErrorBanner(null);

    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    const isAudio = file.type.startsWith('audio/');
    let type: PendingAttachment['type'] = 'document';

    if (isImage) type = 'image';
    else if (isVideo) type = 'video';
    else if (isAudio) type = 'audio';

    try {
      const base64 = await fileToBase64(file);
      const previewUrl = (isImage || isVideo || isAudio) ? URL.createObjectURL(file) : undefined;

      setPendingAttachment({
        type,
        file,
        base64,
        mimetype: file.type || (isImage ? 'image/jpeg' : 'application/pdf'),
        filename: file.name,
        fileSize: file.size,
        previewUrl,
      });
      setAttachmentCaption('');
    } catch (err: any) {
      setErrorBanner(`Failed to process file: ${err.message}`);
    }
  };

  // Clipboard Paste listener (Ctrl+V for images/files)
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      if (!selectedConversation) return;
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === 'file') {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            await processSelectedFile(file);
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [selectedConversation]);

  // Send Reply / Outgoing Message (Text or Media)
  const handleSendReply = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedConversation || sendingReply) return;

    const hasAttachment = Boolean(pendingAttachment);
    const body = hasAttachment ? (attachmentCaption.trim() || pendingAttachment?.filename || '') : replyText.trim();

    if (!hasAttachment && !body) return;

    setSendingReply(true);
    setErrorBanner(null);

    // Prepare payload
    const payload: any = {
      quotedMessageId: quotedMessage?.id,
    };

    if (hasAttachment && pendingAttachment) {
      payload.messageType = pendingAttachment.type;
      payload.mediaBase64 = pendingAttachment.base64;
      payload.mimetype = pendingAttachment.mimetype;
      payload.filename = pendingAttachment.filename;
      payload.fileSize = pendingAttachment.fileSize;
      payload.caption = attachmentCaption.trim() || undefined;
      payload.text = attachmentCaption.trim() || undefined;
    } else {
      payload.messageType = 'text';
      payload.text = body;
    }

    // Reset composer inputs
    setReplyText('');
    setAttachmentCaption('');
    const curAttachment = pendingAttachment;
    setPendingAttachment(null);
    const curQuoted = quotedMessage;
    setQuotedMessage(null);

    // Optimistic message insertion
    const tempId = `temp_${Date.now()}`;
    const optimisticMsg: WhatsAppMsg = {
      _id: tempId,
      conversationId: selectedConversation._id,
      connectionId: String(selectedConversation.connectionId?._id || selectedConversation.connectionId),
      direction: 'outbound',
      status: 'pending',
      messageBody: body,
      messageType: payload.messageType,
      mediaUrl: curAttachment?.previewUrl || (curAttachment?.base64 ? `data:${curAttachment.mimetype};base64,${curAttachment.base64}` : undefined),
      filename: curAttachment?.filename,
      fileSize: curAttachment?.fileSize,
      quotedMessage: curQuoted ? { id: curQuoted.id, body: curQuoted.body, sender: curQuoted.sender } : undefined,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    setTimeout(() => {
      if (messagesContainerRef.current) {
        messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
      }
    }, 30);

    try {
      const saved = await inboxApi.replyWhatsApp(selectedConversation._id, payload);
      setMessages((prev) =>
        prev.map((m) => (m._id === tempId ? { ...saved, status: saved.status || 'sent' } : m)),
      );
      loadConversations(true);
    } catch (err) {
      setMessages((prev) =>
        prev.map((m) =>
          m._id === tempId
            ? { ...m, status: 'failed', errorMessage: extractErrorMessage(err) }
            : m,
        ),
      );
      setErrorBanner(`Failed to send WhatsApp message: ${extractErrorMessage(err)}`);
    } finally {
      setSendingReply(false);
    }
  };

  // Send Location Message
  const handleSendLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedConversation) return;

    setShowLocationModal(false);
    setSendingReply(true);

    const lat = parseFloat(locationLat) || 28.6139;
    const lng = parseFloat(locationLng) || 77.2090;

    const payload = {
      messageType: 'location',
      latitude: lat,
      longitude: lng,
      text: locationName || `Location (${lat}, ${lng})`,
      caption: locationName,
    };

    try {
      await inboxApi.replyWhatsApp(selectedConversation._id, payload);
      setSuccessToast('Location sent successfully');
      refreshActiveMessages();
    } catch (err) {
      setErrorBanner(`Failed to send location: ${extractErrorMessage(err)}`);
    } finally {
      setSendingReply(false);
    }
  };

  // Send Contact Card Message
  const handleSendContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedConversation || !contactName.trim() || !contactPhone.trim()) return;

    setShowContactModal(false);
    setSendingReply(true);

    const cleanPhone = contactPhone.trim();
    const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:${contactName.trim()}\nTEL;type=CELL;type=VOICE;waid=${cleanPhone.replace(/[^0-9]/g, '')}:${cleanPhone}\nEND:VCARD`;

    const payload = {
      messageType: 'contact',
      contactData: {
        displayName: contactName.trim(),
        vcard,
      },
      text: `Contact: ${contactName.trim()} (${cleanPhone})`,
    };

    try {
      await inboxApi.replyWhatsApp(selectedConversation._id, payload);
      setSuccessToast('Contact card shared');
      setContactName('');
      setContactPhone('');
      refreshActiveMessages();
    } catch (err) {
      setErrorBanner(`Failed to share contact: ${extractErrorMessage(err)}`);
    } finally {
      setSendingReply(false);
    }
  };

  // React to a Message with Emoji
  const handleReactToMessage = async (msg: WhatsAppMsg, emoji: string) => {
    if (!selectedConversation) return;
    setActiveReactionMsgId(null);

    const msgId = msg.providerMessageId || msg._id;
    const fromMe = msg.direction === 'outbound';

    // Optimistically update message reaction in local state
    setMessages((prev) =>
      prev.map((m) =>
        (m._id === msg._id || m.providerMessageId === msgId) ? { ...m, reactionEmoji: emoji } : m,
      ),
    );

    try {
      await inboxApi.reactWhatsApp(selectedConversation._id, emoji, msgId, fromMe);
      setSuccessToast(`Reacted ${emoji}`);
    } catch (err) {
      setErrorBanner(`Reaction failed: ${extractErrorMessage(err)}`);
    }
  };

  // Audio Play / Pause Handler
  const handleToggleAudio = (msgId: string, url: string) => {
    let audio = audioRefs.current.get(msgId);
    if (!audio) {
      audio = new Audio(url);
      audio.onended = () => setPlayingAudioId(null);
      audio.onerror = () => setPlayingAudioId(null);
      audioRefs.current.set(msgId, audio);
    }

    if (playingAudioId === msgId) {
      audio.pause();
      setPlayingAudioId(null);
    } else {
      // Pause any currently playing audio
      if (playingAudioId) {
        const active = audioRefs.current.get(playingAudioId);
        if (active) active.pause();
      }
      audio.play().catch(() => {});
      setPlayingAudioId(msgId);
    }
  };

  // Retry sending a failed message
  const handleRetryMessage = async (msg: WhatsAppMsg) => {
    if (!selectedConversation) return;
    try {
      setMessages((prev) =>
        prev.map((m) => (m._id === msg._id ? { ...m, status: 'pending', errorMessage: undefined } : m)),
      );
      const res = await inboxApi.replyWhatsApp(selectedConversation._id, {
        text: msg.messageBody,
        messageType: msg.messageType,
        mediaBase64: msg.mediaBase64,
        mimetype: msg.mimetype,
        filename: msg.filename,
      });
      setMessages((prev) =>
        prev.map((m) => (m._id === msg._id ? res : m)),
      );
      setSuccessToast('Message resent successfully.');
    } catch (err) {
      setMessages((prev) =>
        prev.map((m) =>
          m._id === msg._id ? { ...m, status: 'failed', errorMessage: extractErrorMessage(err) } : m,
        ),
      );
      setErrorBanner(`Retry failed: ${extractErrorMessage(err)}`);
    }
  };

  // Start New Chat
  const handleStartNewChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChatPhone.trim() || !selectedConnectionId) {
      setErrorBanner('Please provide a recipient phone number and select a WhatsApp connection.');
      return;
    }

    setStartingChat(true);
    setErrorBanner(null);
    try {
      const res = await inboxApi.startWhatsAppConversation({
        connectionId: selectedConnectionId,
        recipientPhoneNumber: newChatPhone.trim(),
        customerName: newChatName.trim() || undefined,
        messageBody: newChatMessage.trim() || undefined,
      });

      setShowNewChatModal(false);
      setNewChatPhone('');
      setNewChatName('');
      setNewChatMessage('');
      setSuccessToast('Chat started successfully.');

      await loadConversations();
      if (res.conversation) {
        handleSelectConversation(res.conversation);
      }
    } catch (err) {
      setErrorBanner(`Failed to start chat: ${extractErrorMessage(err)}`);
    } finally {
      setStartingChat(false);
    }
  };

  // Toggle Pin
  const handleTogglePin = async (conv: WhatsAppConv, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setActiveMenuConvId(null);
    try {
      const updated = await inboxApi.updateWhatsAppConversation(conv._id, {
        isPinned: !conv.isPinned,
      });
      setConversations((prev) => prev.map((c) => (c._id === conv._id ? updated : c)));
      setSuccessToast(conv.isPinned ? 'Chat unpinned' : 'Chat pinned to top');
    } catch (err) {
      setErrorBanner(`Failed to update pin: ${extractErrorMessage(err)}`);
    }
  };

  // Toggle Read / Unread
  const handleToggleRead = async (conv: WhatsAppConv, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setActiveMenuConvId(null);
    const newCount = conv.unreadCount > 0 ? 0 : 1;
    try {
      const updated = await inboxApi.updateWhatsAppConversation(conv._id, {
        unreadCount: newCount,
      });
      setConversations((prev) => prev.map((c) => (c._id === conv._id ? updated : c)));
      setSuccessToast(newCount === 0 ? 'Marked as read' : 'Marked as unread');
    } catch (err) {
      setErrorBanner(`Failed to mark read: ${extractErrorMessage(err)}`);
    }
  };

  // Clear Chat History
  const handleClearChatHistory = async (conv: WhatsAppConv, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setActiveMenuConvId(null);
    if (!window.confirm(`Clear live messages with ${conv.customerName || conv.customerPhoneNumber}?`)) return;

    try {
      await inboxApi.clearWhatsAppMessages(conv._id);
      if (selectedConversation?._id === conv._id) {
        setMessages([]);
      }
      setConversations((prev) =>
        prev.map((c) => (c._id === conv._id ? { ...c, lastMessageText: '', unreadCount: 0 } : c)),
      );
      setSuccessToast('Chat messages cleared.');
    } catch (err) {
      setErrorBanner(`Failed to clear history: ${extractErrorMessage(err)}`);
    }
  };

  // Copy text to clipboard
  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text);
    setSuccessToast('Copied to clipboard');
  };

  // Insert Emoji into reply
  const handleInsertEmoji = (emoji: string) => {
    if (pendingAttachment) {
      setAttachmentCaption((prev) => prev + emoji);
    } else {
      setReplyText((prev) => prev + emoji);
    }
    setShowEmojiPicker(false);
  };

  // Scroll listener
  const handleScroll = () => {
    if (!messagesContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
    setShowScrollBottom(scrollHeight - scrollTop - clientHeight > 200);

    if (scrollTop < 50 && hasMoreMessages && !loadingOlder) {
      loadOlderMessages();
    }
  };

  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  };

  const selectedConn = connections.find((c) => c._id === selectedConnectionId);

  // Group messages by Date for Date Separators
  const groupedMessages: { dateLabel: string; items: WhatsAppMsg[] }[] = [];
  messages.forEach((msg) => {
    const d = new Date(msg.timestamp);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    let dateLabel = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    if (d.toDateString() === today.toDateString()) {
      dateLabel = 'Today';
    } else if (d.toDateString() === yesterday.toDateString()) {
      dateLabel = 'Yesterday';
    }

    const lastGroup = groupedMessages[groupedMessages.length - 1];
    if (lastGroup && lastGroup.dateLabel === dateLabel) {
      lastGroup.items.push(msg);
    } else {
      groupedMessages.push({ dateLabel, items: [msg] });
    }
  });

  return (
    <div className="flex-1 flex flex-col min-h-0 space-y-3">
      {/* Hidden File Upload Inputs */}
      <input
        type="file"
        ref={imageInputRef}
        accept="image/*,video/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) processSelectedFile(file);
          e.target.value = '';
        }}
      />
      <input
        type="file"
        ref={docInputRef}
        accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip,.rar"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) processSelectedFile(file);
          e.target.value = '';
        }}
      />
      <input
        type="file"
        ref={audioInputRef}
        accept="audio/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) processSelectedFile(file);
          e.target.value = '';
        }}
      />

      {/* Top Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            WhatsApp Live Inbox
            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              WhatsApp Web Multi-Media
            </span>
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Real-time messaging with rich attachments (Photos, Videos, Audio, Documents, Locations, Reactions & Quoted replies).
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Connection Status Badge */}
          {selectedConn && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium border bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-2xs">
              {selectedConn.status === 'connected' ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-emerald-700 dark:text-emerald-400 font-semibold">Live Connected</span>
                  {selectedConn.phoneNumber && (
                    <span className="text-slate-400 dark:text-slate-500 font-mono text-[10px]">({selectedConn.phoneNumber})</span>
                  )}
                </>
              ) : selectedConn.status === 'qr_ready' ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span className="text-amber-700 dark:text-amber-400 font-semibold">QR Ready</span>
                </>
              ) : selectedConn.status === 'connecting' ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                  <span className="text-blue-700 dark:text-blue-400 font-semibold">Connecting...</span>
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-slate-400" />
                  <span className="text-slate-600 dark:text-slate-300 font-semibold">Disconnected</span>
                </>
              )}
            </div>
          )}

          {/* Connection Selector */}
          <select
            value={selectedConnectionId}
            onChange={(e) => setSelectedConnectionId(e.target.value)}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          >
            <option value="">All WhatsApp Connections</option>
            {connections.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name} ({c.providerType === 'official_meta' ? 'Official Meta' : 'Regular QR'})
              </option>
            ))}
          </select>

          {/* New Chat Button */}
          <button
            onClick={() => setShowNewChatModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-2xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            New Chat
          </button>

          {/* Refresh Button */}
          <button
            onClick={() => loadConversations()}
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-200 transition-colors shadow-2xs"
            title="Refresh conversations"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Alert & Toast Banners */}
      {errorBanner && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/60 rounded-xl text-xs text-rose-700 dark:text-rose-300">
          <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600 dark:text-rose-400" />
          <span className="flex-1 font-medium">{errorBanner}</span>
          <button onClick={() => setErrorBanner(null)} className="text-rose-500 hover:text-rose-800 dark:hover:text-rose-200 text-xs font-semibold">
            Dismiss
          </button>
        </div>
      )}

      {successToast && (
        <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 animate-fade-in">
          <Sparkles className="w-4 h-4 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span className="flex-1 font-medium">{successToast}</span>
        </div>
      )}

      {/* Main 2-Pane WhatsApp Web View */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDraggingOver(true);
        }}
        onDragLeave={() => setIsDraggingOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDraggingOver(false);
          const file = e.dataTransfer.files?.[0];
          if (file) processSelectedFile(file);
        }}
        className={`flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-2xs flex min-h-0 relative ${
          isDraggingOver ? 'ring-2 ring-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/20' : ''
        }`}
      >
        {/* Drag Overlay Notice */}
        {isDraggingOver && (
          <div className="absolute inset-0 bg-emerald-600/10 backdrop-blur-2xs z-30 flex items-center justify-center pointer-events-none">
            <div className="bg-white dark:bg-slate-850 border-2 border-dashed border-emerald-500 p-6 rounded-2xl shadow-xl text-center space-y-2">
              <ImageIcon className="w-10 h-10 text-emerald-600 dark:text-emerald-400 mx-auto animate-bounce" />
              <div className="text-sm font-bold text-slate-800 dark:text-slate-100">Drop your file here to attach</div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Supports images, documents, audio, and video</p>
            </div>
          </div>
        )}

        {/* Left Pane: Conversation List */}
        <div className="w-80 md:w-96 border-r border-slate-200 dark:border-slate-800 flex flex-col flex-shrink-0 bg-slate-50/50 dark:bg-slate-900/50">
          {/* Search bar */}
          <div className="p-3 border-b border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search chats or phone number..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-8 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-slate-50/50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Filter Tabs: All, Unread, Pinned */}
            <div className="flex items-center gap-1.5 pt-1">
              {(['all', 'unread', 'pinned'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setFilterTab(tab)}
                  className={`px-3 py-1 rounded-full text-[11px] font-semibold capitalize transition-colors ${
                    filterTab === tab
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-700'
                  }`}
                >
                  {tab === 'pinned' ? '📌 Pinned' : tab}
                </button>
              ))}
            </div>
          </div>

          {/* Conversations List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
            {loading ? (
              <div className="p-8 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
                <RefreshCw className="w-5 h-5 animate-spin text-slate-400" />
                <span>Loading chats...</span>
              </div>
            ) : conversations.length === 0 ? (
              <div className="p-8 text-center">
                <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-2.5 text-slate-400">
                  <MessageSquare className="w-6 h-6" />
                </div>
                <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">No conversations found</div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed max-w-xs mx-auto">
                  {selectedConn?.status === 'connected'
                    ? `Send a WhatsApp test message to ${selectedConn.phoneNumber || 'the connected number'} or click '+ New Chat'.`
                    : selectedConn?.status === 'qr_ready'
                    ? 'Scan the QR code in WhatsApp Hub to connect.'
                    : 'Connect your WhatsApp account in WhatsApp Hub to start receiving messages.'}
                </p>
                {selectedConn?.status === 'connected' && (
                  <button
                    onClick={() => setShowNewChatModal(true)}
                    className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/60"
                  >
                    <Plus className="w-3.5 h-3.5" /> Start New Chat
                  </button>
                )}
              </div>
            ) : (
              conversations.map((conv) => {
                const isSelected = selectedConversation?._id === conv._id;
                const isMenuOpen = activeMenuConvId === conv._id;

                return (
                  <div
                    key={conv._id}
                    onClick={() => handleSelectConversation(conv)}
                    className={`w-full text-left p-3.5 transition-colors flex items-start gap-3 relative cursor-pointer group ${
                      isSelected
                        ? 'bg-emerald-50/80 dark:bg-emerald-950/50 border-l-4 border-emerald-600'
                        : 'hover:bg-slate-100/60 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 flex items-center justify-center font-bold text-xs flex-shrink-0 relative">
                      {conv.customerName ? conv.customerName.charAt(0).toUpperCase() : <User className="w-4 h-4" />}
                      {conv.isPinned && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-400 text-[9px] text-white rounded-full flex items-center justify-center shadow-xs">
                          📌
                        </span>
                      )}
                    </div>

                    {/* Metadata & Message preview */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs text-slate-900 dark:text-slate-100 truncate flex items-center gap-1">
                          {conv.customerName || conv.customerPhoneNumber}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {conv.unreadCount > 0 && (
                            <span className="px-1.5 py-0.2 rounded-full bg-emerald-600 text-[10px] font-bold text-white shadow-2xs">
                              {conv.unreadCount}
                            </span>
                          )}
                          <span className="text-[10px] text-slate-400 dark:text-slate-500">
                            {new Date(conv.lastActivityAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      </div>

                      <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate">{conv.customerPhoneNumber}</div>

                      <div className="text-xs text-slate-600 dark:text-slate-300 truncate mt-0.5 font-normal flex items-center gap-1">
                        {conv.lastMessageText || '(No messages yet)'}
                      </div>
                    </div>

                    {/* Quick Action Popover Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenuConvId(isMenuOpen ? null : conv._id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-opacity"
                      title="More options"
                    >
                      <MoreVertical className="w-3.5 h-3.5" />
                    </button>

                    {/* Context Menu Dropdown */}
                    {isMenuOpen && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="absolute right-4 top-10 w-44 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg z-20 py-1 text-xs text-slate-700 dark:text-slate-200 animate-in fade-in zoom-in-95"
                      >
                        <button
                          onClick={(e) => handleTogglePin(conv, e)}
                          className="w-full text-left px-3.5 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/60 flex items-center gap-2"
                        >
                          {conv.isPinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5 text-amber-500" />}
                          <span>{conv.isPinned ? 'Unpin chat' : 'Pin chat'}</span>
                        </button>
                        <button
                          onClick={(e) => handleToggleRead(conv, e)}
                          className="w-full text-left px-3.5 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/60 flex items-center gap-2"
                        >
                          <CheckCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          <span>{conv.unreadCount > 0 ? 'Mark as read' : 'Mark as unread'}</span>
                        </button>
                        <button
                          onClick={(e) => handleClearChatHistory(conv, e)}
                          className="w-full text-left px-3.5 py-2 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center gap-2"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Clear messages</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Pane: WhatsApp Web Message Thread */}
        {selectedConversation ? (
          <div className="flex-1 flex flex-col min-w-0 bg-[#efeae2]/20 dark:bg-slate-950/60 relative">
            {/* Thread Header */}
            <div className="p-3.5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between flex-shrink-0 z-10 shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 flex items-center justify-center font-bold text-sm">
                  {selectedConversation.customerName
                    ? selectedConversation.customerName.charAt(0).toUpperCase()
                    : 'C'}
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    {selectedConversation.customerName || selectedConversation.customerPhoneNumber}
                    {selectedConversation.isPinned && (
                      <span className="text-xs text-amber-500" title="Pinned conversation">
                        📌
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 font-mono flex items-center gap-2">
                    <span>{selectedConversation.customerPhoneNumber}</span>
                    {selectedConversation.contactId?.company && (
                      <span className="text-slate-400 dark:text-slate-500">• {selectedConversation.contactId.company}</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Live Ephemeral Stream
                </span>

                <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                  <MessageSquare className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                  {selectedConversation.connectionId?.name || 'WhatsApp Session'}
                </span>

                <button
                  onClick={() => handleTogglePin(selectedConversation)}
                  className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                  title={selectedConversation.isPinned ? 'Unpin chat' : 'Pin chat'}
                >
                  {selectedConversation.isPinned ? (
                    <PinOff className="w-4 h-4 text-amber-500" />
                  ) : (
                    <Pin className="w-4 h-4" />
                  )}
                </button>

                <button
                  onClick={() => handleClearChatHistory(selectedConversation)}
                  className="p-2 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/50 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                  title="Clear chat history"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Message Viewport */}
            <div
              ref={messagesContainerRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 bg-[#efeae2]/15 dark:bg-[#0b0f19]/80"
            >
              {/* Upward pagination loading indicator */}
              {loadingOlder && (
                <div className="py-2 text-center text-[11px] text-slate-400 dark:text-slate-500 flex items-center justify-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Loading live messages...
                </div>
              )}

              {loadingMessages ? (
                <div className="p-16 text-center text-xs text-slate-400 dark:text-slate-500 flex flex-col items-center gap-2">
                  <RefreshCw className="w-6 h-6 animate-spin text-emerald-600 dark:text-emerald-400" />
                  <span>Connecting live chat stream...</span>
                </div>
              ) : messages.length === 0 ? (
                <div className="p-16 text-center">
                  <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-2">
                    <MessageSquare className="w-6 h-6" />
                  </div>
                  <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">Live Active Session Ready</div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto leading-relaxed">
                    Live messages stream in real-time during active sessions (Zero permanent database chat storage). Use the rich composer below to send text, photos, documents, voice notes, location, or contacts.
                  </p>
                </div>
              ) : (
                groupedMessages.map((group, gIdx) => (
                  <div key={gIdx} className="space-y-3">
                    {/* Date Separator Pill */}
                    <div className="flex justify-center my-2">
                      <span className="px-3 py-1 rounded-full text-[10px] font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 shadow-2xs">
                        {group.dateLabel}
                      </span>
                    </div>

                    {/* Messages in Group */}
                    {group.items.map((msg) => {
                      const isOutbound = msg.direction === 'outbound';
                      const isFailed = msg.status === 'failed';
                      const isPendingDecryption =
                        msg.decryptionStatus === 'decryption_pending' ||
                        msg.messageBody === 'Waiting for this message. This may take a while.';

                      return (
                        <div
                          key={msg._id}
                          className={`flex flex-col group relative ${isOutbound ? 'items-end' : 'items-start'}`}
                        >
                          <div className="relative max-w-lg">
                            <div
                              className={`p-3.5 rounded-2xl text-xs leading-relaxed transition-shadow relative ${
                                isOutbound
                                  ? isFailed
                                    ? 'bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/60 text-rose-900 dark:text-rose-200 rounded-br-xs'
                                    : 'bg-emerald-600 text-white rounded-br-xs shadow-xs'
                                  : isPendingDecryption
                                  ? 'bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-200 rounded-bl-xs shadow-2xs'
                                  : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-bl-xs shadow-2xs'
                              }`}
                            >
                              {/* Quoted Message Reference Header */}
                              {msg.quotedMessage && (
                                <div
                                  className={`mb-2 p-2 rounded-lg text-[11px] border-l-4 ${
                                    isOutbound
                                      ? 'bg-emerald-700/60 border-emerald-300 text-emerald-100'
                                      : 'bg-slate-100 dark:bg-slate-700 border-emerald-600 text-slate-700 dark:text-slate-200'
                                  }`}
                                >
                                  <div className="font-bold text-[10px]">
                                    {msg.quotedMessage.sender || 'Replied Message'}
                                  </div>
                                  <div className="truncate line-clamp-2">{msg.quotedMessage.body || '(Attachment)'}</div>
                                </div>
                              )}

                              {/* Rich Content Renderer by Message Type */}
                              {/* 1. Decryption Pending Card */}
                              {isPendingDecryption ? (
                                <div className="space-y-1.5">
                                  <div className="flex items-center gap-1.5 font-bold text-amber-800 dark:text-amber-300">
                                    <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 animate-pulse" />
                                    <span>Waiting for this message</span>
                                  </div>
                                  <p className="text-[11px] text-amber-700 dark:text-amber-300/80 leading-normal">
                                    This may take a moment while WhatsApp syncs end-to-end Signal encryption keys with your linked mobile device.
                                  </p>
                                </div>
                              ) : msg.messageType === 'image' && (msg.mediaUrl || msg.mediaBase64) ? (
                                /* 2. Image Message */
                                <div className="space-y-2">
                                  <div
                                    onClick={() => setLightboxUrl(msg.mediaUrl || `data:${msg.mimetype || 'image/jpeg'};base64,${msg.mediaBase64}`)}
                                    className="relative rounded-xl overflow-hidden cursor-pointer group/img bg-slate-950/20 max-h-72 flex items-center justify-center"
                                  >
                                    <img
                                      src={msg.mediaUrl || `data:${msg.mimetype || 'image/jpeg'};base64,${msg.mediaBase64}`}
                                      alt={msg.filename || 'WhatsApp Image'}
                                      className="w-full h-auto max-h-72 object-cover transition-transform group-hover/img:scale-105"
                                    />
                                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center text-white gap-2">
                                      <Maximize2 className="w-5 h-5" />
                                    </div>
                                  </div>
                                  {msg.messageBody && msg.messageBody !== '[Image]' && (
                                    <div className="whitespace-pre-wrap font-sans pt-1">{msg.messageBody}</div>
                                  )}
                                </div>
                              ) : msg.messageType === 'video' && (msg.mediaUrl || msg.mediaBase64) ? (
                                /* 3. Video Message */
                                <div className="space-y-2">
                                  <video
                                    controls
                                    src={msg.mediaUrl || `data:${msg.mimetype || 'video/mp4'};base64,${msg.mediaBase64}`}
                                    className="w-full rounded-xl max-h-72 bg-black"
                                  />
                                  {msg.messageBody && msg.messageBody !== '[Video]' && (
                                    <div className="whitespace-pre-wrap font-sans">{msg.messageBody}</div>
                                  )}
                                </div>
                              ) : (msg.messageType === 'audio' || msg.messageType === 'voice') && (msg.mediaUrl || msg.mediaBase64) ? (
                                /* 4. Audio / Voice Note Message */
                                <div className="space-y-1.5 py-1 min-w-[220px]">
                                  <div className="flex items-center gap-3">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleToggleAudio(
                                          msg._id,
                                          msg.mediaUrl || `data:${msg.mimetype || 'audio/ogg'};base64,${msg.mediaBase64}`,
                                        )
                                      }
                                      className={`p-2.5 rounded-full transition-transform active:scale-95 shadow-sm ${
                                        isOutbound
                                          ? 'bg-white text-emerald-700'
                                          : 'bg-emerald-600 text-white'
                                      }`}
                                    >
                                      {playingAudioId === msg._id ? (
                                        <Pause className="w-4 h-4 fill-current" />
                                      ) : (
                                        <Play className="w-4 h-4 fill-current ml-0.5" />
                                      )}
                                    </button>
                                    <div className="flex-1">
                                      <div className="flex items-center justify-between text-[10px] opacity-80 mb-1">
                                        <span className="font-semibold flex items-center gap-1">
                                          {msg.messageType === 'voice' ? <Mic className="w-3 h-3" /> : <Film className="w-3 h-3" />}
                                          {msg.messageType === 'voice' ? 'Voice Note' : 'Audio Track'}
                                        </span>
                                        <span>{msg.duration ? `${Math.round(msg.duration)}s` : 'Audio'}</span>
                                      </div>
                                      <div className={`h-1.5 rounded-full ${isOutbound ? 'bg-emerald-700' : 'bg-slate-200 dark:bg-slate-700'}`}>
                                        <div
                                          className={`h-full rounded-full ${
                                            playingAudioId === msg._id ? 'w-full animate-pulse bg-white' : 'w-1/3 bg-emerald-500'
                                          }`}
                                        />
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ) : msg.messageType === 'document' && (msg.mediaUrl || msg.mediaBase64) ? (
                                /* 5. Document Message */
                                <div className="space-y-2">
                                  <div
                                    className={`flex items-center gap-3 p-2.5 rounded-xl border ${
                                      isOutbound
                                        ? 'bg-emerald-700/60 border-emerald-500/50 text-white'
                                        : 'bg-slate-50 dark:bg-slate-700/60 border-slate-200 dark:border-slate-600 text-slate-800 dark:text-slate-100'
                                    }`}
                                  >
                                    <div className="w-9 h-9 rounded-lg bg-red-500/20 text-red-500 flex items-center justify-center flex-shrink-0">
                                      <FileText className="w-5 h-5" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="font-semibold text-xs truncate">
                                        {msg.filename || 'Document.pdf'}
                                      </div>
                                      <div className="text-[10px] opacity-75">
                                        {msg.fileSize ? `${(msg.fileSize / 1024).toFixed(1)} KB` : 'Document'}
                                      </div>
                                    </div>
                                    <a
                                      href={msg.mediaUrl || `data:${msg.mimetype || 'application/pdf'};base64,${msg.mediaBase64}`}
                                      download={msg.filename || 'document.pdf'}
                                      className="p-2 rounded-lg hover:bg-black/10 transition-colors"
                                      title="Download file"
                                    >
                                      <Download className="w-4 h-4" />
                                    </a>
                                  </div>
                                  {msg.messageBody && !msg.messageBody.startsWith('[DOCUMENT]') && (
                                    <div className="whitespace-pre-wrap font-sans">{msg.messageBody}</div>
                                  )}
                                </div>
                              ) : msg.messageType === 'location' && msg.latitude && msg.longitude ? (
                                /* 6. Location Card */
                                <div className="space-y-2 min-w-[200px]">
                                  <div
                                    className={`p-3 rounded-xl border ${
                                      isOutbound
                                        ? 'bg-emerald-700/60 border-emerald-500/50 text-white'
                                        : 'bg-slate-50 dark:bg-slate-700/60 border-slate-200 dark:border-slate-600 text-slate-800 dark:text-slate-100'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2 mb-1">
                                      <MapPin className="w-4 h-4 text-rose-400" />
                                      <span className="font-bold text-xs">Shared Location</span>
                                    </div>
                                    <p className="text-[11px] opacity-90 truncate">{msg.messageBody || 'Pinned Location'}</p>
                                    <div className="text-[10px] opacity-75 font-mono mt-0.5">
                                      {msg.latitude.toFixed(4)}, {msg.longitude.toFixed(4)}
                                    </div>
                                    <a
                                      href={`https://maps.google.com/?q=${msg.latitude},${msg.longitude}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="mt-2.5 inline-flex items-center gap-1 text-[11px] font-semibold text-cyan-200 underline hover:text-white"
                                    >
                                      <ExternalLink className="w-3 h-3" /> Open in Google Maps
                                    </a>
                                  </div>
                                </div>
                              ) : msg.messageType === 'contact' ? (
                                /* 7. Contact Card */
                                <div className="space-y-2 min-w-[220px]">
                                  <div
                                    className={`p-3 rounded-xl border ${
                                      isOutbound
                                        ? 'bg-emerald-700/60 border-emerald-500/50 text-white'
                                        : 'bg-slate-50 dark:bg-slate-700/60 border-slate-200 dark:border-slate-600 text-slate-800 dark:text-slate-100'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2.5 mb-2">
                                      <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-300 flex items-center justify-center font-bold text-xs">
                                        <User className="w-4 h-4" />
                                      </div>
                                      <div>
                                        <div className="font-bold text-xs">{msg.messageBody || 'Contact Card'}</div>
                                        <div className="text-[10px] opacity-75">WhatsApp Contact</div>
                                      </div>
                                    </div>
                                    <div className="pt-2 border-t border-white/10 text-center">
                                      <span className="text-[10px] font-semibold opacity-90">vCard Contact Info</span>
                                    </div>
                                  </div>
                                </div>
                              ) : msg.messageType === 'unsupported' ? (
                                /* 8. Unsupported Message Type */
                                <div className="space-y-1 py-0.5">
                                  <div className="flex items-center gap-1.5 font-medium text-[11px] opacity-90">
                                    <HelpCircle className="w-3.5 h-3.5 text-amber-500" />
                                    <span>Unsupported message type</span>
                                  </div>
                                  {msg.messageBody && !msg.messageBody.includes('Unsupported') && (
                                    <div className="text-[10px] opacity-75 font-mono">{msg.messageBody}</div>
                                  )}
                                </div>
                              ) : (
                                /* 9. Standard Text Message */
                                <div className="whitespace-pre-wrap font-sans">{msg.messageBody}</div>
                              )}

                              {/* Error info if failed */}
                              {isFailed && msg.errorMessage && (
                                <div className="mt-1.5 text-[10px] text-rose-600 dark:text-rose-400 flex items-center gap-1 font-medium">
                                  <AlertCircle className="w-3 h-3" />
                                  <span>{msg.errorMessage}</span>
                                </div>
                              )}

                              {/* Timestamp & Status ticks */}
                              <div
                                className={`mt-1.5 flex items-center justify-end gap-1 text-[10px] ${
                                  isOutbound
                                    ? isFailed
                                      ? 'text-rose-500 dark:text-rose-300'
                                      : 'text-emerald-100'
                                    : 'text-slate-400 dark:text-slate-500'
                                }`}
                              >
                                <span>
                                  {new Date(msg.timestamp).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </span>

                                {isOutbound && (
                                  <span
                                    title={
                                      msg.status === 'read'
                                        ? 'Read'
                                        : msg.status === 'delivered'
                                        ? 'Delivered'
                                        : msg.status === 'sent'
                                        ? 'Sent'
                                        : msg.status === 'pending'
                                        ? 'Sending...'
                                        : 'Failed'
                                    }
                                  >
                                    {msg.status === 'read' ? (
                                      <CheckCheck className="w-3.5 h-3.5 text-cyan-200" />
                                    ) : msg.status === 'delivered' ? (
                                      <CheckCheck className="w-3.5 h-3.5" />
                                    ) : msg.status === 'sent' ? (
                                      <Check className="w-3.5 h-3.5" />
                                    ) : msg.status === 'pending' ? (
                                      <Clock className="w-3.5 h-3.5 animate-pulse" />
                                    ) : (
                                      <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
                                    )}
                                  </span>
                                )}
                              </div>

                              {/* Reaction Badge */}
                              {msg.reactionEmoji && (
                                <div
                                  className={`absolute -bottom-2.5 ${
                                    isOutbound ? 'left-2' : 'right-2'
                                  } bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full px-1.5 py-0.5 text-xs shadow-xs flex items-center gap-0.5`}
                                  title={`Reacted with ${msg.reactionEmoji}`}
                                >
                                  <span>{msg.reactionEmoji}</span>
                                </div>
                              )}
                            </div>

                            {/* Hover Quick Actions (Quote Reply, React, Copy, Retry) */}
                            <div
                              className={`absolute top-1 ${
                                isOutbound ? '-left-24' : '-right-24'
                              } opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-1 shadow-2xs z-20`}
                            >
                              {/* Reply Button */}
                              <button
                                onClick={() =>
                                  setQuotedMessage({
                                    id: msg.providerMessageId || msg._id,
                                    body: msg.messageBody,
                                    sender: isOutbound
                                      ? 'You'
                                      : selectedConversation.customerName || selectedConversation.customerPhoneNumber,
                                  })
                                }
                                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100"
                                title="Reply to message"
                              >
                                <Reply className="w-3 h-3" />
                              </button>

                              {/* Emoji Reaction Popover Trigger */}
                              <button
                                onClick={() =>
                                  setActiveReactionMsgId((prev) => (prev === msg._id ? null : msg._id))
                                }
                                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-500 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400"
                                title="React with emoji"
                              >
                                <Smile className="w-3 h-3" />
                              </button>

                              {/* Copy Text */}
                              <button
                                onClick={() => handleCopyText(msg.messageBody)}
                                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100"
                                title="Copy text"
                              >
                                <Copy className="w-3 h-3" />
                              </button>

                              {/* Retry if failed */}
                              {isFailed && (
                                <button
                                  onClick={() => handleRetryMessage(msg)}
                                  className="p-1 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 rounded text-rose-600 dark:text-rose-400 hover:text-emerald-700 dark:hover:text-emerald-300"
                                  title="Retry sending"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                </button>
                              )}
                            </div>

                            {/* Reaction Floating Picker */}
                            {activeReactionMsgId === msg._id && (
                              <div
                                className={`absolute -top-10 ${
                                  isOutbound ? 'right-0' : 'left-0'
                                } bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full px-2 py-1 shadow-lg z-30 flex items-center gap-1.5 animate-in fade-in zoom-in-95 text-base`}
                              >
                                {['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥', '🎉'].map((emoji) => (
                                  <button
                                    key={emoji}
                                    onClick={() => handleReactToMessage(msg, emoji)}
                                    className="hover:scale-130 transition-transform px-1"
                                  >
                                    {emoji}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))
              )}
            </div>

            {/* Scroll-to-Bottom Floating Button */}
            {showScrollBottom && (
              <button
                onClick={scrollToBottom}
                className="absolute right-6 bottom-24 p-2.5 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-md hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-200 z-10 transition-transform active:scale-95"
                title="Scroll to bottom"
              >
                <ArrowDown className="w-4 h-4" />
              </button>
            )}

            {/* Quoted Message Active Preview Bar */}
            {quotedMessage && (
              <div className="px-4 py-2 bg-slate-100 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between z-10">
                <div className="flex items-center gap-2 text-xs border-l-4 border-emerald-600 pl-2">
                  <Reply className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <div>
                    <span className="font-bold text-emerald-800 dark:text-emerald-300">Replying to {quotedMessage.sender}:</span>
                    <span className="text-slate-600 dark:text-slate-400 ml-1 truncate max-w-md inline-block align-bottom">
                      {quotedMessage.body}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setQuotedMessage(null)}
                  className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1"
                  title="Cancel reply"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Pending Attachment Preview Bar */}
            {pendingAttachment && (
              <div className="p-3 bg-emerald-50/70 dark:bg-emerald-950/60 border-t border-emerald-200 dark:border-emerald-800 flex items-center gap-3 z-10 animate-in fade-in">
                {pendingAttachment.previewUrl ? (
                  <img
                    src={pendingAttachment.previewUrl}
                    alt="Preview"
                    className="w-12 h-12 rounded-lg object-cover border border-emerald-300 dark:border-emerald-700"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-emerald-200 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-300 flex items-center justify-center">
                    <File className="w-6 h-6" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-xs text-emerald-950 dark:text-emerald-200 truncate">{pendingAttachment.filename}</div>
                  <div className="text-[10px] text-emerald-700 dark:text-emerald-400 uppercase font-semibold">
                    {pendingAttachment.type} • {(pendingAttachment.fileSize / 1024).toFixed(1)} KB
                  </div>
                  <input
                    type="text"
                    placeholder="Add an optional caption..."
                    value={attachmentCaption}
                    onChange={(e) => setAttachmentCaption(e.target.value)}
                    className="mt-1 w-full px-2.5 py-1 text-xs rounded-lg border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <button
                  onClick={() => setPendingAttachment(null)}
                  className="p-1.5 rounded-lg text-emerald-700 dark:text-emerald-400 hover:bg-emerald-200/60 dark:hover:bg-emerald-900/60"
                  title="Remove attachment"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Outbound Message Composer */}
            <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex flex-col gap-2 flex-shrink-0 relative">
              {/* Quick Emojis Bar */}
              {showEmojiPicker && (
                <div className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-base animate-in fade-in">
                  {['👍', '❤️', '😊', '🙏', '🔥', '🎉', '✅', '👋', '💯', '✨', '👏', '🎯'].map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => handleInsertEmoji(emoji)}
                      className="hover:scale-125 transition-transform px-1"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}

              {/* Attachment Picker Menu Popover */}
              {showAttachMenu && (
                <div className="absolute bottom-16 left-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl p-2 z-20 w-52 space-y-1 animate-in fade-in zoom-in-95 text-xs text-slate-700 dark:text-slate-200">
                  <button
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/60 rounded-xl flex items-center gap-2.5 font-medium"
                  >
                    <span className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                      <ImageIcon className="w-4 h-4" />
                    </span>
                    <span>Photos & Videos</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => docInputRef.current?.click()}
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/60 rounded-xl flex items-center gap-2.5 font-medium"
                  >
                    <span className="w-7 h-7 rounded-lg bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                      <FileText className="w-4 h-4" />
                    </span>
                    <span>Document (PDF/DOC)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => audioInputRef.current?.click()}
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/60 rounded-xl flex items-center gap-2.5 font-medium"
                  >
                    <span className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                      <Mic className="w-4 h-4" />
                    </span>
                    <span>Audio / Voice Note</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowAttachMenu(false);
                      setShowLocationModal(true);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/60 rounded-xl flex items-center gap-2.5 font-medium"
                  >
                    <span className="w-7 h-7 rounded-lg bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                      <MapPin className="w-4 h-4" />
                    </span>
                    <span>Share Location</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowAttachMenu(false);
                      setShowContactModal(true);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/60 rounded-xl flex items-center gap-2.5 font-medium"
                  >
                    <span className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                      <UserPlus className="w-4 h-4" />
                    </span>
                    <span>Share Contact</span>
                  </button>
                </div>
              )}

              <form onSubmit={handleSendReply} className="flex items-center gap-2">
                {/* Emoji Picker Button */}
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker((prev) => !prev)}
                  className={`p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors ${
                    showEmojiPicker ? 'bg-slate-100 dark:bg-slate-800 text-emerald-600 dark:text-emerald-400' : ''
                  }`}
                  title="Insert emoji"
                >
                  <Smile className="w-4 h-4" />
                </button>

                {/* Attachment Menu Button */}
                <button
                  type="button"
                  onClick={() => setShowAttachMenu((prev) => !prev)}
                  className={`p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors ${
                    showAttachMenu ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700' : ''
                  }`}
                  title="Attach file, photo, audio, or location"
                >
                  <Paperclip className="w-4 h-4" />
                </button>

                {/* Text Area Composer */}
                <textarea
                  rows={1}
                  value={pendingAttachment ? attachmentCaption : replyText}
                  onChange={(e) => {
                    if (pendingAttachment) setAttachmentCaption(e.target.value);
                    else setReplyText(e.target.value);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendReply();
                    }
                  }}
                  placeholder={
                    pendingAttachment
                      ? 'Add an optional caption for attachment (Enter to send)...'
                      : 'Type a message (Enter to send, Shift+Enter for new line, Ctrl+V to paste images)...'
                  }
                  className="flex-1 px-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 resize-none max-h-24 bg-slate-50/50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500"
                />

                {/* Submit / Send Button */}
                <button
                  type="submit"
                  disabled={(!replyText.trim() && !pendingAttachment) || sendingReply}
                  className="inline-flex items-center justify-center p-2.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 shadow-xs transition-colors"
                  title="Send message"
                >
                  {sendingReply ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </button>
              </form>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-center p-12 text-slate-400 dark:text-slate-500 bg-slate-50/30 dark:bg-slate-900/30">
            <div>
              <div className="w-14 h-14 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-3">
                <MessageSquare className="w-7 h-7" />
              </div>
              <div className="text-sm font-bold text-slate-700 dark:text-slate-200">WhatsApp Web Inbox</div>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-sm mx-auto">
                {conversations.length === 0
                  ? 'Connect a WhatsApp account or start a new chat to begin messaging customers.'
                  : 'Select a conversation from the left pane to view messages and reply in real time.'}
              </p>
              <button
                onClick={() => setShowNewChatModal(true)}
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 shadow-2xs transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Start New Conversation
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Lightbox Modal for Full-Size Image Preview */}
      {lightboxUrl && (
        <div
          onClick={() => setLightboxUrl(null)}
          className="fixed inset-0 bg-black/85 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in"
        >
          <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center">
            <button
              onClick={() => setLightboxUrl(null)}
              className="absolute -top-10 right-0 text-white hover:text-slate-300 p-2 text-sm font-bold flex items-center gap-1"
            >
              <X className="w-5 h-5" /> Close
            </button>
            <img
              src={lightboxUrl}
              alt="Full view"
              className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl"
            />
          </div>
        </div>
      )}

      {/* Location Sharing Modal */}
      {showLocationModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 w-full max-w-md p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <MapPin className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                Share Location Pin
              </h2>
              <button onClick={() => setShowLocationModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSendLocation} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Place / Address Label</label>
                <input
                  type="text"
                  value={locationName}
                  onChange={(e) => setLocationName(e.target.value)}
                  placeholder="e.g. Office Headquarters"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Latitude</label>
                  <input
                    type="text"
                    value={locationLat}
                    onChange={(e) => setLocationLat(e.target.value)}
                    placeholder="28.6139"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Longitude</label>
                  <input
                    type="text"
                    value={locationLng}
                    onChange={(e) => setLocationLng(e.target.value)}
                    placeholder="77.2090"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-mono"
                    required
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowLocationModal(false)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl shadow-2xs"
                >
                  Share Location
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Contact Sharing Modal */}
      {showContactModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 w-full max-w-md p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                Share Contact Card
              </h2>
              <button onClick={() => setShowContactModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSendContact} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Contact Full Name *</label>
                <input
                  type="text"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Phone Number (with Country Code) *</label>
                <input
                  type="text"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="+919876543210"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-mono"
                  required
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowContactModal(false)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!contactName.trim() || !contactPhone.trim()}
                  className="px-4 py-1.5 text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 rounded-xl shadow-2xs"
                >
                  Send Contact
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Start New Chat Modal */}
      {showNewChatModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 w-full max-w-md p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                Start New WhatsApp Chat
              </h2>
              <button
                onClick={() => setShowNewChatModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleStartNewChat} className="space-y-4">
              {/* WhatsApp Connection */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Send From WhatsApp Account *
                </label>
                <select
                  value={selectedConnectionId}
                  onChange={(e) => setSelectedConnectionId(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  required
                >
                  {connections.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name} ({c.phoneNumber || (c.providerType === 'official_meta' ? 'Meta Official' : 'Regular QR')})
                    </option>
                  ))}
                </select>
              </div>

              {/* Quick Contact Picker */}
              {availableContacts.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Or Select Existing Contact
                  </label>
                  <select
                    onChange={(e) => {
                      const contact = availableContacts.find((c) => c._id === e.target.value);
                      if (contact) {
                        setNewChatPhone(contact.phoneNumber || '');
                        setNewChatName(contact.fullName || '');
                      }
                    }}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  >
                    <option value="">-- Choose a contact from address book --</option>
                    {availableContacts.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.fullName} ({c.phoneNumber || 'No phone'}) {c.company ? `- ${c.company}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Recipient Phone Number */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Recipient Phone Number (with Country Code) *
                </label>
                <input
                  type="text"
                  placeholder="+14155552671 or +919876543210"
                  value={newChatPhone}
                  onChange={(e) => setNewChatPhone(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-mono"
                  required
                />
              </div>

              {/* Customer Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Customer / Lead Name (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. John Doe"
                  value={newChatName}
                  onChange={(e) => setNewChatName(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              {/* Initial Message */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Initial Message (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Hi there! Following up regarding..."
                  value={newChatMessage}
                  onChange={(e) => setNewChatMessage(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewChatModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={startingChat || !newChatPhone.trim()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 rounded-xl shadow-2xs"
                >
                  {startingChat ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Starting...
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" /> Start Chat
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
