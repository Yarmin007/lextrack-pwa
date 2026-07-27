"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { 
  Plus, Trash2, TrendingDown, TrendingUp, 
  CheckCircle2, AlertCircle, ArrowRightLeft, 
  Search, Filter, Calendar, Tag, ArrowUpRight, ArrowDownRight, Wallet, X
} from "lucide-react";

interface Transaction {
  id: string;
  title: string;
  category: string;
  amount: number;
  type: 'income' | 'expense';
  created_at: string;
  transaction_date?: string;
}

interface Loan {
  id: string;
  person_name: string;
  loan_type: 'lent' | 'borrowed';
  amount: number;
  is_paid: boolean;
  created_at: string;
}

export default function TrackerPage() {
  const [activeTab, setActiveTab] = useState<'transactions' | 'loans'>('transactions');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);

  // Transaction Form States
  const [transTitle, setTransTitle] = useState("");
  const [transCategory, setTransCategory] = useState("Food & Drink");
  const [transAmount, setTransAmount] = useState("");
  const [transType, setTransType] = useState<'expense' | 'income'>('expense');

  // Loan Form States
  const [loanName, setLoanName] = useState("");
  const [loanType, setLoanType] = useState<'lent' | 'borrowed'>('lent');
  const [loanAmount, setLoanAmount] = useState("");

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');

  const categories = [
    "Food & Drink",
    "Salary / Income",
    "Business / Trade",
    "Subscriptions",
    "Transport & Fuel",
    "Shopping",
    "Bills & Utilities",
    "Health",
    "Other"
  ];

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [billsRes, loansRes] = await Promise.all([
      supabase.from('bills').select('*').order('created_at', { ascending: false }),
      supabase.from('loans').select('*').order('created_at', { ascending: false })
    ]);

    if (billsRes.data) {
      const mapped = billsRes.data.map((b: any) => ({
        ...b,
        type: b.type || (b.category === "Salary / Income" || b.category === "Business / Trade" ? "income" : "expense")
      }));
      setTransactions(mapped);
    }

    if (loansRes.data) setLoans(loansRes.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // --- Handlers ---
  const handleAddTransaction = async () => {
    if (!transTitle.trim() || !transAmount) return showToast("Enter title and amount", "error");
    const parsedAmt = parseFloat(transAmount) || 0;
    if (parsedAmt <= 0) return showToast("Enter a valid amount", "error");

    const payload = {
      title: transTitle.trim(),
      category: transCategory,
      amount: parsedAmt,
      type: transType,
      transaction_date: new Date().toISOString().split('T')[0]
    };

    const { error } = await supabase.from('bills').insert(payload);
    if (error) {
      showToast(`Error saving: ${error.message}`, "error");
    } else {
      showToast(`${transType === 'income' ? 'Income' : 'Expense'} recorded!`);
      setTransTitle("");
      setTransAmount("");
      fetchData();
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    if (!confirm("Delete this entry?")) return;
    const { error } = await supabase.from('bills').delete().eq('id', id);
    if (!error) {
      fetchData();
      showToast("Transaction deleted");
    }
  };

  const handleAddLoan = async () => {
    if (!loanName.trim() || !loanAmount) return showToast("Enter person's name and amount", "error");
    const parsedAmt = parseFloat(loanAmount) || 0;
    if (parsedAmt <= 0) return showToast("Enter a valid amount", "error");

    const payload = {
      person_name: loanName.trim(),
      loan_type: loanType,
      amount: parsedAmt,
      is_paid: false
    };

    const { error } = await supabase.from('loans').insert(payload);
    if (error) {
      showToast(`Error saving loan: ${error.message}`, "error");
    } else {
      showToast("Loan recorded!");
      setLoanName("");
      setLoanAmount("");
      fetchData();
    }
  };

  const toggleLoanStatus = async (id: string, currentStatus: boolean) => {
    await supabase.from('loans').update({ is_paid: !currentStatus }).eq('id', id);
    fetchData();
  };

  const handleDeleteLoan = async (id: string) => {
    if (!confirm("Delete this loan record?")) return;
    await supabase.from('loans').delete().eq('id', id);
    fetchData();
    showToast("Loan deleted");
  };

  // --- Financial Math Engine ---
  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;

    transactions.forEach(t => {
      const amt = Number(t.amount) || 0;
      if (t.type === 'income') income += amt;
      else expense += amt;
    });

    return { income, expense, net: income - expense };
  }, [transactions]);

  const loanTotals = useMemo(() => {
    const lent = loans.filter(l => l.loan_type === 'lent' && !l.is_paid).reduce((s, l) => s + (Number(l.amount) || 0), 0);
    const borrowed = loans.filter(l => l.loan_type === 'borrowed' && !l.is_paid).reduce((s, l) => s + (Number(l.amount) || 0), 0);
    return { lent, borrowed };
  }, [loans]);

  // Spending Breakdown By Category
  const categoryBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    let totalExpenseCounted = 0;

    transactions.filter(t => t.type === 'expense').forEach(t => {
      const amt = Number(t.amount) || 0;
      map[t.category] = (map[t.category] || 0) + amt;
      totalExpenseCounted += amt;
    });

    return Object.entries(map).map(([cat, amt]) => ({
      category: cat,
      amount: amt,
      percent: totalExpenseCounted > 0 ? Math.round((amt / totalExpenseCounted) * 100) : 0
    })).sort((a, b) => b.amount - a.amount);
  }, [transactions]);

  // Filtered Transactions List
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const matchesSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            t.category.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === "all" || t.category === selectedCategory;
      const matchesType = filterType === "all" || t.type === filterType;
      return matchesSearch && matchesCategory && matchesType;
    });
  }, [transactions, searchQuery, selectedCategory, filterType]);

  return (
    <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-8 pb-28">
      
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[999] px-4 py-2.5 rounded-xl shadow-lg text-xs font-bold text-white flex items-center gap-2 animate-in slide-in-from-top-4 ${toast.type === 'error' ? 'bg-rose-500' : 'bg-slate-900'}`}>
          {toast.type === 'error' ? <AlertCircle size={15}/> : <CheckCircle2 size={15}/>}
          <span>{toast.message}</span>
        </div>
      )}

      {/* HEADER & TAB SWITCHER */}
      <header className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 mb-5">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
            <Wallet size={22} className="text-indigo-600"/> Cash Flow Tracker
          </h2>
          <p className="text-xs font-semibold text-slate-500 mt-0.5">Track daily income, personal spending, and active loans.</p>
        </div>

        <div className="flex items-center gap-1 bg-white border border-slate-200 p-1 rounded-xl shadow-2xs w-fit">
          <button 
            onClick={() => setActiveTab('transactions')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors ${activeTab === 'transactions' ? 'bg-slate-900 text-white shadow-2xs' : 'text-slate-500'}`}
          >
            💸 Cash Flow
          </button>
          <button 
            onClick={() => setActiveTab('loans')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors ${activeTab === 'loans' ? 'bg-slate-900 text-white shadow-2xs' : 'text-slate-500'}`}
          >
            🔄 Loans ({loans.filter(l => !l.is_paid).length})
          </button>
        </div>
      </header>

      {/* TAB 1: TRANSACTIONS (INCOME & EXPENSE) */}
      {activeTab === 'transactions' && (
        <div className="space-y-5 animate-in fade-in duration-200">
          
          {/* TOP METRICS GRID */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white border border-slate-200/80 p-4 rounded-2xl shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-[9px] font-extrabold uppercase text-slate-400 tracking-wider">Total Income</span>
                <p className="text-xl font-black text-emerald-600 mt-0.5">MVR {totals.income.toLocaleString()}</p>
              </div>
              <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                <ArrowUpRight size={18}/>
              </div>
            </div>

            <div className="bg-white border border-slate-200/80 p-4 rounded-2xl shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-[9px] font-extrabold uppercase text-slate-400 tracking-wider">Total Expenses</span>
                <p className="text-xl font-black text-rose-600 mt-0.5">MVR {totals.expense.toLocaleString()}</p>
              </div>
              <div className="w-9 h-9 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                <ArrowDownRight size={18}/>
              </div>
            </div>

            <div className="bg-white border border-slate-200/80 p-4 rounded-2xl shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-[9px] font-extrabold uppercase text-slate-400 tracking-wider">Net Cash Flow</span>
                <p className={`text-xl font-black mt-0.5 ${totals.net >= 0 ? 'text-slate-900' : 'text-rose-600'}`}>
                  MVR {totals.net.toLocaleString()}
                </p>
              </div>
              <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 shrink-0">
                <Wallet size={18}/>
              </div>
            </div>
          </div>

          {/* LOG NEW TRANSACTION PANEL */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 sm:p-5 shadow-2xs space-y-3">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2.5">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <Plus size={15} className="text-indigo-600"/> Quick Log Entry
              </h3>

              {/* Type Switcher */}
              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                <button 
                  type="button"
                  onClick={() => setTransType('expense')}
                  className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase transition-colors ${transType === 'expense' ? 'bg-rose-600 text-white' : 'text-slate-500'}`}
                >
                  - Expense
                </button>
                <button 
                  type="button"
                  onClick={() => setTransType('income')}
                  className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase transition-colors ${transType === 'income' ? 'bg-emerald-600 text-white' : 'text-slate-500'}`}
                >
                  + Income
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
              <div className="sm:col-span-5">
                <input 
                  type="text" 
                  placeholder={transType === 'income' ? "Income Source (e.g. Salary, Freelance)" : "Expense Description (e.g. Groceries)"} 
                  value={transTitle} 
                  onChange={(e) => setTransTitle(e.target.value)} 
                  className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-bold text-slate-800 focus:outline-none"
                />
              </div>

              <div className="sm:col-span-4">
                <select 
                  value={transCategory} 
                  onChange={(e) => setTransCategory(e.target.value)} 
                  className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-bold text-slate-700 focus:outline-none"
                >
                  {categories.map((c, i) => (
                    <option key={i} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-3">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">MVR</span>
                  <input 
                    type="number" 
                    placeholder="0.00" 
                    value={transAmount} 
                    onChange={(e) => setTransAmount(e.target.value)} 
                    className="w-full bg-slate-50 border border-slate-200 py-2.5 pl-12 pr-3 rounded-xl text-xs font-bold text-slate-900 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <button 
              onClick={handleAddTransaction}
              className={`w-full h-10 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-2xs transition-transform active:scale-95 flex items-center justify-center gap-1.5 ${transType === 'income' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-slate-900 hover:bg-slate-800'}`}
            >
              <Plus size={14}/> Save {transType === 'income' ? 'Income' : 'Expense'}
            </button>
          </div>

          {/* SPENDING BREAKDOWN & HISTORY GRID */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            
            {/* LEFT 4 COLUMNS: CATEGORY SPENDING BAR CHART */}
            <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs space-y-3">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <Tag size={14} className="text-indigo-600"/> Expense Categories
              </h3>

              {categoryBreakdown.length === 0 ? (
                <p className="text-xs text-slate-400 italic text-center py-6">No expenses logged to summarize.</p>
              ) : (
                <div className="space-y-3">
                  {categoryBreakdown.map((item, idx) => (
                    <div key={idx} className="space-y-1">
                      <div className="flex justify-between items-center text-xs font-bold">
                        <span className="text-slate-700 truncate">{item.category}</span>
                        <span className="text-slate-900 font-black">MVR {item.amount.toLocaleString()}</span>
                      </div>
                      <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div 
                          className="bg-indigo-600 h-full rounded-full transition-all duration-300"
                          style={{ width: `${item.percent}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* RIGHT 8 COLUMNS: TRANSACTIONS LOG WITH SEARCH & FILTERS */}
            <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs space-y-3">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 pb-2 border-b border-slate-100">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Transaction History</h3>

                {/* Filter Controls */}
                <div className="flex items-center gap-1.5">
                  <div className="relative grow sm:w-40">
                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"/>
                    <input 
                      type="text" 
                      placeholder="Search..." 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 pl-8 pr-2 py-1 rounded-lg text-xs font-bold focus:outline-none"
                    />
                  </div>

                  <select 
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value as any)}
                    className="bg-slate-50 border border-slate-200 p-1 rounded-lg text-[10px] font-bold text-slate-700 focus:outline-none"
                  >
                    <option value="all">All Types</option>
                    <option value="income">Income Only</option>
                    <option value="expense">Expenses Only</option>
                  </select>
                </div>
              </div>

              {filteredTransactions.length === 0 ? (
                <p className="text-xs text-slate-400 italic text-center py-10">No matching transactions found.</p>
              ) : (
                <div className="divide-y divide-slate-100 space-y-1 max-h-[60vh] overflow-y-auto pr-1">
                  {filteredTransactions.map((t) => (
                    <div key={t.id} className="flex justify-between items-center py-2.5 first:pt-0 hover:bg-slate-50/50 rounded-xl px-2 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center border shrink-0 ${t.type === 'income' ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-rose-50 border-rose-100 text-rose-600'}`}>
                          {t.type === 'income' ? <TrendingUp size={15}/> : <TrendingDown size={15}/>}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate">{t.title}</p>
                          <p className="text-[10px] font-semibold text-slate-400 flex items-center gap-1 mt-0.5">
                            <span>{t.category}</span>
                            <span>•</span>
                            <span>{new Date(t.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className={`text-xs font-black ${t.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {t.type === 'income' ? '+' : '-'} {Number(t.amount).toLocaleString()} MVR
                        </span>
                        <button onClick={() => handleDeleteTransaction(t.id)} className="text-slate-300 hover:text-rose-500 p-1">
                          <Trash2 size={13}/>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: LOANS & DEBTS */}
      {activeTab === 'loans' && (
        <div className="space-y-5 animate-in fade-in duration-200">
          
          {/* LOAN METRICS */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white border border-slate-200/80 p-4 rounded-2xl shadow-2xs">
              <span className="text-[9px] font-extrabold uppercase text-slate-400 tracking-wider">People Owe Me (Lent)</span>
              <p className="text-xl font-black text-emerald-600 mt-0.5">MVR {loanTotals.lent.toLocaleString()}</p>
            </div>
            <div className="bg-white border border-slate-200/80 p-4 rounded-2xl shadow-2xs">
              <span className="text-[9px] font-extrabold uppercase text-slate-400 tracking-wider">I Owe People (Borrowed)</span>
              <p className="text-xl font-black text-rose-600 mt-0.5">MVR {loanTotals.borrowed.toLocaleString()}</p>
            </div>
          </div>

          {/* LOG LOAN FORM */}
          <div className="bg-slate-900 text-white rounded-2xl p-4 sm:p-5 shadow-md space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
              <ArrowRightLeft size={15}/> Record Loan or Debt
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
              <input 
                type="text" 
                placeholder="Person's Name" 
                value={loanName} 
                onChange={(e) => setLoanName(e.target.value)} 
                className="sm:col-span-5 bg-slate-800 border border-slate-700 p-2.5 rounded-xl text-xs font-bold text-white focus:outline-none placeholder-slate-400"
              />

              <div className="sm:col-span-4 flex items-center gap-1 bg-slate-800 p-1 rounded-xl border border-slate-700">
                <button 
                  type="button"
                  onClick={() => setLoanType('lent')}
                  className={`flex-1 py-1 rounded-lg text-[10px] font-black uppercase transition-colors ${loanType === 'lent' ? 'bg-emerald-600 text-white' : 'text-slate-400'}`}
                >
                  I Lent
                </button>
                <button 
                  type="button"
                  onClick={() => setLoanType('borrowed')}
                  className={`flex-1 py-1 rounded-lg text-[10px] font-black uppercase transition-colors ${loanType === 'borrowed' ? 'bg-rose-600 text-white' : 'text-slate-400'}`}
                >
                  I Borrowed
                </button>
              </div>

              <input 
                type="number" 
                placeholder="MVR Amount" 
                value={loanAmount} 
                onChange={(e) => setLoanAmount(e.target.value)} 
                className="sm:col-span-3 bg-slate-800 border border-slate-700 p-2.5 rounded-xl text-xs font-bold text-white focus:outline-none placeholder-slate-400"
              />
            </div>

            <button 
              onClick={handleAddLoan}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-xs transition-transform active:scale-95"
            >
              + Save Loan Record
            </button>
          </div>

          {/* ACTIVE LOANS LIST */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs space-y-3">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Active Loan Ledger</h3>

            {loans.length === 0 ? (
              <p className="text-xs text-slate-400 italic text-center py-8">No active loans recorded.</p>
            ) : (
              <div className="space-y-2">
                {loans.map(loan => (
                  <div key={loan.id} className={`p-3 rounded-xl border flex items-center justify-between gap-2 transition-all ${loan.is_paid ? 'bg-slate-50 border-slate-200 opacity-60' : 'bg-white border-slate-200 shadow-2xs'}`}>
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center border shrink-0 ${loan.loan_type === 'lent' ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-rose-50 border-rose-100 text-rose-600'}`}>
                        <ArrowRightLeft size={14}/>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 truncate">{loan.person_name}</p>
                        <span className={`text-[9px] font-extrabold uppercase ${loan.loan_type === 'lent' ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {loan.loan_type === 'lent' ? 'Owes You' : 'You Owe'} • {new Date(loan.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-xs font-black ${loan.loan_type === 'lent' ? 'text-emerald-600' : 'text-rose-600'}`}>
                        MVR {Number(loan.amount).toLocaleString()}
                      </span>

                      <button 
                        onClick={() => toggleLoanStatus(loan.id, loan.is_paid)}
                        className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase border transition-colors ${loan.is_paid ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'}`}
                      >
                        {loan.is_paid ? 'Paid ✅' : 'Mark Settled'}
                      </button>

                      <button onClick={() => handleDeleteLoan(loan.id)} className="text-slate-300 hover:text-rose-500 p-0.5">
                        <Trash2 size={13}/>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}

    </div>
  );
}