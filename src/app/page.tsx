"use client"

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import AddTransaction from '@/components/AddTransaction'
import { 
  Wallet, TrendingDown, TrendingUp, 
  Settings, ShoppingCart, Calculator, Activity, Banknote, User2, ArrowUpRight, ArrowDownRight, LayoutDashboard, Flame
} from "lucide-react"
import Link from 'next/link'

export default function Home() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  
  const [totalCashMvr, setTotalCashMvr] = useState(0)
  const [totalPendingMvr, setTotalPendingMvr] = useState(0)
  const [recentActivity, setRecentActivity] = useState<any[]>([])

  const fetchData = useCallback(async () => {
    setLoading(true)
    
    const [clearingsRes, splitsRes, billsRes] = await Promise.all([
      supabase.from('shop_clearings').select('*, hosts(name)'),
      supabase.from('splitter_events').select('*'),
      supabase.from('bills').select('*').order('created_at', { ascending: false }).limit(5)
    ]);

    let cash = 0;
    let pending = 0;
    let activityFeed: any[] = [];

    const sellRate = parseFloat(localStorage.getItem("lextrack_selling_rate") || "17.40");
    
    if (clearingsRes.data) {
      clearingsRes.data.forEach((c: any) => {
        const bill = parseFloat(c.bill_amount_mvr) || 0;
        const rate = parseFloat(c.applied_rate) || 15.42;
        const recUsd = parseFloat(c.received_usd) || 0;
        const advs = c.advances_list || [];
        
        const totalAdvs = advs.reduce((sum: number, a: any) => sum + (parseFloat(a.amountMvr) || 0), 0);
        const totalDueUsd = (bill + totalAdvs) / rate;
        const pendingUsd = totalDueUsd - recUsd;

        cash += (recUsd * sellRate);
        pending += (pendingUsd * sellRate);

        if (recUsd > 0) {
          activityFeed.push({
            id: `sc-${c.id}`,
            title: `Shop Clearing: ${c.hosts?.name || 'Client'}`,
            type: 'income',
            amount: (recUsd * sellRate).toFixed(0),
            date: new Date(c.created_at || Date.now())
          });
        }
      });
    }

    if (splitsRes.data) {
      splitsRes.data.forEach((ev: any) => {
        const count = ev.participants?.length || 1;
        const deliverySplit = (parseFloat(ev.delivery_fee) || 0) / count;
        
        ev.participants?.forEach((p: any) => {
          let share = 0;
          if (ev.mode === 'food') {
            const itemsTotal = (p.items || []).reduce((sum: number, item: any) => sum + (parseFloat(item.price) || 0), 0);
            share = itemsTotal + deliverySplit + (parseFloat(p.amount) || 0); 
          } else {
            share = (parseFloat(ev.total_bill) || 0) / count;
          }

          if (p.hasPaid) cash += share;
          else pending += share;
        });

        activityFeed.push({
          id: `sp-${ev.id}`,
          title: `Split: ${ev.title}`,
          type: 'split',
          amount: parseFloat(ev.total_bill || 0).toFixed(0),
          date: new Date(ev.event_date || ev.created_at)
        });
      });
    }

    if (billsRes.data) {
      billsRes.data.forEach((b: any) => {
        cash -= parseFloat(b.amount); 
        activityFeed.push({
          id: `b-${b.id}`,
          title: b.title,
          type: 'expense',
          amount: parseFloat(b.amount).toFixed(0),
          date: new Date(b.created_at)
        });
      });
    }

    activityFeed.sort((a, b) => b.date.getTime() - a.date.getTime());

    setTotalCashMvr(cash);
    setTotalPendingMvr(pending);
    setRecentActivity(activityFeed.slice(0, 8)); 
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return (
    <main className="min-h-screen bg-[#F8FAFC] text-[#1E293B] font-sans antialiased flex selection:bg-sky-500/10">
      
      {/* PREMIUM SIDEBAR PANELS FOR PC */}
      <aside className="hidden lg:flex w-72 bg-white border-r border-slate-200/80 flex-col p-6 sticky top-0 h-screen shrink-0 z-40">
        <div className="flex items-center gap-3 mb-10 px-2">
          <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center text-white font-black shadow-md">L</div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-slate-900 leading-none">Lextrack</h1>
            <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-400 mt-1">LexCorp System</p>
          </div>
        </div>
        
        <nav className="space-y-1 flex-grow">
          <Link href="/" className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold bg-slate-900 text-white shadow-sm transition-all duration-200"><LayoutDashboard size={18}/> Dashboard</Link>
          <Link href="/tracker" className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium hover:bg-slate-50 text-slate-500 hover:text-slate-900 transition-all duration-150"><Banknote size={18}/> Tracker</Link>
          <Link href="/splitter" className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium hover:bg-slate-50 text-slate-500 hover:text-slate-900 transition-all duration-150"><Calculator size={18}/> Splitter</Link>
          <Link href="/shop-clearing" className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium hover:bg-slate-50 text-slate-500 hover:text-slate-900 transition-all duration-150"><ShoppingCart size={18}/> Clearing</Link>
          <Link href="/activities" className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium hover:bg-slate-50 text-slate-500 hover:text-slate-900 transition-all duration-150"><Flame size={18}/> Activities</Link>
          <Link href="/myself" className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium hover:bg-slate-50 text-slate-500 hover:text-slate-900 transition-all duration-150"><User2 size={18}/> Myself</Link>
        </nav>
        
        <button className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-slate-400 hover:text-slate-600 transition-colors duration-150"><Settings size={18}/> Settings</button>
      </aside>

      {/* VIEWPORT CONTROLLER */}
      <div className="flex-grow flex flex-col h-screen overflow-y-auto relative bg-[#F8FAFC]">
        <div className="w-full max-w-[1140px] mx-auto px-4 lg:px-8 py-6 lg:py-8 pb-32">
          
          {/* USER INFORMATION PROFILE SECTION */}
          <header className="flex justify-between items-center mb-8">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-md font-bold text-lg">
                AY
              </div>
              <div>
                <h2 className="text-xl font-bold tracking-tight text-slate-900">Abdulla Yamin</h2>
                <p className="text-xs font-medium text-slate-400">Housekeeping Coordinator | LexCorp Workspace</p>
              </div>
            </div>
            <button className="w-10 h-10 rounded-xl bg-white border border-slate-200/60 flex items-center justify-center hover:bg-slate-50 transition-colors shadow-sm">
              <Settings size={18} className="text-slate-500" />
            </button>
          </header>

          {/* BRIGHT SEGMENTED METRICS GRID */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
            <div className="bg-white rounded-2xl p-6 border border-slate-200/60 shadow-[0_2px_12px_rgba(0,0,0,0.02)] relative overflow-hidden transition-all duration-200 hover:shadow-md">
              <div className="flex justify-between items-start mb-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Available Liquid Balance</p>
                <span className="p-1.5 bg-emerald-50 rounded-lg text-emerald-600"><ArrowUpRight size={14}/></span>
              </div>
              <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 flex items-baseline">
                <span className="text-xs font-bold text-emerald-600 mr-2 bg-emerald-50 px-1.5 py-0.5 rounded">MVR</span>
                {totalCashMvr.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
              </h2>
            </div>
            
            <div className="bg-white rounded-2xl p-6 border border-slate-200/60 shadow-[0_2px_12px_rgba(0,0,0,0.02)] relative overflow-hidden transition-all duration-200 hover:shadow-md">
              <div className="flex justify-between items-start mb-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Pending Inflows</p>
                <span className="p-1.5 bg-amber-50 rounded-lg text-amber-600"><ArrowDownRight size={14}/></span>
              </div>
              <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 flex items-baseline">
                <span className="text-xs font-bold text-amber-600 mr-2 bg-amber-50 px-1.5 py-0.5 rounded">MVR</span>
                {totalPendingMvr.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
              </h2>
            </div>
          </div>

          {/* MINIMALIST LOG RECORDS LIST */}
          <div className="bg-white rounded-2xl border border-slate-200/60 p-5 md:p-6 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400 flex items-center gap-2"><Activity size={14} className="text-slate-400"/> Synced Operations Activity</h3>
              {loading && <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-slate-900"></div>}
            </div>
            
            {recentActivity.length === 0 && !loading && (
              <div className="text-center py-14 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                <p className="text-sm font-medium text-slate-400">No operations records logged.</p>
              </div>
            )}

            <div className="divide-y divide-slate-100">
              {recentActivity.map((act) => (
                <div key={act.id} className="flex justify-between items-center py-3.5 first:pt-0 last:pb-0 group transition-all duration-150">
                  <div className="flex items-center gap-3.5">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center border transition-colors ${
                      act.type === 'income' ? 'bg-emerald-50 border-emerald-100 text-emerald-600' :
                      act.type === 'expense' ? 'bg-rose-50 border-rose-100 text-rose-600' :
                      'bg-slate-50 border-slate-100 text-slate-600'
                    }`}>
                      {act.type === 'income' ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800 transition-colors">{act.title}</p>
                      <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                        {act.date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                  </div>
                  <p className={`text-sm font-bold ${act.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {act.type === 'income' ? '+' : '-'} {Number(act.amount).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 2026 LIGHT INTERACTIVE BOTTOM NAV FOR MOBILE */}
        <nav className="lg:hidden fixed bottom-5 left-1/2 -translate-x-1/2 w-[92%] max-w-[360px] h-14 bg-white/90 border border-slate-200/60 shadow-[0_8px_30px_rgba(0,0,0,0.06)] rounded-xl flex justify-around items-center px-2 z-[100] backdrop-blur-md">
          <Link href="/" className="text-slate-900 transition-transform duration-200 active:scale-95"><Wallet size={18} className="bg-slate-100 p-2 w-8 h-8 rounded-lg" /></Link>
          <Link href="/tracker" className="text-slate-400 hover:text-slate-800 transition-colors active:scale-95"><Banknote size={18} /></Link>
          <Link href="/splitter" className="text-slate-400 hover:text-slate-800 transition-colors active:scale-95"><Calculator size={18} /></Link>
          <Link href="/shop-clearing" className="text-slate-400 hover:text-slate-800 transition-colors active:scale-95"><ShoppingCart size={18} /></Link>
          <Link href="/activities" className="text-slate-400 hover:text-slate-800 transition-colors active:scale-95"><Flame size={18} /></Link>
          <Link href="/myself" className="text-slate-400 hover:text-slate-800 transition-colors active:scale-95"><User2 size={18} /></Link>
        </nav>
      </div>

      <AddTransaction isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onRefresh={fetchData} />
    </main>
  )
}