"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Wallet, Landmark, Plus, ReceiptText, User, Bell, Settings, PieChart, ShoppingCart, CheckCircle2, AlertCircle, Trash2 } from "lucide-react";
import Link from "next/link";

export default function ShopClearingPage() {
  const [hosts, setHosts] = useState<{ id: string; name: string; host_no: string }[]>([]);
  const [banks, setBanks] = useState<{ id: string; account_name: string; account_number: string }[]>([]);
  
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  
  const [rowData, setRowData] = useState<Record<string, { clearingId?: string; billMvr: string; rate: string; isPaid: boolean; isMsgSent: boolean }>>({});
  
  const [clearingMonth, setClearingMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const [newHostName, setNewHostName] = useState("");
  const [newHostNo, setNewHostNo] = useState("");
  const [newBankName, setNewBankName] = useState("");
  const [newBankNo, setNewBankNo] = useState("");

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
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
            billMvr: c.bill_amount_mvr.toString(),
            rate: c.applied_rate.toString(),
            isPaid: c.is_paid,
            isMsgSent: c.is_msg_sent
          };
        });
      }
      setRowData(newRowData);
    }
    fetchMonthData();
  }, [clearingMonth]);

  const handleRowChange = (hostId: string, field: "billMvr" | "rate", value: string) => {
    setRowData((prev) => {
      const existingRow = prev[hostId] || { billMvr: "", rate: "", isPaid: false, isMsgSent: false };
      return {
        ...prev,
        [hostId]: {
          ...existingRow,
          [field]: value || "", // Prevents "uncontrolled input" error
        },
      };
    });
  };

  const handleAddCustomer = async () => {
    if (!newHostName || !newHostNo) {
      showToast("Please enter both Name and Host No.", "error");
      return;
    }
    const { data, error } = await supabase.from('hosts').insert({ name: newHostName, host_no: newHostNo }).select().single();
    if (error) { showToast("Error adding customer. (Check RLS Settings)", "error"); return; }
    if (data) {
      setHosts([...hosts, data]);
      setNewHostName("");
      setNewHostNo("");
      showToast("Customer added successfully!");
    }
  };

  const handleAddBank = async () => {
    if (!newBankName || !newBankNo) {
      showToast("Please enter Bank Name and Account Number.", "error");
      return;
    }
    const { data, error } = await supabase.from('bank_accounts').insert({ account_name: newBankName, account_number: newBankNo }).select().single();
    if (error) { showToast("Error adding bank account. (Check RLS Settings)", "error"); return; }
    if (data) {
      setBanks([...banks, data]);
      setNewBankName("");
      setNewBankNo("");
      showToast("Bank account added!");
    }
  };

  const handleDeleteBank = async (id: string) => {
    const { error } = await supabase.from('bank_accounts').delete().eq('id', id);
    if (!error) {
      setBanks(banks.filter(b => b.id !== id));
      showToast("Bank account removed.");
    }
  };

  const handleSaveToDatabase = async (hostId: string) => {
    const row = rowData[hostId];
    if (!row?.billMvr || !row?.rate) {
      showToast("Please fill Bill and Rate before saving.", "error");
      return;
    }
    
    const payload = {
      host_id: hostId,
      clearing_month: `${clearingMonth}-01`,
      bill_amount_mvr: parseFloat(row.billMvr),
      applied_rate: parseFloat(row.rate),
      is_paid: row.isPaid || false,
      is_msg_sent: row.isMsgSent || false
    };

    if (row.clearingId) {
      const { error } = await supabase.from('shop_clearings').update(payload).eq('id', row.clearingId);
      if (error) showToast("Error updating data.", "error");
      else showToast(`Updated data for ${hosts.find(h => h.id === hostId)?.name}!`);
    } else {
      const { data, error } = await supabase.from('shop_clearings').insert(payload).select().single();
      if (error) showToast("Error saving data. (Check RLS Settings)", "error");
      if (data) {
        setRowData(prev => ({ ...prev, [hostId]: { ...prev[hostId], clearingId: data.id } }));
        showToast(`Saved data for ${hosts.find(h => h.id === hostId)?.name}!`);
      }
    }
  };

  const handleWhatsApp = async (hostId: string) => {
    const host = hosts.find((h) => h.id === hostId);
    const row = rowData[hostId];

    if (!host || !row?.billMvr || !row?.rate) {
      showToast("Please enter the Bill and Rate first.", "error");
      return;
    }
    if (banks.length === 0) {
      showToast("Please add at least one bank account in settings.", "error");
      return;
    }

    const usdAmount = (parseFloat(row.billMvr) / parseFloat(row.rate)).toFixed(2);
    const today = new Date();
    const dateString = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
    
    // FORMAT FIX: Adding explicit "Account:" label and divider for better WhatsApp detection
    const invoiceText = `*INVOICE*\nDate: ${dateString}\nBill To: ${host.name}\n\n- Shop Clearence ${usdAmount}$/-`;
    const bankDetailsText = banks.map(b => `🏦 *${b.account_name}*\nAccount: ${b.account_number}`).join('\n\n');
    const finalMessage = `${invoiceText}\n\n━━━━━━━━━━━━━━━\n\n${bankDetailsText}`;

    try {
      const encodedText = encodeURIComponent(finalMessage);
      window.open(`https://wa.me/?text=${encodedText}`, "_blank");
      
      setRowData(prev => ({ ...prev, [hostId]: { ...prev[hostId], isMsgSent: true } }));
      if (row.clearingId) {
        await supabase.from('shop_clearings').update({ is_msg_sent: true }).eq('id', row.clearingId);
      }
      showToast("Invoice opened in WhatsApp!");
    } catch (err) {
      showToast("Failed to open WhatsApp.", "error");
    }
  };

  const togglePaidStatus = async (hostId: string) => {
    const row = rowData[hostId];
    if (!row?.clearingId) {
      showToast("Please hit 'Save' first before marking as Paid.", "error");
      return;
    }

    const newPaidStatus = !row.isPaid;
    
    setRowData(prev => ({ ...prev, [hostId]: { ...prev[hostId], isPaid: newPaidStatus } }));
    
    const { error } = await supabase.from('shop_clearings').update({ is_paid: newPaidStatus }).eq('id', row.clearingId);
    if (error) showToast("Failed to update status.", "error");
  };

  return (
    <main className="min-h-screen bg-[#F8FAFB] text-[#364d54] font-sans flex relative">
      
      {/* 0. TOAST NOTIFICATIONS */}
      {toast && (
        <div className={`fixed top-6 right-1/2 translate-x-1/2 lg:translate-x-0 lg:right-6 z-[200] px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 text-sm font-bold animate-in fade-in slide-in-from-top-5 duration-300 ${toast.type === 'success' ? 'bg-[#3a5b5e] text-white' : 'bg-red-500 text-white'}`}>
          {toast.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
          {toast.message}
        </div>
      )}

      {/* 1. SIDEBAR (Desktop Only) */}
      <aside className="hidden lg:flex w-72 bg-white border-r border-[#E0E7E9] flex-col p-8 sticky top-0 h-screen shrink-0">
        <div className="mb-12">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#5fa4ad] mb-1">LexCorp Systems</p>
          <h1 className="text-2xl font-black tracking-tighter uppercase">Lextrack</h1>
        </div>
        <nav className="space-y-3 flex-grow">
          {[
            { icon: <Wallet size={20}/>, label: 'Dashboard', active: false, href: '/' },
            { icon: <Landmark size={20}/>, label: 'Loans', active: false, href: '#' },
            { icon: <ReceiptText size={20}/>, label: 'Bills', active: false, href: '#' },
            { icon: <PieChart size={20}/>, label: 'Analytics', active: false, href: '#' },
            { icon: <ShoppingCart size={20}/>, label: 'Shop Clearing', active: true, href: '/shop-clearing' },
          ].map((item, i) => (
            <Link key={i} href={item.href} className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-sm font-bold transition-all ${item.active ? 'bg-[#3a5b5e] text-white shadow-lg' : 'hover:bg-[#F8FAFB]'}`}>
              {item.icon} {item.label}
            </Link>
          ))}
        </nav>
        <button className="flex items-center gap-4 px-5 py-4 text-sm font-bold opacity-40 hover:opacity-100 transition-opacity">
          <Settings size={20}/> Settings
        </button>
      </aside>

      {/* 2. MAIN CONTENT AREA */}
      <div className="flex-grow flex flex-col min-h-screen bg-[#F8FAFB]">
        <div className="w-full max-w-[1100px] mx-auto px-6 py-8 md:py-12 pb-40 lg:pb-12">
          
          <header className="flex justify-between items-center mb-10">
            <div>
              <h2 className="text-2xl md:text-3xl font-black tracking-tight">Shop Clearing</h2>
              <p className="text-xs font-bold text-[#A0AEC0] uppercase tracking-widest mt-1">Manage Customers & Invoices</p>
            </div>
            <div className="flex items-center gap-3">
              <button className="hidden sm:flex w-12 h-12 rounded-2xl bg-white border border-[#E0E7E9] items-center justify-center shadow-sm"><Bell size={20}/></button>
              <button className="w-12 h-12 rounded-2xl bg-white border border-[#E0E7E9] flex items-center justify-center shadow-sm">
                <User size={20} className="text-[#3a5b5e]" />
              </button>
            </div>
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <div className="bg-white border border-[#E0E7E9] rounded-[2rem] p-6 shadow-sm flex flex-col justify-between">
              <div>
                <label className="block text-[11px] font-black uppercase tracking-widest text-[#A0AEC0] mb-3">Your Bank Accounts (Sent with Invoice)</label>
                <div className="space-y-2 mb-4">
                  {banks.map(bank => (
                    <div key={bank.id} className="flex justify-between items-center bg-[#F8FAFB] p-3 rounded-xl border border-[#E0E7E9]">
                      <div>
                        <p className="text-xs font-bold text-[#364d54]">{bank.account_name}</p>
                        <p className="text-[10px] text-[#A0AEC0] font-mono">{bank.account_number}</p>
                      </div>
                      <button onClick={() => handleDeleteBank(bank.id)} className="text-red-400 hover:text-red-600 p-2"><Trash2 size={16} /></button>
                    </div>
                  ))}
                  {banks.length === 0 && <p className="text-xs text-[#A0AEC0] italic">No bank accounts added yet.</p>}
                </div>
              </div>
              <div className="flex gap-2">
                <input type="text" placeholder="e.g. BML USD" value={newBankName} onChange={(e) => setNewBankName(e.target.value)} className="w-1/2 bg-[#F8FAFB] border border-[#E0E7E9] rounded-2xl p-3 text-xs font-bold focus:outline-none focus:border-[#5fa4ad]"/>
                <input type="text" placeholder="Account No." value={newBankNo} onChange={(e) => setNewBankNo(e.target.value)} className="w-1/2 bg-[#F8FAFB] border border-[#E0E7E9] rounded-2xl p-3 text-xs font-bold focus:outline-none focus:border-[#5fa4ad]"/>
                <button onClick={handleAddBank} className="bg-[#3a5b5e] text-white px-4 rounded-2xl active:scale-95 transition-all"><Plus size={16} /></button>
              </div>
            </div>

            <div className="bg-white border border-[#E0E7E9] rounded-[2rem] p-6 shadow-sm space-y-6">
              <div>
                <label className="block text-[11px] font-black uppercase tracking-widest text-[#A0AEC0] mb-2">Select Filter Month</label>
                <input 
                  type="month"
                  className="w-full bg-[#F8FAFB] border border-[#E0E7E9] rounded-2xl p-4 text-sm font-bold focus:outline-none focus:border-[#5fa4ad] text-[#3a5b5e]"
                  value={clearingMonth}
                  onChange={(e) => setClearingMonth(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-[11px] font-black uppercase tracking-widest text-[#A0AEC0] mb-3">Add New Customer</label>
                <div className="flex gap-2">
                  <input type="text" placeholder="Name" value={newHostName} onChange={(e) => setNewHostName(e.target.value)} className="w-full bg-[#F8FAFB] border border-[#E0E7E9] rounded-2xl p-4 text-sm font-bold focus:outline-none focus:border-[#5fa4ad]"/>
                  <input type="text" placeholder="Host No." value={newHostNo} onChange={(e) => setNewHostNo(e.target.value)} className="w-32 bg-[#F8FAFB] border border-[#E0E7E9] rounded-2xl p-4 text-sm font-bold focus:outline-none focus:border-[#5fa4ad]"/>
                  <button onClick={handleAddCustomer} className="bg-[#3a5b5e] text-white px-6 rounded-2xl font-black active:scale-95 transition-all"><Plus size={20} /></button>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-[#A0AEC0] mb-4">Clearance List for {clearingMonth}</h3>
            
            {hosts.map((host) => {
              const row = rowData[host.id] || { billMvr: "", rate: "", isPaid: false, isMsgSent: false };
              const usd = row.billMvr && row.rate ? (parseFloat(row.billMvr) / parseFloat(row.rate)).toFixed(2) : "0.00";

              return (
                <div key={host.id} className="bg-white border border-[#E0E7E9] rounded-[2rem] p-5 shadow-sm flex flex-col xl:flex-row gap-4 xl:items-center">
                  
                  <div className="w-full xl:w-40 flex-shrink-0">
                    <p className="font-bold text-[#364d54] truncate">{host.name}</p>
                    <p className="text-[10px] text-[#A0AEC0] uppercase tracking-widest font-bold">Host: {host.host_no}</p>
                  </div>

                  <div className="flex gap-2 flex-grow">
                    <input 
                      type="number" placeholder="Bill (MVR)" value={row.billMvr || ""} onChange={(e) => handleRowChange(host.id, "billMvr", e.target.value)}
                      className="w-1/2 bg-[#F8FAFB] border border-[#E0E7E9] rounded-2xl p-3 text-sm font-bold focus:outline-none focus:border-[#5fa4ad]"
                    />
                    <input 
                      type="number" placeholder="Rate" value={row.rate || ""} onChange={(e) => handleRowChange(host.id, "rate", e.target.value)}
                      className="w-1/2 bg-[#F8FAFB] border border-[#E0E7E9] rounded-2xl p-3 text-sm font-bold focus:outline-none focus:border-[#5fa4ad]"
                    />
                  </div>

                  <div className="w-20 text-center xl:text-right flex-shrink-0">
                    <p className="text-[10px] text-[#A0AEC0] font-black uppercase tracking-widest">USD</p>
                    <p className="font-black text-[#5fa4ad] text-lg">${usd}</p>
                  </div>

                  <div className="flex gap-2 flex-shrink-0">
                    <button 
                      onClick={() => togglePaidStatus(host.id)}
                      className={`px-4 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${row.isPaid ? 'bg-green-500 text-white shadow-md' : 'bg-[#E0E7E9] text-[#A0AEC0] hover:bg-gray-300'}`}
                    >
                      {row.isPaid ? 'Paid' : 'Unpaid'}
                    </button>

                    <button 
                      onClick={() => handleWhatsApp(host.id)}
                      className={`px-4 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${row.isMsgSent ? 'bg-blue-500 text-white shadow-md' : 'bg-[#5fa4ad] text-white hover:bg-[#4d868e]'}`}
                    >
                      {row.isMsgSent ? 'WA Sent' : 'Send WA'}
                    </button>

                    <button 
                      onClick={() => handleSaveToDatabase(host.id)}
                      className="bg-[#3a5b5e] text-white px-4 py-3 rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 transition-all hover:bg-[#2b4446]"
                    >
                      Save
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

        </div>

        {/* 3. MOBILE BOTTOM NAV (Fixed visibility & Z-Index) */}
        <nav className="lg:hidden fixed bottom-8 left-1/2 -translate-x-1/2 w-[calc(100%-48px)] max-w-[400px] h-20 bg-white shadow-[0_20px_50px_rgba(0,0,0,0.1)] border border-[#E0E7E9] rounded-[2.5rem] flex justify-around items-center px-4 z-[100]">
          <Link href="/" className="p-3 text-[#A0AEC0]"><Wallet size={24} /></Link>
          <button className="relative -mt-14 active:scale-90 transition-transform">
            <div className="absolute inset-0 bg-[#3a5b5e] blur-xl opacity-20" />
            <div className="relative w-16 h-16 bg-[#3a5b5e] rounded-[1.5rem] flex items-center justify-center shadow-lg border-4 border-white"><Plus size={32} className="text-white" /></div>
          </button>
          <Link href="/shop-clearing" className="p-3 text-[#3a5b5e]"><ShoppingCart size={24} /></Link>
        </nav>
      </div>
    </main>
  );
}