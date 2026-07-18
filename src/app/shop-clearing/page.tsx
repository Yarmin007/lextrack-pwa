"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Wallet, Plus, ShoppingCart, CheckCircle2, AlertCircle, Trash2, UserPlus, Landmark, X, Send, Calculator, Settings, PieChart, TrendingUp, UserMinus, Banknote, LayoutDashboard, User } from "lucide-react";
import Link from "next/link";

export default function ShopClearingPage() {
  const [hosts, setHosts] = useState<any[]>([]);
  const [banks, setBanks] = useState<any[]>([]);
  const [directory, setDirectory] = useState<any[]>([]);
  
  // Controls which hosts are shown strictly in the current month view
  const [activeHostIds, setActiveHostIds] = useState<Set<string>>(new Set());
  
  const [showAddUser, setShowAddUser] = useState(false);
  const [showBanks, setShowBanks] = useState(false);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

  const [newHostName, setNewHostName] = useState("");
  const [newHostNo, setNewHostNo] = useState("");
  const [newBankName, setNewBankName] = useState("");
  const [newBankNo, setNewBankNo] = useState("");

  const [sellingRate, setSellingRate] = useState("17.40");
  const [rowData, setRowData] = useState<Record<string, any>>({});
  const [clearingMonth, setClearingMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const savedRate = localStorage.getItem("lextrack_selling_rate");
    if (savedRate) {
      setSellingRate(savedRate);
    }
  }, []);

  const handleRateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newRate = e.target.value;
    setSellingRate(newRate);
    localStorage.setItem("lextrack_selling_rate", newRate);
  };

  useEffect(() => {
    async function fetchMonthData() {
      const { data: hostsData } = await supabase.from('hosts').select('*');
      const { data: banksData } = await supabase.from('bank_accounts').select('*');
      const { data: dirData } = await supabase.from('directory').select('*');
      
      if (hostsData) setHosts(hostsData);
      if (banksData) setBanks(banksData);
      if (dirData) setDirectory(dirData);

      const { data: clearingsData } = await supabase.from('shop_clearings').select('*').eq('clearing_month', `${clearingMonth}-01`);

      const newRowData: Record<string, any> = {};
      const activeIds = new Set<string>();
      
      if (clearingsData) {
        clearingsData.forEach((c) => {
          activeIds.add(c.host_id);
          newRowData[c.host_id] = {
            clearingId: c.id,
            billMvr: c.bill_amount_mvr?.toString() || "",
            rate: c.applied_rate?.toString() || "15.42",
            advances: c.advances_list || [],
            received: c.received_usd?.toString() || "",
            isPaid: c.is_paid,
            isMsgSent: c.is_msg_sent
          };
        });
      }
      setRowData(newRowData);
      setActiveHostIds(activeIds);
    }
    fetchMonthData();
  }, [clearingMonth]);

  const handleRowChange = (hostId: string, field: string, value: any) => {
    setRowData((prev) => {
      const existingRow = prev[hostId] || { billMvr: "", rate: "15.42", advances: [], received: "", isPaid: false, isMsgSent: false };
      return { ...prev, [hostId]: { ...existingRow, [field]: value } };
    });
  };

  const addAdvance = (hostId: string) => {
    const row = rowData[hostId] || { billMvr: "", rate: "15.42", advances: [], received: "" };
    const today = new Date().toISOString().split('T')[0];
    const newAdvances = [...(row.advances || []), { date: today, amountMvr: "" }];
    handleRowChange(hostId, "advances", newAdvances);
  };

  const updateAdvance = (hostId: string, index: number, field: string, value: string) => {
    const row = rowData[hostId];
    const newAdvances = [...row.advances];
    newAdvances[index][field] = value;
    handleRowChange(hostId, "advances", newAdvances);
  };

  const removeAdvance = (hostId: string, index: number) => {
    const row = rowData[hostId];
    const newAdvances = row.advances.filter((_: any, i: number) => i !== index);
    handleRowChange(hostId, "advances", newAdvances);
  };

  const handleSaveToDatabase = async (hostId: string) => {
    const row = rowData[hostId] || {};
    const bill = parseFloat(row.billMvr) || 0;
    const rate = parseFloat(row.rate) || 15.42;
    const received = parseFloat(row.received) || 0;
    const advances = row.advances || [];
    
    const totalAdvancesMvr = advances.reduce((sum: number, adv: any) => sum + (parseFloat(adv.amountMvr) || 0), 0);
    const totalDueUsd = (bill + totalAdvancesMvr) / rate;
    const isPaid = received > 0 && received >= totalDueUsd;

    const payload = {
      host_id: hostId,
      clearing_month: `${clearingMonth}-01`,
      bill_amount_mvr: bill,
      applied_rate: rate,
      advances_list: advances,
      received_usd: received,
      is_paid: isPaid,
      is_msg_sent: row.isMsgSent || false
    };

    if (row.clearingId) {
      const { error } = await supabase.from('shop_clearings').update(payload).eq('id', row.clearingId);
      if (error) showToast("Error saving data.", "error"); else showToast("Ledger updated!");
    } else {
      const { data, error } = await supabase.from('shop_clearings').insert(payload).select().single();
      if (error) showToast("Error saving data.", "error");
      if (data) { setRowData(prev => ({ ...prev, [hostId]: { ...prev[hostId], clearingId: data.id } })); showToast("Ledger saved!"); }
    }
  };

  const handleDeleteClearing = async (hostId: string) => {
    const row = rowData[hostId];
    if (!row?.clearingId) return;
    if (confirm("Are you sure you want to delete this month's record for this customer?")) {
      const { error } = await supabase.from('shop_clearings').delete().eq('id', row.clearingId);
      if (!error) {
        const newRowData = { ...rowData };
        delete newRowData[hostId];
        setRowData(newRowData);
        showToast("Record deleted successfully");
      }
    }
  };

  const handleRemoveFromMonth = async (hostId: string, hostName: string) => {
    if (confirm(`Remove ${hostName} from this month's view? (This will delete their ledger record for THIS MONTH only)`)) {
      const row = rowData[hostId];
      if (row?.clearingId) {
        await supabase.from('shop_clearings').delete().eq('id', row.clearingId);
        const newRowData = { ...rowData };
        delete newRowData[hostId];
        setRowData(newRowData);
      }
      setActiveHostIds(prev => {
        const next = new Set(prev);
        next.delete(hostId);
        return next;
      });
      showToast("Removed from this month's view.");
    }
  };

  const handleWhatsApp = async (hostId: string) => {
    const host = hosts.find((h) => h.id === hostId);
    const row = rowData[hostId] || {};
    const billMvr = parseFloat(row.billMvr) || 0;
    const rate = parseFloat(row.rate) || 15.42;
    const advances = row.advances || [];
    
    if (banks.length === 0) return showToast("Add a bank account first.", "error");
    
    const shopClearanceUsd = billMvr / rate;
    const totalAdvancesMvr = advances.reduce((sum: number, adv: any) => sum + (parseFloat(adv.amountMvr) || 0), 0);
    const totalDueUsd = shopClearanceUsd + (totalAdvancesMvr / rate);
    
    const today = new Date();
    const dateString = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
    
    let invoiceText = `*INVOICE*\nDate: ${dateString}\nBill To: ${host.name}\n\n`;
    if (shopClearanceUsd > 0) invoiceText += `• Shop Clearance ${shopClearanceUsd.toFixed(2)}$/-\n`;
    
    if (advances.length > 0) {
      advances.forEach((adv: any) => {
        const advUsd = (parseFloat(adv.amountMvr) || 0) / rate;
        const [y, m, d] = adv.date.split('-');
        invoiceText += `• Advance (${d}/${m}) ${advUsd.toFixed(2)}$/- (MVR ${adv.amountMvr})\n`;
      });
    }

    invoiceText += `\nTotal Due: ${totalDueUsd.toFixed(2)}$/-\n\n`;

    const bankDetailsText = banks.map(b => `🏦 ${b.account_name}\n${b.account_number}`).join('\n\n');
    const finalMessage = `${invoiceText}${bankDetailsText}`;

    try {
      window.open(`https://wa.me/?text=${encodeURIComponent(finalMessage)}`, "_blank");
      setRowData(prev => ({ ...prev, [hostId]: { ...prev[hostId], isMsgSent: true } }));
      if (row.clearingId) {
        await supabase.from('shop_clearings').update({ is_msg_sent: true }).eq('id', row.clearingId);
      }
    } catch (err) {
      showToast("Failed to open WhatsApp.", "error");
    }
  };

  const handleAddExistingHostToMonth = (hostId: string) => {
    setActiveHostIds(prev => {
      const next = new Set(prev);
      next.add(hostId);
      return next;
    });
    setShowAddUser(false);
    showToast("Client added to this month!");
  };

  const handleAddCustomer = async () => {
    if (!newHostName) return showToast("Enter Name.", "error");
    
    const finalHostNo = newHostNo || `H-${Math.floor(Math.random()*10000)}`;
    
    const { data, error } = await supabase.from('hosts').insert({ name: newHostName, host_no: finalHostNo }).select().single();
    if (data) {
      setHosts([...hosts, data]);
      setActiveHostIds(prev => new Set(prev).add(data.id));
      setNewHostName(""); setNewHostNo(""); setShowAddUser(false);
      showToast("Customer created and added!");
    } else {
      showToast("Error creating client", "error");
    }
  };

  const handleAddBank = async () => {
    if (!newBankName || !newBankNo) return showToast("Enter Bank details.", "error");
    const { data, error } = await supabase.from('bank_accounts').insert({ account_name: newBankName, account_number: newBankNo }).select().single();
    if (data) {
      setBanks([...banks, data]);
      setNewBankName(""); setNewBankNo("");
      showToast("Bank added!");
    }
  };

  const handleDeleteBank = async (id: string) => {
    const { error } = await supabase.from('bank_accounts').delete().eq('id', id);
    if (!error) { setBanks(banks.filter(b => b.id !== id)); showToast("Bank removed."); }
  };

  let globalInvestmentMvr = 0;
  let globalReceivedUsd = 0;
  let globalExpectedProfitMvr = 0;
  let globalPendingUsd = 0;
  const currentSellRate = parseFloat(sellingRate) || 0;

  Object.values(rowData).forEach(row => {
    const b = parseFloat(row.billMvr) || 0;
    const r = parseFloat(row.rate) || 15.42;
    const rec = parseFloat(row.received) || 0;
    const advs = row.advances || [];
    
    const totalAdvancesMvr = advs.reduce((sum: number, adv: any) => sum + (parseFloat(adv.amountMvr) || 0), 0);
    const rowInvestmentMvr = b + totalAdvancesMvr;
    const rowTotalUsdDue = rowInvestmentMvr / r;
    
    globalInvestmentMvr += rowInvestmentMvr;
    globalReceivedUsd += rec;
    globalPendingUsd += (rowTotalUsdDue - rec);

    const expectedProfit = (rowTotalUsdDue * currentSellRate) - (rowTotalUsdDue * r);
    globalExpectedProfitMvr += expectedProfit;
  });

  return (
    <main className="min-h-screen bg-[#F8FAFC] text-[#1E293B] font-sans antialiased flex selection:bg-sky-500/10">
      
      {toast && (
        <div className={`fixed top-6 right-1/2 translate-x-1/2 lg:translate-x-0 lg:right-6 z-[300] px-5 py-3.5 rounded-xl shadow-xl flex items-center gap-3 text-xs font-bold animate-in fade-in slide-in-from-top-4 duration-200 bg-slate-950 text-white`}>
          {toast.type === 'success' ? <CheckCircle2 size={16} className="text-emerald-400" /> : <AlertCircle size={16} className="text-rose-400" />}
          {toast.message}
        </div>
      )}

      {/* PREMIUM SIDEBAR FOR PC DOCK */}
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
          <Link href="/shop-clearing" className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold bg-slate-900 text-white shadow-sm transition-all duration-200"><ShoppingCart size={18}/> Clearing</Link>
          <Link href="/myself" className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium hover:bg-slate-50 text-slate-500 hover:text-slate-900 transition-all duration-150"><User size={18}/> Myself</Link>
        </nav>
        <button className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-slate-400 hover:text-slate-600 transition-colors duration-150"><Settings size={18}/> Settings</button>
      </aside>

      {/* CORE FRAME CONTAINER */}
      <div className="flex-grow flex flex-col min-h-screen overflow-y-auto bg-[#F8FAFC]">
        <div className="w-full max-w-[1140px] mx-auto px-4 lg:px-8 py-6 lg:py-8 pb-40">
          
          <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
            <div>
              <h2 className="text-xl lg:text-2xl font-bold tracking-tight text-slate-900">Ledger</h2>
              <div className="flex items-center gap-3 mt-1.5">
                <input type="month" value={clearingMonth} onChange={e => setClearingMonth(e.target.value)} className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"/>
                <div className="flex items-center bg-white border border-slate-200 rounded-lg px-2.5 py-1">
                  <span className="text-[10px] font-bold uppercase text-slate-400 mr-2">Sell Rate</span>
                  <input type="number" value={sellingRate} onChange={handleRateChange} className="w-14 bg-transparent border-none p-0 text-xs font-bold text-slate-800 focus:outline-none focus:ring-0" />
                </div>
              </div>
            </div>
            <div className="flex gap-2 w-full md:w-auto">
              <button onClick={() => setShowBanks(true)} className="flex-1 md:flex-none h-10 px-4 rounded-xl bg-white border border-slate-200/60 flex items-center justify-center gap-2 shadow-sm text-slate-700 font-semibold text-xs uppercase tracking-wider hover:bg-slate-50 active:scale-95 transition-all"><Landmark size={14}/> Banks</button>
              <button onClick={() => setShowAddUser(true)} className="flex-1 md:flex-none h-10 px-4 rounded-xl bg-slate-900 flex items-center justify-center gap-2 shadow-sm text-white font-semibold text-xs uppercase tracking-wider active:scale-95 transition-all"><UserPlus size={14}/> Add Client</button>
            </div>
          </header>

          {/* BRIGHT METRIC SUMMARY ROW */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5 mb-8">
            <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Total Investment</p>
              <p className="text-xl font-extrabold text-slate-900">MVR {globalInvestmentMvr.toLocaleString(undefined, {maximumFractionDigits:0})}</p>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Total Pending</p>
              <p className="text-xl font-extrabold text-amber-600">${globalPendingUsd.toFixed(2)}</p>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Total Received</p>
              <p className="text-xl font-extrabold text-emerald-600">${globalReceivedUsd.toFixed(2)}</p>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-[0_2px_12px_rgba(0,0,0,0.02)] overflow-hidden relative">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1"><TrendingUp size={13} className="text-emerald-500"/> Est. Profit</p>
              <p className="text-xl font-extrabold text-emerald-600">MVR {globalExpectedProfitMvr.toLocaleString(undefined, {maximumFractionDigits:0})}</p>
            </div>
          </div>

          {/* ACTIVE CUSTOMER CARD LISTING */}
          <div className="space-y-4">
            {hosts.filter(h => activeHostIds.has(h.id)).map(host => {
              const row = rowData[host.id] || { billMvr: "", rate: "15.42", advances: [], received: "" };
              const b = parseFloat(row.billMvr) || 0;
              const r = parseFloat(row.rate) || 15.42;
              const advances = row.advances || [];
              const rec = parseFloat(row.received) || 0;
              
              const totalAdvancesMvr = advances.reduce((sum: number, adv: any) => sum + (parseFloat(adv.amountMvr) || 0), 0);
              const totalDueUsd = (b + totalAdvancesMvr) / r;
              const remaining = totalDueUsd - rec;
              const isFullyPaid = remaining <= 0.01 && totalDueUsd > 0;

              return (
                <div key={host.id} className="bg-white rounded-2xl p-5 shadow-[0_2px_12px_rgba(0,0,0,0.02)] border border-slate-200/60 flex flex-col lg:flex-row gap-5 lg:items-stretch transition-all hover:shadow-md">
                  
                  <div className="lg:w-44 flex-shrink-0 flex justify-between lg:flex-col lg:justify-start">
                    <div>
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <h3 className="font-bold text-base text-slate-900 max-w-[130px] truncate">{host.name}</h3>
                        <button onClick={() => handleRemoveFromMonth(host.id, host.name)} title="Remove from month" className="text-slate-300 hover:text-rose-500 transition-colors"><X size={14} /></button>
                      </div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">ID: {host.host_no}</p>
                      
                      {isFullyPaid ? (
                        <span className="bg-emerald-50 text-emerald-600 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider border border-emerald-100">Paid</span>
                      ) : (
                        <p className="text-[9px] font-bold uppercase text-amber-600 bg-amber-50 border border-amber-100 inline-block px-1.5 py-0.5 rounded">Owes: ${remaining.toFixed(2)}</p>
                      )}
                    </div>
                    {row.clearingId && (
                      <button onClick={() => handleDeleteClearing(host.id)} title="Clear record" className="text-slate-400 hover:text-rose-500 mt-4 lg:mt-auto bg-slate-50 hover:bg-rose-50 w-8 h-8 rounded-xl flex items-center justify-center transition-colors border border-slate-100"><Trash2 size={14}/></button>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-3 lg:w-64 flex-shrink-0">
                    <div className="flex flex-col"><label className="text-[9px] font-bold uppercase text-slate-400 mb-1 pl-0.5">Bill (MVR)</label><input type="number" placeholder="0" value={row.billMvr} onChange={(e) => handleRowChange(host.id, "billMvr", e.target.value)} className="bg-slate-50 border border-slate-100 rounded-xl p-2.5 text-xs font-semibold focus:outline-none" /></div>
                    <div className="flex flex-col"><label className="text-[9px] font-bold uppercase text-slate-400 mb-1 pl-0.5">Rate</label><input type="number" value={row.rate} onChange={(e) => handleRowChange(host.id, "rate", e.target.value)} className="bg-slate-50 border border-slate-100 rounded-xl p-2.5 text-xs font-semibold focus:outline-none" /></div>
                    <div className="flex flex-col"><label className="text-[9px] font-bold uppercase text-emerald-600 mb-1 pl-0.5">Recv ($)</label><input type="number" placeholder="0" value={row.received} onChange={(e) => handleRowChange(host.id, "received", e.target.value)} className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-2.5 text-xs font-bold text-emerald-700 focus:outline-none" /></div>
                  </div>

                  <div className="flex-grow bg-slate-50/60 rounded-xl p-4 border border-slate-100">
                    <div className="flex justify-between items-center mb-2.5">
                      <h4 className="text-[9px] font-bold uppercase text-slate-400 tracking-wider">Advances (MVR)</h4>
                      <button onClick={() => addAdvance(host.id)} className="text-sky-600 bg-white border border-slate-200 font-bold text-[9px] uppercase flex items-center gap-0.5 px-2 py-0.5 rounded shadow-xs active:scale-95 transition-transform"><Plus size={11}/> Add</button>
                    </div>
                    <div className="space-y-2">
                      {advances.length === 0 && <p className="text-xs text-slate-400 italic">No advances recorded.</p>}
                      {advances.map((adv: any, i: number) => (
                        <div key={i} className="flex gap-1.5 items-center">
                          <input type="date" value={adv.date} onChange={e => updateAdvance(host.id, i, "date", e.target.value)} className="w-28 bg-white border border-slate-200 rounded-lg p-1.5 text-xs font-semibold focus:outline-none text-slate-500"/>
                          <input type="number" placeholder="MVR Amount" value={adv.amountMvr} onChange={e => updateAdvance(host.id, i, "amountMvr", e.target.value)} className="flex-grow bg-white border border-slate-200 rounded-lg p-1.5 text-xs font-semibold focus:outline-none"/>
                          <button onClick={() => removeAdvance(host.id, i)} className="text-slate-300 hover:text-rose-500 p-0.5"><X size={14}/></button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex lg:flex-col gap-2 lg:w-24 flex-shrink-0">
                    <button onClick={() => handleWhatsApp(host.id)} className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 lg:py-0 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all ${row.isMsgSent ? 'bg-sky-50 text-sky-600 border border-sky-100' : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'}`}><Send size={12}/> WA</button>
                    <button onClick={() => handleSaveToDatabase(host.id)} className="flex-1 bg-slate-900 text-white py-2.5 lg:py-0 rounded-xl font-bold text-[10px] uppercase tracking-wider active:scale-95 transition-all shadow-xs">Save</button>
                  </div>
                </div>
              );
            })}
            
            {hosts.filter(h => activeHostIds.has(h.id)).length === 0 && (
              <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-200 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
                <p className="font-semibold text-slate-400 text-sm">No clients active in this month yet.</p>
                <button onClick={() => setShowAddUser(true)} className="mt-3 px-3.5 py-2 bg-sky-50 text-sky-600 rounded-xl font-bold text-[10px] uppercase tracking-wider border border-sky-100">Add Client to Month</button>
              </div>
            )}
          </div>
        </div>

        {/* 2026 FLOATING NAV DOCK FOR MOBILE PLATFORMS */}
        <nav className="lg:hidden fixed bottom-5 left-1/2 -translate-x-1/2 w-[92%] max-w-[360px] h-14 bg-white/90 border border-slate-200/60 shadow-[0_8px_30px_rgba(0,0,0,0.06)] rounded-xl flex justify-around items-center px-2 z-[100] backdrop-blur-md">
          <Link href="/" className="text-slate-400 hover:text-slate-800 transition-colors active:scale-95"><Wallet size={18} /></Link>
          <Link href="/tracker" className="text-slate-400 hover:text-slate-800 transition-colors active:scale-95"><Banknote size={18} /></Link>
          <Link href="/splitter" className="text-slate-400 hover:text-slate-800 transition-colors active:scale-95"><Calculator size={18} /></Link>
          <Link href="/shop-clearing" className="text-slate-900 transition-transform duration-200 active:scale-95"><ShoppingCart size={18} className="bg-slate-100 p-2 w-8 h-8 rounded-lg" /></Link>
          <Link href="/myself" className="text-slate-400 hover:text-slate-800 transition-colors active:scale-95"><User size={18} /></Link>
        </nav>
      </div>

      {showAddUser && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs z-[300] flex justify-center items-end sm:items-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-t-2xl sm:rounded-2xl p-5 shadow-2xl flex flex-col max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-bold tracking-tight text-slate-900">Add Client to Month</h3>
              <button onClick={() => setShowAddUser(false)} className="bg-slate-50 p-1.5 rounded-full text-slate-400 hover:bg-slate-100"><X size={15}/></button>
            </div>
            
            <div className="space-y-4 mb-5">
              <div>
                <h4 className="text-[9px] font-bold text-slate-400 mb-1.5 uppercase tracking-wider">Add Existing Client</h4>
                <div className="max-h-28 overflow-y-auto space-y-1.5 bg-slate-50/50 rounded-xl p-2 border border-slate-100">
                  {hosts.filter(h => !activeHostIds.has(h.id)).length === 0 && <p className="text-[9px] text-center p-2 text-slate-400 font-medium">All clients active this month.</p>}
                  {hosts.filter(h => !activeHostIds.has(h.id)).map(h => (
                    <div key={h.id} className="flex justify-between items-center p-2 bg-white rounded-lg shadow-xs border border-slate-100">
                      <span className="text-xs font-bold text-slate-700">{h.name}</span>
                      <button onClick={() => handleAddExistingHostToMonth(h.id)} className="text-[9px] bg-sky-50 text-sky-600 px-2 py-0.5 rounded font-bold uppercase border border-sky-100">Add</button>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="relative pt-3.5 border-t border-slate-100">
                <h4 className="text-[9px] font-bold text-slate-400 mb-1.5 uppercase tracking-wider">Or Create New Client</h4>
                <input type="text" list="directory-suggestions" placeholder="Full Name (Pick from Directory)" value={newHostName} onChange={e => setNewHostName(e.target.value)} className="w-full bg-slate-50 border border-slate-100 p-2.5 rounded-xl text-xs font-semibold focus:outline-none mb-2" />
                <datalist id="directory-suggestions">
                  {directory.map(d => <option key={d.id} value={d.name} />)}
                </datalist>
                <input type="text" placeholder="Host No. / ID (Optional)" value={newHostNo} onChange={e => setNewHostNo(e.target.value)} className="w-full bg-slate-50 border border-slate-100 p-2.5 rounded-xl text-xs font-semibold focus:outline-none" />
              </div>
            </div>
            
            <button onClick={handleAddCustomer} className="w-full bg-slate-900 text-white p-3 rounded-xl font-bold text-xs uppercase tracking-wider shadow-sm active:scale-95 transition-transform">Save & Add Client</button>
          </div>
        </div>
      )}

      {showBanks && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs z-[300] flex justify-center items-end sm:items-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-t-2xl sm:rounded-2xl p-5 shadow-2xl flex flex-col max-h-[80vh] overflow-y-auto">
            <div className="fixed justify-between items-center mb-4">
              <h3 className="text-base font-bold tracking-tight text-slate-900">Deposit Accounts</h3>
              <button onClick={() => setShowBanks(false)} className="bg-slate-50 p-1.5 rounded-full text-slate-400 hover:bg-slate-100"><X size={15}/></button>
            </div>
            <div className="flex gap-1.5 mb-4">
              <input type="text" placeholder="Bank" value={newBankName} onChange={e => setNewBankName(e.target.value)} className="w-1/2 bg-slate-50 border border-slate-100 p-2 rounded-xl text-xs font-semibold focus:outline-none" />
              <input type="text" placeholder="Account No." value={newBankNo} onChange={e => setNewBankNo(e.target.value)} className="w-1/2 bg-slate-50 border border-slate-100 p-2 rounded-xl text-xs font-semibold focus:outline-none" />
              <button onClick={handleAddBank} className="bg-slate-900 text-white px-3.5 rounded-xl active:scale-95 transition-transform flex items-center justify-center"><Plus size={15}/></button>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {banks.length === 0 && <p className="text-xs text-slate-400 italic text-center py-4">No bank accounts added.</p>}
              {banks.map(bank => (
                <div key={bank.id} className="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <div>
                    <p className="text-xs font-bold text-slate-700">{bank.account_name}</p>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">{bank.account_number}</p>
                  </div>
                  <button onClick={() => handleDeleteBank(bank.id)} className="text-slate-400 p-1.5 hover:text-rose-500 transition-colors"><Trash2 size={14}/></button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </main>
  );
}