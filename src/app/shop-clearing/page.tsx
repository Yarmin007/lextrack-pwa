"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Wallet, Plus, ShoppingCart, CheckCircle2, AlertCircle, Trash2, UserPlus, Landmark, X, Send, Calculator, Settings, PieChart, TrendingUp, UserMinus } from "lucide-react";
import Link from "next/link";

export default function ShopClearingPage() {
  const [hosts, setHosts] = useState<any[]>([]);
  const [banks, setBanks] = useState<any[]>([]);
  
  // Modal states
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
      if (hostsData) setHosts(hostsData);
      if (banksData) setBanks(banksData);

      const { data: clearingsData } = await supabase
        .from('shop_clearings')
        .select('*')
        .eq('clearing_month', `${clearingMonth}-01`);

      const newRowData: Record<string, any> = {};
      if (clearingsData) {
        clearingsData.forEach((c) => {
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
      if (error) showToast("Error saving data.", "error");
      else showToast("Ledger updated!");
    } else {
      const { data, error } = await supabase.from('shop_clearings').insert(payload).select().single();
      if (error) showToast("Error saving data.", "error");
      if (data) {
        setRowData(prev => ({ ...prev, [hostId]: { ...prev[hostId], clearingId: data.id } }));
        showToast("Ledger saved!");
      }
    }
  };

  const handleDeleteClearing = async (hostId: string) => {
    const row = rowData[hostId];
    if (!row?.clearingId) return;
    
    if (confirm("Are you sure you want to delete this month's record for this customer?")) {
      const { error } = await supabase.from('shop_clearings').delete().eq('id', row.clearingId);
      if (error) {
        showToast("Error deleting record", "error");
      } else {
        const newRowData = { ...rowData };
        delete newRowData[hostId];
        setRowData(newRowData);
        showToast("Record deleted successfully");
      }
    }
  };

  const handleDeleteHost = async (hostId: string, hostName: string) => {
    if (confirm(`Are you sure you want to PERMANENTLY delete client ${hostName}? This cannot be undone.`)) {
      const { error } = await supabase.from('hosts').delete().eq('id', hostId);
      if (error) {
        showToast("Error deleting client.", "error");
      } else {
        setHosts(hosts.filter(h => h.id !== hostId));
        const newRowData = { ...rowData };
        delete newRowData[hostId];
        setRowData(newRowData);
        showToast("Client permanently deleted.");
      }
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

    // Completely stripped formatting so WhatsApp detects the bank link below
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

  const handleAddCustomer = async () => {
    if (!newHostName || !newHostNo) return showToast("Enter Name and Host No.", "error");
    const { data, error } = await supabase.from('hosts').insert({ name: newHostName, host_no: newHostNo }).select().single();
    if (error) return showToast("Error adding customer.", "error");
    if (data) {
      setHosts([...hosts, data]);
      setNewHostName(""); setNewHostNo("");
      setShowAddUser(false);
      showToast("Customer added!");
    }
  };

  const handleAddBank = async () => {
    if (!newBankName || !newBankNo) return showToast("Enter Bank details.", "error");
    const { data, error } = await supabase.from('bank_accounts').insert({ account_name: newBankName, account_number: newBankNo }).select().single();
    if (error) return showToast("Error adding bank.", "error");
    if (data) {
      setBanks([...banks, data]);
      setNewBankName(""); setNewBankNo("");
      showToast("Bank added!");
    }
  };

  const handleDeleteBank = async (id: string) => {
    const { error } = await supabase.from('bank_accounts').delete().eq('id', id);
    if (!error) {
      setBanks(banks.filter(b => b.id !== id));
      showToast("Bank removed.");
    }
  };

  // --- Global Math Calculations ---
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
    <main className="min-h-screen bg-[#F0F4F8] text-[#364d54] font-sans flex relative">
      
      {/* TOAST NOTIFICATIONS */}
      {toast && (
        <div className={`fixed top-6 right-1/2 translate-x-1/2 lg:translate-x-0 lg:right-6 z-[300] px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 text-sm font-bold animate-in fade-in slide-in-from-top-5 duration-300 ${toast.type === 'success' ? 'bg-[#3a5b5e] text-white' : 'bg-red-500 text-white'}`}>
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
          <Link href="/splitter" className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-sm font-bold hover:bg-[#F8FAFB] text-[#A0AEC0] transition-all"><Calculator size={20}/> Splitter</Link>
          <Link href="/shop-clearing" className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-sm font-bold bg-[#3a5b5e] text-white shadow-lg transition-all"><ShoppingCart size={20}/> Clearing</Link>
          <Link href="#" className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-sm font-bold hover:bg-[#F8FAFB] text-[#A0AEC0] transition-all"><PieChart size={20}/> Analytics</Link>
        </nav>
        <button className="flex items-center gap-4 px-5 py-4 text-sm font-bold opacity-40 hover:opacity-100 transition-opacity"><Settings size={20}/> Settings</button>
      </aside>

      {/* 2. MAIN CONTENT AREA */}
      <div className="flex-grow flex flex-col min-h-screen bg-[#F0F4F8] overflow-y-auto">
        <div className="w-full max-w-[1200px] mx-auto px-4 lg:px-8 py-6 lg:py-10 pb-40">
          
          {/* Header & Controls */}
          <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
            <div>
              <h2 className="text-2xl lg:text-3xl font-black tracking-tight">Ledger</h2>
              <div className="flex items-center gap-3 mt-1">
                <input type="month" value={clearingMonth} onChange={e => setClearingMonth(e.target.value)} className="bg-white border border-[#E0E7E9] rounded-lg px-2 py-1 text-xs font-bold text-[#5fa4ad] cursor-pointer"/>
                <div className="flex items-center bg-white border border-[#E0E7E9] rounded-lg px-2 py-1">
                  <span className="text-[10px] font-black uppercase text-[#A0AEC0] mr-2">Sell Rate</span>
                  <input type="number" value={sellingRate} onChange={handleRateChange} className="w-16 bg-transparent border-none p-0 text-xs font-bold text-[#3a5b5e] focus:ring-0" />
                </div>
              </div>
            </div>
            <div className="flex gap-2 w-full md:w-auto">
              <button onClick={() => setShowBanks(true)} className="flex-1 md:flex-none h-11 px-4 rounded-xl bg-white border border-[#E0E7E9] flex items-center justify-center gap-2 shadow-sm text-[#364d54] font-bold text-xs"><Landmark size={16}/> Banks</button>
              <button onClick={() => setShowAddUser(true)} className="flex-1 md:flex-none h-11 px-4 rounded-xl bg-[#3a5b5e] flex items-center justify-center gap-2 shadow-sm text-white font-bold text-xs"><UserPlus size={16}/> Add Client</button>
            </div>
          </header>

          {/* Business Analytics Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-6 mb-8">
            <div className="bg-white p-5 rounded-3xl border border-[#E0E7E9] shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-widest text-[#A0AEC0] mb-1">Total Investment</p>
              <p className="text-xl lg:text-2xl font-black text-[#364d54]">MVR {globalInvestmentMvr.toFixed(0)}</p>
            </div>
            <div className="bg-white p-5 rounded-3xl border border-[#E0E7E9] shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-widest text-[#A0AEC0] mb-1">Total Pending</p>
              <p className="text-xl lg:text-2xl font-black text-orange-500">${globalPendingUsd.toFixed(2)}</p>
            </div>
            <div className="bg-white p-5 rounded-3xl border border-[#E0E7E9] shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-widest text-[#A0AEC0] mb-1">Total Received</p>
              <p className="text-xl lg:text-2xl font-black text-green-500">${globalReceivedUsd.toFixed(2)}</p>
            </div>
            <div className="bg-[#3a5b5e] p-5 rounded-3xl shadow-xl text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-xl -mr-6 -mt-6" />
              <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1 flex items-center gap-1"><TrendingUp size={12}/> Est. Profit</p>
              <p className="text-xl lg:text-2xl font-black text-green-300">MVR {globalExpectedProfitMvr.toFixed(0)}</p>
            </div>
          </div>

          {/* Desktop & Mobile Responsive List */}
          <div className="space-y-4">
            {hosts.map(host => {
              const row = rowData[host.id] || { billMvr: "", rate: "15.42", advances: [], received: "" };
              
              const b = parseFloat(row.billMvr) || 0;
              const r = parseFloat(row.rate) || 15.42;
              const advs = row.advances || [];
              const rec = parseFloat(row.received) || 0;
              
              const totalAdvancesMvr = advs.reduce((sum: number, adv: any) => sum + (parseFloat(adv.amountMvr) || 0), 0);
              const totalDueUsd = (b + totalAdvancesMvr) / r;
              const remaining = totalDueUsd - rec;
              const isFullyPaid = remaining <= 0.01 && totalDueUsd > 0;

              return (
                <div key={host.id} className="bg-white rounded-[2rem] p-5 shadow-sm border border-[#E0E7E9] flex flex-col lg:flex-row gap-6 lg:items-stretch">
                  
                  {/* Left: Info */}
                  <div className="lg:w-48 flex-shrink-0 flex justify-between lg:flex-col lg:justify-start">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-black text-lg text-[#364d54]">{host.name}</h3>
                        {/* Icon-only Delete Button */}
                        <button onClick={() => handleDeleteHost(host.id, host.name)} title="Permanently delete client" className="text-gray-300 hover:text-red-500 transition-colors">
                          <UserMinus size={14} />
                        </button>
                      </div>
                      
                      <p className="text-[10px] font-bold text-[#A0AEC0] uppercase tracking-wider mb-2">Host: {host.host_no}</p>
                      
                      {isFullyPaid ? (
                        <span className="bg-green-100 text-green-600 text-[10px] font-black px-2 py-1 rounded-md uppercase tracking-wider">Paid</span>
                      ) : (
                        <p className="text-[10px] font-black uppercase text-orange-500 bg-orange-50 inline-block px-2 py-1 rounded-md mb-2">Owes: ${remaining.toFixed(2)}</p>
                      )}
                    </div>

                    {/* Clear Month Record Button */}
                    {row.clearingId && (
                      <button onClick={() => handleDeleteClearing(host.id)} title="Clear this month's record" className="text-red-300 hover:text-red-500 mt-auto bg-red-50 w-8 h-8 rounded-full flex items-center justify-center transition-colors">
                        <Trash2 size={14}/>
                      </button>
                    )}
                  </div>

                  {/* Middle: Primary Inputs */}
                  <div className="grid grid-cols-3 gap-3 lg:w-72 flex-shrink-0">
                    <div className="flex flex-col">
                      <label className="text-[9px] font-black uppercase text-[#A0AEC0] mb-1 pl-1">Bill (MVR)</label>
                      <input type="number" placeholder="0" value={row.billMvr} onChange={(e) => handleRowChange(host.id, "billMvr", e.target.value)} className="bg-[#F8FAFB] border-none rounded-xl p-3 text-sm font-bold focus:ring-1 focus:ring-[#5fa4ad]" />
                    </div>
                    <div className="flex flex-col">
                      <label className="text-[9px] font-black uppercase text-[#A0AEC0] mb-1 pl-1">Rate</label>
                      <input type="number" value={row.rate} onChange={(e) => handleRowChange(host.id, "rate", e.target.value)} className="bg-[#F8FAFB] border-none rounded-xl p-3 text-sm font-bold focus:ring-1 focus:ring-[#5fa4ad]" />
                    </div>
                    <div className="flex flex-col">
                      <label className="text-[9px] font-black uppercase text-green-600 mb-1 pl-1">Recv ($)</label>
                      <input type="number" placeholder="0" value={row.received} onChange={(e) => handleRowChange(host.id, "received", e.target.value)} className="bg-green-50 border-none rounded-xl p-3 text-sm font-bold text-green-700 focus:ring-1 focus:ring-green-400" />
                    </div>
                  </div>

                  {/* Middle 2: Advances Array */}
                  <div className="flex-grow bg-[#F8FAFB] rounded-2xl p-4 border border-[#E0E7E9]/50">
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="text-[10px] font-black uppercase text-[#A0AEC0] tracking-widest">Advances (MVR)</h4>
                      <button onClick={() => addAdvance(host.id)} className="text-[#5fa4ad] font-bold text-[10px] uppercase flex items-center gap-1 bg-white px-2 py-1 rounded shadow-sm"><Plus size={12}/> Add</button>
                    </div>
                    <div className="space-y-2">
                      {advs.length === 0 && <p className="text-xs text-gray-400 italic">No advances recorded.</p>}
                      {advs.map((adv: any, i: number) => (
                        <div key={i} className="flex gap-2 items-center">
                          <input type="date" value={adv.date} onChange={e => updateAdvance(host.id, i, "date", e.target.value)} className="w-32 bg-white border-none rounded-lg p-2 text-xs font-bold text-[#A0AEC0] focus:ring-1 focus:ring-[#5fa4ad]"/>
                          <input type="number" placeholder="MVR Amount" value={adv.amountMvr} onChange={e => updateAdvance(host.id, i, "amountMvr", e.target.value)} className="flex-grow bg-white border-none rounded-lg p-2 text-xs font-bold focus:ring-1 focus:ring-[#5fa4ad]"/>
                          <button onClick={() => removeAdvance(host.id, i)} className="text-red-300 hover:text-red-500 p-1"><X size={16}/></button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex lg:flex-col gap-2 lg:w-28 flex-shrink-0">
                    <button onClick={() => handleWhatsApp(host.id)} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${row.isMsgSent ? 'bg-[#e0f2fe] text-[#0284c7]' : 'bg-white border border-[#E0E7E9] text-[#5fa4ad] hover:bg-gray-50'}`}>
                      <Send size={14}/> WA
                    </button>
                    <button onClick={() => handleSaveToDatabase(host.id)} className="flex-1 bg-[#3a5b5e] text-white py-3 rounded-xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all shadow-md">
                      Save
                    </button>
                  </div>

                </div>
              );
            })}
          </div>

        </div>

        {/* MOBILE BOTTOM NAV - Pill Shaped */}
        <nav className="lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-[400px] h-16 bg-white shadow-[0_10px_40px_rgba(0,0,0,0.1)] rounded-full border border-gray-100 flex justify-around items-center px-6 z-[100]">
          <Link href="/" className="text-gray-400 hover:text-[#3a5b5e] transition-colors"><Wallet size={20} /></Link>
          <button className="text-gray-400 hover:text-[#3a5b5e] transition-colors">
            <Plus size={24} className="bg-gray-50 hover:bg-[#e0f2fe] p-1.5 rounded-xl transition-all" />
          </button>
          <Link href="/splitter" className="text-gray-400 hover:text-[#3a5b5e] transition-colors"><Calculator size={20} /></Link>
          <Link href="/shop-clearing" className="text-[#3a5b5e]"><ShoppingCart size={20} /></Link>
        </nav>
      </div>

      {/* --- MODALS --- */}
      
      {/* Add User Modal */}
      {showAddUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[300] flex justify-center items-end sm:items-center">
          <div className="bg-white w-full max-w-md rounded-t-[2rem] sm:rounded-[2rem] p-6 animate-in slide-in-from-bottom-8">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-black tracking-tight">New Customer</h3>
              <button onClick={() => setShowAddUser(false)} className="bg-gray-100 p-2 rounded-full text-gray-500 hover:bg-gray-200"><X size={16}/></button>
            </div>
            <div className="space-y-3 mb-6">
              <input type="text" placeholder="Full Name" value={newHostName} onChange={e => setNewHostName(e.target.value)} className="w-full bg-gray-50 border-none p-4 rounded-2xl font-bold focus:ring-2 focus:ring-[#5fa4ad]" />
              <input type="text" placeholder="Host No. / ID" value={newHostNo} onChange={e => setNewHostNo(e.target.value)} className="w-full bg-gray-50 border-none p-4 rounded-2xl font-bold focus:ring-2 focus:ring-[#5fa4ad]" />
            </div>
            <button onClick={handleAddCustomer} className="w-full bg-[#3a5b5e] text-white p-4 rounded-2xl font-black uppercase tracking-widest shadow-lg active:scale-95 transition-transform">Save Customer</button>
          </div>
        </div>
      )}

      {/* Manage Banks Modal */}
      {showBanks && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[300] flex justify-center items-end sm:items-center">
          <div className="bg-white w-full max-w-md rounded-t-[2rem] sm:rounded-[2rem] p-6 animate-in slide-in-from-bottom-8 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-black tracking-tight">Deposit Accounts</h3>
              <button onClick={() => setShowBanks(false)} className="bg-gray-100 p-2 rounded-full text-gray-500 hover:bg-gray-200"><X size={16}/></button>
            </div>
            
            <div className="flex gap-2 mb-6">
              <input type="text" placeholder="Bank Name" value={newBankName} onChange={e => setNewBankName(e.target.value)} className="w-1/2 bg-gray-50 border-none p-3 rounded-xl text-sm font-bold focus:ring-2 focus:ring-[#5fa4ad]" />
              <input type="text" placeholder="Account No." value={newBankNo} onChange={e => setNewBankNo(e.target.value)} className="w-1/2 bg-gray-50 border-none p-3 rounded-xl text-sm font-bold focus:ring-2 focus:ring-[#5fa4ad]" />
              <button onClick={handleAddBank} className="bg-[#3a5b5e] text-white px-4 rounded-xl active:scale-95 transition-transform"><Plus size={16}/></button>
            </div>

            <div className="space-y-2">
              {banks.length === 0 && <p className="text-xs text-gray-400 italic text-center py-4">No bank accounts added.</p>}
              {banks.map(bank => (
                <div key={bank.id} className="flex justify-between items-center bg-gray-50 p-3 rounded-xl">
                  <div>
                    <p className="text-xs font-bold text-[#364d54]">{bank.account_name}</p>
                    <p className="text-[10px] text-gray-400 font-mono">{bank.account_number}</p>
                  </div>
                  <button onClick={() => handleDeleteBank(bank.id)} className="text-red-400 p-2 hover:text-red-600 transition-colors"><Trash2 size={16}/></button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </main>
  );
}