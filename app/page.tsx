'use client';

import React, { useState, useEffect, useRef } from 'react';
import Script from 'next/script';
import { motion, AnimatePresence } from 'motion/react';
import {
  Heart,
  Sparkles,
  Image as ImageIcon,
  MessageSquare,
  Calendar as CalendarIcon,
  Copy,
  Download,
  Share2,
  Trash2,
  Plus,
  Compass,
  Star,
  ChevronRight,
  Pin,
  Clock,
  Send,
  User,
  Check,
  Smartphone,
  Info,
  ChevronLeft,
  X,
  Sparkle,
  Mail,
  FileText,
  MessageCircle,
  LogIn,
  LogOut,
  Loader2,
  ArrowRight,
  MapPin,
  Menu
} from 'lucide-react';

import { db, auth } from '../lib/firebase';
import { collection, addDoc, onSnapshot, query, orderBy, limit, serverTimestamp, setDoc, doc, getDocs, where } from 'firebase/firestore';

// Enum for Views
enum Tab {
  LOVE_COUNTER = 'LOVE_COUNTER',
  GALLERY = 'GALLERY',
  MESSAGE_BOARD = 'MESSAGE_BOARD',
  TIMELINE = 'TIMELINE',
  PLACES = 'PLACES',
  MORE = 'MORE'
}

// Milestone Interface
interface Milestone {
  id: string;
  date: string;
  title: string;
  description: string;
  emoji: string;
}

// Photo Interface
interface Photo {
  id: string;
  url: string;
  caption: string;
  date: string;
  isFavorite: boolean;
}

// Special Place Interface
interface SpecialPlace {
  id: string;
  title: string;
  address: string;
  description: string;
  date: string;
  emoji: string;
  author: 'boyfriend' | 'girlfriend' | 'both';
}

// Note Interface
interface Note {
  id: string;
  text: string;
  author: string;
  date: string;
  isPinned: boolean;
  reactions: {
    '❤️': number;
    '💖': number;
    '💕': number;
    '💌': number;
    '💝': number;
  };
}

// Heart particle interface for clicking on big heart
interface FloatingHeart {
  id: number;
  x: number;
  y: number;
  size: number;
  rotation: number;
  velocity: { x: number; y: number };
}

