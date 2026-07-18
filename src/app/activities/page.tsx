"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { 
  Plus, X, Trash2, Wallet, ShoppingCart, Calculator, Settings, 
  CheckCircle2, AlertCircle, ChevronDown, ChevronUp, Send, User, 
  Banknote, LayoutDashboard, Users, Flame, ClipboardList
} from "lucide-react";
import Link from "next/link";

export default function ActivitiesPage() {
  const [activities, setActivities] = useState<any[]>([]);
  const [selectedActId, setSelectedActId] = useState<string | null>(null);
  const [activeTab, setActiveHostTab] = useState<'finance' | 'shopping' | 'groups'>('finance');
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  const [loading, setLoading] = useState(false);

  // Form states for creating a new activity dashboard
  const [actTitle, setActTitle] = useState("");
  const [actDate, setActDate] = useState(new Date().toISOString().split('T')[0]);

  // Logistics / Group states
  const [newGroupName, setNewGroupName] = useState("");

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchActivitiesData = useCallback(async () => {
    setLoading(true);
    const { data: actData } = await supabase.from('activities').select('*').order('activity_date', { ascending: false });
    
    if (actData) {
      const consolidated = await Promise.all(actData.map(async (act: any) => {
        const [partsRes, shopRes] = await Promise.all([
          supabase.from('activity_participants').select('*').eq('activity_id', act.id),
          supabase.from('activity_shopping').select('*').eq('activity_id', act.id)
        ]);
        return {
          ...act,
          participants: partsRes.data || [],
          shopping: shopRes.data || []
        };
      }));
      setActivities(consolidated);
      if (consolidated.length > 0 && !selectedActId) {
        setSelectedActId(consolidated[0].id);
      }
    }
    setLoading(false);
  }, [selectedActId]);

  useEffect(() => {
    fetchActivitiesData();
  }, [fetchActivitiesData]);

  // Find currently active event profile focus context
  const currentActivity = activities.find(a => a.id === selectedActId);

  // --- Core Analytics Processing Engine ---
  const getKidsCount = (kidsNamesStr: string) => {
    if (!kidsNamesStr || !kidsNamesStr.trim()) return 0;
    return kidsNamesStr.split(',').filter(name => name.trim().length > 0).length;
  };

  const calculateBreakdown = (activity: any) => {
    let adults = 0;
    let kids = 0;
    if (activity && activity.participants) {
      activity.participants.forEach((p: any) => {
        adults += 1; // The head payer
        if (p.spouse_name && p.spouse_name.trim()) adults += 1;
        kids += getKidsCount(p.kids_names || "");
      });
    }
    return { adults, kids, total: adults + kids };
  };

  const calculateSharePerHead = (activity: any) => {
    if (!activity) return 0;
    const { total } = calculateBreakdown(activity);
    if (total === 0) return 0;
    const totalExp = parseFloat(activity.total_expenses) || 0;
    return totalExp / total;
  };

  const calculateFamilyDue = (p: any, sharePerHead: number) => {
    const familySize = 1 + (p.spouse_name && p.spouse_name.trim() ? 1 : 0) + getKidsCount(p.kids_names || "");
    return familySize * sharePerHead;
  };

  // --- Database Sync Pipelines ---
  const handleCreateActivity = async () => {
    if (!actTitle.trim()) return showToast("Activity title required", "error");
    const defaultGroups = ["General Attendees"];
    const { data, error } = await supabase.from('activities').insert({ title: actTitle.trim(), activity_date: actDate, groups_list: defaultGroups }).select().single();
    if (!error && data) {
      showToast("Activity initialized!");
      setActTitle("");
      setSelectedActId(data.id);
      fetchActivitiesData();
    }
  };

  const handleUpdateExpense = async (actId: string, val: string) => {
    setActivities(prev => prev.map(a => a.id === actId ? { ...a, total_expenses: val } : a));
    await supabase.from('activities').update({ total_expenses: parseFloat(val) || 0 }).eq('id', actId);
  };

  const handleAddFamily = async (actId: string) => {
    // FIX: Aligned insertion payload keys to fully pass security table guidelines
    const newFam = { 
      activity_id: actId, 
      primary_name: "New Attendee", 
      spouse_name: "", 
      kids_names: "", 
      has_paid: false, 
      assigned_group: "General Attendees" 
    };
    const { error } = await supabase.from('activity_participants').insert(newFam);
    if (error) {
      console.error(error);
      showToast("Database insertion error.", "error");
    } else {
      fetchActivitiesData();
    }
  };

  const handleUpdateFamilyLocal = (actId: string, partId: string, field: string, val: any) => {
    setActivities(prev => prev.map(a => a.id === actId ? {
      ...a,
      participants: a.participants.map((p: any) => p.id === partId ? { ...p, [field]: val } : p)
    } : a));
  };

  const handleSaveFamilyDB = async (partId: string, field: string, val: any) => {
    await supabase.from('activity_participants').update({ [field]: val }).eq('id', partId);
  };

  const handleRemoveFamily = async (partId: string) => {
    await supabase.from('activity_participants').delete().eq('id', partId);
    fetchActivitiesData();
  };

  const handleAddShoppingItem = async (actId: string) => {
    const newItem = { activity_id: actId, item_name: "New Provision Item", qty: "1", estimated_cost: 0, is_bought: false, assigned_to_name: "" };
    const { data } = await supabase.from('activity_shopping').insert(newItem).select().single();
    if (data) fetchActivitiesData();
  };

  const handleUpdateShopLocal = (actId: string, itemId: string, field: string, val: any) => {
    setActivities(prev => prev.map(a => a.id === actId ? {
      ...a,
      shopping: a.shopping.map((s: any) => s.id === itemId ? { ...s, [field]: val } : s)
    } : a));
  };

  const handleSaveShopDB = async (itemId: string, field: string, val: any) => {
    await supabase.from('activity_shopping').update({ [field]: val }).eq('id', itemId);
  };

  const handleRemoveShopItem = async (itemId: string) => {
    await supabase.from('activity_shopping').delete().eq('id', itemId);
    fetchActivitiesData();
  };

  const handleAddGroupDB = async (act: any) => {
    if (!newGroupName.trim()) return;
    const nextGroups = [...(act.groups_list || []), newGroupName.trim()];
    setActivities(prev => prev.map(a => a.id === act.id ? { ...a, groups_list: nextGroups } : a));
    await supabase.from('activities').update({ groups_list: nextGroups }).eq('id', act.id);
    setNewGroupName("");
    showToast("Custom Group Added!");
  };

  const removeGroupDB = async (act: any, targetGroupName: string) => {
    const nextGroups = (act.groups_list || []).filter((g: string) => g !== targetGroupName);
    setActivities(prev => prev.map(a => a.id === act.id ? { ...a, groups_list: nextGroups } : a));
    await supabase.from('activities').update({ groups_list: nextGroups }).eq('id', act.id);
    await supabase.from('activity_participants').update({ assigned_group: "General Attendees" }).eq('activity_id', act.id).eq('assigned_group', targetGroupName);
    fetchActivitiesData();
  };

  const handleDeleteActivity = async (actId: string) => {
    if (!confirm("Delete this entire activity session?")) return;
    await supabase.from('activities').delete().eq('id', actId);
    setSelectedActId(null);
    showToast("Activity clear");
    fetchActivitiesData();
  };

  const handleShareWhatsApp = (act: any) => {
    const { total, adults, kids } = calculateBreakdown(act);
    const sharePerHead = calculateSharePerHead(act);
    let msg = `*🏡 ACTIVITY INVOICE SUMMARY: ${act.title.toUpperCase()}*\n📅 Date: ${act.activity_date}\n💰 Total Expense: MVR ${parseFloat(act.total_expenses).toFixed(2)}\n👥 Attendance: ${total} Pax (${adults} Adults, ${kids} Kids)\n📊 Cost Per Head: MVR ${sharePerHead.toFixed(2)}\n\n*FINANCIAL LEDGER DUES:*\n`;

    act.participants.forEach((p: any) => {
      const kCount = getKidsCount(p.kids_names || "");
      const familySize = 1 + (p.spouse_name && p.spouse_name.trim() ? 1 : 0) + kCount;
      const totalDue = calculateFamilyDue(p, sharePerHead);
      
      msg += `• *${p.primary_name}* (${familySize} pax)\n`;
      if (p.spouse_name && p.spouse_name.trim()) msg += `  ↳ Spouse: ${p.spouse_name}\n`;
      if (kCount > 0) msg += `  ↳ Kids: ${p.kids_names}\n`;
      msg += `  💳 Amount Due: *MVR ${totalDue.toFixed(0)}* [${p.has_paid ? 'PAID ✅' : 'PENDING ⏳'}]\n\n`;
    });

    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const breakdown = calculateBreakdown(currentActivity);

  return (
    <main className="min-h-screen bg-[#F8FAFC] text-[#1E293B] font-sans antialiased flex selection:bg-sky-500/10">
      
      {/* PC DESKTOP NAVIGATION DOCK */}
      <aside className="hidden lg:flex w-72 bg-white border-r border-slate-200/80 flex-col p-6 sticky top-0 h-screen shrink-0 z-40">
        <div className="flex items-center gap-3 mb-10 px-2">
          <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center text-white font-black shadow-md">L</div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-slate-900 leading-none">Lextrack</h1>
            <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-400 mt-1">LexCorp System</p>
          </div>
        </div>
        <nav className="space-y-1 flex-grow">
          <Link href="/" className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium hover:bg-slate-50 text-slate-500 hover:text-slate-900 transition-all duration-150"><LayoutDashboard size={18}/> Dashboard</Link>
          <Link href="/tracker" className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium hover:bg-slate-50 text-slate-500 hover:text-slate-900 transition-all duration-150"><Banknote size={18}/> Tracker</Link>
          <Link href="/splitter" className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium hover:bg-slate-50 text-slate-500 hover:text-slate-900 transition-all duration-150"><Calculator size={18}/> Splitter</Link>
          <Link href="/shop-clearing" className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium hover:bg-slate-50 text-slate-500 hover:text-slate-900 transition-all duration-150"><ShoppingCart size={18}/> Clearing</Link>
          <Link href="/activities" className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold bg-slate-900 text-white shadow-sm transition-all duration-200"><Flame size={18}/> Activities</Link>
          <Link href="/myself" className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium hover:bg-slate-50 text-slate-500 hover:text-slate-900 transition-all duration-150"><User size={18}/> Myself</Link>
        </nav>
      </aside>

      {/* CORE VIEWPORT CANVAS FRAME */}
      <div className="flex-grow flex flex-col min-h-screen overflow-y-auto bg-[#F8FAFC]">
        <div className="w-full max-w-[1240px] mx-auto px-4 lg:px-8 py-6 lg:py-8 pb-40">
          
          {/* HEADER ROW BAR */}
          <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <div>
              <h2 className="text-xl lg:text-2xl font-bold tracking-tight text-slate-900">Activity Hub</h2>
              <div className="flex items-center gap-2.5 mt-2 overflow-x-auto max-w-full pb-1 no-scrollbar">
                {activities.map(a => (
                  <button 
                    key={a.id} 
                    onClick={() => setSelectedActId(a.id)}
                    className={`px-3 py-1.5 rounded-xl font-bold text-xs uppercase tracking-wider whitespace-nowrap border transition-all ${selectedActId === a.id ? 'bg-slate-900 border-slate-900 text-white shadow-sm' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                  >
                    {a.title}
                  </button>
                ))}
              </div>
            </div>
          </header>

          {/* INITIALIZE NEW EVENT ACTION SECTION */}
          <div className="bg-white rounded-xl p-3.5 border border-slate-200/60 shadow-[0_2px_12px_rgba(0,0,0,0.02)] mb-6 flex flex-col sm:flex-row gap-3 items-end">
            <div className="flex flex-col flex-grow w-full">
              <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1 pl-0.5">Initialize New Event Workspace</label>
              <input type="text" placeholder="e.g. Maafushi Beach BBQ Trip, Kuda Bandos Picnic" value={actTitle} onChange={e => setActTitle(e.target.value)} className="bg-slate-50 border border-slate-100 p-2 rounded-xl text-xs font-semibold focus:outline-none"/>
            </div>
            <div className="flex flex-col w-full sm:w-40">
              <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1 pl-0.5">Event Date</label>
              <input type="date" value={actDate} onChange={e => setActDate(e.target.value)} className="bg-slate-50 border border-slate-100 p-2 rounded-xl text-xs font-semibold focus:outline-none text-slate-500"/>
            </div>
            <button onClick={handleCreateActivity} className="w-full sm:w-auto h-9 px-4 bg-slate-900 text-white font-semibold text-xs uppercase tracking-wider rounded-xl shadow-xs flex items-center justify-center gap-1 shrink-0"><Plus size={14}/> Create Hub</button>
          </div>

          {currentActivity ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* HIGH CAPACITY ATTENDANCE DIRECTORY (LEFT COLUMN) */}
              <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/60 shadow-[0_2px_12px_rgba(0,0,0,0.02)] flex flex-col h-[650px] overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center shrink-0">
                  <div>
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5"><Users size={15} className="text-slate-500"/> Attendance Directory</h3>
                    <p className="text-[10px] text-slate-500 font-bold mt-1 bg-white border border-slate-200/60 rounded-lg px-2 py-0.5 inline-block">
                      👨‍💼 Adults: {breakdown.adults} | 👦 Kids: {breakdown.kids} ({breakdown.total} Total)
                    </p>
                  </div>
                  <button onClick={() => handleAddFamily(currentActivity.id)} className="bg-slate-900 text-white font-bold text-[9px] uppercase tracking-wider flex items-center gap-0.5 px-2.5 py-1.5 rounded-lg active:scale-95 transition-transform shadow-xs"><Plus size={11}/> Add Member</button>
                </div>

                <div className="p-4 overflow-y-auto flex-grow space-y-4 custom-scrollbar bg-slate-50/30">
                  {currentActivity.participants.length === 0 && (
                    <div className="text-center py-20 text-slate-400 font-semibold text-xs">No registered attendees. Add a family deck above.</div>
                  )}
                  {currentActivity.participants.map((p: any) => (
                    <div key={p.id} className="bg-white border border-slate-200/50 rounded-xl p-3.5 shadow-xs relative group animate-in fade-in">
                      <button onClick={() => handleRemoveFamily(p.id)} className="absolute top-3 right-3 text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity p-0.5"><Trash2 size={13}/></button>
                      
                      <div className="space-y-2.5">
                        <div>
                          <label className="text-[8px] font-bold text-slate-400 uppercase block mb-1">Household Head Payer</label>
                          <input type="text" value={p.primary_name} onChange={e => handleUpdateFamilyLocal(currentActivity.id, p.id, "primary_name", e.target.value)} onBlur={e => handleSaveFamilyDB(p.id, "primary_name", e.target.value)} className="w-full bg-slate-50 border border-slate-100 rounded-lg p-1.5 text-xs font-bold focus:outline-none"/>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <label className="text-[8px] font-bold text-slate-400 uppercase block mb-1">Spouse Name</label>
                            <input type="text" placeholder="None" value={p.spouse_name || ""} onChange={e => handleUpdateFamilyLocal(currentActivity.id, p.id, "spouse_name", e.target.value)} onBlur={e => handleSaveFamilyDB(p.id, "spouse_name", e.target.value)} className="w-full bg-slate-50 border border-slate-100 rounded-lg p-1.5 text-xs font-semibold focus:outline-none"/>
                          </div>
                          <div>
                            <label className="text-[8px] font-bold text-slate-400 uppercase block mb-1">Assign Group Slot</label>
                            <select value={p.assigned_group || "General Attendees"} onChange={e => { handleUpdateFamilyLocal(currentActivity.id, p.id, "assigned_group", e.target.value); handleSaveFamilyDB(p.id, "assigned_group", e.target.value); }} className="w-full bg-slate-50 border border-slate-100 rounded-lg p-1.5 text-xs font-semibold focus:outline-none text-slate-700">
                              {(currentActivity.groups_list || ["General Attendees"]).map((g: string, gIdx: number) => (
                                <option key={gIdx} value={g}>{g}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="text-[8px] font-bold text-slate-400 uppercase block mb-1">Children Names (Comma Separated)</label>
                          <input type="text" placeholder="e.g. Sara, Ryan, Adam" value={p.kids_names || ""} onChange={e => handleUpdateFamilyLocal(currentActivity.id, p.id, "kids_names", e.target.value)} onBlur={e => handleSaveFamilyDB(p.id, "kids_names", e.target.value)} className="w-full bg-slate-50 border border-slate-100 rounded-lg p-1.5 text-xs font-medium focus:outline-none"/>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* UNIVERSE TAB WORKSPACE (RIGHT COLUMN) */}
              <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/60 shadow-[0_2px_12px_rgba(0,0,0,0.02)] flex flex-col h-[650px] overflow-hidden">
                
                <div className="border-b border-slate-100 bg-slate-50 px-4 flex justify-between items-center shrink-0">
                  <div className="flex gap-1 pt-3">
                    <button onClick={() => setActiveHostTab('finance')} className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${activeTab === 'finance' ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-700'}`}>📊 Finances</button>
                    <button onClick={() => setActiveHostTab('shopping')} className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${activeTab === 'shopping' ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-700'}`}>🛒 Shopping</button>
                    <button onClick={() => setActiveHostTab('groups')} className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${activeTab === 'groups' ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-700'}`}>🎯 Logistics Groups</button>
                  </div>
                  
                  {activeTab === 'shopping' && (
                    <button onClick={() => handleAddShoppingItem(currentActivity.id)} className="bg-sky-50 text-sky-600 border border-sky-100 font-bold text-[9px] uppercase tracking-wider px-2.5 py-1 rounded-lg active:scale-95 transition-transform"><Plus size={11}/> Add Item</button>
                  )}
                </div>

                <div className="p-5 flex-grow overflow-y-auto bg-white custom-scrollbar">
                  
                  {/* TAB 1: FINANCES PANEL */}
                  {activeTab === 'finance' && (
                    <div className="space-y-5 animate-in fade-in duration-150">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="bg-[#F8FAFC] p-4 rounded-xl border border-slate-200/50 flex flex-col justify-center">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 pl-0.5">Total Activity Expenses (MVR)</label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 italic">MVR</span>
                            <input type="number" value={currentActivity.total_expenses} onChange={e => handleUpdateExpense(currentActivity.id, e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl py-2 pl-12 pr-3 text-sm font-bold focus:outline-none text-slate-800" placeholder="0.00"/>
                          </div>
                        </div>
                        <div className="bg-[#F8FAFC] p-4 rounded-xl border border-slate-200/50 flex flex-col justify-center">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Dynamic Per-Capita Base Due</p>
                          <p className="text-xl font-black text-slate-900">MVR {calculateSharePerHead(currentActivity).toFixed(2)} <span className="text-xs font-normal text-slate-400">/ person</span></p>
                        </div>
                      </div>

                      <div className="border border-slate-100 rounded-xl overflow-hidden shadow-xs">
                        <table className="w-full border-collapse text-left text-xs font-semibold">
                          <thead>
                            <tr className="bg-slate-50 text-slate-400 uppercase font-bold text-[9px] tracking-wider border-b border-slate-100">
                              <th className="p-3">Household Account Head</th>
                              <th className="p-3 text-center">Pax Size</th>
                              <th className="p-3 text-right">Calculated Debt</th>
                              <th className="p-3 text-center">Receipt</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {currentActivity.participants.map((p: any) => {
                              const fDue = calculateFamilyDue(p, calculateSharePerHead(currentActivity));
                              const fSize = 1 + (p.spouse_name && p.spouse_name.trim() ? 1 : 0) + getKidsCount(p.kids_names || "");
                              return (
                                <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                                  <td className="p-3 font-bold text-slate-800">{p.primary_name}</td>
                                  <td className="p-3 text-center font-bold text-slate-500 bg-slate-50/30">{fSize} pax</td>
                                  <td className="p-3 text-right font-black text-amber-600">MVR {fDue.toFixed(0)}</td>
                                  <td className="p-3 text-center">
                                    <button 
                                      onClick={() => {
                                        handleUpdateFamilyLocal(currentActivity.id, p.id, "has_paid", !p.has_paid);
                                        handleSaveFamilyDB(p.id, "has_paid", !p.has_paid);
                                      }}
                                      className={`px-2 py-1 rounded font-black text-[9px] uppercase tracking-wider transition-colors border ${p.has_paid ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}
                                    >
                                      {p.has_paid ? 'Paid' : 'Pending'}
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* TAB 2: SHOPPING EXPANDED CANVAS */}
                  {activeTab === 'shopping' && (
                    <div className="space-y-3 animate-in fade-in duration-150">
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 mb-2">
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1"><ClipboardList size={13}/> Checklist Workspace</p>
                      </div>

                      {currentActivity.shopping.length === 0 && (
                        <p className="text-xs text-slate-400 italic py-12 text-center">No provision tracking vectors added yet. Click Add Item to start compiling.</p>
                      )}

                      <div className="space-y-2.5">
                        {currentActivity.shopping.map((item: any) => (
                          <div key={item.id} className="flex gap-2 items-center bg-[#F8FAFC] border border-slate-200/40 shadow-xs p-2.5 rounded-xl hover:bg-slate-50 transition-colors group">
                            <button 
                              onClick={() => {
                                handleUpdateShopLocal(currentActivity.id, item.id, "is_bought", !item.is_bought);
                                handleSaveShopDB(item.id, "is_bought", !item.is_bought);
                              }}
                              className="text-slate-400 hover:text-slate-900 p-0.5 shrink-0"
                            >
                              {item.is_bought ? <CheckCircle2 size={16} className="text-emerald-500"/> : <div className="w-4 h-4 rounded-md border border-slate-300 bg-white"/>}
                            </button>

                            <input type="text" value={item.item_name} onChange={e => handleUpdateShopLocal(currentActivity.id, item.id, "item_name", e.target.value)} onBlur={e => handleSaveShopDB(item.id, "item_name", e.target.value)} className={`flex-grow bg-white border border-slate-200 px-2.5 py-1.5 rounded-lg text-xs font-semibold focus:outline-none ${item.is_bought ? 'line-through text-slate-400 bg-slate-100/50 border-transparent' : 'text-slate-800'}`} placeholder="Item Description"/>
                            <input type="text" placeholder="Qty" value={item.qty} onChange={e => handleUpdateShopLocal(currentActivity.id, item.id, "qty", e.target.value)} onBlur={e => handleSaveShopDB(item.id, "qty", e.target.value)} className="w-16 bg-white border border-slate-200 p-1.5 rounded-lg text-xs font-semibold text-center focus:outline-none text-slate-600"/>
                            
                            <select value={item.assigned_to_name || ""} onChange={e => { handleUpdateShopLocal(currentActivity.id, item.id, "assigned_to_name", e.target.value); handleSaveShopDB(item.id, "assigned_to_name", e.target.value); }} className="w-32 bg-white border border-slate-200 p-1.5 rounded-lg text-xs font-semibold focus:outline-none text-slate-500">
                              <option value="">Unassigned</option>
                              {currentActivity.participants.map((p: any, pIdx: number) => (
                                <option key={pIdx} value={p.primary_name}>{p.primary_name}</option>
                              ))}
                            </select>

                            <button onClick={() => handleRemoveShopItem(item.id)} className="text-slate-300 hover:text-rose-500 p-1 shrink-0"><X size={15}/></button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* TAB 3: LOGISTICS GROUPS ASSIGNER */}
                  {activeTab === 'groups' && (
                    <div className="space-y-6 animate-in fade-in duration-150">
                      <div className="bg-[#F8FAFC] border border-slate-200/50 p-4 rounded-xl flex items-end gap-3 shadow-xs">
                        <div className="flex flex-col flex-grow">
                          <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1 pl-0.5">Create Custom Group Name</label>
                          <input type="text" placeholder="e.g., Cooking Team, Games Crew, Setup Squad" value={newGroupName} onChange={e => setNewGroupName(e.target.value)} className="bg-white border border-slate-200 p-1.5 rounded-lg text-xs font-semibold focus:outline-none"/>
                        </div>
                        <button onClick={() => handleAddGroupDB(currentActivity)} className="h-8 px-3.5 bg-slate-900 text-white font-semibold text-xs uppercase tracking-wider rounded-lg active:scale-95 transition-transform shrink-0">Add Group</button>
                      </div>

                      <div className="space-y-4">
                        {(currentActivity.groups_list || ["General Attendees"]).map((groupName: string, gIdx: number) => {
                          const assignedFolks = currentActivity.participants.filter((p: any) => (p.assigned_group || "General Attendees") === groupName);
                          
                          // Dynamic group breakdown counts
                          let groupAdults = 0;
                          let groupKids = 0;
                          assignedFolks.forEach((f: any) => {
                            groupAdults += 1;
                            if (f.spouse_name && f.spouse_name.trim()) groupAdults += 1;
                            groupKids += getKidsCount(f.kids_names || "");
                          });

                          return (
                            <div key={gIdx} className="border border-slate-200/60 rounded-xl overflow-hidden shadow-xs bg-white">
                              <div className="bg-slate-50/80 border-b border-slate-100 p-3 flex justify-between items-center">
                                <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                                  <div className="w-1.5 h-1.5 rounded-full bg-sky-500"/>
                                  {groupName} 
                                  <span className="text-[10px] text-slate-500 font-bold bg-white border border-slate-100 px-1.5 py-0.5 rounded-md ml-1">
                                    👨‍💼 {groupAdults} Adults | 👦 {groupKids} Kids
                                  </span>
                                </h4>
                                {groupName !== "General Attendees" && (
                                  <button onClick={() => removeGroupDB(currentActivity, groupName)} className="text-slate-300 hover:text-rose-500 transition-colors p-0.5"><X size={14}/></button>
                                )}
                              </div>

                              <div className="p-3 bg-white flex flex-wrap gap-2">
                                {assignedFolks.length === 0 && (
                                  <p className="text-[11px] text-slate-400 italic pl-1 py-1">No members assigned to this group yet.</p>
                                )}
                                {assignedFolks.map((p: any) => {
                                  const totalKidsNum = getKidsCount(p.kids_names || "");
                                  return (
                                    <div key={p.id} className="bg-slate-50 border border-slate-100 px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-700 flex items-center gap-1.5 shadow-xs">
                                      <User size={12} className="text-slate-400"/>
                                      <div>
                                        <span>{p.primary_name}</span>
                                        {(p.spouse_name || totalKidsNum > 0) && (
                                          <span className="text-[9px] font-normal text-slate-400 block -mt-0.5">Family size: {1 + (p.spouse_name ? 1 : 0) + totalKidsNum}</span>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                    </div>
                  )}

                </div>

                {/* WORKSPACE OPERATIONS PANEL FOOTER BAR */}
                <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-between items-center shrink-0">
                  <button onClick={() => handleDeleteActivity(currentActivity.id)} className="text-rose-400 font-bold text-[10px] uppercase flex items-center gap-0.5 hover:text-rose-600"><Trash2 size={13}/> Wipe Activity</button>
                  <button onClick={() => handleShareWhatsApp(currentActivity)} className="h-10 px-5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] uppercase tracking-wider rounded-xl shadow-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all"><Send size={13}/> Broadcast WhatsApp Ledger</button>
                </div>

              </div>

            </div>
          ) : (
            <div className="text-center py-24 bg-white rounded-2xl border border-dashed border-slate-200 text-slate-400 font-semibold text-sm shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
              No activity session context found. Initialize an activity profile above to spin up the columns matrix.
            </div>
          )}

        </div>

        {/* MOBILE FLOATING NAV DOCKBAR CONTAINER */}
        <nav className="lg:hidden fixed bottom-5 left-1/2 -translate-x-1/2 w-[92%] max-w-[360px] h-14 bg-white/90 border border-slate-200/60 shadow-[0_8px_30px_rgba(0,0,0,0.06)] rounded-xl flex justify-around items-center px-2 z-[100] backdrop-blur-md">
          <Link href="/" className="text-slate-400 hover:text-slate-800 transition-colors active:scale-95"><Wallet size={18} /></Link>
          <Link href="/tracker" className="text-slate-400 hover:text-slate-800 transition-colors active:scale-95"><Banknote size={18} /></Link>
          <Link href="/splitter" className="text-slate-400 hover:text-slate-800 transition-colors active:scale-95"><Calculator size={18} /></Link>
          <Link href="/shop-clearing" className="text-slate-400 hover:text-slate-800 transition-colors active:scale-95"><ShoppingCart size={18} /></Link>
          <Link href="/activities" className="text-slate-900 transition-transform duration-200 active:scale-95"><Flame size={18} className="bg-slate-100 p-2 w-8 h-8 rounded-lg" /></Link>
        </nav>
      </div>

    </main>
  );
}