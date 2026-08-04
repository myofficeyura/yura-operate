'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, Table, Presentation, Mic, Send, Settings, Loader2, Paperclip, X,
  Menu, SquarePen, FileText, User, Search as SearchIcon, Play,
  LogOut, ChevronRight, Image as ImageIcon, Video, Music, Code, ListTodo,
  FolderOpen, FileAudio, MessageSquare, Calendar as CalendarIcon, Bell, Download, Cloud, LogIn,
  HardDrive, BookOpen, CheckCircle2, LayoutTemplate, Type, PaintBucket
} from 'lucide-react';

import { signInWithPopup, signOut, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, User as FirebaseUser } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, googleProvider, db } from '@/lib/firebase'; 

// Types
type FileObj = { name: string; data: string; mimeType: string; url: string; source?: string };
type Message = { role: 'user' | 'yura'; content: string; files?: FileObj[]; uiType?: string; };
type ChatSession = { id: string; title: string; messages: Message[]; date: number; };
type ProjectItem = { id: string; title: string; type: string; date: number; content: string; }; 
type AppItem = { id: string; content: string; date: number; };
type AppSettings = { theme: 'light' | 'dark'; font: string; fontSize: string; bubbleColor: string; nickname: string; };

export default function Home() {
  // App States
  const [prompt, setPrompt] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isMounted, setIsMounted] = useState(false); 
  const [user, setUser] = useState<FirebaseUser | null>(null);

  // Data States
  const [currentSessionId, setCurrentSessionId] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatHistory, setChatHistory] = useState<ChatSession[]>([]);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [tasks, setTasks] = useState<AppItem[]>([]);
  const [events, setEvents] = useState<AppItem[]>([]);
  const [notes, setNotes] = useState<AppItem[]>([]);
  const [appSettings, setAppSettings] = useState<AppSettings>({ theme: 'light', font: 'font-sans', fontSize: 'text-base', bubbleColor: 'bg-[#f0f4f9]', nickname: '' });

  // UI Modals
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isProjectsOpen, setIsProjectsOpen] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isTasksOpen, setIsTasksOpen] = useState(false);
  const [isKeepOpen, setIsKeepOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  
  // Menus & Previews
  const [attachedFiles, setAttachedFiles] = useState<FileObj[]>([]);
  const [previewFile, setPreviewFile] = useState<{url: string, type: string, name: string} | null>(null);
  const [isAttachMenuOpen, setIsAttachMenuOpen] = useState(false);
  const [isCreateMenuOpen, setIsCreateMenuOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'main' | 'appearance' | 'about'>('main');
  const [pendingUIType, setPendingUIType] = useState<string>('text');

  // Search & Auth Inputs
  const [historySearch, setHistorySearch] = useState('');
  const [chatSearch, setChatSearch] = useState('');
  const [authMode, setAuthMode] = useState<'select' | 'email-login' | 'email-signup'>('select');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Refs
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ------------------- INITIALIZATION & FIREBASE SYNC (NO LOCAL STORAGE) -------------------
  useEffect(() => {
    setIsMounted(true);
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser && db) {
        try {
          const docRef = doc(db, 'users', currentUser.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            setChatHistory(data.chatHistory || []);
            setProjects(data.projects || []);
            setTasks(data.tasks || []);
            setEvents(data.events || []);
            setNotes(data.notes || []);
            if(data.settings) setAppSettings(data.settings);
            
            if (data.chatHistory?.length > 0) {
              setCurrentSessionId(data.chatHistory[0].id);
              setMessages(data.chatHistory[0].messages);
            } else startNewChat();
          } else {
             startNewChat();
          }
        } catch (e) { console.error("Firebase load error", e); startNewChat(); }
      } else {
        startNewChat();
      }
    });
    return () => unsubscribe();
  }, []);

  // Auto-save to Firebase Firestore only
  useEffect(() => {
    if (!isMounted || !currentSessionId) return;
    if (messages.length > 0) {
      setChatHistory(prev => {
        let updated = [...prev];
        const idx = prev.findIndex(s => s.id === currentSessionId);
        const title = messages[0].content.slice(0, 30) + (messages[0].content.length > 30 ? '...' : '');
        if (idx >= 0) updated[idx] = { ...updated[idx], messages, title };
        else updated.unshift({ id: currentSessionId, title, messages, date: Date.now() });
        if (updated.length > 50) updated = updated.slice(0, 50);
        
        if (user && db) {
          setDoc(doc(db, 'users', user.uid), { chatHistory: updated, projects, tasks, events, notes, settings: appSettings }, { merge: true }).catch(e => console.error(e));
        }
        return updated;
      });
    }
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, projects, tasks, events, notes, appSettings, user]);

  // ------------------- AUTHENTICATION -------------------
  const handleGoogleLogin = async () => { try { await signInWithPopup(auth, googleProvider); setIsAuthModalOpen(false); } catch (error) { alert("Login failed."); } };
  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (authMode === 'email-login') await signInWithEmailAndPassword(auth, email, password);
      else await createUserWithEmailAndPassword(auth, email, password);
      setIsAuthModalOpen(false); setAuthMode('select'); setEmail(''); setPassword('');
    } catch (error: any) { alert(error.message); }
  };
  const handleLogout = async () => { try { await signOut(auth); startNewChat(); } catch (error) { console.error(error); } };

  // ------------------- CHAT LOGIC -------------------
  const startNewChat = () => { setCurrentSessionId(Date.now().toString()); setMessages([]); setIsSidebarOpen(false); setPendingUIType('text'); setChatSearch(''); };
  const loadChat = (id: string) => { const session = chatHistory.find(s => s.id === id); if (session) { setCurrentSessionId(session.id); setMessages(session.messages); setIsSidebarOpen(false); setChatSearch(''); }};

  const toggleVoiceInput = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) { alert("Voice input requires Chrome/Edge."); return; }
    if (isListening) return;
    const recognition = new SpeechRecognition();
    recognition.continuous = false; recognition.interimResults = true;
    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (e: any) => { setPrompt(Array.from(e.results).map((r: any) => r[0].transcript).join('')); };
    recognition.onerror = () => setIsListening(false); recognition.onend = () => setIsListening(false);
    recognition.start();
  };

  const openFilePicker = (acceptType: string) => { setIsAttachMenuOpen(false); setTimeout(() => { if (fileInputRef.current) { fileInputRef.current.accept = acceptType; fileInputRef.current.click(); } }, 50); };
  const handleCloudPick = (sourceName: string) => { setIsAttachMenuOpen(false); setAttachedFiles(prev => [...prev, { name: `Imported_From_${sourceName}.pdf`, data: "", mimeType: "application/pdf", url: "", source: sourceName }]); };
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (attachedFiles.length + files.length > 5) { alert("Maximum 5 files."); return; }
    const newFiles = await Promise.all(files.map(file => new Promise<FileObj>((resolve) => {
      const reader = new FileReader(); reader.readAsDataURL(file);
      reader.onload = () => resolve({ name: file.name, data: (reader.result as string).split(',')[1], mimeType: file.name.toLowerCase().endsWith('.mp4') ? 'video/mp4' : file.type, url: URL.createObjectURL(file) });
    })));
    setAttachedFiles(prev => [...prev, ...newFiles]);
    if (fileInputRef.current) fileInputRef.current.value = ""; 
  };

  const removeFile = (indexToRemove: number) => { setAttachedFiles(prev => prev.filter((_, index) => index !== indexToRemove)); };

  const handleSend = async () => {
    if ((!prompt.trim() && attachedFiles.length === 0) || isLoading) return;
    
    const currentPrompt = prompt; const currentFiles = [...attachedFiles]; const targetUIType = pendingUIType;
    setMessages(prev => [...prev, { role: 'user', content: currentPrompt, ...(currentFiles.length > 0 && { files: currentFiles }) }]);
    
    let apiPrompt = currentPrompt; 
    if (targetUIType === 'sheet') apiPrompt += "\n\n(Format strictly as a Markdown table).";
    if (targetUIType === 'slide') apiPrompt += "\n\n(Write a presentation. Separate each slide with '---SLIDE---'. First line is title).";
    if (targetUIType === 'image') apiPrompt += "\n\n(Reply ONLY with a descriptive image generation prompt).";
    if (targetUIType === 'todo') apiPrompt += "\n\n(Format as a Tasks list. Start lines with a dash '-').";
    if (targetUIType === 'calendar') apiPrompt += "\n\n(Generate a structured daily Calendar format).";
    if (targetUIType === 'reminder') apiPrompt += "\n\n(Generate a Keep reminder note).";
    if (targetUIType === 'transcript' || currentFiles.some(f => f.mimeType.includes('audio') || f.mimeType.includes('video'))) apiPrompt += "\n\n(Provide a full transcript of the audio media).";

    setPrompt(''); setAttachedFiles([]); setIsLoading(true); 
    setIsCreateMenuOpen(false); setIsAttachMenuOpen(false); setPendingUIType('text'); 

    try {
      const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: [...messages, { role: 'user', content: apiPrompt }], fileData: currentFiles[0]?.data, fileMimeType: currentFiles[0]?.mimeType }) });
      const data = await res.json();
      
      if (data.result) {
        setMessages(prev => [...prev, { role: 'yura', content: data.result, uiType: targetUIType }]);
        
        const newItem = { id: Date.now().toString(), content: data.result, date: Date.now() };
        if (targetUIType === 'todo') setTasks(prev => [newItem, ...prev]);
        if (targetUIType === 'calendar') setEvents(prev => [newItem, ...prev]);
        if (targetUIType === 'reminder') setNotes(prev => [newItem, ...prev]);
        if (['sheet', 'doc', 'code', 'slide'].includes(targetUIType)) {
            setProjects(prev => [{ id: newItem.id, title: currentPrompt.slice(0, 25) + '...', type: targetUIType, date: newItem.date, content: data.result }, ...prev].slice(0, 25));
        }
      } else setMessages(prev => [...prev, { role: 'yura', content: `Error: ${data.error}`, uiType: 'text' }]);
    } catch (error) { setMessages(prev => [...prev, { role: 'yura', content: "Operator offline.", uiType: 'text' }]); } 
    finally { setIsLoading(false); }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') { e.preventDefault(); handleSend(); } };

  // ------------------- HELPERS & THEMES -------------------
  const themeBg = appSettings.theme === 'dark' ? 'bg-[#0a0a0a]' : 'bg-white';
  const themeText = appSettings.theme === 'dark' ? 'text-gray-100' : 'text-gray-800';
  const themePanel = appSettings.theme === 'dark' ? 'bg-[#121212] border-[#222]' : 'bg-[#f8f9fa] border-gray-200';
  const themeModal = appSettings.theme === 'dark' ? 'bg-[#1a1a1a] border-[#333]' : 'bg-white border-gray-200';
  const bubbleUser = appSettings.theme === 'dark' ? appSettings.bubbleColor.replace('bg-', 'bg-opacity-20 bg-') : appSettings.bubbleColor;

  const createTools = [
    { title: "Docs", icon: FileText, color: "text-blue-600", bg: "bg-blue-50", type: 'doc' as const },
    { title: "Sheets", icon: Table, color: "text-green-600", bg: "bg-green-50", type: 'sheet' as const },
    { title: "Slides", icon: Presentation, color: "text-yellow-600", bg: "bg-yellow-50", type: 'slide' as const },
    { title: "Tasks", icon: ListTodo, color: "text-blue-600", bg: "bg-blue-50", type: 'todo' as const },
    { title: "Calendar", icon: CalendarIcon, color: "text-blue-600", bg: "bg-blue-50", type: 'calendar' as const },
    { title: "Keep Notes", icon: Bell, color: "text-yellow-600", bg: "bg-yellow-50", type: 'reminder' as const },
    { title: "Nano Banana Image", icon: ImageIcon, color: "text-red-500", bg: "bg-red-50", type: 'image' as const },
    { title: "Gemini Pro Code", icon: Code, color: "text-purple-600", bg: "bg-purple-50", type: 'code' as const },
    { title: "Audio Transcript", icon: FileAudio, color: "text-red-500", bg: "bg-red-50", type: 'transcript' as const },
  ];
  const activeToolConfig = createTools.find(t => t.type === pendingUIType);

  const filteredHistory = chatHistory.filter(c => c.title.toLowerCase().includes(historySearch.toLowerCase()));
  const filteredMessages = chatSearch ? messages.filter(m => m.content.toLowerCase().includes(chatSearch.toLowerCase())) : messages;

  if (!isMounted) return null;

  return (
    // MOBILE FIX: Changed h-screen to h-[100dvh] so mobile bottom bars don't cover the chat input!
    <div className={`flex flex-col h-[100dvh] w-full ${themeBg} ${themeText} ${appSettings.font} ${appSettings.fontSize} overflow-hidden transition-colors duration-300`}>
      
      {/* ------------------- MODALS & PREVIEWS ------------------- */}
      <AnimatePresence>
        {previewFile && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
             <button onClick={() => setPreviewFile(null)} className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors z-50"><X className="h-6 w-6" /></button>
             {previewFile.type.startsWith('image/') && <img src={previewFile.url} alt="Preview" className="max-w-full max-h-[90vh] rounded-2xl shadow-2xl object-contain" />}
             {(previewFile.type.startsWith('video/') || previewFile.name.endsWith('.mp4')) && <video src={previewFile.url} controls autoPlay className="max-w-full max-h-[90vh] rounded-2xl shadow-2xl" />}
             {(previewFile.type.startsWith('audio/') && !previewFile.name.endsWith('.mp4')) && <div className={`${themeModal} p-8 rounded-3xl shadow-xl flex flex-col items-center gap-6`}><div className="h-32 w-32 rounded-full bg-blue-500/20 flex items-center justify-center"><Music className="h-16 w-16 text-blue-500" /></div><h3 className="text-xl font-semibold max-w-xs text-center truncate">{previewFile.name}</h3><audio src={previewFile.url} controls className="w-80" /></div>}
             {previewFile.type === 'application/pdf' && <iframe src={previewFile.url} className="w-full h-[90vh] rounded-2xl bg-white shadow-xl" title="PDF Preview" />}
          </motion.div>
        )}
      </AnimatePresence>

      {/* AUTHENTICATION MODAL */}
      <AnimatePresence>
        {isAuthModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className={`w-full max-w-md max-h-[90vh] overflow-y-auto ${themeModal} rounded-3xl shadow-2xl p-6 md:p-8 flex flex-col relative`}>
              <button onClick={() => setIsAuthModalOpen(false)} className="absolute top-4 right-4 p-2 hover:bg-gray-500/10 rounded-full"><X className="h-5 w-5" /></button>
              
              <div className="flex justify-center mb-6"><div className="h-12 w-12 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-lg"><User className="h-6 w-6" /></div></div>
              <h2 className="text-2xl font-bold text-center mb-6">Welcome to Operator</h2>
              
              {authMode === 'select' && (
                <div className="space-y-4">
                  <button onClick={handleGoogleLogin} className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium text-sm flex items-center justify-center gap-3 transition-colors shadow-md"><LogIn className="h-5 w-5" /> Sign in with Google</button>
                  <div className="relative flex items-center py-2"><div className="flex-grow border-t border-gray-500/20"></div><span className="flex-shrink-0 mx-4 text-gray-500 text-xs uppercase">or</span><div className="flex-grow border-t border-gray-500/20"></div></div>
                  <button onClick={() => setAuthMode('email-login')} className={`w-full py-3.5 border border-gray-500/30 hover:bg-gray-500/10 rounded-xl font-medium text-sm flex items-center justify-center gap-3 transition-colors`}><LogIn className="h-5 w-5" /> Sign in with Email</button>
                </div>
              )}

              {(authMode === 'email-login' || authMode === 'email-signup') && (
                <form onSubmit={handleEmailAuth} className="space-y-4">
                  <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required className={`w-full p-3 rounded-xl border border-gray-500/30 bg-transparent outline-none focus:border-blue-500`} />
                  <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required className={`w-full p-3 rounded-xl border border-gray-500/30 bg-transparent outline-none focus:border-blue-500`} />
                  <button type="submit" className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium text-sm shadow-md transition-colors">
                    {authMode === 'email-login' ? 'Sign In' : 'Create Account'}
                  </button>
                  <button type="button" onClick={() => setAuthMode(authMode === 'email-login' ? 'email-signup' : 'email-login')} className="w-full text-xs text-blue-500 hover:underline text-center">
                    {authMode === 'email-login' ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
                  </button>
                  <button type="button" onClick={() => setAuthMode('select')} className="w-full text-xs text-gray-500 hover:underline text-center pt-2">Back to options</button>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DEDICATED APP WINDOWS */}
      <AnimatePresence>
        {isProjectsOpen && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 md:p-10 bg-black/50 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className={`w-full h-full max-w-6xl max-h-[90vh] ${themeModal} rounded-3xl shadow-2xl p-4 md:p-6 flex flex-col`}>
              <div className="flex justify-between items-center mb-6 border-b border-gray-500/20 pb-4">
                <div className="flex items-center gap-3"><FolderOpen className="h-6 w-6 text-blue-500" /><h2 className="text-xl md:text-2xl font-semibold">Drive</h2></div>
                <button onClick={() => setIsProjectsOpen(false)} className="p-2 hover:bg-gray-500/10 rounded-full"><X className="h-6 w-6" /></button>
              </div>
              <div className="flex-1 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 overflow-y-auto hide-scrollbar p-2">
                {projects.map((proj) => (
                  <div key={proj.id} onClick={() => { setIsProjectsOpen(false); setMessages(prev => [...prev, { role: 'user', content: `Open project: ${proj.title}` }, { role: 'yura', content: proj.content, uiType: proj.type }]); }} className={`p-4 md:p-5 rounded-2xl border border-gray-500/20 flex flex-col items-start gap-4 hover:border-blue-400 cursor-pointer transition-all h-36 md:h-40 ${appSettings.theme==='dark'?'bg-[#222]':'bg-gray-50'}`}>
                     <div className="p-2 md:p-3 rounded-full bg-white shadow-sm text-black">
                       {proj.type === 'doc' ? <FileText className="h-5 w-5 md:h-6 md:w-6 text-blue-600" /> : proj.type === 'code' ? <Code className="h-5 w-5 md:h-6 md:w-6 text-purple-600" /> : proj.type === 'sheet' ? <Table className="h-5 w-5 md:h-6 md:w-6 text-green-600" /> : <Presentation className="h-5 w-5 md:h-6 md:w-6 text-yellow-600" />}
                     </div>
                     <span className="text-xs md:text-sm font-medium line-clamp-2">{proj.title}</span>
                  </div>
                ))}
                {projects.length === 0 && <p className="col-span-full text-center mt-20 opacity-50">No files generated yet.</p>}
              </div>
            </motion.div>
          </div>
        )}
        
        {isTasksOpen && (
          <div className="fixed inset-0 z-[80] flex items-center justify-end p-4 md:p-6 bg-black/30 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, x: 100 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 100 }} className={`w-full h-full max-w-sm max-h-[90vh] ${themeModal} rounded-3xl shadow-2xl flex flex-col`}>
              <div className="flex justify-between items-center p-6 border-b border-gray-500/20">
                <div className="flex items-center gap-3"><ListTodo className="h-6 w-6 text-blue-500" /><h2 className="text-xl font-semibold">Tasks</h2></div>
                <button onClick={() => setIsTasksOpen(false)} className="p-2 hover:bg-gray-500/10 rounded-full"><X className="h-5 w-5" /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                 {tasks.map(t => (
                   <div key={t.id} className={`p-4 rounded-xl border border-gray-500/20 ${appSettings.theme==='dark'?'bg-[#222]':'bg-blue-50/50'}`}>
                     {t.content.split('\n').filter(l => l.trim().startsWith('-')).map((task, i) => (
                       <label key={i} className="flex items-start gap-3 py-1 cursor-pointer">
                         <input type="checkbox" className="mt-1" />
                         <span className="text-sm">{task.replace(/^[-*]\s*/, '')}</span>
                       </label>
                     ))}
                   </div>
                 ))}
                 {tasks.length === 0 && <div className="mt-10 text-center text-sm opacity-50">Ask Operator to create a To-Do list.</div>}
              </div>
            </motion.div>
          </div>
        )}

        {isCalendarOpen && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 md:p-10 bg-black/40 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className={`w-full h-full max-w-5xl max-h-[90vh] ${themeModal} rounded-3xl shadow-2xl flex flex-col`}>
              <div className="flex justify-between items-center p-6 border-b border-gray-500/20">
                <div className="flex items-center gap-3"><CalendarIcon className="h-7 w-7 text-blue-500" /><h2 className="text-xl md:text-2xl font-semibold">Calendar</h2></div>
                <button onClick={() => setIsCalendarOpen(false)} className="p-2 hover:bg-gray-500/10 rounded-full"><X className="h-6 w-6" /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
                 {events.map(e => ( <div key={e.id} className={`p-4 md:p-6 rounded-2xl border border-gray-500/20 whitespace-pre-wrap text-sm md:text-base ${appSettings.theme==='dark'?'bg-[#222]':'bg-gray-50'}`}>{e.content}</div> ))}
                 {events.length === 0 && <div className="mt-20 text-center opacity-50 flex flex-col items-center"><CalendarIcon className="h-16 w-16 mb-4 opacity-50" /> No events created yet.</div>}
              </div>
            </motion.div>
          </div>
        )}

        {isKeepOpen && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 md:p-10 bg-black/40 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className={`w-full h-full max-w-6xl max-h-[90vh] ${themeModal} rounded-3xl shadow-2xl flex flex-col`}>
              <div className="flex justify-between items-center p-6 border-b border-gray-500/20">
                <div className="flex items-center gap-3"><Bell className="h-6 w-6 md:h-7 md:w-7 text-yellow-500" /><h2 className="text-xl md:text-2xl font-semibold">Keep Notes</h2></div>
                <button onClick={() => setIsKeepOpen(false)} className="p-2 hover:bg-gray-500/10 rounded-full"><X className="h-6 w-6" /></button>
              </div>
              <div className="flex-1 p-4 md:p-6 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 items-start content-start overflow-y-auto">
                 {notes.map(n => ( <div key={n.id} className={`border border-yellow-500/30 p-4 md:p-5 rounded-2xl shadow-sm whitespace-pre-wrap text-sm md:text-base ${appSettings.theme==='dark'?'bg-yellow-900/20':'bg-yellow-50'}`}>{n.content}</div> ))}
                 {notes.length === 0 && <div className="col-span-full mt-20 text-center opacity-50">No notes created.</div>}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ------------------- CORE UI ------------------- */}

      {/* SIDEBAR */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsSidebarOpen(false)} className="fixed inset-0 bg-black/40 z-[50]" />
            <motion.div initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} className={`fixed top-0 left-0 h-full w-[280px] md:w-[300px] ${themePanel} border-r z-[60] flex flex-col shadow-2xl`}>
              <div className="p-4 flex items-center justify-between border-b border-gray-500/20">
                <div className="flex items-center gap-2">
                  <span className="text-xl font-bold tracking-tight">yura</span>
                  <span className="text-xl font-medium text-blue-500 ml-1">operator</span>
                </div>
                <button onClick={() => setIsSidebarOpen(false)} className="p-2 hover:bg-gray-500/10 rounded-full"><X className="h-5 w-5" /></button>
              </div>
              
              <div className="px-4 pt-4 space-y-4">
                <button onClick={startNewChat} className="w-full flex items-center gap-3 px-4 py-3 rounded-full bg-blue-600 text-white shadow-md hover:bg-blue-700 transition-all"><SquarePen className="h-5 w-5" /> <span className="text-sm font-medium">New chat</span></button>
                <div className="relative">
                  <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-50" />
                  <input type="text" placeholder="Search history..." value={historySearch} onChange={e => setHistorySearch(e.target.value)} className={`w-full pl-9 pr-4 py-2.5 rounded-full text-sm outline-none border border-gray-500/20 bg-transparent focus:border-blue-500`} />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-3 mt-4 space-y-1 hide-scrollbar">
                <div className="text-xs font-semibold px-3 py-2 opacity-50">Recent Sessions</div>
                {filteredHistory.map((session) => (
                    <div key={session.id} onClick={() => loadChat(session.id)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-full cursor-pointer transition-colors ${currentSessionId === session.id ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400 font-medium' : 'hover:bg-gray-500/10'}`}>
                      <MessageSquare className="h-4 w-4 shrink-0 opacity-70" />
                      <span className="text-sm truncate">{session.title}</span>
                    </div>
                  ))}
              </div>

              <div className="p-4 border-t border-gray-500/20">
                <button onClick={() => {setIsSidebarOpen(false); setIsSettingsOpen(true);}} className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-gray-500/10 transition-colors">
                  <div className="flex items-center gap-3">
                    {user?.photoURL ? ( <img src={user.photoURL} alt="Profile" referrerPolicy="no-referrer" className="h-9 w-9 rounded-full object-cover" /> ) 
                    : ( <div className="h-9 w-9 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold">{appSettings.nickname ? appSettings.nickname[0] : (user?.email ? user.email[0].toUpperCase() : 'U')}</div> )}
                    <div className="text-left"><p className="text-sm font-medium truncate max-w-[130px]">{appSettings.nickname || user?.displayName || user?.email || 'Guest'}</p></div>
                  </div>
                  <Settings className="h-5 w-5 opacity-60" />
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* SETTINGS MODAL */}
      <AnimatePresence>
        {isSettingsOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 md:p-6 bg-black/50 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className={`w-full max-w-xl h-full max-h-[90vh] flex flex-col ${themeModal} rounded-3xl shadow-2xl`}>
              <div className="flex justify-between items-center p-6 border-b border-gray-500/20">
                <div className="flex items-center gap-3">
                  <Settings className="h-5 w-5 text-blue-500" />
                  <h2 className="text-xl font-medium">Settings</h2>
                </div>
                <button onClick={() => setIsSettingsOpen(false)} className="p-2 hover:bg-gray-500/10 rounded-full"><X className="h-5 w-5" /></button>
              </div>
              
              <div className="flex border-b border-gray-500/20 px-6 pt-2 gap-6">
                 <button onClick={()=>setSettingsTab('main')} className={`pb-3 font-medium text-sm border-b-2 transition-colors ${settingsTab==='main'?'border-blue-500 text-blue-500':'border-transparent opacity-60'}`}>Account</button>
                 <button onClick={()=>setSettingsTab('appearance')} className={`pb-3 font-medium text-sm border-b-2 transition-colors ${settingsTab==='appearance'?'border-blue-500 text-blue-500':'border-transparent opacity-60'}`}>Appearance</button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 hide-scrollbar">
                {settingsTab === 'main' && (
                  <div className="space-y-6">
                    <div className="flex flex-col items-center text-center p-6 rounded-2xl border border-gray-500/20">
                      {user?.photoURL ? ( <img src={user.photoURL} alt="Profile" referrerPolicy="no-referrer" className="h-20 w-20 rounded-full shadow-md mb-4" /> ) 
                      : ( <div className="h-20 w-20 rounded-full bg-blue-600 text-white flex items-center justify-center text-3xl font-bold mb-4">{user ? (user.email?.[0].toUpperCase()) : 'U'}</div> )}
                      <h3 className="text-lg font-bold">{user?.displayName || user?.email || 'Not Signed In'}</h3>
                      
                      {!user ? ( <button onClick={()=>setIsAuthModalOpen(true)} className="mt-4 px-6 py-2.5 bg-blue-600 text-white rounded-full font-medium text-sm shadow-md">Sign In</button> ) 
                      : ( <button onClick={handleLogout} className="mt-4 px-6 py-2.5 bg-red-500/10 text-red-500 rounded-full font-medium text-sm">Sign Out</button> )}
                    </div>
                    
                    <div className="space-y-2">
                       <label className="text-sm font-semibold opacity-70">Custom Nickname</label>
                       <input type="text" value={appSettings.nickname} onChange={e => setAppSettings({...appSettings, nickname: e.target.value})} placeholder="How should Operator call you?" className={`w-full p-3 rounded-xl border border-gray-500/20 bg-transparent outline-none focus:border-blue-500`} />
                    </div>

                    <button onClick={() => { startNewChat(); setChatHistory([]); setProjects([]); setTasks([]); setEvents([]); setNotes([]); alert("Memory cleared."); }} className="w-full p-4 rounded-xl bg-red-500/10 text-red-500 text-left font-medium text-sm flex items-center justify-between">
                      <span>Clear Cloud Storage Memory</span> <LogOut className="h-4 w-4" />
                    </button>
                  </div>
                )}

                {settingsTab === 'appearance' && (
                  <div className="space-y-8">
                     <div className="space-y-3">
                       <label className="text-sm font-semibold opacity-70 flex items-center gap-2"><LayoutTemplate className="h-4 w-4"/> Theme</label>
                       <div className="grid grid-cols-2 gap-3">
                         <button onClick={()=>setAppSettings({...appSettings, theme:'light'})} className={`p-3 md:p-4 rounded-xl border-2 font-medium flex items-center justify-center gap-2 ${appSettings.theme==='light'?'border-blue-500 bg-blue-500/10':'border-gray-500/20'}`}>Light</button>
                         <button onClick={()=>setAppSettings({...appSettings, theme:'dark'})} className={`p-3 md:p-4 rounded-xl border-2 font-medium flex items-center justify-center gap-2 ${appSettings.theme==='dark'?'border-blue-500 bg-blue-500/10':'border-gray-500/20'}`}>Dark</button>
                       </div>
                     </div>

                     <div className="space-y-3">
                       <label className="text-sm font-semibold opacity-70 flex items-center gap-2"><Type className="h-4 w-4"/> Typography</label>
                       <select value={appSettings.font} onChange={e => setAppSettings({...appSettings, font: e.target.value})} className={`w-full p-3 rounded-xl border border-gray-500/20 bg-transparent outline-none`}>
                          <option value="font-sans" className="text-black">Modern (Sans)</option>
                          <option value="font-serif" className="text-black">Classic (Serif)</option>
                          <option value="font-mono" className="text-black">Terminal (Mono)</option>
                       </select>
                       <div className="flex gap-2">
                         {['text-sm', 'text-base', 'text-lg'].map(size => (
                           <button key={size} onClick={()=>setAppSettings({...appSettings, fontSize: size})} className={`flex-1 py-2 rounded-lg border text-sm md:text-base ${appSettings.fontSize===size?'bg-blue-500/20 border-blue-500':'border-gray-500/20'}`}>
                             {size === 'text-sm' ? 'Small' : size === 'text-base' ? 'Normal' : 'Large'}
                           </button>
                         ))}
                       </div>
                     </div>

                     <div className="space-y-3">
                       <label className="text-sm font-semibold opacity-70 flex items-center gap-2"><PaintBucket className="h-4 w-4"/> User Bubble Color</label>
                       <div className="flex gap-3">
                         {[ {c:'bg-[#f0f4f9]', l:'Default'}, {c:'bg-blue-500', l:'Blue'}, {c:'bg-emerald-500', l:'Green'}, {c:'bg-purple-500', l:'Purple'} ].map(color => (
                           <button key={color.c} onClick={()=>setAppSettings({...appSettings, bubbleColor: color.c})} className={`h-8 w-8 md:h-10 md:w-10 rounded-full shadow-sm border-2 ${appSettings.bubbleColor===color.c ? 'border-gray-400 scale-110' : 'border-transparent'} ${color.c}`} title={color.l} />
                         ))}
                       </div>
                     </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* TOP HEADER */}
      <header className={`shrink-0 w-full px-4 py-3 flex items-center justify-between z-[40] ${themeBg} border-b border-gray-500/20`}>
        <div className="flex items-center gap-2 md:gap-3">
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 -ml-2 rounded-full hover:bg-gray-500/10 transition-colors"><Menu className="h-6 w-6" /></button>
          <div className="flex items-center gap-1">
            <span className="text-xl font-bold tracking-tight hidden sm:block">yura</span>
            <span className="text-xl font-medium text-blue-500 hidden sm:block">operator</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2 flex-1 max-w-md mx-4 hidden md:flex relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-50" />
            <input type="text" placeholder="Search in chat..." value={chatSearch} onChange={e => setChatSearch(e.target.value)} className={`w-full pl-9 pr-4 py-2 rounded-full text-sm outline-none border border-gray-500/20 bg-transparent focus:border-blue-500`} />
        </div>

        <div className="flex items-center gap-1 md:gap-2">
          {/* MOBILE FIX: Showing shortcuts on mobile by tweaking the CSS */}
          <div className="flex items-center gap-0.5 md:gap-1 mr-1 md:mr-2 border-r border-gray-500/20 pr-2 md:pr-3">
            <button onClick={() => setIsTasksOpen(true)} className="p-2 hover:bg-blue-500/10 text-blue-500 rounded-full transition-colors" title="Tasks"><ListTodo className="h-5 w-5" /></button>
            <button onClick={() => setIsCalendarOpen(true)} className="p-2 hover:bg-blue-500/10 text-blue-500 rounded-full transition-colors hidden sm:block" title="Calendar"><CalendarIcon className="h-5 w-5" /></button>
            <button onClick={() => setIsKeepOpen(true)} className="p-2 hover:bg-yellow-500/10 text-yellow-500 rounded-full transition-colors hidden sm:block" title="Notes"><Bell className="h-5 w-5" /></button>
            <button onClick={() => setIsProjectsOpen(true)} className="p-2 hover:bg-green-500/10 text-green-500 rounded-full transition-colors" title="Drive"><FolderOpen className="h-5 w-5" /></button>
          </div>

          {!user ? (
            <button onClick={()=>setIsAuthModalOpen(true)} className="px-3 md:px-4 py-1.5 md:py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full text-xs md:text-sm font-medium shadow-sm transition-all">Sign In</button>
          ) : (
            <button onClick={() => setIsSettingsOpen(true)} className="p-1 rounded-full border border-gray-500/20">
              {user.photoURL ? <img src={user.photoURL} alt="Avatar" referrerPolicy="no-referrer" className="h-7 w-7 rounded-full object-cover" /> 
              : <div className="h-7 w-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">{appSettings.nickname?appSettings.nickname[0]:user.email?.[0].toUpperCase()}</div>}
            </button>
          )}
        </div>
      </header>

      {/* CHAT DISPLAY */}
      <main className={`flex-1 w-full mx-auto px-2 md:px-4 py-6 md:py-8 flex flex-col gap-4 md:gap-6 z-10 overflow-y-auto hide-scrollbar ${themeBg}`} onClick={() => {setIsAttachMenuOpen(false); setIsCreateMenuOpen(false);}}>
        <div className="max-w-4xl w-full mx-auto flex flex-col gap-4 md:gap-6 pb-24 md:pb-20">
          
          {messages.length === 0 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="w-full flex flex-col items-center justify-center text-center mt-10 md:mt-20 pb-10 px-4">
              <div className="text-3xl md:text-4xl font-bold mb-4 tracking-tight">yura <span className="text-blue-500">operator</span></div>
              <p className="opacity-60 text-base md:text-lg">Hello {appSettings.nickname || user?.displayName?.split(' ')[0] || ''}, how can I help you orchestrate your workspace today?</p>
            </motion.div>
          )}

          {filteredMessages.map((msg, index) => (
            <motion.div key={index} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`flex flex-col max-w-[95%] md:max-w-[85%] ${msg.role === 'user' ? 'self-end items-end' : 'self-start items-start w-full'}`}>
              
              {msg.role === 'yura' && (
                <div className="flex items-center gap-2 mb-2 ml-2">
                  <Sparkles className="h-3 w-3 md:h-4 md:w-4 text-blue-500" />
                  <span className="text-[10px] md:text-xs font-semibold uppercase tracking-wider opacity-60">Operator</span>
                  {msg.uiType && msg.uiType !== 'text' && (
                     <span className="ml-2 text-[9px] md:text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 border border-blue-500/20">{msg.uiType}</span>
                  )}
                </div>
              )}

              <div className={`px-4 md:px-5 py-3 md:py-4 rounded-3xl w-full text-sm md:text-base ${msg.role === 'user' ? `${bubbleUser} ${appSettings.bubbleColor.includes('bg-[#f0f4f9]') ? 'text-gray-900' : 'text-white'} rounded-br-sm max-w-fit shadow-sm` : `${themePanel} shadow-sm border rounded-tl-sm`}`}>
                
                {msg.files && msg.files.length > 0 && (
                  <div className="mb-4 flex flex-wrap gap-2 md:gap-3">
                    {msg.files.map((file, fIdx) => (
                      <div key={fIdx} className={`cursor-pointer rounded-xl overflow-hidden inline-block border hover:shadow-md transition-shadow ${appSettings.theme==='dark'?'border-[#333] bg-[#222]':'border-gray-200 bg-white'}`} onClick={() => setPreviewFile({url: file.url, type: file.mimeType, name: file.name})}>
                        {file.mimeType.startsWith('image/') ? ( <img src={file.url} className="h-20 w-28 md:h-24 md:w-32 object-cover" alt="attachment" /> ) 
                        : file.mimeType.startsWith('video/') || file.name.toLowerCase().endsWith('.mp4') ? ( <div className="h-20 w-28 md:h-24 md:w-32 bg-black relative flex items-center justify-center"><Video className="h-6 w-6 md:h-8 md:w-8 text-white/80" /></div> ) 
                        : file.mimeType.startsWith('audio/') ? ( <div className="h-20 w-28 md:h-24 md:w-32 bg-red-500/10 flex flex-col items-center justify-center gap-1"><Music className="h-5 w-5 md:h-6 md:w-6 text-red-500" /><span className="text-[9px] md:text-[10px] truncate w-24 text-center">{file.name}</span></div> )
                        : ( <div className="flex items-center gap-2 p-2 md:p-3 w-28 h-20 md:w-32 md:h-24 flex-col justify-center text-center"><FileText className="h-5 w-5 md:h-6 md:w-6 text-blue-500" /><span className="text-[9px] md:text-[10px] truncate w-full font-medium">{file.name}</span></div> )}
                      </div>
                    ))}
                  </div>
                )}

                {/* TEXT & CODE PARSER */}
                {(!msg.uiType || msg.uiType === 'text' || msg.uiType === 'code') && (
                  <div className="whitespace-pre-wrap leading-relaxed">
                     {msg.content.split(/(```[\s\S]*?```)/).map((part, i) => {
                        if (part.startsWith('```')) {
                           const isHtml = part.toLowerCase().includes('html');
                           const codeContent = part.replace(/```[a-z]*\n|```/g, '');
                           return (
                             <div key={i} className="my-3 md:my-4 rounded-xl overflow-hidden border border-gray-500/20 bg-[#1e1e1e] text-gray-200 font-mono text-xs md:text-sm relative group shadow-md">
                               <div className="bg-[#2d2d2d] px-3 md:px-4 py-2 flex items-center justify-between">
                                 <div className="flex items-center gap-1.5 md:gap-2"><div className="h-2.5 w-2.5 md:h-3 md:w-3 rounded-full bg-red-500"/><div className="h-2.5 w-2.5 md:h-3 md:w-3 rounded-full bg-yellow-500"/><div className="h-2.5 w-2.5 md:h-3 md:w-3 rounded-full bg-green-500"/></div>
                                 {isHtml && <button onClick={()=>alert("HTML Preview rendered! (Simulated)")} className="text-[10px] md:text-xs bg-blue-600 hover:bg-blue-500 px-2 md:px-3 py-1 rounded text-white flex items-center gap-1"><Play className="h-3 w-3"/> Preview</button>}
                               </div>
                               <div className="p-3 md:p-4 overflow-x-auto">{codeContent}</div>
                             </div>
                           )
                        }
                        return <span key={i}>{part}</span>;
                     })}
                  </div>
                )}

                {msg.uiType === 'transcript' && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`rounded-2xl overflow-hidden w-full border ${themeModal} shadow-sm`}>
                     <div className="bg-red-500/10 px-4 md:px-5 py-3 md:py-4 flex items-center gap-3 border-b border-red-500/20"><FileAudio className="h-4 w-4 md:h-5 md:w-5 text-red-500" /><span className="font-semibold text-sm md:text-base">Audio Transcript</span></div>
                     <div className="p-4 md:p-6 leading-relaxed max-h-[500px] overflow-y-auto whitespace-pre-wrap font-serif border-l-4 border-red-500 ml-4">{msg.content}</div>
                  </motion.div>
                )}

                {msg.uiType === 'doc' && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`rounded-2xl overflow-hidden w-full border ${themeModal} shadow-sm`}>
                     <div className="bg-blue-500/10 px-4 md:px-5 py-3 md:py-4 flex items-center gap-3 border-b border-blue-500/20"><FileText className="h-4 w-4 md:h-5 md:w-5 text-blue-500" /><span className="font-semibold text-sm md:text-base">Docs</span></div>
                     <div className="p-4 md:p-8 leading-relaxed max-h-[500px] overflow-y-auto whitespace-pre-wrap font-serif">{msg.content.replace(/```[a-z]*\n|```/g, '')}</div>
                  </motion.div>
                )}

                {msg.uiType === 'sheet' && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`rounded-2xl overflow-hidden w-full border ${themeModal} shadow-sm`}>
                     <div className="bg-green-500/10 px-4 md:px-5 py-3 md:py-4 flex items-center gap-3 border-b border-green-500/20"><Table className="h-4 w-4 md:h-5 md:w-5 text-green-500" /><span className="font-semibold text-sm md:text-base">Sheets</span></div>
                     <div className="overflow-x-auto p-0 max-h-[400px]">
                       <table className="min-w-full text-xs md:text-sm text-left border-collapse">
                         <tbody>
                           {msg.content.split('\n').filter(line => line.includes('|') && !line.includes('---')).map((row, rIdx) => (
                             <tr key={rIdx} className={rIdx === 0 ? "bg-gray-500/10 font-bold border-b-2 border-gray-500/20" : "border-b border-gray-500/10"}>
                               {row.split('|').filter(cell => cell.trim() !== '').map((cell, cIdx) => ( <td key={cIdx} className="p-2 md:p-3 whitespace-nowrap">{cell.trim()}</td> ))}
                             </tr>
                           ))}
                         </tbody>
                       </table>
                     </div>
                  </motion.div>
                )}

                {msg.uiType === 'slide' && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`rounded-2xl overflow-hidden w-full border ${themeModal} shadow-sm`}>
                    <div className="bg-yellow-500/10 px-4 md:px-5 py-3 md:py-4 flex items-center gap-3 border-b border-yellow-500/20"><Presentation className="h-4 w-4 md:h-5 md:w-5 text-yellow-500" /><span className="font-semibold text-sm md:text-base">Slides</span></div>
                    <div className="flex flex-col gap-4 md:gap-6 w-full p-4 md:p-6 max-h-[500px] overflow-y-auto bg-gray-500/5">
                     {msg.content.split(/---SLIDE---|---/g).filter(s => s.trim().length > 10).map((slideText, i) => {
                        const lines = slideText.trim().split('\n').filter(l => l.trim().length > 0);
                        return (
                          <div key={i} className={`rounded-xl p-4 md:p-8 border shadow-md aspect-video flex flex-col ${themeModal}`}>
                            <h2 className="text-lg md:text-2xl font-bold mb-3 md:mb-4 border-b border-gray-500/20 pb-2 md:pb-4">{lines[0].replace(/[*#]/g, '')}</h2>
                            <ul className="space-y-2 md:space-y-3 flex-1">{lines.slice(1).map((l, bIdx) => <li key={bIdx} className="flex items-start gap-2 md:gap-3 text-xs md:text-sm"><div className="h-1.5 w-1.5 md:h-2 md:w-2 rounded-full bg-yellow-500 mt-1.5 md:mt-2 shrink-0"/><span>{l.replace(/^[-*•]\s*/, '')}</span></li>)}</ul>
                          </div>
                        )
                     })}
                    </div>
                  </motion.div>
                )}

                {msg.uiType === 'image' && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`rounded-2xl p-2 md:p-4 border ${themeModal} shadow-sm flex justify-center`}>
                     <img src={`https://image.pollinations.ai/prompt/${encodeURIComponent(msg.content)}?nologo=true&width=1024&height=1024&model=turbo`} alt="Nano Banana Fast Gen" className="max-w-full rounded-xl shadow-md object-cover" />
                  </motion.div>
                )}

                {/* Minimal components for embedded OS actions */}
                {msg.uiType === 'calendar' && (
                  <div className={`p-4 md:p-5 rounded-2xl border ${themeModal} flex items-center gap-3 md:gap-4`}><CalendarIcon className="h-6 w-6 md:h-8 md:w-8 text-blue-500"/><div><h4 className="font-bold text-sm md:text-base">Event Logged</h4><p className="text-xs md:text-sm opacity-70">Saved to Calendar modal.</p></div></div>
                )}
                {msg.uiType === 'todo' && (
                  <div className={`p-4 md:p-5 rounded-2xl border ${themeModal} flex items-center gap-3 md:gap-4`}><ListTodo className="h-6 w-6 md:h-8 md:w-8 text-blue-500"/><div><h4 className="font-bold text-sm md:text-base">Tasks Created</h4><p className="text-xs md:text-sm opacity-70">Saved to Tasks modal.</p></div></div>
                )}
                {msg.uiType === 'reminder' && (
                  <div className={`p-4 md:p-5 rounded-2xl border ${themeModal} flex items-center gap-3 md:gap-4`}><Bell className="h-6 w-6 md:h-8 md:w-8 text-yellow-500"/><div><h4 className="font-bold text-sm md:text-base">Note Saved</h4><p className="text-xs md:text-sm opacity-70">Added to Keep Notes modal.</p></div></div>
                )}
              </div>
            </motion.div>
          ))}
          
          {isLoading && (
            <div className="self-start flex items-center gap-2 md:gap-3 text-blue-500 mt-2 ml-4">
               <Loader2 className="h-4 w-4 md:h-5 md:w-5 animate-spin" /><span className="text-xs md:text-sm font-medium animate-pulse">Operator is orchestrating...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* INPUT DOCK */}
      <footer className={`shrink-0 w-full max-w-4xl mx-auto px-2 md:px-4 pb-4 md:pb-6 pt-2 z-[40] ${themeBg}`}>
        <div className="flex flex-col relative">

          {/* ACTIVE TOOL CHIP */}
          {pendingUIType !== 'text' && (
             <div className="absolute -top-10 md:-top-12 left-2 md:left-4 z-30">
               <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-1.5 md:py-2 rounded-full border shadow-md ${themeModal}`}>
                 {activeToolConfig && <activeToolConfig.icon className={`h-3 w-3 md:h-4 md:w-4 ${activeToolConfig.color}`} />}
                 <span className="text-[10px] md:text-xs font-semibold">Generating: {activeToolConfig?.title}</span>
                 <button onClick={() => setPendingUIType('text')} className="ml-1 md:ml-2 p-1 hover:bg-gray-500/10 rounded-full"><X className="h-3 w-3" /></button>
               </motion.div>
             </div>
          )}

          {attachedFiles.length > 0 && (
            <div className="absolute bottom-[60px] md:bottom-[80px] left-2 md:left-4 flex flex-wrap gap-2 z-30">
              {attachedFiles.map((file, idx) => (
                <div key={idx} className={`border p-1 md:p-1.5 pr-2 md:pr-3 rounded-full flex items-center gap-1.5 md:gap-2 shadow-md cursor-pointer ${themeModal}`} onClick={() => setPreviewFile({url: file.url, type: file.mimeType, name: file.name})}>
                  {file.source ? ( <div className="h-6 w-6 md:h-8 md:w-8 bg-blue-500/20 rounded-full flex items-center justify-center"><Cloud className="h-3 w-3 md:h-4 md:w-4 text-blue-500"/></div> )
                  : file.mimeType.startsWith('image/') ? ( <img src={file.url} className="h-6 w-6 md:h-8 md:w-8 object-cover rounded-full" /> ) 
                  : file.mimeType.startsWith('video/') || file.name.toLowerCase().endsWith('.mp4') ? ( <div className="h-6 w-6 md:h-8 md:w-8 bg-gray-900 rounded-full flex items-center justify-center"><Video className="h-3 w-3 md:h-4 md:w-4 text-white"/></div> ) 
                  : file.mimeType.startsWith('audio/') ? ( <div className="h-6 w-6 md:h-8 md:w-8 bg-red-500/20 rounded-full flex items-center justify-center"><Music className="h-3 w-3 md:h-4 md:w-4 text-red-500"/></div> )
                  : ( <div className="h-6 w-6 md:h-8 md:w-8 bg-blue-500/20 rounded-full flex items-center justify-center"><FileText className="h-3 w-3 md:h-4 md:w-4 text-blue-500" /></div> )}
                  <span className="text-[10px] md:text-xs font-medium truncate max-w-[80px] md:max-w-[100px]">{file.name}</span>
                  <button onClick={(e) => { e.stopPropagation(); removeFile(idx); }} className="ml-0.5 md:ml-1 hover:bg-gray-500/20 p-1 rounded-full"><X className="h-3 w-3" /></button>
                </div>
              ))}
            </div>
          )}

          <AnimatePresence>
            {isCreateMenuOpen && (
              <motion.div initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }} className={`absolute bottom-[60px] md:bottom-[70px] left-1 md:left-2 w-52 md:w-60 border rounded-2xl shadow-2xl p-2 z-50 max-h-[300px] md:max-h-[350px] overflow-y-auto hide-scrollbar ${themeModal}`}>
                <div className="text-[10px] md:text-[11px] font-bold uppercase tracking-wider mb-2 px-2 md:px-3 pt-2 opacity-50">Workspace Tools</div>
                <div className="space-y-1">
                  {createTools.map((tool, i) => (
                    <button key={i} onClick={() => { setPendingUIType(tool.type); setIsCreateMenuOpen(false); inputRef.current?.focus();}} className="w-full flex items-center gap-2 md:gap-3 p-1.5 md:p-2 rounded-xl hover:bg-gray-500/10 transition-colors text-left group">
                      <div className={`p-1.5 md:p-2 rounded-lg ${tool.bg} ${tool.color}`}><tool.icon className="h-3 w-3 md:h-4 md:w-4" /></div>
                      <span className="text-xs md:text-sm font-medium">{tool.title}</span>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {isAttachMenuOpen && (
              <motion.div initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }} className={`absolute bottom-[60px] md:bottom-[70px] left-12 md:left-14 w-48 md:w-56 border rounded-2xl shadow-2xl p-2 z-50 flex flex-col gap-1 ${themeModal}`}>
                <div className="text-[9px] md:text-[10px] font-bold uppercase px-2 md:px-3 pt-1 opacity-50">Local Files</div>
                {[ { icon: ImageIcon, color: "text-blue-500", title: "Photo/Video", accept: "image/*,video/*" }, { icon: Music, color: "text-red-500", title: "Audio File", accept: "audio/*,.mp3,.wav" }, { icon: FileText, color: "text-green-500", title: "Document", accept: ".pdf,.doc,.docx,.txt" } ].map((item, i) => (
                  <button key={i} onClick={() => openFilePicker(item.accept)} className="w-full flex items-center gap-2 md:gap-3 p-1.5 md:p-2 rounded-xl hover:bg-gray-500/10 transition-colors text-left">
                    <item.icon className={`h-3 w-3 md:h-4 md:w-4 ${item.color}`} /> <span className="text-xs md:text-sm font-medium">{item.title}</span>
                  </button>
                ))}
                
                <div className="text-[9px] md:text-[10px] font-bold uppercase px-2 md:px-3 pt-2 border-t border-gray-500/20 mt-1 opacity-50">Cloud Workspace</div>
                <button onClick={() => handleCloudPick("Google Drive")} className="w-full flex items-center gap-2 md:gap-3 p-1.5 md:p-2 rounded-xl hover:bg-gray-500/10 transition-colors text-left"><HardDrive className="h-3 w-3 md:h-4 md:w-4 text-blue-500" /> <span className="text-xs md:text-sm font-medium">Google Drive</span></button>
                <button onClick={() => handleCloudPick("Google Photos")} className="w-full flex items-center gap-2 md:gap-3 p-1.5 md:p-2 rounded-xl hover:bg-gray-500/10 transition-colors text-left"><ImageIcon className="h-3 w-3 md:h-4 md:w-4 text-red-500" /> <span className="text-xs md:text-sm font-medium">Google Photos</span></button>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.div animate={{ boxShadow: isFocused ? "0 4px 20px rgba(59, 130, 246, 0.2)" : "0 2px 10px rgba(0,0,0,0.05)" }} className={`rounded-[24px] md:rounded-[32px] p-1.5 md:p-2 flex items-center gap-1 md:gap-2 border ${isFocused ? 'border-blue-500/50' : 'border-gray-500/20'} relative transition-all duration-300 z-40 ${themePanel}`}>
            
            <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" multiple />
            
            <div className="flex items-center gap-0.5 md:gap-1">
              <button onClick={() => {setIsCreateMenuOpen(!isCreateMenuOpen); setIsAttachMenuOpen(false);}} className={`p-2 md:p-3 rounded-full transition-all active:scale-90 ${isCreateMenuOpen ? 'bg-blue-500/20 text-blue-500' : 'hover:bg-gray-500/10'}`}><Sparkles className="h-4 w-4 md:h-5 md:w-5" /></button>
              <button onClick={() => {setIsAttachMenuOpen(!isAttachMenuOpen); setIsCreateMenuOpen(false);}} className={`p-2 md:p-3 rounded-full transition-all active:scale-90 ${isAttachMenuOpen ? 'bg-blue-500/20 text-blue-500' : 'hover:bg-gray-500/10'}`}><Paperclip className="h-4 w-4 md:h-5 md:w-5" /></button>
            </div>
            
            <input
              ref={inputRef} type="text" value={prompt} onChange={(e) => setPrompt(e.target.value)} onKeyDown={handleKeyDown} onFocus={() => setIsFocused(true)} onBlur={() => setIsFocused(false)}
              placeholder={isListening ? "Listening..." : pendingUIType !== 'text' ? `Parameters for ${pendingUIType}...` : "Message Operator..."} disabled={isLoading} className="flex-1 bg-transparent border-none outline-none text-sm md:text-base placeholder-gray-500 px-2 md:px-3 h-full min-w-0 disabled:opacity-50 z-10 relative"
            />
            
            <button onClick={toggleVoiceInput} className={`p-2 md:p-3 rounded-full transition-all active:scale-90 shrink-0 z-10 ${isListening ? 'text-red-500 bg-red-500/20 animate-pulse' : 'hover:bg-gray-500/10'}`}><Mic className="h-4 w-4 md:h-5 md:w-5" /></button>
            <button onClick={handleSend} disabled={isLoading || (!prompt.trim() && attachedFiles.length === 0)} className={`p-2 md:p-3 rounded-full transition-all flex items-center justify-center shrink-0 z-10 ${isLoading || (!prompt.trim() && attachedFiles.length === 0) ? 'bg-gray-500/20 opacity-50 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-90 shadow-md'}`}><Send className="h-4 w-4 md:h-5 md:w-5 ml-0.5" /></button>
          </motion.div>
        </div>
      </footer>
    </div>
  );
}