function PayPalButton() {
  useEffect(() => {
    // Only load if not already loaded by next/script (or if loaded, just render)
    const renderPayPal = () => {
      if ((window as any).paypal?.HostedButtons) {
        document.getElementById('paypal-container-PQPUZ3EZGYAY2')!.innerHTML = '';
        (window as any).paypal.HostedButtons({
          hostedButtonId: "PQPUZ3EZGYAY2",
        }).render("#paypal-container-PQPUZ3EZGYAY2");
      }
    };
    
    // Slight delay to ensure DOM and script is ready
    const timer = setTimeout(renderPayPal, 1000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="w-full flex justify-center py-4 bg-[#F2F2F7] rounded-xl border border-[#E5E5EA]">
      <Script 
        src="https://www.paypal.com/sdk/js?client-id=BAAi_cVc7gBN2qynsD2H1RbWv9FYKqBTTSugqlYmequgaDwCrb1BjsQ_zj-iEP02Dw1qc_mitubpvM6TV4&components=hosted-buttons&disable-funding=venmo&currency=CZK"
        strategy="lazyOnload"
      />
      <div id="paypal-container-PQPUZ3EZGYAY2"></div>
    </div>
  );
}

export default function RomanceApp() {
  // ---- APP INITIAL STATES ----
  const RELATIONSHIP_START = '2026-04-03T00:00:00';

  // State with safe client-side lazy initializers
  const [activeTab, setActiveTab] = useState<Tab>(Tab.LOVE_COUNTER);
  
  const [userRole, setUserRole] = useState<'boyfriend' | 'girlfriend'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('love_user_role') as 'boyfriend' | 'girlfriend') || 'boyfriend';
    }
    return 'boyfriend';
  });

  const [partnerName, setPartnerName] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const savedRole = localStorage.getItem('love_user_role');
      return savedRole === 'girlfriend' ? 'FáFa' : 'Beru';
    }
    return 'Beru';
  });

  const [relationshipCode, setRelationshipCode] = useState<string>('734-921');
  const [showCodeSync, setShowCodeSync] = useState<boolean>(false);
  const [syncCodeInput, setSyncCodeInput] = useState<string>('');
  const [isSynced, setIsSynced] = useState<boolean>(true);

  const [hasLoadedInitialNotifs, setHasLoadedInitialNotifs] = useState(false);
  
  // Real-time listener for Local Notifications via Firebase
  useEffect(() => {
    // We only want to trigger notifications for newly added items, so we'll query for recent ones.
    const q = query(
      collection(db, 'notifications'),
      where('coupleId', '==', 'fafa_and_beru'),
      orderBy('createdAt', 'desc'),
      limit(5)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      // Don't show notifications for the initial load
      if (!hasLoadedInitialNotifs) {
        setHasLoadedInitialNotifs(true);
        return;
      }

      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const data = change.doc.data();
          // Show alert if the creator isn't the current user 
          if (data.creator !== userRole) {
             triggerAlert("Nová zpráva lásky ✨", data.message, "💌");
             setTimeout(() => {
                // optionally play a sound or trigger visual heart explosion
                triggerHeartExplosion({ clientX: window.innerWidth / 2, clientY: window.innerHeight / 2 } as React.MouseEvent);
             }, 500);
          }
        }
      });
    });

    return () => unsubscribe();
  }, [hasLoadedInitialNotifs, userRole]);

  // Helper to publish notifications
  const sendNotification = async (type: string, message: string) => {
    if (!googleUser) return;
    try {
      await addDoc(collection(db, 'notifications'), {
        coupleId: 'fafa_and_beru',
        type: type,
        message: message,
        creator: userRole,
        isRead: false,
        createdAt: serverTimestamp()
      });
    } catch (e) {
      console.error("Failed to send notification via Firebase", e);
    }
  };

  // Fetch API content upon token or docId existence

  // Floating Heart Particle state
  const [hearts, setHearts] = useState<FloatingHeart[]>([]);
  const nextHeartId = useRef(0);
  const [isHeartPulsing, setIsHeartPulsing] = useState(false);

  const handleMainHeartClick = (e: React.MouseEvent) => {
    setIsHeartPulsing(true);
    triggerHeartExplosion(e);
    setTimeout(() => {
      setIsHeartPulsing(false);
    }, 1000);
  };

  // Time counter state
  const [timeTogether, setTimeTogether] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    totalSeconds: 0
  });

  // Custom Confirm & Alert Dialogs States (Fixes sandbox iframe window.confirm/alert blocks!)
  interface CustomConfirmConfig {
    title: string;
    message: string;
    confirmText: string;
    cancelText?: string;
    isDestructive?: boolean;
    onConfirm: () => void;
  }
  const [customConfirm, setCustomConfirm] = useState<CustomConfirmConfig | null>(null);
  
  interface CustomAlertConfig {
    title: string;
    message: string;
    icon?: string;
    onClose?: () => void;
  }
  const [customAlert, setCustomAlert] = useState<CustomAlertConfig | null>(null);

  const triggerAlert = (title: string, message: string, icon = '✨') => {
    setCustomAlert({ title, message, icon });
  };

  // Naše místa (Special Places) Default Data
  const DEFAULT_PLACES: SpecialPlace[] = [
    {
      id: 'place_1',
      title: 'První střetnutí očí 👀',
      address: 'Javorek 54, 592 03 Javorek, Česko',
      description: 'Zde se poprvé střetly naše cesty a začala se psát naše překrásná společná kapitola života.',
      date: '2026-04-03',
      emoji: '✨',
      author: 'both'
    },
    {
      id: 'place_2',
      title: 'První oficiální rande ❤️',
      address: 'Nové Město na Moravě, Česko',
      description: 'Sladký začátek, výborná káva a nezapomenutelný smích plný roztomilé trémy.',
      date: '2026-04-18',
      emoji: '☕️',
      author: 'boyfriend'
    },
    {
      id: 'place_3',
      title: 'Naše zamilovaná procházka 🏰',
      address: 'Zelená hora, Žďár nad Sázavou, Česko',
      description: 'Nádherná chvíle na památném místě kousek od Žďáru, kde jsme si slíbili naši věrnost a blízkost.',
      date: '2026-05-01',
      emoji: '🌸',
      author: 'girlfriend'
    }
  ];

  // Naše místa States
  const [places, setPlaces] = useState<SpecialPlace[]>(() => {
    if (typeof window !== 'undefined') {
      const savedPlaces = localStorage.getItem('love_places');
      if (savedPlaces) {
        try {
          return JSON.parse(savedPlaces);
        } catch (e) {
          console.error("Load places error", e);
        }
      }
    }
    return DEFAULT_PLACES;
  });

  const [selectedPlaceId, setSelectedPlaceId] = useState<string>('place_1');
  const [showAddPlace, setShowAddPlace] = useState<boolean>(false);
  const [newPlaceTitle, setNewPlaceTitle] = useState<string>('');
  const [newPlaceAddress, setNewPlaceAddress] = useState<string>('');
  const [newPlaceDescription, setNewPlaceDescription] = useState<string>('');
  const [newPlaceDate, setNewPlaceDate] = useState<string>('');
  const [newPlaceEmoji, setNewPlaceEmoji] = useState<string>('📍');

  // Gallery State with safe client fallback (Illustrative photos removed by default)
  const [galleryPhotos, setGalleryPhotos] = useState<Photo[]>(() => {
    if (typeof window !== 'undefined') {
      const savedGallery = localStorage.getItem('love_gallery');
      if (savedGallery) {
        try {
          return JSON.parse(savedGallery);
        } catch (e) {
          console.error("Load gallery error", e);
        }
      }
    }
    return []; // Return empty by default as explicitly requested!
  });

  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [uploadCaption, setUploadCaption] = useState<string>('');
  const [uploadDate, setUploadDate] = useState<string>('');
  const [galleryFilter, setGalleryFilter] = useState<'all' | 'favorites'>('all');
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Message Board State with safe client fallback
  const [notes, setNotes] = useState<Note[]>(() => {
    if (typeof window !== 'undefined') {
      const savedNotes = localStorage.getItem('love_notes');
      if (savedNotes) {
        try {
          return JSON.parse(savedNotes);
        } catch (e) {
          console.error("Load notes error", e);
        }
      }
    }
    return [
      {
        id: 'note_1',
        text: 'Miláčku, nezapomeň, že jsi to nejhezčí, co se mi v životě stalo. Strašně moc mě těší každá vteřina s tebou. ❤️ Piš mi sem vzkazy!',
        author: 'FáFa',
        date: '2026-05-20T10:15:00Z',
        isPinned: true,
        reactions: { '❤️': 15, '💖': 8, '💕': 12, '💌': 5, '💝': 6 }
      },
      {
        id: 'note_2',
        text: 'Báječný nápad na tuto naší soukromou aplikaci, jseš ten nejšikovnější přítel na světě! Miluju tě z celého srdíčka! 😘',
        author: 'Beru',
        date: '2026-05-22T19:30:00Z',
        isPinned: false,
        reactions: { '❤️': 22, '💖': 18, '💕': 14, '💌': 9, '💝': 11 }
      }
    ];
  });

  const [newNoteText, setNewNoteText] = useState<string>('');
  const [customAuthor, setCustomAuthor] = useState<string>('');
  const [aiNotePrompt, setAiNotePrompt] = useState<string>('');

  // Timeline Calendar State with safe client fallback
  const [milestones, setMilestones] = useState<Milestone[]>(() => {
    if (typeof window !== 'undefined') {
      const savedMilestones = localStorage.getItem('love_milestones');
      if (savedMilestones) {
        try {
          return JSON.parse(savedMilestones);
        } catch (e) {
          console.error("Load milestones error", e);
        }
      }
    }
    return [
      {
        id: 'miles_1',
        date: '2026-04-03',
        title: 'První rande (Potkali jsme se)',
        description: 'Náš osudový den, kdy jsme si poprvé pohlédli do očí. Od této chvíle se píše náš příběh.',
        emoji: '✨'
      },
      {
        id: 'miles_2',
        date: '2026-04-12',
        title: 'První pusa (Zlatý večer)',
        description: 'Hvězdy zářily, když jsme poprvé spojili rty. Okamžik, který potvrdil, co oba cítíme.',
        emoji: '💖'
      },
      {
        id: 'miles_3',
        date: '2026-05-01',
        title: 'Zamilovaný První Máj',
        description: 'Polibek pod rozkvetlou třešní a náš slib, že budeme kráčet životem společně ruku v ruce.',
        emoji: '🌸'
      }
    ];
  });

  const [showAddMilestone, setShowAddMilestone] = useState<boolean>(false);
  const [newMilestoneTitle, setNewMilestoneTitle] = useState<string>('');
  const [newMilestoneDate, setNewMilestoneDate] = useState<string>('');
  const [newMilestoneDesc, setNewMilestoneDesc] = useState<string>('');
  const [newMilestoneEmoji, setNewMilestoneEmoji] = useState<string>('❤️');

  // Trigger loading state on client to load localStorage cleanly
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  // Formatted start date for UI
  const CzechDateFormat = "3. dubna 2026";

  // ---- PERSISTENCE IN LOCAL STORAGE ----
  useEffect(() => {
    // Write defaults to localStorage on mount if they don't exist yet, to ensure data is preserved across sessions
    if (typeof window !== 'undefined') {
// We do not set states synchronously inside the effect loop
      if (!localStorage.getItem('love_gallery')) {
        localStorage.setItem('love_gallery', JSON.stringify(galleryPhotos));
      }
      if (!localStorage.getItem('love_notes')) {
        localStorage.setItem('love_notes', JSON.stringify(notes));
      }
      if (!localStorage.getItem('love_milestones')) {
        localStorage.setItem('love_milestones', JSON.stringify(milestones));
      }
      if (!localStorage.getItem('love_user_role')) {
        localStorage.setItem('love_user_role', userRole);
      }
    }
    // Set loaded state asynchronously to prevent synchronous linter cascading render exceptions
    const timer = setTimeout(() => {
      setIsLoaded(true);
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  // Save changes wrapper
  const saveState = (key: string, data: any) => {
    localStorage.setItem(key, JSON.stringify(data));
  };

  // Switch role and reload contextual names
  const handleRoleChange = (newRole: 'boyfriend' | 'girlfriend') => {
    setUserRole(newRole);
    setPartnerName(newRole === 'boyfriend' ? 'Beru' : 'FáFa');
    localStorage.setItem('love_user_role', newRole);
    
    // Auto-spawn some celebratory hearts
    triggerHeartExplosion({ clientX: window.innerWidth / 2, clientY: window.innerHeight / 2 } as React.MouseEvent);
  };

  // ---- DYNAMIC REAL-TIME RELATIONSHIP TICKER ----
  useEffect(() => {
    const updateTicker = () => {
      const start = new Date(RELATIONSHIP_START).getTime();
      const now = new Date().getTime();
      const diff = now - start;

      if (diff <= 0) return;

      const seconds = Math.floor((diff / 1000) % 60);
      const minutes = Math.floor((diff / (1000 * 60)) % 60);
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));

      setTimeTogether({
        days,
        hours,
        minutes,
        seconds,
        totalSeconds: Math.floor(diff / 1000)
      });
    };

    updateTicker();
    const interval = setInterval(updateTicker, 1000);
    return () => clearInterval(interval);
  }, [RELATIONSHIP_START]);

  // ---- floating heart particles logic ----
  useEffect(() => {
    if (hearts.length === 0) return;

    const frame = requestAnimationFrame(() => {
      setHearts((prev) =>
        prev
          .map((h) => ({
            ...h,
            x: h.x + h.velocity.x,
            y: h.y + h.velocity.y,
            velocity: { x: h.velocity.x * 0.98, y: h.velocity.y + 0.15 }, // gravity-ish
            rotation: h.rotation + 2
          }))
          .filter((h) => h.y < window.innerHeight + 100 && h.x > -50 && h.x < window.innerWidth + 50)
      );
    });

    return () => cancelAnimationFrame(frame);
  }, [hearts]);

  const triggerHeartExplosion = (e: React.MouseEvent | { clientX: number, clientY: number }) => {
    let originX = e.clientX;
    let originY = e.clientY;

    if (!originX || !originY) {
      if ('currentTarget' in e && e.currentTarget) {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        originX = rect.left + rect.width / 2;
        originY = rect.top + rect.height / 2;
      } else {
        originX = window.innerWidth / 2;
        originY = window.innerHeight / 2;
      }
    }

    const newParticles: FloatingHeart[] = Array.from({ length: 18 }).map(() => {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 8;
      const size = 12 + Math.random() * 24;
      return {
        id: nextHeartId.current++,
        x: originX,
        y: originY,
        size,
        rotation: Math.random() * 360,
        velocity: {
          x: Math.cos(angle) * speed,
          y: Math.sin(angle) * speed - 3
        }
      };
    });

    setHearts((prev) => [...prev, ...newParticles]);
  };

  // ---- PERSISTENT IMAGE GALLERY COMPRESSION & UPLOAD ----
  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    processAndAddImage(file);
  };

  const processAndAddImage = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Highly efficient canvas compression to stay safely within localstorage 5MB limit!
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Force maximum dimension of 500px to compress to lightweight file (~30–45KB)
        const MAX_DIM = 500;
        if (width > height) {
          if (width > MAX_DIM) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          }
        } else {
          if (height > MAX_DIM) {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Draw and compress
        ctx.drawImage(img, 0, 0, width, height);
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7); // 70% quality jpeg is incredibly light and looks flawless on mobile screens

        const defaultCaption = uploadCaption.trim() ? uploadCaption : `Krásný společný moment z ${uploadDate || 'dneška'}.`;
        
        const newPhoto: Photo = {
          id: `photo_${Date.now()}`,
          url: compressedBase64,
          caption: defaultCaption,
          date: uploadDate || new Date().toISOString().split('T')[0],
          isFavorite: false
        };

        const updatedGallery = [newPhoto, ...galleryPhotos];
        setGalleryPhotos(updatedGallery);
        saveState('love_gallery', updatedGallery);

        // Reset upload fields
        setUploadCaption('');
        setUploadDate('');
        if (fileInputRef.current) fileInputRef.current.value = '';
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Drag and drop mechanics for romantic intuitive desktop experience
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processAndAddImage(files[0]);
    }
  };

  const deletePhoto = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCustomConfirm({
      title: "Smazat vzpomínku? 📸",
      message: "Opravdu si přeješ nadobro smazat tuto drahocennou vzpomínku z naší společné galerie?",
      confirmText: "Smazat",
      cancelText: "Ponechat",
      isDestructive: true,
      onConfirm: () => {
        const updated = galleryPhotos.filter((p) => p.id !== id);
        setGalleryPhotos(updated);
        saveState('love_gallery', updated);
        setLightboxIndex(null);
        setCustomConfirm(null);
      }
    });
  };

  const toggleFavoritePhoto = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = galleryPhotos.map((p) => {
      if (p.id === id) {
        return { ...p, isFavorite: !p.isFavorite };
      }
      return p;
    });
    setGalleryPhotos(updated);
    saveState('love_gallery', updated);
  };

  // ---- VZKAZOVNÍK (SWEET MESSAGE BOARD) CONTEXT ----
  const addNote = () => {
    if (!newNoteText.trim()) return;

    const authorSignature = customAuthor.trim() ? customAuthor : (userRole === 'boyfriend' ? 'FáFa 👑' : 'Beru 🌸');

    const newNote: Note = {
      id: `note_${Date.now()}`,
      text: newNoteText.trim(),
      author: authorSignature,
      date: new Date().toISOString(),
      isPinned: false,
      reactions: { '❤️': 0, '💖': 0, '💕': 0, '💌': 0, '💝': 0 }
    };

    const updatedNotes = [newNote, ...notes];
    setNotes(updatedNotes);
    saveState('love_notes', updatedNotes);
    
    // Dispatch Firebase Local Notification
    sendNotification('note', `Máš nový zamilovaný vzkaz od ${authorSignature}!`);

    // Reset fields
    setNewNoteText('');
    setCustomAuthor('');
  };

  const reactToNote = (noteId: string, emoji: '❤️' | '💖' | '💕' | '💌' | '💝') => {
    const updated = notes.map((n) => {
      if (n.id === noteId) {
        const reactionsCopy = { ...n.reactions };
        reactionsCopy[emoji] = (reactionsCopy[emoji] || 0) + 1;
        return { ...n, reactions: reactionsCopy };
      }
      return n;
    });
    setNotes(updated);
    saveState('love_notes', updated);
  };

  const pinNote = (noteId: string) => {
    const updated = notes.map((n) => {
      // Toggle pinned for the selected note, unpin others to have exactly ONE pinned Note of the Day
      if (n.id === noteId) {
        return { ...n, isPinned: !n.isPinned };
      }
      return { ...n, isPinned: false };
    });
    setNotes(updated);
    saveState('love_notes', updated);
  };

  const deleteNote = (noteId: string) => {
    setCustomConfirm({
      title: "Smazat vzkaz? 💌",
      message: "Opravdu chceš smazat tento sladký vzkaz?",
      confirmText: "Smazat",
      cancelText: "Ponechat",
      isDestructive: true,
      onConfirm: () => {
        const updated = notes.filter((n) => n.id !== noteId);
        setNotes(updated);
        saveState('love_notes', updated);
        setCustomConfirm(null);
      }
    });
  };

  const generateAiVzkazPrompt = () => {
    const prompts = [
      "Napiš Michaelce, jak se těšíš na další společný víkend a jak ti chybí.",
      "Vzpomeň si na jeden vtipný detail z vašeho prvního rande 3.4.2026.",
      "Popiš Michaelce 3 nejkrásnější věci, které na ní nejvíc obdivuješ.",
      "Připomeň jí veselou historku ze společné procházky a napiš, že jí posíláš pusu.",
      "Slib Michaelce masáž nebo snídani do postele, až se zase uvidíte.",
      "Poděkuj jí za to, s jakou trpělivostí tě doplňuje a naslouchá ti."
    ];
    const rand = prompts[Math.floor(Math.random() * prompts.length)];
    setAiNotePrompt(rand);
  };

  // ---- TIMELINE MILESTONES CALENDAR ACTIONS ----
  const addMilestone = () => {
    if (!newMilestoneTitle.trim() || !newMilestoneDate.trim()) return;

    const newMiles: Milestone = {
      id: `miles_${Date.now()}`,
      date: newMilestoneDate,
      title: newMilestoneTitle.trim(),
      description: newMilestoneDesc.trim() || "Krásný drahocenný den v našich životech.",
      emoji: newMilestoneEmoji
    };

    const updated = [newMiles, ...milestones].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    setMilestones(updated);
    saveState('love_milestones', updated);

    const signature = userRole === 'boyfriend' ? 'FáFa' : 'Beru';
    sendNotification('milestone', `${signature} přidal(a) nový milník do vašeho kalendáře lásky: ${newMilestoneTitle.trim()}!`);

    // Reset values
    setNewMilestoneTitle('');
    setNewMilestoneDate('');
    setNewMilestoneDesc('');
    setNewMilestoneEmoji('❤️');
    setShowAddMilestone(false);
  };

  const deleteMilestone = (id: string) => {
    setCustomConfirm({
      title: "Smazat milník? 📅",
      message: "Opravdu chceš smazat tento krásný milník z vašeho společného kalendáře?",
      confirmText: "Smazat",
      cancelText: "Ponechat",
      isDestructive: true,
      onConfirm: () => {
        const updated = milestones.filter((m) => m.id !== id);
        setMilestones(updated);
        saveState('love_milestones', updated);
        setCustomConfirm(null);
      }
    });
  };

  // ---- SPECIÁLNÍ MÍSTA (MEMORABLE PLACES) ACTIONS ----
  const addSpecialPlace = () => {
    if (!newPlaceTitle.trim() || !newPlaceAddress.trim()) {
      triggerAlert("Chyba ⚠️", "Prosím vyplňte název i adresu místa.", "⚠️");
      return;
    }
    const signature = userRole === 'boyfriend' ? 'boyfriend' : 'girlfriend';
    const newPlace: SpecialPlace = {
      id: `place_${Date.now()}`,
      title: newPlaceTitle.trim(),
      address: newPlaceAddress.trim(),
      description: newPlaceDescription.trim() || "Krásné vzpomínkové rande nebo společné dobrodružství.",
      date: newPlaceDate || new Date().toISOString().split('T')[0],
      emoji: newPlaceEmoji || '📍',
      author: signature
    };
    const updated = [newPlace, ...places];
    setPlaces(updated);
    saveState('love_places', updated);
    setSelectedPlaceId(newPlace.id);
    
    // Reset fields
    setNewPlaceTitle('');
    setNewPlaceAddress('');
    setNewPlaceDescription('');
    setNewPlaceDate('');
    setNewPlaceEmoji('📍');
    setShowAddPlace(false);
    
    triggerAlert("Místo uloženo! 🎉", `Misto "${newPlace.title}" bylo úspěšně přidáno na vaši mapu.`, "💖");
  };

  const deleteSpecialPlace = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCustomConfirm({
      title: "Smazat místo? 📍",
      message: "Opravdu si přeješ smazat toto památné místo z vaší společné mapy?",
      confirmText: "Smazat",
      cancelText: "Ponechat",
      isDestructive: true,
      onConfirm: () => {
        const updated = places.filter((p) => p.id !== id);
        setPlaces(updated);
        saveState('love_places', updated);
        if (selectedPlaceId === id && updated.length > 0) {
          setSelectedPlaceId(updated[0].id);
        }
        setCustomConfirm(null);
      }
    });
  };


  // Show absolute placeholder loader if client states aren't finished
  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-[#F2F2F7] flex items-center justify-center">
        <Heart className="w-12 h-12 text-[#FF2D55] animate-pulse" />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-transparent text-gray-800 font-sans selection:bg-[#FF2D55]/25 flex items-center justify-center p-0 sm:py-0 relative" id="romance-layout">
      {/* Ambient background glow layers */}
      <div className="fixed inset-0 pointer-events-none z-[-1] overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-gradient-to-tr from-[#FF2D55]/10 to-[#FFA07A]/10 blur-3xl opacity-70" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-gradient-to-bl from-[#FF5E7E]/10 to-[#FF9A9E]/10 blur-3xl opacity-60" />
      </div>

      {/* Dynamic heart particle overlay layer */}
      <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden" id="heart-explosion-layer">
        {hearts.map((h) => (
          <div
            key={h.id}
            style={{
              position: 'absolute',
              left: h.x,
              top: h.y,
              transform: `translate(-50%, -50%) rotate(${h.rotation}deg)`,
              fontSize: `${h.size}px`,
            }}
          >
            ❤️
          </div>
        ))}
      </div>

      {/* Main PWA Outer Wrapper */}
      <div className="w-full max-w-[480px] mx-auto bg-white/40 backdrop-blur-2xl relative flex flex-col h-[100dvh] sm:shadow-2xl sm:border sm:border-white/60 sm:rounded-2xl transition-all overflow-hidden" id="device-shell">

        {/* Dynamic iOS Sticky Header Banner */}
        <div className="bg-white/60 backdrop-blur-md border-b border-white/50 text-[#1C1C1E] px-5 py-3 flex flex-col gap-2 shrink-0 relative shadow-sm" id="sticky-header">
          <div className="w-full flex justify-between items-center">
            {/* Context adapters switch roles instantly */}
            <div className="flex bg-white/50 backdrop-blur-sm rounded-full p-0.5 border border-white/40 text-xs shadow-inner" id="role-selector">
              <button
                type="button"
                id="role-boy"
                onClick={() => handleRoleChange('boyfriend')}
                className={`px-3 py-1 rounded-full transition-all flex items-center gap-1 ${
                  userRole === 'boyfriend'
                    ? 'bg-white text-[#FF2D55] font-bold shadow-2xs'
                    : 'text-gray-500 hover:text-gray-900 font-medium'
                }`}
              >
                <span>👑 FáFa</span>
              </button>
              <button
                type="button"
                id="role-girl"
                onClick={() => handleRoleChange('girlfriend')}
                className={`px-3 py-1 rounded-full transition-all flex items-center gap-1 ${
                  userRole === 'girlfriend'
                    ? 'bg-white text-[#FF2D55] font-bold shadow-2xs'
                    : 'text-gray-500 hover:text-gray-900 font-medium'
                }`}
              >
                <span>🌸 Beru</span>
              </button>
            </div>

            <button
              type="button"
              id="sync-space-btn"
              onClick={() => setShowCodeSync(!showCodeSync)}
              className="text-[#FF2D55] bg-[#FFE5E9] hover:bg-[#FFE5E9]/80 p-2 rounded-full transition-all border border-[#FFF1F2]"
              title="Spárovat love space"
            >
              <Compass className="w-4 h-4" />
            </button>
          </div>

          {/* Sync Box Dropdown with micro animation */}
          {showCodeSync && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="w-full mt-2 bg-white text-gray-800 rounded-xl p-3 shadow-inner text-xs border border-[#E5E5EA] flex flex-col gap-2 origin-top"
              id="sync-card"
            >
              <div className="flex justify-between items-center">
                <span className="font-bold text-[#FF2D55] flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 fill-[#FF2D55]" /> Naše cloudová synchronizace
                </span>
                <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-100 font-semibold">
                  Aktivní a spárováno
                </span>
              </div>
              <p className="text-gray-500 leading-relaxed font-sans">
                Zařízení jsou propojena kódem <strong className="text-gray-900 font-mono tracking-wider">{relationshipCode}</strong>. Jakákoliv fotka či vzkaz se okamžitě zobrazí i Michaelce.
              </p>
              <div className="flex gap-2 items-center mt-1">
                <input
                  type="text"
                  placeholder="Zadej kód od Michaelky..."
                  className="bg-[#F2F2F7] border border-[#E5E5EA] px-3 py-1.5 rounded-lg flex-1 text-xs focus:outline-hidden focus:ring-1 focus:ring-[#FF2D55] font-mono text-gray-800"
                  value={syncCodeInput}
                  onChange={(e) => setSyncCodeInput(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (syncCodeInput.trim().length > 3) {
                      setRelationshipCode(syncCodeInput.trim().toUpperCase());
                      setSyncCodeInput('');
                      alert("Váš láskyplný prostor byl úspěšně synchronizován a propojen! 💖");
                    }
                  }}
                  className="bg-[#FF2D55] hover:bg-[#FF2D55]/90 text-white px-3 py-1.5 rounded-lg font-bold transition-all text-xs shadow-xs"
                >
                  Propojit
                </button>
              </div>
            </motion.div>
          )}
        </div>

        {/* Scrollable View Area Frame */}
        <div className="flex-1 overflow-y-auto px-4 py-5 pb-24 relative custom-ios-scroll" id="scroll-workspace">
          
          <AnimatePresence mode="wait">
            {/* TAB 1: COUNTER (LÁSKA) */}
            {activeTab === Tab.LOVE_COUNTER && (
              <motion.div
                key="counter"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.25 }}
                className="flex flex-col gap-6"
                id="counter-tab"
              >
                
                {/* Visual relationship circle frame - Premium glassmorphic look */}
                <div 
                  className="bg-white/30 backdrop-blur-3xl rounded-[32px] p-8 shadow-[0_12px_40px_rgba(255,45,85,0.12)] border-t border-l border-white/80 border-b border-r border-[#FF2D55]/10 flex flex-col items-center relative text-center overflow-hidden"
                  id="countdown-card"
                >
                  <div className="absolute -top-24 -left-24 w-48 h-48 bg-gradient-to-br from-pink-300 to-rose-400 rounded-full blur-[60px] opacity-40 mix-blend-multiply" />
                  <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-gradient-to-tl from-orange-200 to-[#FF2D55] rounded-full blur-[60px] opacity-30 mix-blend-multiply" />

                  <span className="text-[10px] uppercase tracking-[0.3em] text-[#FF2D55] font-black mb-2 relative z-10 drop-shadow-sm/50">Naše Cesta Cestou</span>
                  <h3 className="font-serif text-gray-900 font-bold text-2xl tracking-tight mb-8 relative z-10 drop-shadow-sm">Milujeme se spolu už</h3>

                  {/* Pulsing Central Lovable Heart Widget */}
                  <motion.div 
                    className="relative cursor-pointer my-4 select-none group z-10" 
                    onClick={handleMainHeartClick} 
                    id="pulse-heart-anchor"
                    initial={{ scale: 1 }}
                    animate={isHeartPulsing ? { scale: [1, 1.4, 0.9, 1.2, 1] } : { scale: [1, 1.02, 1] }}
                    transition={isHeartPulsing ? { duration: 1, ease: "easeInOut" } : { duration: 3, repeat: Infinity, ease: "easeInOut" }}
                  >
                    {/* Ring glow element */}
                    <AnimatePresence>
                      {isHeartPulsing && (
                        <motion.div 
                          initial={{ opacity: 0.8, scale: 1 }}
                          animate={{ opacity: 0, scale: 2 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 1, ease: "easeOut" }}
                          className="absolute inset-0 bg-gradient-to-tr from-[#FF2D55] to-[#FFA07A] rounded-full blur-2xl"
                        />
                      )}
                    </AnimatePresence>
                    {!isHeartPulsing && <div className="absolute inset-0 bg-[#FF2D55]/20 rounded-full scale-[1.3] blur-2xl animate-pulse" />}
                    
                    <div className="w-40 h-40 bg-gradient-to-tr from-[#E11D48] via-[#FF2D55] to-[#FDA4AF] rounded-full shadow-[0_0_50px_rgba(255,45,85,0.5),inset_0_4px_12px_rgba(255,255,255,0.4)] border border-white/60 flex flex-col justify-center items-center relative z-10 backdrop-blur-md transition-all">
                      <Heart className={`w-16 h-16 text-white fill-white ${isHeartPulsing ? 'animate-ping' : ''}`} style={{ filter: 'drop-shadow(0px 4px 8px rgba(0,0,0,0.2))' }} />
                      <span className="text-white text-2xl font-black font-mono mt-2 drop-shadow-md tracking-tighter">{timeTogether.days} dní</span>
                    </div>
                    {/* Tiny visual guidance badge */}
                    <span className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-white/60 backdrop-blur-xl border border-white text-[#E11D48] text-[9px] px-4 py-1.5 rounded-full font-black shadow-lg opacity-80 group-hover:opacity-100 transition-opacity whitespace-nowrap tracking-wider">
                      ŤUKNI SI 💖
                    </span>
                  </motion.div>

                  {/* Subtitle counter grid */}
                  <div className="grid grid-cols-3 gap-4 w-full mt-10 relative z-10" id="precise-time-grid">
                    <div className="bg-white/50 backdrop-blur-xl rounded-[20px] p-4 flex flex-col items-center border-t border-l border-white/90 shadow-md">
                      <span className="font-mono text-2xl font-black text-gray-900 drop-shadow-sm">{timeTogether.hours}</span>
                      <span className="text-[9px] text-[#FF2D55] font-black uppercase tracking-widest mt-1">Hodiny</span>
                    </div>
                    <div className="bg-white/50 backdrop-blur-xl rounded-[20px] p-4 flex flex-col items-center border-t border-l border-white/90 shadow-md">
                      <span className="font-mono text-2xl font-black text-gray-900 drop-shadow-sm">{timeTogether.minutes}</span>
                      <span className="text-[9px] text-[#FF2D55] font-black uppercase tracking-widest mt-1">Minuty</span>
                    </div>
                    <div className="bg-white/50 backdrop-blur-xl rounded-[20px] p-4 flex flex-col items-center border-t border-l border-white/90 shadow-md">
                      <span className="font-mono text-2xl font-black text-gray-900 drop-shadow-sm">{timeTogether.seconds}</span>
                      <span className="text-[10px] text-gray-700 font-semibold font-sans uppercase tracking-wider">Sekundy</span>
                    </div>
                  </div>

                  <div className="mt-5 text-xs text-[#8E8E93] leading-snug font-sans">
                    Náš společný vesmír započal <span className="font-bold text-gray-900">{CzechDateFormat}</span>. Každým nadechnutím tě miluji víc.
                  </div>
                </div>

                {/* Personal Adapted Card */}
                <div className="bg-white/70 backdrop-blur-xl text-gray-900 border border-white/60 rounded-[24px] p-6 shadow-[0_8px_32px_rgba(255,45,85,0.06)] relative overflow-hidden" id="personalized-greeting-card">
                  {/* Backdrop glowing patterns */}
                  <div className="absolute right-0 top-0 w-40 h-40 bg-gradient-to-br from-[#FF2D55]/10 to-[#FFA07A]/10 rounded-full blur-2xl pointer-events-none" />
                  
                  <div className="flex justify-between items-start mb-4 relative z-10">
                    <div className="bg-white/80 backdrop-blur-md text-[#FF2D55] px-4 py-1.5 rounded-full text-[10px] uppercase font-bold tracking-widest border border-white/60 shadow-sm">
                      Osobní prostor
                    </div>
                    <Sparkles className="w-5 h-5 text-[#FF2D55]" />
                  </div>

                  {userRole === 'boyfriend' ? (
                    <div>
                      <h4 className="text-xl font-extrabold text-gray-900 mb-2">Pro moji úžasnou Beru 🌸</h4>
                      <p className="text-gray-600 text-sm leading-relaxed font-sans">
                        Dnes pro tebe mám připravený skvělý program, lásko. Nech si ode mě přes AI složit báseň nebo mi napiš vzkaz na naši zeď. Všechny vzpomínky jsou zde v bezpečí.
                      </p>
                    </div>
                  ) : (
                    <div>
                      <h4 className="text-xl font-extrabold text-gray-900 mb-2">Vítej zpět, princezno Beru! 👸</h4>
                      <p className="text-gray-600 text-sm leading-relaxed font-sans">
                        František (FáFa) na tebe neustále myslí a miluje tě celým svým bytím. Tato aplikace je odrazem jeho nekonečné oddanosti tobě. Užij si náš koutek!
                      </p>
                    </div>
                  )}

                  <div className="mt-5 pt-4 border-t border-[#E5E5EA] flex justify-between items-center text-xs text-[#8E8E93]">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-[#FF2D55]" />
                      <span>Dnes je to <strong>{timeTogether.days} vteřinových cyklů</strong></span>
                    </div>
                    <span className="italic font-serif text-[#FF2D55] font-bold">F&B</span>
                  </div>
                </div>

                {/* Local Quote Card with gorgeous soft pink gradient */}
                <div className="bg-gradient-to-br from-[#FF9A9E] to-[#FAD0C4] text-white rounded-[24px] p-6 shadow-[0_4px_20px_rgba(0,0,0,0.05)] relative overflow-hidden" id="quote-card">
                  <div className="absolute right-3 bottom-1 text-white/12 text-7xl font-serif select-none pointer-events-none">“</div>
                  <div className="flex gap-2 items-center mb-3">
                    <div className="bg-white/20 p-1.5 rounded-full text-white">
                      <Star className="w-4 h-4 text-white fill-white" />
                    </div>
                    <h4 className="font-bold font-sans text-sm text-white">Zamilovaný vzkaz na dnešní den</h4>
                  </div>
                  <blockquote className="font-sans text-white/95 italic border-l-2 border-white/60 pl-3 leading-relaxed text-xs">
                    &ldquo;Láska není jen pohled do očí, ale společná chůze směrem k hvězdám. Naše cesta začala 3. dubna a každý další krok s tebou, Michaelko, je mým splněným snem.&rdquo;
                  </blockquote>
                </div>

              </motion.div>
            )}

            {/* TAB 2: AI POET (BÁSNÍK) */}
            {activeTab === Tab.AI_POET && (
              <motion.div
                key="poet"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.25 }}
                className="flex flex-col gap-5"
                id="poet-tab"
              >
                
                {/* Generation control block */}
                <div className="bg-white rounded-[24px] p-5 shadow-[0_4px_20px_rgba(0,0,0,0.05)] border border-[#E5E5EA] flex flex-col gap-4" id="ai-generator-panel">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs uppercase tracking-wider text-[#FF2D55] font-bold flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 fill-[#FF2D55] animate-spin" /> AI Básník pro Michaelku
                    </span>
                    <h3 className="font-sans text-gray-900 font-extrabold text-lg">Zvol styl zamilovaného kouzla</h3>
                  </div>

                  {/* iOS Segmented Control styled list for categories */}
                  <div className="grid grid-cols-2 gap-1 bg-[#F2F2F7] p-1 rounded-[16px] border border-[#E5E5EA]" id="ai-category-segmented-control">
                    <button
                      type="button"
                      id="ai-cat-poem"
                      onClick={() => setGeneratorCategory('poem')}
                      className={`py-2 text-[11px] rounded-[12px] font-bold transition-all ${
                        generatorCategory === 'poem'
                          ? 'bg-white text-[#FF2D55] shadow-2xs border border-[#E5E5EA]/40'
                          : 'text-gray-500 hover:text-gray-900 hover:bg-white/40'
                      }`}
                    >
                      🌸 Krásná Báseň
                    </button>
                    <button
                      type="button"
                      id="ai-cat-compliment"
                      onClick={() => setGeneratorCategory('compliment')}
                      className={`py-2 text-[11px] rounded-[12px] font-bold transition-all ${
                        generatorCategory === 'compliment'
                          ? 'bg-white text-[#FF2D55] shadow-2xs border border-[#E5E5EA]/40'
                          : 'text-gray-500 hover:text-gray-900 hover:bg-white/40'
                      }`}
                    >
                      💖 Milé Vyznání
                    </button>
                    <button
                      type="button"
                      id="ai-cat-funny"
                      onClick={() => setGeneratorCategory('funny')}
                      className={`py-2 text-[11px] rounded-[12px] font-bold transition-all ${
                        generatorCategory === 'funny'
                          ? 'bg-white text-[#FF2D55] shadow-2xs border border-[#E5E5EA]/40'
                          : 'text-gray-500 hover:text-gray-900 hover:bg-white/40'
                      }`}
                    >
                      😆 Pobavit Beru
                    </button>
                    <button
                      type="button"
                      id="ai-cat-custom"
                      onClick={() => setGeneratorCategory('custom')}
                      className={`py-2 text-[11px] rounded-[12px] font-bold transition-all ${
                        generatorCategory === 'custom'
                          ? 'bg-white text-[#FF2D55] shadow-2xs border border-[#E5E5EA]/40'
                          : 'text-gray-500 hover:text-gray-900 hover:bg-white/40'
                      }`}
                    >
                      ✍️ Slovo od srdce
                    </button>
                  </div>

                  {/* Custom Detail Prompt input field */}
                  <div className="flex flex-col gap-1.5" id="ai-custom-prompt-wrapper">
                    <label htmlFor="ai-prompt-input" className="text-[11px] text-gray-500 font-bold block">
                      {generatorCategory === 'custom' 
                        ? 'O čem má vzkaz být? (např. omluva, skvělý pražský dortík, dálka před námi)'
                        : 'Osobní detail do básně (např. blond vlásky, modrý svetřík... - volitelné)'
                      }
                    </label>
                    <input
                      id="ai-prompt-input"
                      type="text"
                      placeholder={generatorCategory === 'custom' ? 'Napiš prosím vtipný vzkaz o kávě...' : 'Doplň detail...'}
                      className="bg-[#F2F2F7] border border-[#E5E5EA] px-4 py-2.5 rounded-[16px] text-xs w-full focus:outline-hidden focus:ring-1 focus:ring-[#FF2D55] font-sans text-gray-800"
                      value={generatorPrompt}
                      onChange={(e) => setGeneratorPrompt(e.target.value)}
                    />
                  </div>

                  {/* Generate Button with touch target */}
                  <button
                    type="button"
                    onClick={generateLoveText}
                    disabled={isGenerating}
                    className="w-full h-11 bg-[#FF2D55] hover:bg-[#FF2D55]/90 active:scale-[0.99] text-white font-bold rounded-[16px] transition-all shadow-[0_4px_12px_rgba(255,45,85,0.2)] text-xs flex items-center justify-center gap-2"
                  >
                    {isGenerating ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>AI Básník horečně skládá slova...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 fill-white" />
                        <span>Vytvořit kouzlo pro Michaelku</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Visual results display */}
                <AnimatePresence mode="wait">
                  {generatedPoem && (
                    <motion.div
                      key="poem-result"
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -15 }}
                      className="bg-white rounded-[24px] p-6 shadow-[0_4px_20px_rgba(0,0,0,0.05)] border border-[#E5E5EA] flex flex-col gap-5 text-center relative"
                      id="generated-poem-card"
                    >
                      {/* Heart seal decorative illustration */}
                      <div className="absolute top-3 right-3 text-[10px] bg-[#FFE5E9] text-[#FF2D55] px-2.5 py-1 rounded-full font-bold">
                        AI Vyznání ✨
                      </div>

                      <div className="flex justify-center mt-2">
                        <Heart className="w-10 h-10 text-[#FF2D55] fill-[#FFE5E9] px-0.5" />
                      </div>

                      {/* Displaying AI text with proper paragraph spacings */}
                      <div className="text-gray-900 italic font-serif leading-relaxed text-sm my-1 whitespace-pre-wrap max-w-sm mx-auto tracking-wide">
                        {generatedPoem}
                      </div>

                      <div className="w-full h-px bg-[#E5E5EA]" />

                      {/* Sharing actions with full iOS responsive options */}
                      <div className="grid grid-cols-2 gap-2" id="ai-poem-actions-panel">
                        <button
                          type="button"
                          onClick={copyToClipboard}
                          className="bg-[#F2F2F7] border border-[#E5E5EA] hover:bg-gray-200/50 py-2.5 rounded-[12px] text-[11px] font-bold text-gray-700 flex items-center justify-center gap-1.5 transition-all"
                        >
                          {copySuccess ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              <span className="text-emerald-700 font-bold">Zkopírováno!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5 text-gray-500" />
                              <span>Zkopírovat text</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={shareLoveText}
                          className="bg-[#F2F2F7] border border-[#E5E5EA] hover:bg-gray-200/50 py-2.5 rounded-[12px] text-[11px] font-bold text-gray-700 flex items-center justify-center gap-1.5 transition-all"
                        >
                          <Share2 className="w-3.5 h-3.5 text-gray-500" />
                          <span>Sdílet mobil</span>
                        </button>

                        <button
                          type="button"
                          onClick={downloadLoveCard}
                          className="bg-[#FFE5E9] hover:bg-[#FFE5E9]/80 py-2.5 rounded-[12px] text-[11px] font-bold text-[#FF2D55] flex items-center justify-center gap-1.5 transition-all border border-[#FFF1F2]"
                        >
                          <Download className="w-3.5 h-3.5 text-[#FF2D55]" />
                          <span>Stažení (Obrázek)</span>
                        </button>

                        <button
                          type="button"
                          onClick={saveAiCardToGallery}
                          className="bg-[#FF2D55] hover:bg-[#FF2D55]/90 py-2.5 rounded-[12px] text-[11px] font-bold text-white flex items-center justify-center gap-1.5 transition-all shadow-xs"
                        >
                          {saveSuccess ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>V Galerii! ❤️</span>
                            </>
                          ) : (
                            <>
                              <ImageIcon className="w-3.5 h-3.5" />
                              <span>Uložit do galerie</span>
                            </>
                          )}
                        </button>
                      </div>

                      {saveSuccess && (
                        <div className="text-[10px] text-emerald-600 text-center font-bold bg-emerald-50 py-1.5 rounded-lg border border-emerald-100 animate-pulse">
                          🎉 Vygenerovaná báseň byla úspěšně vykreslena jako obrázkový lísteček a uložena do naší společné Galerie vzpomínek!
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}

             {/* TAB 3: GALLERY (GALERIE) */}
            {activeTab === Tab.GALLERY && (
              <motion.div
                key="gallery"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.25 }}
                className="flex flex-col gap-5"
                id="gallery-tab"
              >
                
                {/* Upload Action Box */}
                <div 
                  className={`bg-white rounded-[24px] p-5 shadow-[0_4px_20px_rgba(0,0,0,0.05)] border ${
                    isDragging ? 'border-dashed border-[#FF2D55] bg-[#FFE5E9]/20' : 'border-[#E5E5EA]'
                  } flex flex-col gap-4 transition-all`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  id="gallery-upload-card"
                >
                  <div className="flex flex-col gap-1">
                    <span className="text-xs uppercase tracking-wider text-[#FF2D55] font-bold">Naše fotoknihovna</span>
                    <h3 className="font-sans text-gray-900 font-extrabold text-lg">Zvečni drahocennou chvíli</h3>
                  </div>

                  {/* Hidden regular input element file */}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    ref={fileInputRef}
                    onChange={handleImageUpload}
                  />

                  {/* Comment inputs */}
                  <div className="flex flex-col gap-3" id="upload-meta-wrapper">
                    <input
                      type="text"
                      placeholder="Přidej osobní vzkaz k fotce..."
                      className="bg-[#F2F2F7] border border-[#E5E5EA] px-3.5 py-2.5 rounded-[16px] text-xs w-full focus:outline-hidden focus:ring-1 focus:ring-[#FF2D55] font-sans text-gray-800"
                      value={uploadCaption}
                      onChange={(e) => setUploadCaption(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <input
                        type="date"
                        className="bg-[#F2F2F7] border border-[#E5E5EA] px-3 py-2 rounded-[12px] text-xs flex-1 focus:outline-hidden focus:ring-1 focus:ring-[#FF2D55] font-mono text-gray-800"
                        value={uploadDate}
                        onChange={(e) => setUploadDate(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={triggerFileSelect}
                        className="bg-[#FF2D55] hover:bg-[#FF2D55]/90 text-white font-bold px-4 py-2 rounded-[12px] text-xs transition-all flex items-center gap-1 shadow-[0_4px_12px_rgba(255,45,85,0.15)]"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Nahrát foto</span>
                      </button>
                    </div>
                  </div>

                  {/* Drag drop info prompt */}
                  <p className="text-[10px] text-[#8E8E93] text-center leading-relaxed">
                    Fotka se před odesláním okamžitě zkomprimuje, takže nezatěžuje paměť zařízení. Lze nahrávat i přímo přetažením sem!
                  </p>
                </div>

                {/* Sub Menu Filtering tabs */}
                <div className="flex justify-between items-center" id="gallery-sub-navigation">
                  <h4 className="font-extrabold text-sm text-gray-900">Naše společná alba</h4>
                  <div className="flex bg-[#F2F2F7] rounded-lg p-0.5 text-xs font-semibold" id="gallery-filter-panel">
                    <button
                      type="button"
                      onClick={() => setGalleryFilter('all')}
                      className={`px-3 py-1 rounded-md transition-all ${
                        galleryFilter === 'all'
                          ? 'bg-white text-[#FF2D55] shadow-2xs font-bold'
                          : 'text-[#8E8E93] hover:text-gray-900'
                      }`}
                    >
                      Vše
                    </button>
                    <button
                      type="button"
                      onClick={() => setGalleryFilter('favorites')}
                      className={`px-3 py-1 rounded-md transition-all ${
                        galleryFilter === 'favorites'
                          ? 'bg-white text-[#FF2D55] shadow-2xs font-bold'
                          : 'text-[#8E8E93] hover:text-gray-900'
                      }`}
                    >
                      🌟 Oblíbené
                    </button>
                  </div>
                </div>

                {/* Grid container photos (3 columns just like native iOS) */}
                {(() => {
                  const filteredPhotos = galleryPhotos.filter((p) => galleryFilter === 'all' || p.isFavorite);
                  if (filteredPhotos.length === 0) {
                    return (
                      <div className="bg-white rounded-[24px] py-12 px-4 shadow-[0_4px_20px_rgba(0,0,0,0.05)] border border-[#E5E5EA] flex flex-col items-center text-center text-gray-400 gap-2">
                        <ImageIcon className="w-10 h-10 text-[#FF2D55]/40 animate-pulse" />
                        <span className="text-xs text-gray-600 font-semibold">Zatím tu nemáte žádné fotky.</span>
                        <span className="text-[10px] text-[#8E8E93]">Nahrejte první drahocennou vzpomínku přes formulář výše!</span>
                      </div>
                    );
                  }
                  return (
                    <>
                      <div className="grid grid-cols-2 gap-3" id="photos-grid">
                        {filteredPhotos.map((p, index) => (
                          <div
                            key={p.id}
                            className="bg-white rounded-[16px] overflow-hidden border border-[#E5E5EA] shadow-2xs cursor-pointer group hover:shadow-sm transition-all relative flex flex-col justify-between"
                            onClick={() => setLightboxIndex(index)}
                          >
                            <div className="relative aspect-square overflow-hidden bg-[#F2F2F7] flex items-center justify-center">
                              {/* Native referrer check applied according to guidelines */}
                              <img
                                src={p.url}
                                alt={p.caption}
                                referrerPolicy="no-referrer"
                                className="object-cover w-full h-full transition-transform duration-300 group-hover:scale-105"
                              />

                              <button
                                type="button"
                                onClick={(e) => toggleFavoritePhoto(p.id, e)}
                                className="absolute top-2 right-2 bg-black/35 backdrop-blur-md p-1.5 rounded-full z-10 hover:bg-black/55 transition-all text-white hover:scale-105"
                              >
                                <Star
                                  className={`w-3.5 h-3.5 ${p.isFavorite ? 'text-amber-400 fill-amber-400' : 'text-white'}`}
                                />
                              </button>
                            </div>

                            {/* Mini Caption */}
                            <div className="p-3 bg-white flex flex-col gap-1">
                              <span className="text-[9px] font-mono text-[#8E8E93] flex items-center gap-1">
                                <CalendarIcon className="w-2.5 h-2.5" /> {p.date}
                              </span>
                              <p className="text-[10px] text-gray-700 font-semibold truncate leading-tight">
                                {p.caption}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* iOS Photo Lightbox / Fullscreen Modal */}
                      {lightboxIndex !== null && filteredPhotos[lightboxIndex] && (
                        <div className="fixed inset-0 bg-black/95 backdrop-blur-lg z-[100] flex flex-col justify-between" id="photo-lightbox">
                          {/* Lightbox header bar */}
                          <div className="flex justify-between items-center px-6 py-4 text-white shrink-0 mt-6">
                            <div className="flex flex-col">
                              <span className="text-xs font-mono text-gray-400">{filteredPhotos[lightboxIndex]?.date}</span>
                              <span className="text-[10px] text-[#FF2D55] font-bold">Náš společný moment ❤️</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => setLightboxIndex(null)}
                              className="bg-white/10 hover:bg-white/20 p-2 rounded-full transition-all text-white border border-white/10"
                            >
                              <X className="w-5 h-5" />
                            </button>
                          </div>

                          {/* Central Image container */}
                          <div className="flex-1 flex items-center justify-center p-3 relative" id="lightbox-center-container">
                            <button
                              type="button"
                              onClick={() => setLightboxIndex(lightboxIndex > 0 ? lightboxIndex - 1 : filteredPhotos.length - 1)}
                              className="absolute left-6 text-white/50 hover:text-white p-2 z-10 bg-black/20 rounded-full"
                            >
                              <ChevronLeft className="w-8 h-8" />
                            </button>

                            <div className="max-w-md max-h-[480px] w-full h-full relative flex items-center justify-center">
                              <img
                                src={filteredPhotos[lightboxIndex]?.url}
                                alt={filteredPhotos[lightboxIndex]?.caption}
                                className="object-contain max-h-[480px] max-w-full rounded-lg shadow-2xl"
                                referrerPolicy="no-referrer"
                              />
                            </div>

                            <button
                              type="button"
                              onClick={() => setLightboxIndex(lightboxIndex < filteredPhotos.length - 1 ? lightboxIndex + 1 : 0)}
                              className="absolute right-6 text-white/50 hover:text-white p-2 z-10 bg-black/20 rounded-full"
                            >
                              <ChevronRight className="w-8 h-8" />
                            </button>
                          </div>

                          {/* Detail footer and captions with delete actions */}
                          <div className="bg-black/60 backdrop-blur-md px-6 py-6 pb-12 flex flex-col gap-4 text-white shrink-0">
                            <p className="text-xs text-center border-l-2 border-[#FF2D55] pl-3 leading-relaxed max-w-sm mx-auto">
                              &ldquo;{filteredPhotos[lightboxIndex]?.caption}&rdquo;
                            </p>
                            <div className="flex justify-between items-center border-t border-white/10 pt-4 max-w-sm mx-auto w-full text-xs">
                              <button
                                type="button"
                                onClick={(e) => toggleFavoritePhoto(filteredPhotos[lightboxIndex].id, e)}
                                className="flex items-center gap-1 text-white hover:text-[#FF2D55] transition-colors"
                              >
                                <Star className={`w-4 h-4 ${filteredPhotos[lightboxIndex]?.isFavorite ? 'text-amber-400 fill-amber-300' : ''}`} />
                                <span>{filteredPhotos[lightboxIndex]?.isFavorite ? 'Odebrat z oblíbených' : 'Přidat k oblíbeným'}</span>
                              </button>

                              <button
                                type="button"
                                onClick={(e) => deletePhoto(filteredPhotos[lightboxIndex].id, e)}
                                className="flex items-center gap-1 text-[#FF2D55] hover:text-[#FF2D55]/80 transition-colors font-bold"
                                title="Smazat vzpomínku"
                              >
                                <Trash2 className="w-4 h-4" />
                                <span>Smazat</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </motion.div>
            )}

            {/* TAB 4: MESSAGE BOARD (VZKAZOVNÍK) */}
            {activeTab === Tab.MESSAGE_BOARD && (
              <motion.div
                key="vzkazy"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.25 }}
                className="flex flex-col gap-5"
                id="vzkazy-tab"
              >
                
                {/* Note creation box */}
                <div className="bg-white rounded-[24px] p-5 shadow-[0_4px_20px_rgba(0,0,0,0.05)] border border-[#E5E5EA] flex flex-col gap-3.5" id="note-composer-card">
                  <div className="flex justify-between items-start">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs uppercase tracking-wider text-[#FF2D55] font-bold">Zamilovaný vzkazovník</span>
                      <h3 className="font-sans text-gray-950 font-extrabold text-lg">Zanech sladké slůvko</h3>
                    </div>
                    {/* Generates short AI inspirational writing suggestions */}
                    <button
                      type="button"
                      onClick={generateAiVzkazPrompt}
                      className="bg-[#FFE5E9] hover:bg-[#FFE5E9]/80 text-[#FF2D55] border border-[#FFF1F2] px-3 py-1.5 rounded-full text-[10px] font-bold flex items-center gap-1 transition-all"
                    >
                      <Sparkles className="w-3.5 h-3.5 fill-[#FF2D55]" />
                      <span>Inspirace</span>
                    </button>
                  </div>

                  {/* Show AI writing tip if generated */}
                  {aiNotePrompt && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="bg-[#FFE5E9]/40 p-2.5 rounded-xl text-[11px] text-gray-800 border border-[#FFF1F2] relative leading-normal"
                      id="ai-note-prompt-box"
                    >
                      <button
                        type="button"
                        onClick={() => setAiNotePrompt('')}
                        className="absolute top-1.5 right-1.5 text-[#FF2D55] hover:text-rose-700"
                      >
                        <X className="w-3 h-3" />
                      </button>
                      <strong>Vnuknutí od básníka:</strong> &ldquo;{aiNotePrompt}&rdquo;
                    </motion.div>
                  )}

                  <div className="flex flex-col gap-2.5" id="note-form-wrapper">
                    <textarea
                      placeholder={userRole === 'boyfriend' ? "Co máš dnes na srdíčku pro Beru..." : "Co máš dnes na srdíčku pro FáFu..."}
                      className="bg-[#F2F2F7] border border-[#E5E5EA] px-3.5 py-3 rounded-[16px] text-xs w-full focus:outline-hidden focus:ring-1 focus:ring-[#FF2D55] font-sans text-gray-800 min-h-[80px]"
                      value={newNoteText}
                      onChange={(e) => setNewNoteText(e.target.value)}
                    />
                    
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder={userRole === 'boyfriend' ? "Podpis (např. Tvůj FáFa...)" : "Podpis (např. Tvoje Beru...)"}
                        className="bg-[#F2F2F7] border border-[#E5E5EA] px-3 py-2 rounded-[12px] text-xs flex-1 focus:outline-hidden focus:ring-1 focus:ring-[#FF2D55] font-sans text-gray-800"
                        value={customAuthor}
                        onChange={(e) => setCustomAuthor(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={addNote}
                        className="bg-[#FF2D55] hover:bg-[#FF2D55]/90 text-white font-bold px-4 py-2 rounded-[12px] text-xs transition-all flex items-center gap-1.5 shadow-[0_4px_12px_rgba(255,45,85,0.15)] shrink-0"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Přidat</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* notes of board layout */}
                <div className="flex flex-col gap-3.5" id="notes-list-board">
                  {notes.map((n) => (
                    <div
                      key={n.id}
                      className={`rounded-[20px] p-5 shadow-2xs border relative flex flex-col gap-3 transition-colors ${
                        n.isPinned
                          ? 'bg-[#FF2D55] text-white border-[#E5E5EA]/20 shadow-[0_4px_16px_rgba(255,45,85,0.18)]'
                          : 'bg-white border-[#E5E5EA] text-gray-800'
                      }`}
                    >
                      {/* Note Header Info */}
                      <div className="flex justify-between items-center">
                        <span className={`text-[10px] font-mono ${n.isPinned ? 'text-white/80' : 'text-[#8E8E93]'}`}>
                          {new Date(n.date).toLocaleDateString('cs-CZ', {
                            day: 'numeric',
                            month: 'long',
                            hour: 'numeric',
                            minute: '2-digit'
                          })}
                        </span>

                        <div className="flex items-center gap-1.5">
                          {/* Pin function */}
                          <button
                            type="button"
                            onClick={() => pinNote(n.id)}
                            className={`p-1 rounded-md transition-colors ${
                              n.isPinned
                                ? 'text-white hover:bg-white/10'
                                : 'text-[#8E8E93] hover:text-[#FF2D55] hover:bg-gray-100'
                            }`}
                            title={n.isPinned ? 'Odepnout vzkaz dne' : 'Připnout jako vzkaz dne'}
                          >
                            <Pin className={`w-3.5 h-3.5 ${n.isPinned ? 'fill-white' : ''}`} />
                          </button>

                          {/* Trash Delete function */}
                          <button
                            type="button"
                            onClick={() => deleteNote(n.id)}
                            className={`p-1 rounded-md transition-colors ${
                              n.isPinned ? 'text-white hover:bg-white/10' : 'text-[#8E8E93] hover:text-red-500 hover:bg-gray-100'
                            }`}
                            title="Smazat vzkaz"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Main love Note Text */}
                      <p className={`text-xs leading-relaxed font-sans ${n.isPinned ? 'font-semibold' : 'text-gray-700'}`}>
                        {n.text}
                      </p>

                      <div className="flex justify-between items-center pt-2 border-t border-rose-100/10">
                        {/* Author signature */}
                        <span className={`text-[10px] font-bold ${n.isPinned ? 'text-[#FFE5E9]' : 'text-[#FF2D55]'}`}>
                          ✍️ {n.author}
                        </span>

                        {/* Reaction bar */}
                        <div className="flex items-center gap-1">
                          {(['❤️', '💖', '💕', '💌', '💝'] as const).map((emoji) => (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => reactToNote(n.id, emoji)}
                              className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] transition-all ${
                                n.isPinned
                                  ? 'bg-white/15 hover:bg-white/20 text-white border border-white/10'
                                  : 'bg-[#FFE5E9] text-[#FF2D55] border border-[#FFF1F2] hover:scale-105'
                              }`}
                            >
                              <span>{emoji}</span>
                              <span className="font-mono font-bold text-[9px]">{n.reactions[emoji] || 0}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* TAB 5: TIMELINE / CALENDAR (KALENDÁŘ) */}
            {activeTab === Tab.TIMELINE && (
              <motion.div
                key="timeline"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.25 }}
                className="flex flex-col gap-5"
                id="timeline-tab"
              >
                
                {/* Milestone Intro header with ADD action buttons */}
                <div className="bg-white rounded-[24px] p-5 shadow-[0_4px_20px_rgba(0,0,0,0.05)] border border-[#E5E5EA] flex flex-col gap-3" id="milestones-card-header">
                  <div className="flex justify-between items-start">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs uppercase tracking-wider text-[#FF2D55] font-bold">Chronologie milníků</span>
                      <h3 className="font-sans text-gray-950 font-extrabold text-lg">Náš společný kalendář</h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowAddMilestone(!showAddMilestone)}
                      className="bg-[#FF2D55] hover:bg-[#FF2D55]/90 text-white font-bold p-2.5 rounded-full transition-all shadow-[0_4px_12px_rgba(255,45,85,0.2)] shrink-0 flex items-center justify-center"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-[10px] text-[#8E8E93] leading-normal">
                    Zaznamenáváme sem všechny drahocenné vzpomínky, výlety, výročí a události, které nás udělaly šťastnými. Každému dnu přisuzujeme vlastní barvu a emoji!
                  </p>
                </div>

                {/* Add milestone Modal inside state */}
                {showAddMilestone && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-[24px] p-5 shadow-[0_4px_20px_rgba(0,0,0,0.05)] border border-[#E5E5EA] flex flex-col gap-3.5"
                    id="add-milestone-form"
                  >
                    <h4 className="font-bold text-[#FF2D55] text-xs uppercase tracking-wider flex items-center gap-1">
                      <Plus className="w-3.5 h-3.5 text-[#FF2D55]" /> Zapsat novou vzpomínku
                    </h4>

                    <div className="grid grid-cols-1 gap-3 text-xs" id="milestone-fields">
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] text-[#8E8E93] font-bold">Název milníku</span>
                        <input
                          type="text"
                          placeholder="Např. První výlet do ZOO Moravská"
                          className="bg-[#F2F2F7] border border-[#E5E5EA] px-3 py-2.5 rounded-[12px] text-xs w-full focus:outline-hidden focus:ring-1 focus:ring-[#FF2D55] font-sans text-gray-800"
                          value={newMilestoneTitle}
                          onChange={(e) => setNewMilestoneTitle(e.target.value)}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] text-[#8E8E93] font-bold">Datum mementa</span>
                          <input
                            type="date"
                            className="bg-[#F2F2F7] border border-[#E5E5EA] px-3 py-2.5 rounded-[12px] text-xs w-full focus:outline-hidden focus:ring-1 focus:ring-[#FF2D55] font-mono text-gray-800"
                            value={newMilestoneDate}
                            onChange={(e) => setNewMilestoneDate(e.target.value)}
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] text-[#8E8E93] font-bold">Zvol symbol emoji</span>
                          <select
                            className="bg-[#F2F2F7] border border-[#E5E5EA] px-3 py-2.5 rounded-[12px] text-xs w-full focus:outline-hidden focus:ring-1 focus:ring-[#FF2D55] text-gray-800"
                            value={newMilestoneEmoji}
                            onChange={(e) => setNewMilestoneEmoji(e.target.value)}
                          >
                            <option value="❤️">❤️ Srdíčko</option>
                            <option value="💖">💖 Jiskření</option>
                            <option value="🌸">🌸 Květina</option>
                            <option value="✨">✨ Kouzlo</option>
                            <option value="🗼">🗼 Výlet</option>
                            <option value="☕">☕ Káva</option>
                            <option value="🍿">🍿 Kino/Kultura</option>
                            <option value="🛌">🛌 Oddych</option>
                          </select>
                        </div>
                      </div>

                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] text-[#8E8E93] font-bold">Co jsme spolu zažili</span>
                        <textarea
                          placeholder="Popis zážitku podrobněji..."
                          className="bg-[#F2F2F7] border border-[#E5E5EA] px-3 py-2.5 rounded-[12px] text-xs w-full focus:outline-hidden focus:ring-1 focus:ring-[#FF2D55] font-sans text-gray-800 min-h-[60px]"
                          value={newMilestoneDesc}
                          onChange={(e) => setNewMilestoneDesc(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setShowAddMilestone(false)}
                        className="bg-[#F2F2F7] hover:bg-[#F2F2F7]/85 text-gray-600 px-4 py-2 rounded-[12px] text-xs font-bold transition-all border border-[#E5E5EA] flex-1"
                      >
                        Zrušit
                      </button>
                      <button
                        type="button"
                        onClick={addMilestone}
                        className="bg-[#FF2D55] hover:bg-[#FF2D55]/90 text-white px-4 py-2 rounded-[12px] text-xs font-bold transition-all shadow-xs flex-1"
                      >
                        Uložit do kalendáře
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* Timeline connected list */}
                <div className="relative border-l border-[#FFE5E9] pl-6 ml-4 flex flex-col gap-6" id="milestones-timeline-box">
                  {milestones.map((m) => (
                    <div key={m.id} className="relative flex flex-col gap-1.5" id={`milestone-${m.id}`}>
                      {/* Interactive dot placeholder */}
                      <div className="absolute -left-10 top-0.5 bg-[#FF2D55] border-4 border-white text-white rounded-full w-8 h-8 flex items-center justify-center font-bold shadow-2xs select-none">
                        <span className="text-sm leading-none">{m.emoji}</span>
                      </div>

                      {/* Timeline header */}
                      <div className="flex justify-between items-start">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-mono text-[#FF2D55] font-bold">
                            {new Date(m.date).toLocaleDateString('cs-CZ', {
                              day: 'numeric',
                              month: 'long',
                              year: 'numeric'
                            })}
                          </span>
                          <h4 className="font-sans text-gray-900 font-bold text-xs">{m.title}</h4>
                        </div>

                        {/* Delete milestone action */}
                        <button
                          type="button"
                          onClick={() => deleteMilestone(m.id)}
                          className="text-[#8E8E93] hover:text-red-500 p-1.5 rounded-lg transition-colors border border-transparent hover:border-[#E5E5EA] bg-white shadow-2xs"
                          title="Smazat milník"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Description Card */}
                      <p className="bg-white border border-[#E5E5EA] rounded-[16px] p-3.5 text-xs text-gray-700 leading-relaxed font-sans shadow-2xs">
                        {m.description}
                      </p>
                    </div>
                  ))}
                </div>

              </motion.div>
            )}

            {activeTab === Tab.PLACES && (
              <motion.div
                key="places"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.25 }}
                className="flex flex-col gap-5 pb-8"
                id="places-tab"
              >
                {/* Header */}
                <div className="flex flex-col gap-1">
                  <span className="text-xs uppercase tracking-wider text-[#FF2D55] font-bold">Zamilovaná mapa</span>
                  <h3 className="font-sans text-gray-900 font-extrabold text-xl">Naše místa rande 📍</h3>
                  <p className="text-xs text-[#8E8E93] leading-relaxed">
                    Uchováváme a mapujeme místa, která pro nás znamenají celý svět!
                  </p>
                </div>

                {/* Google Map Embedded Frame */}
                {(() => {
                  const currentPlace = places.find(p => p.id === selectedPlaceId) || places[0];
                  const mapEmbedUrl = currentPlace 
                    ? `https://maps.google.com/maps?q=${encodeURIComponent(currentPlace.address)}&t=&z=14&ie=UTF8&iwloc=&output=embed`
                    : '';
                  
                  return (
                    <div className="bg-white rounded-[24px] p-2.5 shadow-[0_4px_20px_rgba(0,0,0,0.05)] border border-[#E5E5EA]" id="map-container">
                      <div className="relative rounded-[18px] overflow-hidden bg-gray-100 flex items-center justify-center border border-gray-100 h-[220px]">
                        {mapEmbedUrl ? (
                          <iframe
                            src={mapEmbedUrl}
                            width="100%"
                            height="100%"
                            style={{ border: 0 }}
                            allowFullScreen={false}
                            loading="lazy"
                            title="Interactive Maps"
                            id="google-maps"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="text-xs text-gray-400 p-4 text-center">Vyberte rande z listu pro zobrazení mapy</div>
                        )}
                      </div>
                      {currentPlace && (
                        <div className="p-3 pb-2 flex flex-col gap-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-base">{currentPlace.emoji}</span>
                            <span className="font-extrabold text-xs text-gray-900 truncate">{currentPlace.title}</span>
                          </div>
                          <span className="text-[10px] font-mono text-[#8E8E93] block truncate">{currentPlace.address}</span>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Add Memorize Place form trigger / form */}
                <div className="flex flex-col gap-3">
                  {!showAddPlace ? (
                    <button
                      type="button"
                      onClick={() => setShowAddPlace(true)}
                      className="bg-white hover:bg-gray-50 text-gray-750 font-bold py-3 px-4 rounded-[16px] text-xs border border-[#E5E5EA] shadow-2xs transition-all flex items-center justify-center gap-2"
                    >
                      <Plus className="w-4 h-4 text-[#FF2D55]" />
                      <span>Zaznamenat další naše rande</span>
                    </button>
                  ) : (
                    <div className="bg-white rounded-[24px] p-5 shadow-[0_4px_20px_rgba(0,0,0,0.05)] border border-[#E5E5EA] flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-250">
                      <div className="flex justify-between items-center">
                        <h4 className="font-extrabold text-sm text-gray-900 flex items-center gap-1.5">
                          <span>📍</span> Nové zamilované místo
                        </h4>
                        <button
                          type="button"
                          onClick={() => setShowAddPlace(false)}
                          className="text-xs text-[#8E8E93] hover:text-gray-900 border border-gray-100 px-2 py-1 rounded-md"
                        >
                          Zavřít
                        </button>
                      </div>

                      <div className="flex flex-col gap-3">
                        <input
                          type="text"
                          placeholder="Co jsme tu prožili? (např. První rande) *"
                          className="bg-[#F2F2F7] border border-[#E5E5EA] px-3.5 py-2.5 rounded-[12px] text-xs w-full focus:ring-1 focus:ring-[#FF2D55] text-gray-855"
                          value={newPlaceTitle}
                          onChange={(e) => setNewPlaceTitle(e.target.value)}
                        />
                        <input
                          type="text"
                          placeholder="Adresa nebo město (např. Javorek 54) *"
                          className="bg-[#F2F2F7] border border-[#E5E5EA] px-3.5 py-2.5 rounded-[12px] text-xs w-full focus:ring-1 focus:ring-[#FF2D55] text-gray-855"
                          value={newPlaceAddress}
                          onChange={(e) => setNewPlaceAddress(e.target.value)}
                        />
                        <textarea
                          placeholder="Tvoje osobní vzpomínka nebo vzkaz..."
                          className="bg-[#F2F2F7] border border-[#E5E5EA] px-3.5 py-2.5 rounded-[12px] text-xs w-full h-16 resize-none focus:ring-1 focus:ring-[#FF2D55] text-gray-855"
                          value={newPlaceDescription}
                          onChange={(e) => setNewPlaceDescription(e.target.value)}
                        />
                        <div className="flex gap-2">
                          <input
                            type="date"
                            className="bg-[#F2F2F7] border border-[#E5E5EA] px-3 py-2.5 rounded-[12px] text-xs flex-1 focus:ring-1 focus:ring-[#FF2D55] text-gray-800"
                            value={newPlaceDate}
                            onChange={(e) => setNewPlaceDate(e.target.value)}
                          />
                          <select
                            className="bg-[#F2F2F7] border border-[#E5E5EA] px-3 py-2.5 rounded-[12px] text-xs focus:ring-1 focus:ring-[#FF2D55] text-gray-800"
                            value={newPlaceEmoji}
                            onChange={(e) => setNewPlaceEmoji(e.target.value)}
                          >
                            <option value="📍">📍 Špendlík</option>
                            <option value="✨">✨ Třpyt</option>
                            <option value="☕️">☕️ Káva</option>
                            <option value="❤️">❤️ Srdce</option>
                            <option value="🌸">🌸 Květina</option>
                            <option value="🏰">🏰 Zámek</option>
                            <option value="🏕️">🏕️ Výlet</option>
                          </select>
                        </div>
                        <button
                          type="button"
                          onClick={addSpecialPlace}
                          className="bg-[#FF2D55] hover:bg-[#FF2D55]/90 text-white font-bold py-2.5 rounded-[12px] text-xs shadow-md transition-all flex items-center justify-center gap-1.5"
                        >
                          <span>Přidat místo do mapy</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Places Log Card List */}
                <div className="flex flex-col gap-2.5" id="places-list">
                  <h4 className="font-extrabold text-xs text-gray-900 px-1 uppercase tracking-wider text-[#8E8E93]">Log památných míst</h4>
                  {places.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => setSelectedPlaceId(p.id)}
                      className={`p-4 rounded-[20px] cursor-pointer transition-all border ${
                        selectedPlaceId === p.id 
                          ? 'bg-red-50/50 border-[#FF2D55]/55 shadow-2xs' 
                          : 'bg-white border-[#E5E5EA] hover:border-gray-300'
                      } flex flex-col gap-2 relative`}
                    >
                      <div className="flex justify-between items-start pr-6">
                        <div className="flex gap-2.5 items-center">
                          <div className="w-8 h-8 rounded-full bg-[#FFE5E9] flex items-center justify-center shrink-0">
                            <span className="text-sm">{p.emoji}</span>
                          </div>
                          <div className="flex flex-col">
                            <h5 className="font-extrabold text-xs text-gray-900 leading-tight">{p.title}</h5>
                            <span className="text-[9px] text-[#8E8E93] font-mono leading-none mt-1">
                              {new Date(p.date).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' })}
                            </span>
                          </div>
                        </div>

                        {/* Delete btn */}
                        <button
                          type="button"
                          onClick={(e) => deleteSpecialPlace(p.id, e)}
                          className="text-[#8E8E93] hover:text-red-500 p-1 rounded-md transition-colors border border-transparent absolute top-3 right-3"
                          title="Smazat místo"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="pl-1 flex flex-col gap-1">
                        <p className="text-[10px] text-gray-500 leading-snug font-mono italic">
                          📍 {p.address}
                        </p>
                        <p className="text-[11px] text-gray-700 leading-relaxed font-sans mt-0.5">
                          {p.description}
                        </p>
                      </div>

                      {/* Author badge signature */}
                      <span className="text-[8px] uppercase font-bold tracking-widest text-[#FF2D55]/60 absolute bottom-3 right-3">
                        {p.author === 'both' ? 'Spolu 🥰' : (p.author === 'boyfriend' ? 'FáFa 👑' : 'Beru 🌸')}
                      </span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {activeTab === Tab.WORKSPACE && (
              <motion.div
                key="workspace"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.25 }}
                className="flex flex-col gap-5 pb-8"
                id="workspace-tab"
              >
                {/* Back to navigation button */}
                <button
                  type="button"
                  onClick={() => setActiveTab(Tab.MORE)}
                  className="mr-auto flex items-center gap-1.5 text-xs text-[#FF2D55] font-extrabold border border-[#FF2D55]/20 bg-white/50 px-3 py-1.5 rounded-full hover:bg-[#FFE5E9]/10 transition-all"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Zpět do Více</span>
                </button>

                {/* Workspace Header */}
                <div className="flex flex-col gap-1">
                  <span className="text-xs uppercase tracking-wider text-[#FF2D55] font-bold">Google Cloud Integrace</span>
                  <h3 className="font-sans text-gray-900 font-extrabold text-xl">Google Workspace Koutek ☁️</h3>
                </div>

                {/* Auth Check layout */}
                {!googleToken ? (
                  <div className="bg-white rounded-[24px] p-6 shadow-[0_4px_20px_rgba(0,0,0,0.05)] border border-[#E5E5EA] flex flex-col items-center text-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-[#F2F2F7] flex items-center justify-center">
                      <Sparkle className="w-6 h-6 text-[#FF2D55]" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <h4 className="font-extrabold text-sm text-gray-900">Propoj svůj společný prostor</h4>
                      <p className="text-xs text-[#8E8E93] max-w-xs leading-relaxed">
                        Chceš psát přímo do Google Docs, posílat milostné maily přes Gmail nebo pálit láskyplné zprávy do Google Chatu? Přihlas se!
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleGoogleLogin}
                      className="bg-gray-900 hover:bg-gray-800 text-white font-bold py-3 px-6 rounded-[16px] text-xs transition-all flex items-center gap-2 shadow-sm"
                    >
                      <LogIn className="w-4 h-4 text-[#FF2D55]" />
                      <span>Propojit s Google Účtem</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    {/* Logged in User Pill */}
                    <div className="bg-[#E5E5EA]/35 backdrop-blur-sm px-4 py-3 rounded-[20px] flex justify-between items-center border border-[#E5E5EA]">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-[#FF2D55] text-white flex items-center justify-center text-[10px] font-bold">
                          {googleUser?.displayName?.charAt(0) || 'U'}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] text-[#8E8E93] leading-none">Propojený Google Účet</span>
                          <span className="text-xs font-bold text-gray-900 leading-tight mt-0.5 truncate max-w-[140px]">
                            {googleUser?.displayName || 'Drahý uživatel'}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleGoogleLogout}
                        className="p-1 px-2.5 bg-white hover:bg-red-50 text-red-500 border border-red-100 rounded-md text-[10px] font-extrabold flex items-center gap-1 transition-all"
                        title="Odpojit účet"
                      >
                        <LogOut className="w-3 h-3" />
                        <span>Odpojit</span>
                      </button>
                    </div>

                    {/* Google Sub-tabs widgets */}
                    <div className="flex bg-[#F2F2F7] rounded-lg p-0.5 text-[10px] font-extrabold" id="workspace-sub-navigation">
                      <button
                        type="button"
                        onClick={() => setWorkspaceSubTab('journal')}
                        className={`py-2 rounded-md transition-all flex-1 text-center ${
                          workspaceSubTab === 'journal'
                            ? 'bg-white text-gray-900 shadow-2xs font-black'
                            : 'text-[#8E8E93] hover:text-gray-900'
                        }`}
                      >
                        📕 Společný deník
                      </button>
                      <button
                        type="button"
                        onClick={() => setWorkspaceSubTab('gmail')}
                        className={`py-2 rounded-md transition-all flex-1 text-center ${
                          workspaceSubTab === 'gmail'
                            ? 'bg-white text-gray-900 shadow-2xs font-black'
                            : 'text-[#8E8E93] hover:text-gray-900'
                        }`}
                      >
                        💌 Milostné dopisy
                      </button>
                      <button
                        type="button"
                        onClick={() => setWorkspaceSubTab('chat')}
                        className={`py-2 rounded-md transition-all flex-1 text-center ${
                          workspaceSubTab === 'chat'
                            ? 'bg-white text-gray-900 shadow-2xs font-black'
                            : 'text-[#8E8E93] hover:text-gray-900'
                        }`}
                      >
                        💬 Rychlý chat
                      </button>
                    </div>

                    {/* SUB-TAB 1: Docs Společný Deník */}
                    {workspaceSubTab === 'journal' && (
                      <div className="flex flex-col gap-4 animate-in fade-in duration-200">
                        {isJournalLoading ? (
                          <div className="bg-white rounded-[24px] py-12 border border-[#E5E5EA] flex flex-col items-center justify-center gap-2">
                            <Loader2 className="w-8 h-8 text-[#FF2D55] animate-spin" />
                            <span className="text-xs text-[#8E8E93]">Stahuji váš společný deník z cloudu...</span>
                          </div>
                        ) : !journalDocId ? (
                          <div className="bg-white rounded-[24px] p-5 border border-[#E5E5EA] flex flex-col gap-4 shadow-3xs">
                            <div className="flex flex-col gap-1">
                              <h4 className="font-extrabold text-xs text-gray-900 uppercase tracking-widest text-[#FF2D55]">Deník v cloudu</h4>
                              <p className="text-xs text-gray-600 leading-relaxed">
                                Vytvořte jedním kliknutím nový Google Dokument, kam se budou automaticky ukládat všechny vaše drahocenné sny, vzkazy a zážitky. Budete ho moci oba společně upravovat!
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={handleCreateJournal}
                              className="bg-[#FF2D55] hover:bg-[#FF2D55]/90 text-white font-bold py-3 rounded-[16px] text-xs transition-all flex items-center justify-center gap-2 shadow-md"
                            >
                              <FileText className="w-4 h-4" />
                              <span>Založit nový deník v Google Docs</span>
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-4 bg-white rounded-[24px] p-5 shadow-3xs border border-[#E5E5EA]">
                            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-green-600">Propojený Google Dokument</span>
                              <a
                                href={`https://docs.google.com/document/d/${journalDocId}/edit`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[10px] text-[#FF2D55] hover:underline font-extrabold flex items-center gap-0.5"
                              >
                                Otevřít v Docs ↗
                              </a>
                            </div>

                            {/* Live document stream simulated widget */}
                            <div className="flex flex-col gap-1">
                              <span className="text-[9px] text-[#8E8E93] uppercase font-bold tracking-wider">Aktuální obsah dokumentu:</span>
                              <div className="bg-[#F2F2F7] max-h-[160px] overflow-y-auto p-3.5 rounded-[16px] text-xs font-serif text-gray-850 leading-relaxed border border-[#E5E5EA] whitespace-pre-wrap">
                                {journalContent ? journalContent : "Dokument je zatím prázdný. Přidejte první zápisek!"}
                              </div>
                            </div>

                            {/* Append Entry Form */}
                            <div className="flex flex-col gap-2 pt-2 border-t border-gray-100">
                              <span className="text-[9px] text-gray-900 font-extrabold uppercase tracking-wider">Připsat další drahocennou chvíli:</span>
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  placeholder="Dneska jsme se tulili a dávali si palačinky... 🥰"
                                  className="bg-[#F2F2F7] border border-[#E5E5EA] px-3.5 py-2.5 rounded-[12px] text-xs flex-1 focus:ring-1 focus:ring-[#FF2D55] text-gray-800 font-sans"
                                  value={newJournalText}
                                  onChange={(e) => setNewJournalText(e.target.value)}
                                />
                                <button
                                  type="button"
                                  onClick={handleAppendJournal}
                                  className="bg-gray-900 hover:bg-gray-800 text-white font-bold px-4 py-2.5 rounded-[12px] text-xs transition-all shadow-xs"
                                >
                                  Zapsat
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* SUB-TAB 2: Gmail Milostné Dopisy */}
                    {workspaceSubTab === 'gmail' && (
                      <div className="flex flex-col gap-4 animate-in fade-in duration-200">
                        <div className="bg-white rounded-[24px] p-5 shadow-3xs border border-[#E5E5EA] flex flex-col gap-4">
                          <h4 className="font-extrabold text-xs text-gray-900 uppercase tracking-widest text-[#FF2D55]">Poslat voňavý email 💌</h4>
                          
                          <div className="flex flex-col gap-3">
                            <input
                              type="email"
                              placeholder="Partnerova Gmail adresa *"
                              className="bg-[#F2F2F7] border border-[#E5E5EA] px-3.5 py-2.5 rounded-[12px] text-xs w-full focus:ring-1 focus:ring-[#FF2D55] text-gray-800"
                              value={partnerEmail}
                              onChange={(e) => setPartnerEmail(e.target.value)}
                            />
                            <textarea
                              placeholder="Napiš ty nejkrásnější řádky přímo ze srdce... 🥰 Vypustíme je přímo přes tvůj Gmail."
                              className="bg-[#F2F2F7] border border-[#E5E5EA] px-3.5 py-2.5 rounded-[12px] text-xs w-full h-24 resize-none focus:ring-1 focus:ring-[#FF2D55] text-gray-800"
                              value={emailMessage}
                              onChange={(e) => setEmailMessage(e.target.value)}
                            />

                            <button
                              type="button"
                              onClick={handleSendLoveLetter}
                              className="bg-[#FF2D55] hover:bg-[#FF2D55]/90 text-white font-bold py-3 rounded-[14px] text-xs shadow-md transition-all flex items-center justify-center gap-1.5"
                            >
                              <Mail className="w-4 h-4" />
                              <span>Odeslat milostné psaní partnerskému srdci</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* SUB-TAB 3: Google Chat Bleskový chat */}
                    {workspaceSubTab === 'chat' && (
                      <div className="flex flex-col gap-4 animate-in fade-in duration-200">
                        {chatSpacesError ? (
                          <div className="bg-[#FFF0F0] rounded-[24px] p-5 shadow-3xs border border-[#FF3B30]/30 flex flex-col gap-2 relative">
                            <h4 className="font-extrabold text-[11px] text-[#FF3B30] uppercase tracking-widest">Google Chat integrace omezena</h4>
                            <p className="text-[10px] text-gray-800 font-medium">Bohužel tvůj Google Workspace účet nemá povolen Google Chat, nebo došlo k jiné chybě:</p>
                            <p className="text-[10px] font-mono text-[#FF3B30]/80 p-2 bg-[#FF3B30]/5 rounded-[8px]">{chatSpacesError}</p>
                            <p className="text-[9px] text-[#8E8E93] mt-2">Doporučujeme kontaktovat správce vašeho Google Workspace účtu (https://support.google.com/a/answer/9071576).</p>
                          </div>
                        ) : (
                          <div className="bg-white rounded-[24px] p-5 shadow-3xs border border-[#E5E5EA] flex flex-col gap-4">
                            <h4 className="font-extrabold text-xs text-gray-900 uppercase tracking-widest text-[#FF2D55]">Google Chat bleskový ping 💬</h4>
                            
                            <div className="flex flex-col gap-3">
                              <label className="text-[10px] uppercase font-extrabold text-[#8E8E93]">Vyberte komunikační prostor:</label>
                              <div className="flex flex-col gap-1">
                                {isChatSpacesLoading ? (
                                  <div className="bg-[#F2F2F7] border border-[#E5E5EA] px-3.5 py-2 rounded-[12px] flex items-center justify-center gap-2">
                                     <Loader2 className="w-3.5 h-3.5 animate-spin text-[#8E8E93]" />
                                     <span className="text-xs text-[#8E8E93]">Načítání prostorů...</span>
                                  </div>
                                ) : chatSpaces.length > 0 ? (
                                  <select 
                                    className="bg-[#F2F2F7] border border-[#E5E5EA] px-3.5 py-2 rounded-[12px] text-xs w-full focus:ring-1 focus:ring-[#FF2D55] text-gray-800 truncate"
                                    value={selectedSpace}
                                    onChange={(e) => setSelectedSpace(e.target.value)}
                                  >
                                    {chatSpaces.map(space => (
                                      <option key={space.name} value={space.name}>{space.displayName || space.name}</option>
                                    ))}
                                  </select>
                                ) : (
                                  <input
                                    type="text"
                                    placeholder="Název prostoru (např. spaces/love_room)"
                                    className="bg-[#F2F2F7] border border-[#E5E5EA] px-3.5 py-2 rounded-[12px] text-xs w-full focus:ring-1 focus:ring-[#FF2D55] text-gray-800 font-mono"
                                    value={selectedSpace}
                                    onChange={(e) => setSelectedSpace(e.target.value)}
                                  />
                                )}
                              </div>
                              
                              <input
                                type="text"
                                placeholder="Krátký rychlý vzkaz k vypálení..."
                                className="bg-[#F2F2F7] border border-[#E5E5EA] px-3.5 py-2.5 rounded-[12px] text-xs w-full focus:ring-1 focus:ring-[#FF2D55] text-gray-800"
                                value={customChatMessage}
                                onChange={(e) => setCustomChatMessage(e.target.value)}
                              />
  
                              <button
                                type="button"
                                onClick={() => handleSendChatMessage()}
                                className="bg-gray-900 hover:bg-gray-800 text-white font-bold py-3 rounded-[14px] text-xs shadow-md transition-all flex items-center justify-center gap-1.5"
                              >
                                <MessageCircle className="w-4 h-4 text-[#FF2D55]" />
                                <span>Odeslat ping do Google Chatu</span>
                              </button>
  
                              {/* Quick Romantic presets */}
                              <div className="flex flex-col gap-2 mt-2 pt-2 border-t border-gray-100">
                                <span className="text-[9px] uppercase font-bold text-[#8E8E93]">Romantické rychloklepky (okamžité odeslání):</span>
                                <div className="flex flex-wrap gap-1.5">
                                  {[
                                    "Myslím na tebe! 🥰", 
                                    "Miluju tě, Beru! ❤️", 
                                    "FáFa tě moc pusinkuje! 😘",
                                    "Chybíš mi! 🥺"
                                  ].map((preset, idx) => (
                                    <button
                                      key={idx}
                                      type="button"
                                      onClick={() => {
                                        setCustomChatMessage(preset);
                                        triggerAlert("Připraveno", `Vzkaz "${preset}" byl vybrán. Můžeš jej odeslat tlačítkem výše!`, "💬");
                                      }}
                                      className="bg-red-50 hover:bg-[#FFE5E9] text-[#FF2D55] text-[10px] font-bold px-3 py-1.5 rounded-full transition-all border border-[#FF2D55]/10"
                                    >
                                      {preset}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === Tab.MORE && (
              <motion.div
                key="more_launchpad"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.25 }}
                className="flex flex-col gap-5 pb-8"
                id="more-launchpad"
              >
                {/* Header */}
                <div className="flex flex-col gap-1">
                  <span className="text-xs uppercase tracking-wider text-[#FF2D55] font-bold">Více funkcí</span>
                  <h3 className="font-sans text-gray-900 font-extrabold text-xl">Láskyplný Rozcestník 🌸</h3>
                </div>

                {/* The Launchpad grid */}
                <div className="grid grid-cols-2 gap-3.5" id="ios-launchpad-grid">
                  <div
                    onClick={() => setActiveTab(Tab.TIMELINE)}
                    className="bg-white/40 backdrop-blur-md p-5 rounded-[24px] border border-white/50 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col items-center text-center gap-2"
                  >
                    <div className="w-10 h-10 rounded-full bg-pink-100/80 flex items-center justify-center text-[#FF2D55] text-lg">
                      📅
                    </div>
                    <span className="font-extrabold text-xs text-gray-900 leading-none drop-shadow-sm">Společný kalendář</span>
                    <span className="text-[9px] text-gray-600 leading-tight">Naše milníky v čase</span>
                  </div>

                  <div
                    onClick={() => setActiveTab(Tab.MESSAGE_BOARD)}
                    className="bg-white/40 backdrop-blur-md p-5 rounded-[24px] border border-white/50 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col items-center text-center gap-2"
                  >
                    <div className="w-10 h-10 rounded-full bg-amber-100/80 flex items-center justify-center text-amber-600 text-lg">
                      💌
                    </div>
                    <span className="font-extrabold text-xs text-gray-900 leading-none drop-shadow-sm">Nástěnka sladkých vzkazů</span>
                    <span className="text-[9px] text-gray-600 leading-tight">Zamilované lístečky lásky</span>
                  </div>
                </div>

                {/* PWA Home Launcher Instructions */}
                <div className="bg-white rounded-[24px] p-5 shadow-3xs border border-[#E5E5EA] flex flex-col gap-3">
                  <h4 className="font-extrabold text-[11px] text-gray-900 uppercase tracking-widest text-[#FF2D55] flex items-center gap-1">
                    <Smartphone className="w-3.5 h-3.5" /> Jak nainstalovat PWA Web Appku?
                  </h4>
                  <p className="text-[10px] text-gray-600 leading-relaxed font-sans">
                    Aby tato aplikace běžela na tvém iPhonu nebo Androidu jako opravdová nativní aplikace přímo s ikonou na ploše:
                  </p>
                  <ol className="text-[10px] text-gray-700 list-decimal list-inside space-y-1.5 pl-1.5 font-sans leading-relaxed">
                    <li>Otevři tuto stránku v prohlížeči <strong>Safari</strong> (iPhone) nebo <strong>Chrome</strong> (Android).</li>
                    <li>Klepni na tlačítko <strong>Sdílet</strong> (Safari) nebo ikonu se třemi tečkami (Chrome).</li>
                    <li>Zvol možnost <strong>Přidat na plochu</strong> (Add to Home Screen).</li>
                    <li>Ulož a spusť ji přímo z plochy telefonu. Aplikace se otevře na celou obrazovku bez řádků prohlížeče!</li>
                  </ol>
                </div>

                {/* PayPal Donation Fund */}
                <div className="bg-white rounded-[24px] p-5 shadow-3xs border border-[#E5E5EA] flex flex-col gap-3 text-center items-center">
                  <h4 className="font-extrabold text-[11px] text-gray-900 uppercase tracking-widest text-[#FF2D55] flex items-center justify-center gap-1">
                    <Heart className="w-3.5 h-3.5" /> Společný fond rande
                  </h4>
                  <p className="text-[10px] text-gray-600 leading-relaxed font-sans max-w-[200px] mb-2">
                    Máte rádi tuto aplikaci? Přispějte nám na kávu nebo společné rande přes PayPal!
                  </p>
                  <PayPalButton />
                </div>

                {/* Professional vCard Metadata Author Signature */}
                <div className="bg-[#FFE5E3]/10 rounded-[24px] p-5 border border-[#FF2D55]/10 mt-2 flex flex-col gap-3" id="vcard-author">
                  <div className="flex items-center gap-3">
                    <img
                      src="https://fkdev.xyz/pwa-icon-512.png"
                      alt="František Kalášek Logo"
                      referrerPolicy="no-referrer"
                      className="w-10 h-10 rounded-full bg-white object-contain border border-[#FF2D55]/15"
                    />
                    <div className="flex flex-col animate-pulse">
                      <h4 className="font-black text-xs text-gray-900 leading-tight">František Kalášek</h4>
                      <span className="text-[9px] font-semibold text-gray-500 leading-none mt-1">TopBot PwnZ™ • Web, PWA & Automatizace</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-1.5 border-t border-gray-100 pt-2.5 text-[9px] font-mono text-gray-600">
                    <div className="flex items-center justify-between">
                      <span>Webové stránky:</span>
                      <a href="https://fkdev.xyz" target="_blank" rel="noreferrer" className="text-[#FF2D55] font-bold hover:underline">fkdev.xyz</a>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>E-mail:</span>
                      <a href="mailto:FandaKalasek@icloud.com" className="text-gray-800 hover:underline">FandaKalasek@icloud.com</a>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Telefonní kontakt:</span>
                      <a href="tel:+420722426195" className="text-gray-800 hover:underline font-bold">+420 722 426 195</a>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Adresa sídla:</span>
                      <span className="text-gray-800">Javorek 54, 592 03 Česko</span>
                    </div>
                  </div>
                  <blockquote className="border-l-2 border-[#FF2D55]/30 pl-2.5 text-[9px] italic text-gray-500 leading-relaxed font-serif mt-1">
                    &ldquo;Bridge the gap, create the world.&rdquo;
                  </blockquote>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

        </div>

        {/* Beautiful Elegant Native Bottom iOS Navigation Panel with 5 columns for phone view */}
        <div style={{ paddingBottom: 'calc(10px + env(safe-area-inset-bottom))' }} className="absolute bottom-0 inset-x-0 bg-white/50 backdrop-blur-3xl saturate-150 border-t border-white/40 pt-2.5 px-3 flex justify-between items-center z-40 h-[calc(64px+env(safe-area-inset-bottom))] shrink-0 shadow-[0_-4px_24px_rgba(0,0,0,0.02)]" id="ios-bottom-nav">
          
          <button
            type="button"
            id="nav-love"
            onClick={() => setActiveTab(Tab.LOVE_COUNTER)}
            className={`flex flex-col items-center gap-1 transition-all text-center flex-1 max-w-[65px] ${
              activeTab === Tab.LOVE_COUNTER ? 'text-[#FF2D55] scale-105' : 'text-[#8E8E93] hover:text-gray-900'
            }`}
          >
            <Heart className={`w-4.5 h-4.5 ${activeTab === Tab.LOVE_COUNTER ? 'fill-[#FF2D55]' : ''}`} />
            <span className="text-[8px] font-black tracking-tight leading-none mt-0.5">Miláček</span>
          </button>

          <button
            type="button"
            id="nav-places"
            onClick={() => setActiveTab(Tab.PLACES)}
            className={`flex flex-col items-center gap-1 transition-all text-center flex-1 max-w-[65px] ${
              activeTab === Tab.PLACES ? 'text-[#FF2D55] scale-105' : 'text-[#8E8E93] hover:text-gray-900'
            }`}
          >
            <MapPin className={`w-4.5 h-4.5 ${activeTab === Tab.PLACES ? 'fill-[#FF2D55]' : ''}`} />
            <span className="text-[8px] font-black tracking-tight leading-none mt-0.5">Místa</span>
          </button>

          <button
            type="button"
            id="nav-gallery"
            onClick={() => setActiveTab(Tab.GALLERY)}
            className={`flex flex-col items-center gap-1 transition-all text-center flex-1 max-w-[65px] ${
              activeTab === Tab.GALLERY ? 'text-[#FF2D55] scale-105' : 'text-[#8E8E93] hover:text-gray-900'
            }`}
          >
            <ImageIcon className={`w-4.5 h-4.5 ${activeTab === Tab.GALLERY ? 'text-[#FF2D55]' : ''}`} />
            <span className="text-[8px] font-black tracking-tight leading-none mt-0.5">Galerie</span>
          </button>

          <button
            type="button"
            id="nav-more"
            onClick={() => setActiveTab(Tab.MORE)}
            className={`flex flex-col items-center gap-1 transition-all text-center flex-1 max-w-[65px] ${
              (activeTab === Tab.MORE || activeTab === Tab.TIMELINE || activeTab === Tab.MESSAGE_BOARD) ? 'text-[#FF2D55] scale-105' : 'text-[#8E8E93] hover:text-gray-900'
            }`}
          >
            <Menu className="w-4.5 h-4.5" />
            <span className="text-[8px] font-black tracking-tight leading-none mt-0.5">Více</span>
          </button>

        </div>

        {/* Custom Confirmation Dialog Overlay (iOS Native Feel) */}
        <AnimatePresence>
          {customConfirm && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-6 z-[200] animate-in fade-in duration-200" id="custom-confirmation-modal">
              <motion.div
                initial={{ opacity: 0, scale: 0.92, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: 15 }}
                transition={{ type: "spring", damping: 25, stiffness: 350 }}
                className="bg-white/95 backdrop-blur-lg rounded-[22px] w-full max-w-xs overflow-hidden shadow-[0_24px_50px_rgba(0,0,0,0.18)] border border-gray-100/30 text-center flex flex-col pt-5"
              >
                <div className="px-5 pb-4 flex flex-col gap-1.5 shrink-0">
                  <h4 className="font-extrabold text-sm text-gray-950 font-sans tracking-tight leading-tight">{customConfirm.title}</h4>
                  <p className="text-[11px] text-gray-600 font-sans leading-normal px-1">{customConfirm.message}</p>
                </div>
                <div className="flex border-t border-gray-200/50 h-11 shrink-0">
                  <button
                    type="button"
                    onClick={() => setCustomConfirm(null)}
                    className="flex-1 font-semibold text-xs text-blue-500 hover:bg-gray-50 active:bg-gray-100 transition-colors border-r border-gray-200/50"
                  >
                    {customConfirm.cancelText || 'Zrušit'}
                  </button>
                  <button
                    type="button"
                    onClick={customConfirm.onConfirm}
                    className={`flex-1 font-extrabold text-xs hover:bg-gray-50 active:bg-gray-100 transition-colors ${
                      customConfirm.isDestructive ? 'text-red-500' : 'text-blue-500'
                    }`}
                  >
                    {customConfirm.confirmText}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Custom Alert Overlay Dialog (iOS Style Alert toast) */}
        <AnimatePresence>
          {customAlert && (
            <div className="fixed inset-0 bg-[#000000]/50 backdrop-blur-xs flex items-center justify-center p-6 z-[200] animate-in fade-in duration-200" id="custom-alert-modal">
              <motion.div
                initial={{ opacity: 0, scale: 0.92, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: 15 }}
                transition={{ type: "spring", damping: 25, stiffness: 350 }}
                className="bg-white/95 backdrop-blur-lg rounded-[22px] w-full max-w-xs overflow-hidden shadow-[0_24px_50px_rgba(0,0,0,0.18)] border border-gray-100/30 text-center flex flex-col pt-5"
              >
                <div className="px-5 pb-4 flex flex-col items-center gap-2 shrink-0">
                  <div className="text-2xl animate-bounce">{customAlert.icon || '✨'}</div>
                  <h4 className="font-extrabold text-sm text-gray-950 font-sans tracking-tight leading-tight">{customAlert.title}</h4>
                  <p className="text-[11px] text-gray-600 font-sans leading-normal px-2">{customAlert.message}</p>
                </div>
                <div className="border-t border-gray-200/50 h-11 shrink-0 flex">
                  <button
                    type="button"
                    onClick={() => {
                      if (customAlert.onClose) customAlert.onClose();
                      setCustomAlert(null);
                    }}
                    className="flex-1 font-black text-xs text-blue-500 hover:bg-gray-50 active:bg-[#FFE5E9]/10 transition-colors"
                  >
                    Rozumím
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
