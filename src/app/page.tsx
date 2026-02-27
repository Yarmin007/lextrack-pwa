"use client"

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import AddTransaction from '@/components/AddTransaction'
import { 
  Wallet, TrendingDown, TrendingUp, Plus, 
  User, Settings, PieChart, ShoppingCart, Calculator, Activity, Banknote
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
    <main className="min-h-screen bg-[#F0F4F8] text-[#364d54] font-sans flex">
      
      {/* DESKTOP SIDEBAR */}
      <aside className="hidden lg:flex w-72 bg-white border-r border-[#E0E7E9] flex-col p-8 sticky top-0 h-screen shrink-0 z-40">
        <div className="mb-12">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#5fa4ad] mb-1">LexCorp Systems</p>
          <h1 className="text-2xl font-black tracking-tighter uppercase">Lextrack</h1>
        </div>
        <nav className="space-y-3 flex-grow">
          <Link href="/" className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-sm font-bold bg-[#3a5b5e] text-white shadow-lg transition-all"><Wallet size={20}/> Dashboard</Link>
          <Link href="/tracker" className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-sm font-bold hover:bg-[#F8FAFB] text-[#A0AEC0] transition-all"><Banknote size={20}/> Tracker</Link>
          <Link href="/splitter" className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-sm font-bold hover:bg-[#F8FAFB] text-[#A0AEC0] transition-all"><Calculator size={20}/> Splitter</Link>
          <Link href="/shop-clearing" className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-sm font-bold hover:bg-[#F8FAFB] text-[#A0AEC0] transition-all"><ShoppingCart size={20}/> Clearing</Link>
          <Link href="/analytics" className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-sm font-bold hover:bg-[#F8FAFB] text-[#A0AEC0] transition-all"><PieChart size={20}/> Analytics</Link>
        </nav>
        <button className="flex items-center gap-4 px-5 py-4 text-sm font-bold opacity-40"><Settings size={20}/> Settings</button>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className="flex-grow flex flex-col h-screen overflow-y-auto relative">
        <div className="w-full max-w-[1100px] mx-auto px-4 lg:px-8 py-6 lg:py-10 pb-32">
          
          <header className="flex justify-between items-center mb-8">
            <div>
              <h2 className="text-2xl lg:text-3xl font-black tracking-tight">Overview</h2>
              <p className="text-[10px] font-bold text-[#A0AEC0] uppercase tracking-widest mt-1">Real-time Financial Status</p>
            </div>
            <button className="w-12 h-12 rounded-full bg-white border border-[#E0E7E9] flex items-center justify-center shadow-sm">
              <User size={20} className="text-[#3a5b5e]" />
            </button>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            <div className="bg-[#3a5b5e] rounded-[2rem] p-8 shadow-xl text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-24 -mt-24" />
              <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-2">Available Cash</p>
              <h2 className="text-4xl lg:text-5xl font-black tracking-tight mb-2">
                <span className="text-lg font-medium opacity-50 mr-2 italic">MVR</span>
                {totalCashMvr.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
              </h2>
            </div>
            <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-[#E0E7E9] flex flex-col justify-center">
              <p className="text-[10px] font-black uppercase tracking-widest text-[#A0AEC0] mb-2">Pending Inflows (Street Money)</p>
              <h2 className="text-4xl lg:text-5xl font-black tracking-tight text-orange-500">
                <span className="text-lg font-medium opacity-50 mr-2 italic">MVR</span>
                {totalPendingMvr.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
              </h2>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center mb-4 px-2">
              <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-[#A0AEC0] flex items-center gap-2"><Activity size={14}/> Recent Activity</h3>
              {loading && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#5fa4ad]"></div>}
            </div>
            
            {recentActivity.length === 0 && !loading && (
              <div className="text-center py-12 bg-white rounded-3xl border border-dashed border-[#A0AEC0]">
                <p className="font-bold text-[#A0AEC0]">No activity recorded yet.</p>
              </div>
            )}

            {recentActivity.map((act) => (
              <div key={act.id} className="flex justify-between items-center bg-white p-4 rounded-3xl border border-gray-100 shadow-sm">
                <div className="flex items-center gap-4">
                  <div className={`w-11 h-11 rounded-full flex items-center justify-center border ${
                    act.type === 'income' ? 'bg-green-50 border-green-100 text-green-500' :
                    act.type === 'expense' ? 'bg-orange-50 border-orange-100 text-orange-500' :
                    'bg-blue-50 border-blue-100 text-blue-500'
                  }`}>
                    {act.type === 'income' ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[#364d54]">{act.title}</p>
                    <p className="text-[9px] text-[#A0AEC0] font-black uppercase tracking-widest mt-0.5">
                      {act.date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                    </p>
                  </div>
                </div>
                <p className={`text-sm font-black ${act.type === 'income' ? 'text-green-500' : 'text-orange-500'}`}>
                  {act.type === 'income' ? '+' : '-'} {Number(act.amount).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* MOBILE BOTTOM NAV */}
        <nav className="lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 w-[95%] max-w-[400px] h-16 bg-white shadow-[0_10px_40px_rgba(0,0,0,0.1)] rounded-full border border-gray-100 flex justify-around items-center px-4 z-[100]">
          <Link href="/" className="text-[#3a5b5e]"><Wallet size={24} className="bg-[#e0f2fe] p-1.5 rounded-xl" /></Link>
          <Link href="/tracker" className="text-gray-400 hover:text-[#3a5b5e] transition-colors"><Banknote size={20} /></Link>
          <Link href="/splitter" className="text-gray-400 hover:text-[#3a5b5e] transition-colors"><Calculator size={20} /></Link>
          <Link href="/shop-clearing" className="text-gray-400 hover:text-[#3a5b5e] transition-colors"><ShoppingCart size={20} /></Link>
          <Link href="/analytics" className="text-gray-400 hover:text-[#3a5b5e] transition-colors"><PieChart size={20} /></Link>
        </nav>
      </div>

      <AddTransaction isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onRefresh={fetchData} />
    </main>
  )
}