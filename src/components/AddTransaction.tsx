'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import AddTransaction from '@/components/AddTransaction'
import { 
  Wallet, Landmark, TrendingDown, Plus, 
  ReceiptText, User, Bell, Settings, 
  PieChart 
} from "lucide-react"

export default function Home() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [totalBalance, setTotalBalance] = useState(0)
  const [bills, setBills] = useState<any[]>([])

  // FETCH DATA FROM SUPABASE
  const fetchData = useCallback(async () => {
    setLoading(true)
    
    // Get all bills
    const { data: billsData, error: billsError } = await supabase
      .from('bills')
      .select('*')
      .order('created_at', { ascending: false })

    if (billsData) {
      setBills(billsData)
      const total = billsData.reduce((acc, b) => acc + Number(b.amount), 0)
      setTotalBalance(total)
    }
    
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return (
    <main className="min-h-screen bg-[#F8FAFB] text-[#364d54] font-sans flex">
      
      {/* 1. DESKTOP SIDEBAR (Visible on lg screens) */}
      <aside className="hidden lg:flex w-72 bg-white border-r border-[#E0E7E9] flex-col p-8 sticky top-0 h-screen shrink-0">
        <div className="mb-12">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#5fa4ad] mb-1">LexCorp Systems</p>
          <h1 className="text-2xl font-black tracking-tighter uppercase">Lextrack</h1>
        </div>
        <nav className="space-y-3 flex-grow">
          <button className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-sm font-bold bg-[#3a5b5e] text-white shadow-lg">
            <Wallet size={20}/> Dashboard
          </button>
          <button className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-sm font-bold hover:bg-[#F8FAFB] text-[#A0AEC0]">
            <Landmark size={20}/> Loans
          </button>
        </nav>
        <button className="flex items-center gap-4 px-5 py-4 text-sm font-bold opacity-40"><Settings size={20}/> Settings</button>
      </aside>

      {/* 2. MAIN CONTENT AREA */}
      <div className="flex-grow flex flex-col h-screen overflow-y-auto relative">
        <div className="w-full max-w-[1100px] mx-auto px-6 py-8 md:py-12 pb-32">
          
          <header className="flex justify-between items-center mb-10">
            <div>
              <h2 className="text-3xl font-black tracking-tight">MVR {totalBalance.toLocaleString()}</h2>
              <p className="text-xs font-bold text-[#A0AEC0] uppercase tracking-widest mt-1">Total Expenses Tracked</p>
            </div>
            <button className="w-12 h-12 rounded-2xl bg-white border border-[#E0E7E9] flex items-center justify-center shadow-sm">
              <User size={20} className="text-[#3a5b5e]" />
            </button>
          </header>

          {/* MAIN CARD */}
          <div className="bg-[#3a5b5e] rounded-[2.5rem] p-10 shadow-xl text-white relative overflow-hidden mb-8">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-24 -mt-24" />
            <p className="text-[11px] font-bold uppercase tracking-widest opacity-70 mb-2">Available Cash</p>
            <h2 className="text-5xl font-black tracking-tight mb-8">
              <span className="text-xl font-medium opacity-50 mr-2 italic">MVR</span>
              12,450.00
            </h2>
          </div>

          {/* LIST OF BILLS */}
          <div className="space-y-4">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-[#A0AEC0]">Recent Bills</h3>
              {loading && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#5fa4ad]"></div>}
            </div>
            
            {bills.map((bill) => (
              <div key={bill.id} className="flex justify-between items-center bg-white p-5 rounded-[2rem] border border-[#E0E7E9] shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 rounded-2xl bg-[#F8FAFB] flex items-center justify-center border border-[#E0E7E9]">
                    <TrendingDown size={18} className="text-orange-500" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[#364d54]">{bill.title}</p>
                    <p className="text-[10px] text-[#A0AEC0] font-medium uppercase">{bill.category}</p>
                  </div>
                </div>
                <p className="text-sm font-black text-orange-500">- {Number(bill.amount).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>

        {/* MOBILE BOTTOM NAV - TRIGGER MODAL */}
        <nav className="lg:hidden fixed bottom-8 left-1/2 -translate-x-1/2 w-[calc(100%-48px)] max-w-[400px] h-20 bg-white shadow-2xl border border-[#E0E7E9] rounded-[2.5rem] flex justify-around items-center px-4 z-50">
          <button className="p-3 text-[#3a5b5e]"><Wallet size={24} /></button>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="relative -mt-14 active:scale-90 transition-transform"
          >
            <div className="relative w-16 h-16 bg-[#3a5b5e] rounded-[1.5rem] flex items-center justify-center shadow-lg border-4 border-white">
              <Plus size={32} className="text-white" />
            </div>
          </button>
          <button className="p-3 text-[#A0AEC0]"><Bell size={24} /></button>
        </nav>
      </div>

      {/* MODAL COMPONENT */}
      <AddTransaction 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onRefresh={fetchData} 
      />
    </main>
  )
}