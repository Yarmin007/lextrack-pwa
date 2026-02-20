"use client";

import { useState, useEffect } from "react";
import { Wallet, Landmark, TrendingDown, Plus, ReceiptText, User, Bell, Settings, PieChart, ShoppingCart } from "lucide-react";
import Link from "next/link";
import AddTransaction from "@/components/AddTransaction";

export default function Home() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Placeholder for data fetching
  const fetchData = async () => {
    console.log("Refreshing dashboard data...");
  };

  return (
    <main className="min-h-screen bg-[#F8FAFB] text-[#364d54] font-sans flex relative">
      
      {/* 1. SIDEBAR: Fixed for Desktop */}
      <aside className="hidden lg:flex w-72 bg-white border-r border-[#E0E7E9] flex-col p-8 sticky top-0 h-screen shrink-0">
        <div className="mb-12">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#5fa4ad] mb-1">LexCorp Systems</p>
          <h1 className="text-2xl font-black tracking-tighter uppercase">Lextrack</h1>
        </div>
        <nav className="space-y-3 flex-grow">
          {[
            { icon: <Wallet size={20}/>, label: 'Dashboard', active: true, href: '/' },
            { icon: <Landmark size={20}/>, label: 'Loans', active: false, href: '#' },
            { icon: <ReceiptText size={20}/>, label: 'Bills', active: false, href: '#' },
            { icon: <PieChart size={20}/>, label: 'Analytics', active: false, href: '#' },
            { icon: <ShoppingCart size={20}/>, label: 'Shop Clearing', active: false, href: '/shop-clearing' },
          ].map((item, i) => (
            <Link 
              key={i} 
              href={item.href} 
              className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-sm font-bold transition-all ${item.active ? 'bg-[#3a5b5e] text-white shadow-lg' : 'hover:bg-[#F8FAFB]'}`}
            >
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
              <h2 className="text-2xl md:text-3xl font-black tracking-tight">Financial Overview</h2>
              <p className="text-xs font-bold text-[#A0AEC0] uppercase tracking-widest mt-1">Saturday, Feb 21</p>
            </div>
            <div className="flex items-center gap-3">
              <button className="hidden sm:flex w-12 h-12 rounded-2xl bg-white border border-[#E0E7E9] items-center justify-center shadow-sm"><Bell size={20}/></button>
              <button className="w-12 h-12 rounded-2xl bg-white border border-[#E0E7E9] flex items-center justify-center shadow-sm active:scale-95 transition-all">
                <User size={20} className="text-[#3a5b5e]" />
              </button>
            </div>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            <div className="md:col-span-2 bg-[#3a5b5e] rounded-[2.5rem] p-8 md:p-10 shadow-xl text-white relative overflow-hidden flex flex-col justify-between min-h-[240px]">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-24 -mt-24 pointer-events-none" />
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest opacity-70 mb-2">Available Balance</p>
                <h2 className="text-4xl md:text-5xl font-black tracking-tight">
                  <span className="text-xl font-medium opacity-50 mr-2 italic">MVR</span>
                  12,450.00
                </h2>
              </div>
              <div className="flex gap-4 mt-8">
                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10 flex-grow">
                  <p className="text-[9px] uppercase font-black opacity-50 mb-1 text-[#5fa4ad]">Loans</p>
                  <p className="text-lg font-bold">5,000</p>
                </div>
                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10 flex-grow">
                  <p className="text-[9px] uppercase font-black opacity-50 mb-1 text-orange-400">Bills</p>
                  <p className="text-lg font-bold">1,200</p>
                </div>
              </div>
            </div>

            <div className="hidden md:flex flex-col gap-4">
              <div className="bg-white border border-[#E0E7E9] rounded-[2.5rem] p-6 flex-grow flex flex-col justify-center items-center text-center shadow-sm">
                <div className="w-14 h-14 rounded-full border-4 border-[#F8FAFB] border-t-[#5fa4ad] flex items-center justify-center mb-3">
                  <span className="font-black text-xs">74%</span>
                </div>
                <p className="text-[10px] font-black uppercase tracking-widest text-[#A0AEC0]">Monthly Limit</p>
              </div>
              <button 
                onClick={() => setIsModalOpen(true)}
                className="bg-[#5fa4ad] text-[#364d54] py-5 rounded-[2rem] font-black uppercase text-xs tracking-widest shadow-lg active:scale-95 transition-all"
              >
                Add Transaction
              </button>
            </div>
          </div>

          <div className="w-full">
            <div className="flex justify-between items-center mb-6 px-2">
              <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-[#A0AEC0]">Recent Activity</h3>
              <button className="text-[10px] font-bold text-[#5fa4ad] uppercase">View History</button>
            </div>
            <div className="space-y-3">
              {[1, 2, 3].map((_, i) => (
                <div key={i} className="flex justify-between items-center bg-white p-5 rounded-[2rem] border border-[#E0E7E9] shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-2xl bg-[#F8FAFB] flex items-center justify-center border border-[#E0E7E9]">
                      <TrendingDown size={18} className="text-orange-500" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[#364d54]">Airtel Bill</p>
                      <p className="text-[10px] text-[#A0AEC0] font-medium uppercase">Feb 21, 2026</p>
                    </div>
                  </div>
                  <p className="text-sm font-black text-orange-500">- 450.00</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 3. MOBILE BOTTOM NAV: Fixed visibility and Z-Index */}
        <nav className="lg:hidden fixed bottom-8 left-1/2 -translate-x-1/2 w-[calc(100%-48px)] max-w-[400px] h-20 bg-white shadow-[0_20px_50px_rgba(0,0,0,0.1)] border border-[#E0E7E9] rounded-[2.5rem] flex justify-around items-center px-4 z-[100]">
          <Link href="/" className="p-3 text-[#3a5b5e]"><Wallet size={24} /></Link>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="relative -mt-14 active:scale-90 transition-transform"
          >
            <div className="absolute inset-0 bg-[#3a5b5e] blur-xl opacity-20" />
            <div className="relative w-16 h-16 bg-[#3a5b5e] rounded-[1.5rem] flex items-center justify-center shadow-lg border-4 border-white">
              <Plus size={32} className="text-white" />
            </div>
          </button>
          <Link href="/shop-clearing" className="p-3 text-[#A0AEC0]"><ShoppingCart size={24} /></Link>
        </nav>
      </div>

      {/* 4. MODAL: Passing the required props to fix build error */}
      <AddTransaction 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onRefresh={fetchData} 
      />
    </main>
  );
}