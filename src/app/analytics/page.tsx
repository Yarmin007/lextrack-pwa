"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Wallet, ShoppingCart, Calculator, PieChart, Settings, TrendingUp, AlertCircle, Users, Banknote } from "lucide-react";
import Link from "next/link";

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  
  const [totalProfit, setTotalProfit] = useState(0);
  const [shopVolume, setShopVolume] = useState(0);
  const [splitVolume, setSplitVolume] = useState(0);
  const [topDebtors, setTopDebtors] = useState<{name: string, amount: number}[]>([]);

  useEffect(() => {
    async function fetchAnalytics() {
      setLoading(true);
      
      const [clearingsRes, splitsRes] = await Promise.all([
        supabase.from('shop_clearings').select('*, hosts(name)'),
        supabase.from('splitter_events').select('*')
      ]);

      let calculatedProfit = 0;
      let shopTotalMvr = 0;
      let splitTotalMvr = 0;
      
      const debtorsMap: Record<string, number> = {};
      const sellRate = parseFloat(localStorage.getItem("lextrack_selling_rate") || "17.40");

      if (clearingsRes.data) {
        clearingsRes.data.forEach((c: any) => {
          const bill = parseFloat(c.bill_amount_mvr) || 0;
          const rate = parseFloat(c.applied_rate) || 15.42;
          const advs = c.advances_list || [];
          const recUsd = parseFloat(c.received_usd) || 0;
          
          const totalAdvs = advs.reduce((sum: number, a: any) => sum + (parseFloat(a.amountMvr) || 0), 0);
          const rowInvestmentMvr = bill + totalAdvs;
          const rowTotalUsdDue = rowInvestmentMvr / rate;
          
          calculatedProfit += (rowTotalUsdDue * sellRate) - (rowTotalUsdDue * rate);
          shopTotalMvr += rowInvestmentMvr;

          const pendingUsd = rowTotalUsdDue - recUsd;
          if (pendingUsd > 0.05) { 
            const clientName = c.hosts?.name || "Unknown Client";
            debtorsMap[clientName] = (debtorsMap[clientName] || 0) + (pendingUsd * sellRate);
          }
        });
      }

      if (splitsRes.data) {
        splitsRes.data.forEach((ev: any) => {
          const count = ev.participants?.length || 1;
          const deliverySplit = (parseFloat(ev.delivery_fee) || 0) / count;
          
          let eventTotal = 0;

          ev.participants?.forEach((p: any) => {
            let share = 0;
            if (ev.mode === 'food') {
              const itemsTotal = (p.items || []).reduce((sum: number, item: any) => sum + (parseFloat(item.price) || 0), 0);
              share = itemsTotal + deliverySplit + (parseFloat(p.amount) || 0);
            } else {
              share = (parseFloat(ev.total_bill) || 0) / count;
            }
            
            eventTotal += share;

            if (!p.hasPaid && share > 0) {
              const pName = p.name?.trim() || "Unknown Friend";
              debtorsMap[pName] = (debtorsMap[pName] || 0) + share;
            }
          });
          
          splitTotalMvr += eventTotal; 
        });
      }

      const sortedDebtors = Object.entries(debtorsMap)
        .map(([name, amount]) => ({ name, amount }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5); 

      setTotalProfit(calculatedProfit);
      setShopVolume(shopTotalMvr);
      setSplitVolume(splitTotalMvr);
      setTopDebtors(sortedDebtors);
      setLoading(false);
    }

    fetchAnalytics();
  }, []);

  const totalVolume = shopVolume + splitVolume;
  const shopPercent = totalVolume > 0 ? (shopVolume / totalVolume) * 100 : 0;
  const splitPercent = totalVolume > 0 ? (splitVolume / totalVolume) * 100 : 0;

  return (
    <main className="min-h-screen bg-[#F0F4F8] text-[#364d54] font-sans flex relative">
      
      {/* DESKTOP SIDEBAR */}
      <aside className="hidden lg:flex w-72 bg-white border-r border-[#E0E7E9] flex-col p-8 sticky top-0 h-screen shrink-0 z-40">
        <div className="mb-12">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#5fa4ad] mb-1">LexCorp Systems</p>
          <h1 className="text-2xl font-black tracking-tighter uppercase">Lextrack</h1>
        </div>
        <nav className="space-y-3 flex-grow">
          <Link href="/" className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-sm font-bold hover:bg-[#F8FAFB] text-[#A0AEC0] transition-all"><Wallet size={20}/> Dashboard</Link>
          <Link href="/tracker" className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-sm font-bold hover:bg-[#F8FAFB] text-[#A0AEC0] transition-all"><Banknote size={20}/> Tracker</Link>
          <Link href="/splitter" className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-sm font-bold hover:bg-[#F8FAFB] text-[#A0AEC0] transition-all"><Calculator size={20}/> Splitter</Link>
          <Link href="/shop-clearing" className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-sm font-bold hover:bg-[#F8FAFB] text-[#A0AEC0] transition-all"><ShoppingCart size={20}/> Clearing</Link>
          <Link href="/analytics" className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-sm font-bold bg-[#3a5b5e] text-white shadow-lg transition-all"><PieChart size={20}/> Analytics</Link>
        </nav>
        <button className="flex items-center gap-4 px-5 py-4 text-sm font-bold opacity-40"><Settings size={20}/> Settings</button>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className="flex-grow flex flex-col min-h-screen overflow-y-auto">
        <div className="w-full max-w-[1100px] mx-auto px-4 lg:px-8 py-6 lg:py-10 pb-40">
          
          <header className="flex justify-between items-center mb-8">
            <div>
              <h2 className="text-2xl lg:text-3xl font-black tracking-tight">Analytics</h2>
              <p className="text-[10px] font-bold text-[#A0AEC0] uppercase tracking-widest mt-1">Financial Insights</p>
            </div>
            {loading && <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#5fa4ad]"></div>}
          </header>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-[#3a5b5e] rounded-[2rem] p-6 shadow-xl text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10" />
              <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-2 flex items-center gap-1"><TrendingUp size={14}/> Expected Profit</p>
              <h2 className="text-3xl font-black tracking-tight text-green-300">
                <span className="text-sm font-medium opacity-70 mr-1">MVR</span>
                {totalProfit.toLocaleString(undefined, {maximumFractionDigits: 0})}
              </h2>
            </div>
            
            <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-[#E0E7E9]">
              <p className="text-[10px] font-black uppercase tracking-widest text-[#A0AEC0] mb-2">Shop Volume</p>
              <h2 className="text-3xl font-black tracking-tight text-[#364d54]">
                <span className="text-sm font-medium opacity-50 mr-1">MVR</span>
                {shopVolume.toLocaleString(undefined, {maximumFractionDigits: 0})}
              </h2>
            </div>

            <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-[#E0E7E9]">
              <p className="text-[10px] font-black uppercase tracking-widest text-[#A0AEC0] mb-2">Splitter Volume</p>
              <h2 className="text-3xl font-black tracking-tight text-[#364d54]">
                <span className="text-sm font-medium opacity-50 mr-1">MVR</span>
                {splitVolume.toLocaleString(undefined, {maximumFractionDigits: 0})}
              </h2>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            <div className="bg-white rounded-[2rem] p-6 lg:p-8 shadow-sm border border-[#E0E7E9]">
              <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-[#A0AEC0] mb-6 flex items-center gap-2"><PieChart size={16}/> Traffic Source</h3>
              
              <div className="h-6 w-full rounded-full bg-gray-100 flex overflow-hidden mb-4 shadow-inner">
                <div style={{ width: `${shopPercent}%` }} className="h-full bg-[#5fa4ad] transition-all duration-1000"></div>
                <div style={{ width: `${splitPercent}%` }} className="h-full bg-orange-400 transition-all duration-1000"></div>
              </div>
              
              <div className="flex justify-between text-xs font-bold">
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#5fa4ad]"></div> Shop Clearing ({shopPercent.toFixed(0)}%)</div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-orange-400"></div> Splitter ({splitPercent.toFixed(0)}%)</div>
              </div>
            </div>

            <div className="bg-white rounded-[2rem] p-6 lg:p-8 shadow-sm border border-red-100">
              <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-[#A0AEC0] mb-6 flex items-center gap-2"><AlertCircle size={16} className="text-red-400"/> Highest Pending (Owes You)</h3>
              
              {topDebtors.length === 0 ? (
                <p className="text-sm font-bold text-gray-400 text-center py-6">Everyone is fully paid up! 🎉</p>
              ) : (
                <div className="space-y-4">
                  {topDebtors.map((debtor, i) => (
                    <div key={i} className="flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-red-50 text-red-500 flex items-center justify-center font-black text-xs">{i + 1}</div>
                        <p className="font-bold text-[#364d54]">{debtor.name}</p>
                      </div>
                      <p className="font-black text-red-500">MVR {debtor.amount.toLocaleString(undefined, {maximumFractionDigits: 0})}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>

        {/* MOBILE BOTTOM NAV */}
        <nav className="lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 w-[95%] max-w-[400px] h-16 bg-white shadow-[0_10px_40px_rgba(0,0,0,0.1)] rounded-full border border-gray-100 flex justify-around items-center px-4 z-[100]">
          <Link href="/" className="text-gray-400 hover:text-[#3a5b5e] transition-colors"><Wallet size={20} /></Link>
          <Link href="/tracker" className="text-gray-400 hover:text-[#3a5b5e] transition-colors"><Banknote size={20} /></Link>
          <Link href="/splitter" className="text-gray-400 hover:text-[#3a5b5e] transition-colors"><Calculator size={20} /></Link>
          <Link href="/shop-clearing" className="text-gray-400 hover:text-[#3a5b5e] transition-colors"><ShoppingCart size={20} /></Link>
          <Link href="/analytics" className="text-[#3a5b5e]"><PieChart size={24} className="bg-[#e0f2fe] p-1.5 rounded-xl" /></Link>
        </nav>
      </div>
    </main>
  );
}