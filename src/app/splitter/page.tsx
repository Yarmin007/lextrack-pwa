"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { 
  Utensils, Navigation, Plus, X, Trash2, Wallet, 
  ShoppingCart, ReceiptText, Calculator, Settings, 
  PieChart, CheckCircle2, AlertCircle, ChevronDown, ChevronUp, Send, User, Landmark
} from "lucide-react";
import Link from "next/link";

export default function SplitterPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

  // MVR Bank State
  const [showBankModal, setShowBankModal] = useState(false);
  const [mvrBankName, setMvrBankName] = useState("");
  const [mvrBankNo, setMvrBankNo] = useState("");

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Fetch Data & Load Local MVR Bank
  useEffect(() => {
    async function fetchData() {
      const { data: eventsData } = await supabase.from('splitter_events').select('*').order('event_date', { ascending: false });
      
      if (eventsData) {
        const mapped = eventsData.map(e => ({
          id: e.id,
          title: e.title,
          date: e.event_date,
          mode: e.mode,
          totalBill: e.total_bill?.toString() || "",
          delivery: e.delivery_fee?.toString() || "",
          participants: e.participants || []
        }));
        setEvents(mapped);
      }
    }
    fetchData();

    // Load MVR Bank from local storage
    const savedBankName = localStorage.getItem("lextrack_mvr_bank_name");
    const savedBankNo = localStorage.getItem("lextrack_mvr_bank_no");
    if (savedBankName) setMvrBankName(savedBankName);
    if (savedBankNo) setMvrBankNo(savedBankNo);
  }, []);

  const saveMvrBank = () => {
    if (!mvrBankName || !mvrBankNo) return showToast("Please fill both fields.", "error");
    localStorage.setItem("lextrack_mvr_bank_name", mvrBankName);
    localStorage.setItem("lextrack_mvr_bank_no", mvrBankNo);
    setShowBankModal(false);
    showToast("MVR Bank saved successfully!");
  };

  const createNewEvent = () => {
    const newId = `new-${Date.now()}`;
    const today = new Date().toISOString().split('T')[0];
    const newEvent = {
      id: newId,
      title: "New Event",
      date: today,
      mode: 'food',
      totalBill: "",
      delivery: "",
      participants: [{ id: Date.now().toString(), name: "", items: [{ id: `item-${Date.now()}`, desc: "", price: "" }], hasPaid: false }]
    };
    setEvents([newEvent, ...events]);
    setExpanded({ ...expanded, [newId]: true });
  };

  const updateEvent = (eventId: string, field: string, value: any) => {
    setEvents(events.map(e => e.id === eventId ? { ...e, [field]: value } : e));
  };

  const addParticipant = (eventId: string) => {
    setEvents(events.map(e => {
      if (e.id === eventId) {
        return { 
          ...e, 
          participants: [...e.participants, { id: Date.now().toString(), name: "", items: [{ id: `item-${Date.now()}`, desc: "", price: "" }], hasPaid: false }] 
        };
      }
      return e;
    }));
  };

  const removeParticipant = (eventId: string, pIndex: number) => {
    setEvents(events.map(e => {
      if (e.id === eventId) {
        const next = [...e.participants];
        next.splice(pIndex, 1);
        return { ...e, participants: next };
      }
      return e;
    }));
  };

  const updateParticipant = (eventId: string, pIndex: number, field: string, value: any) => {
    setEvents(events.map(e => {
      if (e.id === eventId) {
        const next = [...e.participants];
        next[pIndex] = { ...next[pIndex], [field]: value };
        return { ...e, participants: next };
      }
      return e;
    }));
  };

  const addParticipantItem = (eventId: string, pIndex: number) => {
    setEvents(events.map(e => {
      if (e.id === eventId) {
        const next = [...e.participants];
        const items = next[pIndex].items || [];
        next[pIndex].items = [...items, { id: `item-${Date.now()}`, desc: "", price: "" }];
        return { ...e, participants: next };
      }
      return e;
    }));
  };

  const updateParticipantItem = (eventId: string, pIndex: number, itemIndex: number, field: string, value: string) => {
    setEvents(events.map(e => {
      if (e.id === eventId) {
        const next = [...e.participants];
        const nextItems = [...(next[pIndex].items || [])];
        nextItems[itemIndex] = { ...nextItems[itemIndex], [field]: value };
        next[pIndex].items = nextItems;
        return { ...e, participants: next };
      }
      return e;
    }));
  };

  const removeParticipantItem = (eventId: string, pIndex: number, itemIndex: number) => {
    setEvents(events.map(e => {
      if (e.id === eventId) {
        const next = [...e.participants];
        const nextItems = [...(next[pIndex].items || [])];
        nextItems.splice(itemIndex, 1);
        next[pIndex].items = nextItems;
        return { ...e, participants: next };
      }
      return e;
    }));
  };

  const calculateShare = (event: any, participant: any) => {
    const billNum = parseFloat(event.totalBill) || 0;
    const deliveryNum = parseFloat(event.delivery) || 0;
    const count = event.participants.length || 1;
    const deliverySplit = deliveryNum / count;

    if (event.mode === 'food') {
      const itemsTotal = (participant.items || []).reduce((sum: number, item: any) => sum + (parseFloat(item.price) || 0), 0);
      return itemsTotal + deliverySplit;
    } else {
      return billNum / count;
    }
  };

  const saveEvent = async (eventId: string) => {
    const ev = events.find(e => e.id === eventId);
    if (!ev) return;

    const participantsWithShares = ev.participants.map((p: any) => ({
      ...p,
      share: calculateShare(ev, p)
    }));

    const payload = {
      title: ev.title,
      event_date: ev.date,
      mode: ev.mode,
      total_bill: parseFloat(ev.totalBill) || 0,
      delivery_fee: parseFloat(ev.delivery) || 0,
      participants: participantsWithShares
    };

    if (ev.id.startsWith('new-')) {
      const { data, error } = await supabase.from('splitter_events').insert(payload).select().single();
      if (error) return showToast("Error saving", "error");
      
      setEvents(events.map(e => e.id === eventId ? { ...e, id: data.id, participants: participantsWithShares } : e));
      setExpanded({ ...expanded, [eventId]: false, [data.id]: true });
      showToast("Event created!");
    } else {
      const { error } = await supabase.from('splitter_events').update(payload).eq('id', ev.id);
      if (error) return showToast("Error updating", "error");
      
      setEvents(events.map(e => e.id === eventId ? { ...e, participants: participantsWithShares } : e));
      showToast("Event updated!");
    }
  };

  const deleteEvent = async (eventId: string) => {
    if (!confirm("Delete this entire event?")) return;
    
    if (!eventId.startsWith('new-')) {
      await supabase.from('splitter_events').delete().eq('id', eventId);
    }
    setEvents(events.filter(e => e.id !== eventId));
    showToast("Event deleted");
  };

  // Groups all unpaid items across ALL events by person's name
  const getPendingByPerson = () => {
    const personMap: Record<string, any> = {};

    events.forEach(ev => {
      const count = ev.participants.length || 1;
      const deliverySplit = (parseFloat(ev.delivery) || 0) / count;

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
            deliverySplit: deliverySplit
          });
        }
      });
    });

    return Object.values(personMap).sort((a, b) => b.totalOwed - a.totalOwed);
  };

  const sendPersonalInvoice = (person: any) => {
    if (!mvrBankName || !mvrBankNo) return showToast("Please set your MVR Bank Account first.", "error");

    let msg = `*INVOICE*\nBill To: ${person.name}\n\n`;

    person.details.forEach((d: any) => {
      const [y, m, day] = d.date.split('-');
      msg += `• ${d.title.toUpperCase()} (${day}/${m})\n`;
      
      if (d.mode === 'food') {
        d.items.forEach((item: any) => {
          if (item.desc || item.price) {
            msg += `   └ ${item.desc || "Item"}: ${item.price || 0}\n`;
          }
        });
        if (d.deliverySplit > 0) {
          msg += `   └ Delivery Share: ${d.deliverySplit.toFixed(2)}\n`;
        }
      } else {
        msg += `   └ Trip Split: ${d.share.toFixed(2)}\n`;
      }
      
      msg += `   Subtotal: ${d.share.toFixed(2)} MVR\n\n`;
    });

    msg += `Total Due: ${person.totalOwed.toFixed(2)} MVR\n\n`;
    msg += `🏦 ${mvrBankName}\n${mvrBankNo}`;

    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
  };

  // Global Math for Header
  let globalTotalOwed = 0;
  let globalTotalCollected = 0;

  events.forEach(ev => {
    ev.participants.forEach((p: any) => {
      const share = calculateShare(ev, p);
      if (p.hasPaid) {
        globalTotalCollected += share;
      } else {
        globalTotalOwed += share;
      }
    });
  });

  const pendingPeople = getPendingByPerson();

  return (
    <main className="min-h-screen bg-[#F0F4F8] text-[#364d54] font-sans flex relative">
      
      {/* TOAST */}
      {toast && (
        <div className={`fixed top-6 right-1/2 translate-x-1/2 lg:translate-x-0 lg:right-6 z-[400] px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 text-sm font-bold animate-in fade-in slide-in-from-top-5 duration-300 ${toast.type === 'success' ? 'bg-[#3a5b5e] text-white' : 'bg-red-500 text-white'}`}>
          {toast.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
          {toast.message}
        </div>
      )}

      {/* 1. DESKTOP SIDEBAR */}
      <aside className="hidden lg:flex w-72 bg-white border-r border-[#E0E7E9] flex-col p-8 sticky top-0 h-screen shrink-0 z-40">
        <div className="mb-12">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#5fa4ad] mb-1">LexCorp Systems</p>
          <h1 className="text-2xl font-black tracking-tighter uppercase">Lextrack</h1>
        </div>
        <nav className="space-y-3 flex-grow">
          <Link href="/" className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-sm font-bold hover:bg-[#F8FAFB] text-[#A0AEC0] transition-all"><Wallet size={20}/> Dashboard</Link>
          <Link href="/splitter" className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-sm font-bold bg-[#3a5b5e] text-white shadow-lg transition-all"><Calculator size={20}/> Splitter</Link>
          <Link href="/shop-clearing" className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-sm font-bold hover:bg-[#F8FAFB] text-[#A0AEC0] transition-all"><ShoppingCart size={20}/> Clearing</Link>
          <Link href="#" className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-sm font-bold hover:bg-[#F8FAFB] text-[#A0AEC0] transition-all"><PieChart size={20}/> Analytics</Link>
        </nav>
      </aside>

      {/* 2. MAIN CONTENT */}
      <div className="flex-grow flex flex-col min-h-screen overflow-y-auto">
        <div className="w-full max-w-[1200px] mx-auto px-4 lg:px-8 py-6 lg:py-10 pb-40">
          
          <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <div>
              <h2 className="text-2xl lg:text-3xl font-black tracking-tight">Split Ledger</h2>
              <p className="text-[10px] font-bold text-[#A0AEC0] uppercase tracking-widest mt-1">Track Group Expenses</p>
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

          {/* Master Overview */}
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

          {/* --- CONSOLIDATED PENDING BY PERSON --- */}
          {pendingPeople.length > 0 && (
            <div className="mb-10">
              <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-[#A0AEC0] mb-4 pl-2">Pending By Person</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {pendingPeople.map((person, idx) => (
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
                        <p className="text-[9px] font-black uppercase text-[#A0AEC0]">Total Owed</p>
                        <p className="font-black text-orange-500">MVR {person.totalOwed.toFixed(0)}</p>
                      </div>
                    </div>
                    <button onClick={() => sendPersonalInvoice(person)} className="w-full bg-[#e0f2fe] text-[#0284c7] hover:bg-[#bae6fd] py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-colors flex justify-center items-center gap-2">
                      <Send size={14}/> Send WA Invoice
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-[#A0AEC0] mb-4 pl-2">Events Ledger</h3>
          
          {/* Events List */}
          <div className="space-y-4">
            {events.length === 0 && (
              <div className="text-center py-20 bg-white rounded-[2rem] border border-dashed border-[#A0AEC0]">
                <Calculator size={48} className="mx-auto text-[#E0E7E9] mb-4" />
                <p className="font-bold text-[#A0AEC0]">No splits recorded yet.</p>
              </div>
            )}

            {events.map((ev) => {
              const isExpanded = expanded[ev.id];
              const eventTotal = ev.mode === 'food' 
                ? ev.participants.reduce((s: number, p: any) => s + calculateShare(ev, p), 0)
                : parseFloat(ev.totalBill) || 0;
              
              const collected = ev.participants.filter((p:any) => p.hasPaid).reduce((s: number, p: any) => s + calculateShare(ev, p), 0);
              const isFullyPaid = collected >= eventTotal && eventTotal > 0;

              return (
                <div key={ev.id} className={`bg-white rounded-[2rem] border border-[#E0E7E9] shadow-sm transition-all duration-300 ${isExpanded ? 'ring-2 ring-[#5fa4ad]/20' : ''}`}>
                  
                  {/* Collapsed Header Summary */}
                  <div className="p-5 flex items-center justify-between cursor-pointer" onClick={() => setExpanded({...expanded, [ev.id]: !isExpanded})}>
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-sm ${ev.mode === 'food' ? 'bg-orange-400' : 'bg-blue-500'}`}>
                        {ev.mode === 'food' ? <Utensils size={20}/> : <Navigation size={20}/>}
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

                  {/* Expanded Editor */}
                  {isExpanded && (
                    <div className="p-5 border-t border-[#E0E7E9] bg-[#F8FAFB] rounded-b-[2rem]">
                      
                      {/* Editor Controls */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                        <div className="flex flex-col">
                          <label className="text-[9px] font-black uppercase tracking-widest text-[#A0AEC0] mb-1 pl-1">Event Title</label>
                          <input type="text" value={ev.title} onChange={e => updateEvent(ev.id, 'title', e.target.value)} className="bg-white border-none p-3 rounded-xl font-bold focus:ring-2 focus:ring-[#5fa4ad]"/>
                        </div>
                        <div className="flex flex-col">
                          <label className="text-[9px] font-black uppercase tracking-widest text-[#A0AEC0] mb-1 pl-1">Date</label>
                          <input type="date" value={ev.date} onChange={e => updateEvent(ev.id, 'date', e.target.value)} className="bg-white border-none p-3 rounded-xl font-bold focus:ring-2 focus:ring-[#5fa4ad]"/>
                        </div>
                        
                        {/* Mode Switcher */}
                        <div className="flex flex-col">
                          <label className="text-[9px] font-black uppercase tracking-widest text-[#A0AEC0] mb-1 pl-1">Split Type</label>
                          <div className="flex bg-white p-1 rounded-xl shadow-sm border border-[#E0E7E9] h-full">
                            <button onClick={() => updateEvent(ev.id, 'mode', 'food')} className={`flex-1 rounded-lg text-[10px] font-black uppercase transition-all ${ev.mode === 'food' ? 'bg-orange-400 text-white' : 'text-[#A0AEC0]'}`}>Food (Itemized)</button>
                            <button onClick={() => updateEvent(ev.id, 'mode', 'trip')} className={`flex-1 rounded-lg text-[10px] font-black uppercase transition-all ${ev.mode === 'trip' ? 'bg-blue-500 text-white' : 'text-[#A0AEC0]'}`}>Trip (Equal)</button>
                          </div>
                        </div>

                        {ev.mode === 'food' ? (
                          <div className="flex flex-col">
                            <label className="text-[9px] font-black uppercase tracking-widest text-orange-400 mb-1 pl-1">Delivery Fee (Split Equally)</label>
                            <input type="number" value={ev.delivery} onChange={e => updateEvent(ev.id, 'delivery', e.target.value)} className="bg-white border-none p-3 rounded-xl font-bold focus:ring-2 focus:ring-orange-400 text-orange-600" placeholder="0"/>
                          </div>
                        ) : (
                          <div className="flex flex-col">
                            <label className="text-[9px] font-black uppercase tracking-widest text-[#A0AEC0] mb-1 pl-1">Total Trip Bill (MVR)</label>
                            <input type="number" value={ev.totalBill} onChange={e => updateEvent(ev.id, 'totalBill', e.target.value)} className="bg-white border-none p-3 rounded-xl font-bold focus:ring-2 focus:ring-[#5fa4ad]" placeholder="0"/>
                          </div>
                        )}
                      </div>

                      {/* Participants Table */}
                      <div className="bg-white rounded-2xl border border-[#E0E7E9] overflow-hidden mb-6">
                        <div className="flex justify-between items-center p-4 border-b border-[#E0E7E9] bg-gray-50">
                          <h4 className="text-[10px] font-black uppercase text-[#364d54] tracking-widest">Participants</h4>
                          <button onClick={() => addParticipant(ev.id)} className="text-[#5fa4ad] font-bold text-[10px] uppercase flex items-center gap-1 bg-[#e0f2fe] px-3 py-1.5 rounded-lg active:scale-95 transition-transform">
                            <Plus size={12}/> Add Person
                          </button>
                        </div>
                        
                        <div className="divide-y divide-[#E0E7E9]">
                          {ev.participants.map((p: any, i: number) => {
                            const share = calculateShare(ev, p);
                            
                            return (
                              <div key={p.id} className="p-3 flex flex-col gap-3">
                                
                                {/* Top Row: Person Info & Paid Toggle */}
                                <div className="flex flex-wrap sm:flex-nowrap items-center gap-3">
                                  <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-400 flex-shrink-0">{i+1}</div>
                                  
                                  <input type="text" placeholder="Name" value={p.name} onChange={e => updateParticipant(ev.id, i, "name", e.target.value)} className="flex-grow min-w-[100px] bg-transparent border-none focus:ring-0 font-bold text-sm p-0"/>
                                  
                                  <div className="w-24 text-right font-black text-sm text-[#364d54] mr-2">
                                    <span className="text-[9px] text-[#A0AEC0] mr-1">MVR</span>{share.toFixed(0)}
                                  </div>

                                  <button 
                                    onClick={() => updateParticipant(ev.id, i, "hasPaid", !p.hasPaid)}
                                    className={`px-3 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-colors w-20 text-center ${p.hasPaid ? 'bg-green-100 text-green-600' : 'bg-orange-50 text-orange-500 hover:bg-orange-100'}`}
                                  >
                                    {p.hasPaid ? 'Paid' : 'Pending'}
                                  </button>
                                  
                                  <button onClick={() => removeParticipant(ev.id, i)} className="text-red-300 hover:text-red-500 p-2"><Trash2 size={16}/></button>
                                </div>

                                {/* Food Mode: Itemized List */}
                                {ev.mode === 'food' && (
                                  <div className="pl-9 pr-2 space-y-2">
                                    {(p.items || []).map((item: any, itemIdx: number) => (
                                      <div key={item.id} className="flex items-center gap-2">
                                        <input type="text" placeholder="Item (e.g. Burger)" value={item.desc} onChange={e => updateParticipantItem(ev.id, i, itemIdx, "desc", e.target.value)} className="flex-grow bg-gray-50 rounded-lg border-none focus:ring-1 focus:ring-orange-300 text-xs font-bold p-2" />
                                        <input type="number" placeholder="Price" value={item.price} onChange={e => updateParticipantItem(ev.id, i, itemIdx, "price", e.target.value)} className="w-24 bg-gray-50 rounded-lg border-none focus:ring-1 focus:ring-orange-300 text-xs font-bold p-2 text-center" />
                                        <button onClick={() => removeParticipantItem(ev.id, i, itemIdx)} className="text-gray-300 hover:text-red-400 p-1"><X size={14}/></button>
                                      </div>
                                    ))}
                                    <button onClick={() => addParticipantItem(ev.id, i)} className="text-orange-400 font-bold text-[9px] uppercase tracking-widest flex items-center gap-1 mt-1 hover:text-orange-600">
                                      <Plus size={10}/> Add Food Item
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Action Bar */}
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

        {/* MOBILE BOTTOM NAV */}
        <nav className="lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-[400px] h-16 bg-white shadow-[0_10px_40px_rgba(0,0,0,0.1)] rounded-full border border-gray-100 flex justify-around items-center px-6 z-[100]">
          <Link href="/" className="text-gray-400 hover:text-[#3a5b5e] transition-colors"><Wallet size={20} /></Link>
          <Link href="/splitter" className="text-[#3a5b5e]"><Calculator size={24} className="bg-[#e0f2fe] p-1 rounded-md" /></Link>
          <Link href="/shop-clearing" className="text-gray-400 hover:text-[#3a5b5e] transition-colors"><ShoppingCart size={20} /></Link>
        </nav>
      </div>

      {/* --- MVR BANK MODAL --- */}
      {showBankModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[300] flex justify-center items-end sm:items-center">
          <div className="bg-white w-full max-w-md rounded-t-[2rem] sm:rounded-[2rem] p-6 animate-in slide-in-from-bottom-8">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-black tracking-tight">Set MVR Bank Account</h3>
              <button onClick={() => setShowBankModal(false)} className="bg-gray-100 p-2 rounded-full text-gray-500 hover:bg-gray-200"><X size={16}/></button>
            </div>
            <p className="text-xs text-[#A0AEC0] mb-6">This account will be attached to all MVR Splitter invoices (Food/Trips).</p>
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