"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { 
  Wallet, Calculator, ShoppingCart, PieChart, Settings, 
  Banknote, Plus, Trash2, TrendingDown, 
  CheckCircle2, AlertCircle, ArrowRightLeft 
} from "lucide-react";
import Link from "next/link";

export default function TrackerPage() {
  const [activeTab, setActiveTab] = useState<'spending' | 'loans'>('spending');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

  const [bills, setBills] = useState<any[]>([]);
  const [loans, setLoans] = useState<any[]>([]);

  const [billTitle, setBillTitle] = useState("");
  const [billCategory, setBillCategory] = useState("Food & Drink");
  const [billAmount, setBillAmount] = useState("");

  const [loanName, setLoanName] = useState("");
  const [loanType, setLoanType] = useState<'lent' | 'borrowed'>('lent');
  const [loanAmount, setLoanAmount] = useState("");

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchData = async () => {
    setLoading(true);
    const [billsRes, loansRes] = await Promise.all([
      supabase.from('bills').select('*').order('created_at', { ascending: false }),
      supabase.from('loans').select('*').order('created_at', { ascending: false })
    ]);

    if (billsRes.data) setBills(billsRes.data);
    if (loansRes.data) setLoans(loansRes.data);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddBill = async () => {
    if (!billTitle || !billAmount) return showToast("Enter title and amount", "error");
    const { error } = await supabase.from('bills').insert({ title: billTitle, category: billCategory, amount: parseFloat(billAmount) });
    if (error) showToast("Error saving expense", "error");
    else { showToast("Expense added!"); setBillTitle(""); setBillAmount(""); fetchData(); }
  };

  const handleDeleteBill = async (id: string) => {
    if (!confirm("Delete this expense?")) return;
    await supabase.from('bills').delete().eq('id', id);
    fetchData(); showToast("Expense deleted");
  };

  const handleAddLoan = async () => {
    if (!loanName || !loanAmount) return showToast("Enter name and amount", "error");
    const { error } = await supabase.from('loans').insert({ person_name: loanName, loan_type: loanType, amount: parseFloat(loanAmount), is_paid: false });
    if (error) showToast("Error saving loan", "error");
    else { showToast("Loan recorded!"); setLoanName(""); setLoanAmount(""); fetchData(); }
  };

  const toggleLoanStatus = async (id: string, currentStatus: boolean) => {
    await supabase.from('loans').update({ is_paid: !currentStatus }).eq('id', id);
    fetchData();
  };

  const handleDeleteLoan = async (id: string) => {
    if (!confirm("Delete this loan record?")) return;
    await supabase.from('loans').delete().eq('id', id);
    fetchData(); showToast("Loan deleted");
  };

  const totalLent = loans.filter(l => l.loan_type === 'lent' && !l.is_paid).reduce((s, l) => s + parseFloat(l.amount), 0);
  const totalBorrowed = loans.filter(l => l.loan_type === 'borrowed' && !l.is_paid).reduce((s, l) => s + parseFloat(l.amount), 0);

  return (
    <main className="min-h-screen bg-[#F0F4F8] text-[#364d54] font-sans flex relative">
      
      {toast && (
        <div className={`fixed top-6 right-1/2 translate-x-1/2 lg:translate-x-0 lg:right-6 z-[300] px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 text-sm font-bold animate-in fade-in slide-in-from-top-5 duration-300 ${toast.type === 'success' ? 'bg-[#3a5b5e] text-white' : 'bg-red-500 text-white'}`}>
          {toast.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
          {toast.message}
        </div>
      )}

      {/* DESKTOP SIDEBAR */}
      <aside className="hidden lg:flex w-72 bg-white border-r border-[#E0E7E9] flex-col p-8 sticky top-0 h-screen shrink-0 z-40">
        <div className="mb-12">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#5fa4ad] mb-1">LexCorp Systems</p>
          <h1 className="text-2xl font-black tracking-tighter uppercase">Lextrack</h1>
        </div>
        <nav className="space-y-3 flex-grow">
          <Link href="/" className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-sm font-bold hover:bg-[#F8FAFB] text-[#A0AEC0] transition-all"><Wallet size={20}/> Dashboard</Link>
          <Link href="/tracker" className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-sm font-bold bg-[#3a5b5e] text-white shadow-lg transition-all"><Banknote size={20}/> Tracker</Link>
          <Link href="/splitter" className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-sm font-bold hover:bg-[#F8FAFB] text-[#A0AEC0] transition-all"><Calculator size={20}/> Splitter</Link>
          <Link href="/shop-clearing" className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-sm font-bold hover:bg-[#F8FAFB] text-[#A0AEC0] transition-all"><ShoppingCart size={20}/> Clearing</Link>
          <Link href="/analytics" className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-sm font-bold hover:bg-[#F8FAFB] text-[#A0AEC0] transition-all"><PieChart size={20}/> Analytics</Link>
        </nav>
        <button className="flex items-center gap-4 px-5 py-4 text-sm font-bold opacity-40"><Settings size={20}/> Settings</button>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className="flex-grow flex flex-col min-h-screen overflow-y-auto">
        <div className="w-full max-w-[900px] mx-auto px-4 lg:px-8 py-6 lg:py-10 pb-40">
          
          <header className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-2xl lg:text-3xl font-black tracking-tight">Finance Tracker</h2>
              <p className="text-[10px] font-bold text-[#A0AEC0] uppercase tracking-widest mt-1">Manage Loans & Expenses</p>
            </div>
          </header>

          <div className="flex bg-white p-1 rounded-2xl shadow-sm border border-[#E0E7E9] mb-8 relative">
            <button onClick={() => setActiveTab('spending')} className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all z-10 ${activeTab === 'spending' ? 'text-white' : 'text-[#A0AEC0]'}`}>Daily Spending</button>
            <button onClick={() => setActiveTab('loans')} className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all z-10 ${activeTab === 'loans' ? 'text-white' : 'text-[#A0AEC0]'}`}>Personal Loans</button>
            <div className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-[#3a5b5e] rounded-xl transition-all duration-300 ease-out shadow-md ${activeTab === 'spending' ? 'left-1' : 'left-[calc(50%+2px)]'}`} />
          </div>

          {activeTab === 'spending' && (
            <div className="animate-in fade-in slide-in-from-bottom-4">
              <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-[#E0E7E9] mb-8">
                <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-[#A0AEC0] mb-4">Log New Expense</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <input type="text" placeholder="What did you buy?" value={billTitle} onChange={e => setBillTitle(e.target.value)} className="bg-[#F8FAFB] border-none p-4 rounded-2xl font-bold text-sm focus:ring-2 focus:ring-[#5fa4ad]"/>
                  <select value={billCategory} onChange={e => setBillCategory(e.target.value)} className="bg-[#F8FAFB] border-none p-4 rounded-2xl font-bold text-sm text-[#364d54] focus:ring-2 focus:ring-[#5fa4ad]">
                    <option value="Food & Drink">Food & Drink</option>
                    <option value="Subscriptions">Subscriptions</option>
                    <option value="Transport">Transport</option>
                    <option value="Shopping">Shopping</option>
                    <option value="Other">Other</option>
                  </select>
                  <div className="flex gap-2">
                    <input type="number" placeholder="MVR" value={billAmount} onChange={e => setBillAmount(e.target.value)} className="w-full bg-[#F8FAFB] border-none p-4 rounded-2xl font-bold text-sm focus:ring-2 focus:ring-[#5fa4ad]"/>
                    <button onClick={handleAddBill} className="bg-[#3a5b5e] text-white px-5 rounded-2xl active:scale-95 transition-transform"><Plus size={20}/></button>
                  </div>
                </div>
              </div>

              <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-[#A0AEC0] mb-4 pl-2">Recent Expenses</h3>
              <div className="space-y-3">
                {bills.length === 0 && <p className="text-center text-sm font-bold text-[#A0AEC0] py-10">No expenses logged yet.</p>}
                {bills.map(bill => (
                  <div key={bill.id} className="flex justify-between items-center bg-white p-5 rounded-[2rem] border border-[#E0E7E9] shadow-sm">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-orange-50 flex items-center justify-center border border-orange-100">
                        <TrendingDown size={18} className="text-orange-500" />
                      </div>
                      <div>
                        <p className="font-black text-[#364d54]">{bill.title}</p>
                        <p className="text-[10px] text-[#A0AEC0] font-bold uppercase tracking-widest mt-0.5">{bill.category} • {new Date(bill.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <p className="font-black text-orange-500 text-lg">- {Number(bill.amount).toLocaleString()}</p>
                      <button onClick={() => handleDeleteBill(bill.id)} className="text-red-300 hover:text-red-500 p-2 transition-colors"><Trash2 size={16}/></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'loans' && (
            <div className="animate-in fade-in slide-in-from-bottom-4">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-white p-5 rounded-[2rem] border border-[#E0E7E9] shadow-sm">
                  <p className="text-[9px] font-black uppercase tracking-widest text-[#A0AEC0] mb-1">People Owe Me</p>
                  <p className="text-2xl font-black text-green-500">MVR {totalLent.toLocaleString()}</p>
                </div>
                <div className="bg-white p-5 rounded-[2rem] border border-[#E0E7E9] shadow-sm">
                  <p className="text-[9px] font-black uppercase tracking-widest text-[#A0AEC0] mb-1">I Owe People</p>
                  <p className="text-2xl font-black text-red-500">MVR {totalBorrowed.toLocaleString()}</p>
                </div>
              </div>

              <div className="bg-[#3a5b5e] p-6 rounded-[2rem] shadow-xl text-white mb-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />
                <h3 className="text-[11px] font-black uppercase tracking-[0.2em] opacity-70 mb-4">Record a Loan</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <input type="text" placeholder="Person's Name" value={loanName} onChange={e => setLoanName(e.target.value)} className="bg-white/10 placeholder-white/50 border border-white/20 p-4 rounded-2xl font-bold text-sm text-white focus:outline-none focus:bg-white/20"/>
                  <div className="flex bg-white/10 rounded-2xl border border-white/20 p-1">
                    <button onClick={() => setLoanType('lent')} className={`flex-1 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors ${loanType === 'lent' ? 'bg-white text-[#3a5b5e]' : 'text-white/60'}`}>I Lent</button>
                    <button onClick={() => setLoanType('borrowed')} className={`flex-1 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors ${loanType === 'borrowed' ? 'bg-white text-[#3a5b5e]' : 'text-white/60'}`}>I Borrowed</button>
                  </div>
                  <div className="flex gap-2">
                    <input type="number" placeholder="MVR Amount" value={loanAmount} onChange={e => setLoanAmount(e.target.value)} className="w-full bg-white/10 placeholder-white/50 border border-white/20 p-4 rounded-2xl font-bold text-sm text-white focus:outline-none focus:bg-white/20"/>
                    <button onClick={handleAddLoan} className="bg-white text-[#3a5b5e] px-5 rounded-2xl active:scale-95 transition-transform"><Plus size={20}/></button>
                  </div>
                </div>
              </div>

              <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-[#A0AEC0] mb-4 pl-2">Active Loans</h3>
              <div className="space-y-3">
                {loans.length === 0 && <p className="text-center text-sm font-bold text-[#A0AEC0] py-10">No active loans.</p>}
                {loans.map(loan => (
                  <div key={loan.id} className={`flex flex-col sm:flex-row sm:items-center justify-between bg-white p-5 rounded-[2rem] border shadow-sm transition-all ${loan.is_paid ? 'border-green-100 opacity-60' : 'border-[#E0E7E9]'}`}>
                    <div className="flex items-center gap-4 mb-4 sm:mb-0">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border ${loan.loan_type === 'lent' ? 'bg-green-50 border-green-100 text-green-500' : 'bg-red-50 border-red-100 text-red-500'}`}>
                        <ArrowRightLeft size={18} />
                      </div>
                      <div>
                        <p className="font-black text-[#364d54] text-lg">{loan.person_name}</p>
                        <p className={`text-[10px] font-bold uppercase tracking-widest mt-0.5 ${loan.loan_type === 'lent' ? 'text-green-500' : 'text-red-500'}`}>
                          {loan.loan_type === 'lent' ? 'Owes You' : 'You Owe'} • {new Date(loan.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto">
                      <p className={`font-black text-xl ${loan.loan_type === 'lent' ? 'text-green-500' : 'text-red-500'}`}>
                        {Number(loan.amount).toLocaleString()}
                      </p>
                      <div className="flex items-center gap-2">
                        <button onClick={() => toggleLoanStatus(loan.id, loan.is_paid)} className={`px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors ${loan.is_paid ? 'bg-green-500 text-white shadow-md' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}>
                          {loan.is_paid ? 'Settled' : 'Mark Paid'}
                        </button>
                        <button onClick={() => handleDeleteLoan(loan.id)} className="text-red-300 hover:text-red-500 p-3 bg-red-50 rounded-xl transition-colors"><Trash2 size={16}/></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* MOBILE BOTTOM NAV */}
        <nav className="lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 w-[95%] max-w-[400px] h-16 bg-white shadow-[0_10px_40px_rgba(0,0,0,0.1)] rounded-full border border-gray-100 flex justify-around items-center px-4 z-[100]">
          <Link href="/" className="text-gray-400 hover:text-[#3a5b5e] transition-colors"><Wallet size={20} /></Link>
          <Link href="/tracker" className="text-[#3a5b5e]"><Banknote size={24} className="bg-[#e0f2fe] p-1.5 rounded-xl" /></Link>
          <Link href="/splitter" className="text-gray-400 hover:text-[#3a5b5e] transition-colors"><Calculator size={20} /></Link>
          <Link href="/shop-clearing" className="text-gray-400 hover:text-[#3a5b5e] transition-colors"><ShoppingCart size={20} /></Link>
          <Link href="/analytics" className="text-gray-400 hover:text-[#3a5b5e] transition-colors"><PieChart size={20} /></Link>
        </nav>
      </div>
    </main>
  );
}