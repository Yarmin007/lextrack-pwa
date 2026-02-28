"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { 
  Utensils, Navigation, Plus, X, Trash2, Wallet, 
  ShoppingCart, ReceiptText, Calculator, Settings, 
  PieChart, CheckCircle2, AlertCircle, ChevronDown, ChevronUp, Send, User, Landmark, Banknote
} from "lucide-react";
import Link from "next/link";

// 1. FIX: True Database-Compliant UUID Generator
const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

// Sort events Newest to Oldest for the UI
const sortEventsDesc = (arr: any[]) => [...arr].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

export default function SplitterPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

  // MVR Bank State
  const [showBankModal, setShowBankModal] = useState(false);
  const [mvrBankName, setMvrBankName] = useState("");
  const [mvrBankNo, setMvrBankNo] = useState("");

  // DB-Backed Adjustments (+ Debt / - Recv)
  const [adjustments, setAdjustments] = useState<any[]>([]);
  
  // Local Shared Statuses (Maps person -> last shared total amount)
  const [sharedStatuses, setSharedStatuses] = useState<Record<string, number>>({});

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    async function fetchData() {
      const [eventsRes, adjsRes] = await Promise.all([
        supabase.from('splitter_events').select('*').order('event_date', { ascending: false }),
        supabase.from('splitter_adjustments').select('*').order('created_at', { ascending: true })
      ]);
      
      if (eventsRes.data) {
        const usedIds = new Set();
        const getSafeId = (id: string | undefined) => {
          if (!id || usedIds.has(id)) {
            const newId = generateId();
            usedIds.add(newId);
            return newId;
          }
          usedIds.add(id);
          return id;
        };

        const mapped = eventsRes.data.map(e => ({
          id: e.id,
          title: e.title,
          date: e.event_date,
          mode: e.mode,
          totalBill: e.total_bill?.toString() || "",
          delivery: e.delivery_fee?.toString() || "",
          participants: (e.participants || []).map((p: any) => {
            let mergedItems = p.items || [];
            if (mergedItems.length === 0 && p.amount) {
              mergedItems = [{ id: getSafeId(undefined), desc: "Food", price: p.amount }];
            }
            return {
              ...p,
              id: getSafeId(p.id),
              paysMain: p.paysMain !== undefined ? p.paysMain : (p.isIncluded !== false), 
              paysDelivery: p.paysDelivery !== undefined ? p.paysDelivery : (p.isIncluded !== false),
              items: mergedItems.map((item: any) => ({ ...item, id: getSafeId(item.id) }))
            };
          })
        }));
        setEvents(sortEventsDesc(mapped));
      }

      if (adjsRes.data && Array.isArray(adjsRes.data)) {
        setAdjustments(adjsRes.data);
      }
    }
    fetchData();

    // Load Local Banks and Statuses
    const savedBankName = localStorage.getItem("lextrack_mvr_bank_name");
    const savedBankNo = localStorage.getItem("lextrack_mvr_bank_no");
    if (savedBankName) setMvrBankName(savedBankName);
    if (savedBankNo) setMvrBankNo(savedBankNo);

    const savedStatuses = localStorage.getItem("lextrack_shared_statuses");
    if (savedStatuses) setSharedStatuses(JSON.parse(savedStatuses));
  }, []);

  const saveMvrBank = () => {
    if (!mvrBankName || !mvrBankNo) return showToast("Please fill both fields.", "error");
    localStorage.setItem("lextrack_mvr_bank_name", mvrBankName);
    localStorage.setItem("lextrack_mvr_bank_no", mvrBankNo);
    setShowBankModal(false);
    showToast("MVR Bank saved successfully!");
  };

  // --- STRICT ID-BASED STATE UPDATERS ---
  const createNewEvent = () => {
    const newId = generateId();
    const today = new Date().toISOString().split('T')[0];
    const newEvent = {
      id: newId,
      title: "New Split",
      date: today,
      mode: 'universal',
      totalBill: "",
      delivery: "",
      participants: [{ id: generateId(), name: "", items: [], hasPaid: false, paysMain: true, paysDelivery: true }]
    };
    setEvents(prev => sortEventsDesc([newEvent, ...prev]));
    setExpanded(prev => ({ ...prev, [newId]: true }));
  };

  const updateEvent = (eventId: string, field: string, value: any) => { setEvents(prev => prev.map(e => e.id === eventId ? { ...e, [field]: value } : e)); };
  const addParticipant = (eventId: string) => { setEvents(prev => prev.map(e => e.id === eventId ? { ...e, participants: [...e.participants, { id: generateId(), name: "", items: [], hasPaid: false, paysMain: true, paysDelivery: true }] } : e)); };
  const removeParticipant = (eventId: string, pId: string) => { setEvents(prev => prev.map(e => e.id === eventId ? { ...e, participants: e.participants.filter((p:any) => p.id !== pId) } : e)); };
  const updateParticipant = (eventId: string, pId: string, field: string, value: any) => { setEvents(prev => prev.map(e => e.id === eventId ? { ...e, participants: e.participants.map((p:any) => p.id === pId ? { ...p, [field]: value } : p) } : e)); };
  const addParticipantItem = (eventId: string, pId: string) => { setEvents(prev => prev.map(e => e.id === eventId ? { ...e, participants: e.participants.map((p:any) => p.id === pId ? { ...p, items: [...(p.items || []), { id: generateId(), desc: "", price: "" }] } : p) } : e)); };
  const updateParticipantItem = (eventId: string, pId: string, itemId: string, field: string, value: string) => { setEvents(prev => prev.map(e => e.id === eventId ? { ...e, participants: e.participants.map((p:any) => p.id === pId ? { ...p, items: (p.items || []).map((it:any) => it.id === itemId ? { ...it, [field]: value } : it) } : p) } : e)); };
  const removeParticipantItem = (eventId: string, pId: string, itemId: string) => { setEvents(prev => prev.map(e => e.id === eventId ? { ...e, participants: e.participants.map((p:any) => p.id === pId ? { ...p, items: (p.items || []).filter((it:any) => it.id !== itemId) } : p) } : e)); };

  // --- FIX: DATABASE-BACKED ADJUSTMENTS ---
  const addAdjustment = async (personName: string) => {
    const key = personName.trim().toLowerCase();
    const newAdj = { id: generateId(), person_name: key, type: 'payment', desc_text: "", amount: 0 }; 
    
    // Update screen instantly
    setAdjustments(prev => Array.isArray(prev) ? [...prev, newAdj] : [newAdj]);
    
    // Save to DB
    const { error } = await supabase.from('splitter_adjustments').insert(newAdj);
    if (error) showToast("Error connecting to DB", "error");
  };

  // Instantly updates the screen while typing
  const updateAdjustmentLocal = (id: string, field: string, value: any) => {
    setAdjustments(prev => prev.map(a => a.id === id ? { ...a, [field]: value } : a));
  };

  // Saves to Supabase cleanly when you finish typing
  const saveAdjustmentDB = async (id: string, field: string, value: any) => {
    let finalValue = value;
    // Postgres requires a real number, empty string causes a crash
    if (field === 'amount') finalValue = parseFloat(value) || 0; 

    const { error } = await supabase.from('splitter_adjustments').update({ [field]: finalValue }).eq('id', id);
    if (error) showToast("Failed to save to cloud", "error");
  };

  const removeAdjustmentDB = async (id: string) => {
    setAdjustments(prev => prev.filter(a => a.id !== id));
    const { error } = await supabase.from('splitter_adjustments').delete().eq('id', id);
    if (error) showToast("Failed to delete", "error");
  };

  // --- UNIVERSAL MATH ENGINE ---
  const calculateShare = (event: any, participant: any) => {
    let total = 0;
    
    if (participant.paysMain !== false) {
      const mainCount = Math.max(1, event.participants.filter((p: any) => p.paysMain !== false).length);
      const billNum = parseFloat(event.totalBill) || 0;
      total += (billNum / mainCount);
    }

    if (participant.paysDelivery !== false) {
      const devCount = Math.max(1, event.participants.filter((p: any) => p.paysDelivery !== false).length);
      const deliveryNum = parseFloat(event.delivery) || 0;
      total += (deliveryNum / devCount);
    }

    const itemsTotal = (participant.items || []).reduce((sum: number, item: any) => sum + (parseFloat(item.price) || 0), 0);
    total += itemsTotal;

    return total;
  };

  const saveEvent = async (eventId: string) => {
    const ev = events.find(e => e.id === eventId);
    if (!ev) return;

    const participantsWithShares = ev.participants.map((p: any) => ({
      ...p,
      share: calculateShare(ev, p)
    }));

    const payload = {
      id: ev.id, // Using the valid UUID
      title: ev.title,
      event_date: ev.date,
      mode: 'universal',
      total_bill: parseFloat(ev.totalBill) || 0,
      delivery_fee: parseFloat(ev.delivery) || 0,
      participants: participantsWithShares
    };

    let updatedEvents = [...events];

    // Upsert safely handles both new and existing events
    const { data, error } = await supabase.from('splitter_events').upsert(payload).select().single();
    
    if (!error && data) { 
      updatedEvents = events.map(e => e.id === eventId ? { ...e, id: data.id, participants: participantsWithShares } : e);
      setExpanded(prev => ({ ...prev, [eventId]: false, [data.id]: true }));
      showToast("Event saved!");
    } else {
      showToast("Error saving event", "error");
      console.error(error);
    }

    setEvents(sortEventsDesc(updatedEvents));
  };

  const deleteEvent = async (eventId: string) => {
    if (!confirm("Delete this entire event?")) return;
    const { error } = await supabase.from('splitter_events').delete().eq('id', eventId);
    if (!error) {
      setEvents(prev => prev.filter(e => e.id !== eventId));
      showToast("Event deleted");
    }
  };

  // --- LIVE INVOICE AGGREGATION ---
  const getPendingByPerson = () => {
    const personMap: Record<string, any> = {};

    events.forEach(ev => {
      const mainCount = Math.max(1, ev.participants.filter((p: any) => p.paysMain !== false).length);
      const devCount = Math.max(1, ev.participants.filter((p: any) => p.paysDelivery !== false).length);
      
      const billSplit = (parseFloat(ev.totalBill) || 0) / mainCount;
      const deliverySplit = (parseFloat(ev.delivery) || 0) / devCount;

      ev.participants.forEach((p: any) => {
        if (!p.hasPaid && p.name && p.name.trim() !== "") {
          const key = p.name.trim().toLowerCase();
          const share = calculateShare(ev, p);

          if (!personMap[key]) {
            personMap[key] = { name: p.name.trim(), totalOwed: 0, details: [] };
          }

          personMap[key].totalOwed += share;
          personMap[key].details.push({
            title: ev.title,
            date: ev.date,
            mode: ev.mode,
            share: share,
            items: p.items || [],
            billSplit: p.paysMain !== false ? billSplit : 0,
            deliverySplit: p.paysDelivery !== false ? deliverySplit : 0,
            paysMain: p.paysMain !== false
          });
        }
      });
    });

    return Object.values(personMap).sort((a, b) => b.totalOwed - a.totalOwed);
  };

  const sendPersonalInvoice = (person: any, personAdjs: any[], finalTotal: number) => {
    if (!mvrBankName || !mvrBankNo) return showToast("Please set your MVR Bank Account first.", "error");

    const today = new Date();
    const formattedDate = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;

    // Exact Format Requested
    let msg = `*INVOICE*\nBill To: ${person.name.toUpperCase()}\nBill Date: ${formattedDate}\n\n`;

    // Sort chronologically (oldest first)
    const sortedDetails = [...person.details].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    if (sortedDetails.length > 0) {
      sortedDetails.forEach((d: any) => {
        const [y, m, day] = d.date.split('-');
        msg += `(${day}/${m}/${y})\n• ${d.title.toUpperCase()}\n`;
        
        d.items.forEach((item: any) => {
          if (item.desc || item.price) {
            msg += `   └ ${item.desc || "Item"}: ${item.price || 0}\n`;
          }
        });

        if (d.billSplit > 0) {
          msg += `   └ Shared Bill: ${d.billSplit.toFixed(2)}\n`;
        }
        if (d.deliverySplit > 0) {
          msg += `   └ Delivery Fee: ${d.deliverySplit.toFixed(2)}\n`;
        }

        if (d.share === 0 && d.items.length === 0) {
          msg += `   └ (Exempt from Event)\n`;
        }
        
        msg += `   Subtotal: ${d.share.toFixed(2)} MVR\n\n`;
      });
    }

    const charges = personAdjs.filter(a => a.type === 'charge');
    const payments = personAdjs.filter(a => a.type === 'payment');

    if (charges.length > 0 || payments.length > 0) {
      msg += `*Adjustments:*\n`;
      charges.forEach((item: any) => {
        if (item.desc_text || item.amount) msg += `   └ ${item.desc_text || "Debt"}: +${item.amount || 0} MVR\n`;
      });
      payments.forEach((item: any) => {
        if (item.desc_text || item.amount) msg += `   └ ${item.desc_text || "Payment"}: -${item.amount || 0} MVR\n`;
      });
      msg += `\n`;
    }

    msg += `*TOTAL DUE: ${finalTotal.toFixed(2)} MVR*\n\n`;
    msg += `*ACCOUNT DETAIL*\n\n`;
    msg += `${mvrBankName}\n${mvrBankNo}`;

    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
    
    // Save the status so the button turns green indicating it's been shared
    const personKey = person.name.trim().toLowerCase();
    setSharedStatuses(prev => {
      const next = { ...prev, [personKey]: finalTotal };
      localStorage.setItem("lextrack_shared_statuses", JSON.stringify(next));
      return next;
    });
  };

  // --- GLOBAL TOTALS ENGINE (Includes Payments & Debts) ---
  let globalTotalOwed = 0;
  let globalTotalCollected = 0;

  events.forEach(ev => {
    ev.participants.forEach((p: any) => {
      const share = calculateShare(ev, p);
      if (p.hasPaid) globalTotalCollected += share; else globalTotalOwed += share;
    });
  });

  const safeAdjustments = Array.isArray(adjustments) ? adjustments : [];
  
  safeAdjustments.forEach(adj => {
    const amt = parseFloat(adj.amount) || 0;
    if (adj.type === 'payment') {
      globalTotalCollected += amt;
      globalTotalOwed -= amt; // Deducted because they paid us
    } else if (adj.type === 'charge') {
      globalTotalOwed += amt;
    }
  });

  const pendingPeople = getPendingByPerson();

  return (
    <main className="min-h-screen bg-[#F0F4F8] text-[#364d54] font-sans flex relative">
      
      {toast && (
        <div className={`fixed top-6 right-1/2 translate-x-1/2 lg:translate-x-0 lg:right-6 z-[400] px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 text-sm font-bold animate-in fade-in slide-in-from-top-5 duration-300 ${toast.type === 'success' ? 'bg-[#3a5b5e] text-white' : 'bg-red-500 text-white'}`}>
          {toast.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
          {toast.message}
        </div>
      )}

      <aside className="hidden lg:flex w-72 bg-white border-r border-[#E0E7E9] flex-col p-8 sticky top-0 h-screen shrink-0 z-40">
        <div className="mb-12">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#5fa4ad] mb-1">LexCorp Systems</p>
          <h1 className="text-2xl font-black tracking-tighter uppercase">Lextrack</h1>
        </div>
        <nav className="space-y-3 flex-grow">
          <Link href="/" className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-sm font-bold hover:bg-[#F8FAFB] text-[#A0AEC0] transition-all"><Wallet size={20}/> Dashboard</Link>
          <Link href="/tracker" className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-sm font-bold hover:bg-[#F8FAFB] text-[#A0AEC0] transition-all"><Banknote size={20}/> Tracker</Link>
          <Link href="/splitter" className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-sm font-bold bg-[#3a5b5e] text-white shadow-lg transition-all"><Calculator size={20}/> Splitter</Link>
          <Link href="/shop-clearing" className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-sm font-bold hover:bg-[#F8FAFB] text-[#A0AEC0] transition-all"><ShoppingCart size={20}/> Clearing</Link>
          <Link href="/analytics" className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-sm font-bold hover:bg-[#F8FAFB] text-[#A0AEC0] transition-all"><PieChart size={20}/> Analytics</Link>
        </nav>
      </aside>

      <div className="flex-grow flex flex-col min-h-screen overflow-y-auto">
        <div className="w-full max-w-[1200px] mx-auto px-4 lg:px-8 py-6 lg:py-10 pb-40">
          
          <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <div>
              <h2 className="text-2xl lg:text-3xl font-black tracking-tight">Split Ledger</h2>
              <p className="text-[10px] font-bold text-[#A0AEC0] uppercase tracking-widest mt-1">Universal Group Splitter</p>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <button onClick={() => setShowBankModal(true)} className="flex-1 sm:flex-none h-12 px-4 rounded-2xl bg-white border border-[#E0E7E9] text-[#364d54] font-black text-xs uppercase tracking-widest shadow-sm flex items-center justify-center gap-2 active:scale-95 transition-transform">
                <Landmark size={16}/> MVR Bank
              </button>
              <button onClick={createNewEvent} className="flex-1 sm:flex-none h-12 px-6 rounded-2xl bg-[#3a5b5e] text-white font-black text-xs uppercase tracking-widest shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-transform">
                <Plus size={16}/> New Split
              </button>
            </div>
          </header>

          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-white p-6 rounded-[2rem] border border-[#E0E7E9] shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-widest text-[#A0AEC0] mb-2">Total Pending Owed</p>
              <p className="text-3xl font-black text-orange-500">MVR {globalTotalOwed.toFixed(0)}</p>
            </div>
            <div className="bg-[#3a5b5e] p-6 rounded-[2rem] shadow-xl text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -mr-10 -mt-10" />
              <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-2">Total Collected</p>
              <p className="text-3xl font-black text-green-300">MVR {globalTotalCollected.toFixed(0)}</p>
            </div>
          </div>

          {/* CONSOLIDATED PENDING BY PERSON */}
          {pendingPeople.length > 0 && (
            <div className="mb-10">
              <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-[#A0AEC0] mb-4 pl-2">Pending By Person</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {pendingPeople.map((person, idx) => {
                  const personKey = person.name.trim().toLowerCase();
                  
                  // DB Backed Adjustments Math
                  const personAdjs = safeAdjustments.filter(a => a.person_name === personKey);
                  const chargeTotal = personAdjs.filter(a => a.type === 'charge').reduce((s, a) => s + (parseFloat(a.amount) || 0), 0);
                  const paymentTotal = personAdjs.filter(a => a.type === 'payment').reduce((s, a) => s + (parseFloat(a.amount) || 0), 0);
                  
                  const finalTotal = person.totalOwed + chargeTotal - paymentTotal;
                  
                  // Button Logic: Only green if the finalTotal matches what was last shared
                  const isShared = sharedStatuses[personKey] === finalTotal;

                  return (
                    <div key={idx} className="bg-white p-5 rounded-[2rem] border border-orange-100 shadow-sm flex flex-col justify-between">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <User size={16} className="text-[#A0AEC0]"/>
                            <h4 className="font-black text-[#364d54] text-lg truncate">{person.name}</h4>
                          </div>
                          <p className="text-[10px] font-bold text-orange-400 uppercase tracking-widest">{person.details.length} pending event(s)</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[9px] font-black uppercase text-[#A0AEC0]">Total Due</p>
                          <p className="font-black text-orange-500 text-lg">MVR {finalTotal.toFixed(0)}</p>
                        </div>
                      </div>

                      {/* ADJUSTMENTS MANAGER */}
                      <div className="mb-4 bg-gray-50 p-3 rounded-xl border border-gray-100">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-[9px] font-black uppercase tracking-widest text-[#A0AEC0]">Adjustments</span>
                          <button onClick={() => addAdjustment(person.name)} className="text-[#5fa4ad] flex items-center gap-1 text-[9px] font-black uppercase tracking-widest active:scale-95 transition-transform"><Plus size={10}/> Add</button>
                        </div>
                        <div className="space-y-2">
                          {personAdjs.map(adj => (
                            <div key={adj.id} className="flex gap-2 animate-in fade-in">
                              <select 
                                value={adj.type} 
                                onChange={e => {
                                  updateAdjustmentLocal(adj.id, 'type', e.target.value);
                                  saveAdjustmentDB(adj.id, 'type', e.target.value);
                                }} 
                                className={`w-24 border border-[#E0E7E9] rounded-lg p-2 text-[10px] font-black uppercase tracking-widest focus:ring-1 focus:ring-orange-300 ${adj.type === 'payment' ? 'bg-green-50 text-green-600' : 'bg-orange-50 text-orange-600'}`}
                              >
                                <option value="charge">+ Debt</option>
                                <option value="payment">- Recv</option>
                              </select>
                              <input 
                                placeholder={adj.type === 'payment' ? "Bank Trf" : "Old Debt"} 
                                value={adj.desc_text || ''} 
                                onChange={e => updateAdjustmentLocal(adj.id, 'desc_text', e.target.value)} 
                                onBlur={e => saveAdjustmentDB(adj.id, 'desc_text', e.target.value)}
                                className="flex-grow w-full bg-white border border-[#E0E7E9] rounded-lg p-2 text-xs font-bold focus:ring-1 focus:ring-orange-300" 
                              />
                              <input 
                                placeholder="MVR" 
                                type="number" 
                                value={adj.amount} 
                                onChange={e => updateAdjustmentLocal(adj.id, 'amount', e.target.value)} 
                                onBlur={e => saveAdjustmentDB(adj.id, 'amount', e.target.value)}
                                className="w-20 bg-white border border-[#E0E7E9] rounded-lg p-2 text-xs font-bold text-center focus:ring-1 focus:ring-orange-300" 
                              />
                              <button onClick={() => removeAdjustmentDB(adj.id)} className="text-gray-300 hover:text-red-400"><Trash2 size={14}/></button>
                            </div>
                          ))}
                        </div>
                      </div>

                      <button 
                        onClick={() => sendPersonalInvoice(person, personAdjs, finalTotal)} 
                        className={`w-full py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-colors flex justify-center items-center gap-2 ${isShared ? 'bg-green-100 text-green-600 hover:bg-green-200' : 'bg-[#e0f2fe] text-[#0284c7] hover:bg-[#bae6fd]'}`}
                      >
                        {isShared ? <><CheckCircle2 size={14}/> Shared ✅</> : <><Send size={14}/> Send WA Invoice</>}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-[#A0AEC0] mb-4 pl-2">Events Ledger</h3>
          
          <div className="space-y-4">
            {events.length === 0 && (
              <div className="text-center py-20 bg-white rounded-[2rem] border border-dashed border-[#A0AEC0]">
                <Calculator size={48} className="mx-auto text-[#E0E7E9] mb-4" />
                <p className="font-bold text-[#A0AEC0]">No splits recorded yet.</p>
              </div>
            )}

            {events.map((ev) => {
              const isExpanded = expanded[ev.id];
              const eventTotal = ev.participants.reduce((s: number, p: any) => s + calculateShare(ev, p), 0);
              const collected = ev.participants.filter((p:any) => p.hasPaid).reduce((s: number, p: any) => s + calculateShare(ev, p), 0);
              const isFullyPaid = collected >= eventTotal && eventTotal > 0;

              return (
                <div key={ev.id} className={`bg-white rounded-[2rem] border border-[#E0E7E9] shadow-sm transition-all duration-300 ${isExpanded ? 'ring-2 ring-[#5fa4ad]/20' : ''}`}>
                  
                  <div className="p-5 flex items-center justify-between cursor-pointer" onClick={() => setExpanded(prev => ({...prev, [ev.id]: !isExpanded}))}>
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-sm bg-[#5fa4ad]">
                        <Calculator size={20}/>
                      </div>
                      <div>
                        <h3 className="font-black text-lg text-[#364d54]">{ev.title}</h3>
                        <p className="text-[10px] font-bold text-[#A0AEC0] uppercase tracking-widest">{ev.date} • {ev.participants.length} People</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-6">
                      <div className="hidden sm:block text-right">
                        <p className="text-[10px] font-black uppercase text-[#A0AEC0]">Total / Collected</p>
                        <p className={`font-black text-sm ${isFullyPaid ? 'text-green-500' : 'text-[#364d54]'}`}>
                          {collected.toFixed(0)} / {eventTotal.toFixed(0)}
                        </p>
                      </div>
                      <div className="text-[#A0AEC0]">
                        {isExpanded ? <ChevronUp size={24}/> : <ChevronDown size={24}/>}
                      </div>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="p-5 border-t border-[#E0E7E9] bg-[#F8FAFB] rounded-b-[2rem]">
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <div className="flex flex-col">
                          <label className="text-[9px] font-black uppercase tracking-widest text-[#A0AEC0] mb-1 pl-1">Event Title</label>
                          <input type="text" value={ev.title} onChange={e => updateEvent(ev.id, 'title', e.target.value)} className="bg-white border-none p-3 rounded-xl font-bold focus:ring-2 focus:ring-[#5fa4ad]"/>
                        </div>
                        <div className="flex flex-col">
                          <label className="text-[9px] font-black uppercase tracking-widest text-[#A0AEC0] mb-1 pl-1">Date</label>
                          <input type="date" value={ev.date} onChange={e => updateEvent(ev.id, 'date', e.target.value)} className="bg-white border-none p-3 rounded-xl font-bold focus:ring-2 focus:ring-[#5fa4ad]"/>
                        </div>
                        
                        <div className="flex gap-2">
                          <div className="flex flex-col w-1/2">
                            <label className="text-[9px] font-black uppercase tracking-widest text-blue-500 mb-1 pl-1">Shared Bill</label>
                            <input type="number" value={ev.totalBill} onChange={e => updateEvent(ev.id, 'totalBill', e.target.value)} className="bg-white border-none p-3 rounded-xl font-bold focus:ring-2 focus:ring-blue-400 text-blue-600" placeholder="0"/>
                          </div>
                          <div className="flex flex-col w-1/2">
                            <label className="text-[9px] font-black uppercase tracking-widest text-orange-400 mb-1 pl-1">Shared Fee/Deliv</label>
                            <input type="number" value={ev.delivery} onChange={e => updateEvent(ev.id, 'delivery', e.target.value)} className="bg-white border-none p-3 rounded-xl font-bold focus:ring-2 focus:ring-orange-400 text-orange-600" placeholder="0"/>
                          </div>
                        </div>
                      </div>

                      <div className="bg-white rounded-2xl border border-[#E0E7E9] overflow-hidden mb-6">
                        <div className="flex justify-between items-center p-4 border-b border-[#E0E7E9] bg-gray-50">
                          <h4 className="text-[10px] font-black uppercase text-[#364d54] tracking-widest">Participants</h4>
                          <button onClick={() => addParticipant(ev.id)} className="text-[#5fa4ad] font-bold text-[10px] uppercase flex items-center gap-1 bg-[#e0f2fe] px-3 py-1.5 rounded-lg active:scale-95 transition-transform">
                            <Plus size={12}/> Add Person
                          </button>
                        </div>
                        
                        <div className="divide-y divide-[#E0E7E9]">
                          {ev.participants.map((p: any) => {
                            const share = calculateShare(ev, p);
                            
                            return (
                              <div key={p.id} className="p-3 flex flex-col gap-3">
                                
                                <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                                  <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-400 flex-shrink-0">P</div>
                                  
                                  <input type="text" placeholder="Name" value={p.name} onChange={e => updateParticipant(ev.id, p.id, "name", e.target.value)} className="flex-grow min-w-[80px] bg-transparent border-none focus:ring-0 font-bold text-sm p-0"/>
                                  
                                  <div className="w-16 text-right font-black text-sm text-[#364d54] mr-1">
                                    <span className="text-[9px] text-[#A0AEC0] mr-0.5">MVR</span>{share.toFixed(0)}
                                  </div>

                                  <button 
                                    onClick={() => updateParticipant(ev.id, p.id, "hasPaid", !p.hasPaid)}
                                    className={`px-2 py-2 rounded-lg text-[8px] font-black uppercase tracking-widest transition-colors w-16 text-center ${p.hasPaid ? 'bg-green-100 text-green-600' : 'bg-orange-50 text-orange-500 hover:bg-orange-100'}`}
                                  >
                                    {p.hasPaid ? 'Paid' : 'Pending'}
                                  </button>
                                  
                                  <button onClick={() => removeParticipant(ev.id, p.id)} className="text-red-300 hover:text-red-500 p-1"><Trash2 size={16}/></button>
                                </div>

                                <div className="pl-8 flex gap-2">
                                  <button 
                                    onClick={() => updateParticipant(ev.id, p.id, "paysMain", p.paysMain === false ? true : false)}
                                    className={`px-2 py-1 rounded-md text-[8px] font-black uppercase tracking-widest transition-colors text-center ${p.paysMain !== false ? 'bg-blue-50 text-blue-500' : 'bg-gray-100 text-gray-400 line-through'}`}
                                  >
                                    {p.paysMain !== false ? 'Bill: Yes' : 'Bill: No'}
                                  </button>
                                  
                                  <button 
                                    onClick={() => updateParticipant(ev.id, p.id, "paysDelivery", p.paysDelivery === false ? true : false)}
                                    className={`px-2 py-1 rounded-md text-[8px] font-black uppercase tracking-widest transition-colors text-center ${p.paysDelivery !== false ? 'bg-indigo-50 text-indigo-500' : 'bg-gray-100 text-gray-400 line-through'}`}
                                  >
                                    {p.paysDelivery !== false ? 'Deliv: Yes' : 'Deliv: No'}
                                  </button>
                                </div>

                                <div className="pl-8 pr-1 space-y-2 mt-1">
                                  {(p.items || []).map((item: any) => (
                                    <div key={item.id} className="flex items-center gap-2">
                                      <input type="text" placeholder="Personal Item (e.g. Burger)" value={item.desc} onChange={e => updateParticipantItem(ev.id, p.id, item.id, "desc", e.target.value)} className="flex-grow bg-gray-50 rounded-lg border-none focus:ring-1 focus:ring-orange-300 text-xs font-bold p-2" />
                                      <input type="number" placeholder="Price" value={item.price} onChange={e => updateParticipantItem(ev.id, p.id, item.id, "price", e.target.value)} className="w-20 bg-gray-50 rounded-lg border-none focus:ring-1 focus:ring-orange-300 text-xs font-bold p-2 text-center" />
                                      <button onClick={() => removeParticipantItem(ev.id, p.id, item.id)} className="text-gray-300 hover:text-red-400 p-1"><X size={14}/></button>
                                    </div>
                                  ))}
                                  <button onClick={() => addParticipantItem(ev.id, p.id)} className="text-[#A0AEC0] font-bold text-[9px] uppercase tracking-widest flex items-center gap-1 mt-1 hover:text-[#5fa4ad]">
                                    <Plus size={10}/> Add Personal Item
                                  </button>
                                </div>

                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="flex flex-wrap sm:flex-nowrap justify-between items-center gap-4">
                        <button onClick={() => deleteEvent(ev.id)} className="text-red-400 text-[10px] font-bold uppercase flex items-center gap-1 hover:text-red-600">
                          <Trash2 size={14}/> Delete Event
                        </button>
                        
                        <div className="flex gap-2 w-full sm:w-auto">
                          <button onClick={() => saveEvent(ev.id)} className="w-full sm:w-auto h-12 px-8 rounded-xl bg-[#3a5b5e] text-white font-black text-[10px] uppercase tracking-widest shadow-md active:scale-95 transition-all">
                            Save Event
                          </button>
                        </div>
                      </div>

                    </div>
                  )}
                </div>
              );
            })}
          </div>

        </div>

        <nav className="lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 w-[95%] max-w-[400px] h-16 bg-white shadow-[0_10px_40px_rgba(0,0,0,0.1)] rounded-full border border-gray-100 flex justify-around items-center px-4 z-[100]">
          <Link href="/" className="text-gray-400 hover:text-[#3a5b5e] transition-colors"><Wallet size={20} /></Link>
          <Link href="/tracker" className="text-gray-400 hover:text-[#3a5b5e] transition-colors"><Banknote size={20} /></Link>
          <Link href="/splitter" className="text-[#3a5b5e]"><Calculator size={24} className="bg-[#e0f2fe] p-1.5 rounded-xl" /></Link>
          <Link href="/shop-clearing" className="text-gray-400 hover:text-[#3a5b5e] transition-colors"><ShoppingCart size={20} /></Link>
          <Link href="/analytics" className="text-gray-400 hover:text-[#3a5b5e] transition-colors"><PieChart size={20} /></Link>
        </nav>
      </div>

      {showBankModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[300] flex justify-center items-end sm:items-center">
          <div className="bg-white w-full max-w-md rounded-t-[2rem] sm:rounded-[2rem] p-6 animate-in slide-in-from-bottom-8">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-black tracking-tight">Set MVR Bank Account</h3>
              <button onClick={() => setShowBankModal(false)} className="bg-gray-100 p-2 rounded-full text-gray-500 hover:bg-gray-200"><X size={16}/></button>
            </div>
            <p className="text-xs text-[#A0AEC0] mb-6">This account will be attached to all MVR Splitter invoices.</p>
            <div className="space-y-3 mb-6">
              <input type="text" placeholder="Bank Name (e.g. BML MVR)" value={mvrBankName} onChange={e => setMvrBankName(e.target.value)} className="w-full bg-gray-50 border-none p-4 rounded-2xl font-bold focus:ring-2 focus:ring-[#5fa4ad]" />
              <input type="text" placeholder="Account Number" value={mvrBankNo} onChange={e => setMvrBankNo(e.target.value)} className="w-full bg-gray-50 border-none p-4 rounded-2xl font-bold focus:ring-2 focus:ring-[#5fa4ad]" />
            </div>
            <button onClick={saveMvrBank} className="w-full bg-[#3a5b5e] text-white p-4 rounded-2xl font-black uppercase tracking-widest shadow-lg active:scale-95 transition-transform">Save Bank</button>
          </div>
        </div>
      )}
    </main>
  );
}