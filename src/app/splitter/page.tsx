"use client";

import { useState } from "react";
import { Utensils, Navigation, Plus, X, Trash2, Wallet, ShoppingCart, ReceiptText } from "lucide-react";
import Link from "next/link";

export default function SplitterPage() {
  const [mode, setMode] = useState<'food' | 'trip'>('food');
  const [totalBill, setTotalBill] = useState("");
  const [delivery, setDelivery] = useState("");
  const [people, setPeople] = useState([{ name: "", amount: "" }]);

  const addPerson = () => setPeople([...people, { name: "", amount: "" }]);
  const removePerson = (index: number) => {
    if (people.length > 1) setPeople(people.filter((_, i) => i !== index));
  };

  const updatePerson = (index: number, field: string, value: string) => {
    const next = [...people];
    next[index] = { ...next[index], [field]: value };
    setPeople(next);
  };

  const calculateSplits = () => {
    const billNum = parseFloat(totalBill) || 0;
    const deliveryNum = parseFloat(delivery) || 0;
    const deliverySplit = people.length > 0 ? (deliveryNum / people.length) : 0;

    return people.map(p => {
      let share = 0;
      if (mode === 'food') {
        share = (parseFloat(p.amount) || 0) + deliverySplit;
      } else {
        share = people.length > 0 ? (billNum / people.length) : 0;
      }
      return { ...p, share };
    });
  };

  const results = calculateSplits();

  return (
    <main className="min-h-screen bg-[#F0F4F8] text-[#364d54] font-sans pb-32">
      <div className="max-w-[800px] mx-auto px-4 py-6">
        
        {/* Header */}
        <header className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-black tracking-tight text-[#364d54]">Splitter</h2>
            <p className="text-[10px] font-bold text-[#A0AEC0] uppercase tracking-widest mt-0.5">Expense Calculator</p>
          </div>
          <Link href="/" className="w-10 h-10 rounded-full bg-white border border-[#E0E7E9] flex items-center justify-center shadow-sm text-[#A0AEC0] active:scale-90 transition-transform">
            <X size={18}/>
          </Link>
        </header>

        {/* Mode Toggle Slider */}
        <div className="flex bg-white p-1 rounded-2xl mb-6 shadow-sm border border-gray-100 relative">
          <button onClick={() => setMode('food')} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all z-10 ${mode === 'food' ? 'text-white' : 'text-gray-400'}`}>
            <Utensils size={14}/> Food
          </button>
          <button onClick={() => setMode('trip')} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all z-10 ${mode === 'trip' ? 'text-white' : 'text-gray-400'}`}>
            <Navigation size={14}/> Trip
          </button>
          {/* Animated Background Pill */}
          <div className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-[#3a5b5e] rounded-xl transition-all duration-300 ease-out shadow-md ${mode === 'food' ? 'left-1' : 'left-[calc(50%+2px)]'}`} />
        </div>

        {/* Master Input Card */}
        <div className="bg-white p-5 rounded-[2rem] border border-gray-100 shadow-sm space-y-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="text-[9px] font-black uppercase tracking-widest text-[#A0AEC0] ml-1 block mb-1">Total Bill (MVR)</label>
              <input type="number" value={totalBill} onChange={e => setTotalBill(e.target.value)} className="w-full bg-gray-50 p-3.5 rounded-xl font-black text-lg border-none focus:ring-2 focus:ring-[#5fa4ad]" placeholder="0.00"/>
            </div>
            {mode === 'food' && (
              <div className="flex-1 animate-in fade-in zoom-in duration-200">
                <label className="text-[9px] font-black uppercase tracking-widest text-orange-400 ml-1 block mb-1">Delivery Fee</label>
                <input type="number" value={delivery} onChange={e => setDelivery(e.target.value)} className="w-full bg-orange-50/50 p-3.5 rounded-xl font-black text-lg text-orange-600 border-none focus:ring-2 focus:ring-orange-300" placeholder="0.00"/>
              </div>
            )}
          </div>
        </div>

        {/* Dynamic Participants List */}
        <div className="mb-6">
          <div className="flex justify-between items-center px-1 mb-3">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#A0AEC0]">Who's paying?</h3>
            <button onClick={addPerson} className="text-[#5fa4ad] bg-[#e0f2fe] px-3 py-1.5 rounded-lg flex items-center gap-1 font-black text-[9px] uppercase tracking-widest active:scale-95 transition-transform">
              <Plus size={12}/> Add
            </button>
          </div>
          
          <div className="space-y-2">
            {people.map((p, i) => (
              <div key={i} className="bg-white p-3 rounded-2xl border border-gray-100 flex items-center gap-2 shadow-sm">
                <div className="w-6 h-6 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center text-[10px] font-black flex-shrink-0">{i + 1}</div>
                <input type="text" placeholder="Name" value={p.name} onChange={e => updatePerson(i, "name", e.target.value)} className="flex-1 bg-transparent p-2 text-sm font-bold border-none focus:ring-0 placeholder-gray-300"/>
                {mode === 'food' && (
                  <input type="number" placeholder="MVR" value={p.amount} onChange={e => updatePerson(i, "amount", e.target.value)} className="w-24 bg-gray-50 p-2 rounded-lg text-sm font-black border-none text-right focus:ring-1 focus:ring-[#5fa4ad]"/>
                )}
                <button onClick={() => removePerson(i)} className="p-2 text-gray-300 hover:text-red-400 transition-colors"><Trash2 size={16}/></button>
              </div>
            ))}
          </div>
        </div>

        {/* Final Receipt Card */}
        <div className="bg-[#3a5b5e] p-6 rounded-[2rem] shadow-xl text-white relative">
          <div className="absolute top-0 left-0 w-full h-4 opacity-20 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjZmZmIi8+Cjwvc3ZnPg==')] animate-pulse" />
          
          <h3 className="text-[10px] font-black uppercase tracking-widest opacity-50 mb-4 flex items-center gap-2 mt-2">
            <ReceiptText size={14}/> Final Breakdown
          </h3>
          
          <div className="space-y-3">
            {results.map((r, i) => (
              <div key={i} className="flex justify-between items-end border-b border-white/10 pb-2 border-dashed">
                <span className="font-bold text-sm">{r.name || `Person ${i + 1}`}</span>
                <span className="font-black text-lg text-green-300"><span className="text-[9px] mr-1 opacity-70">MVR</span>{r.share.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Mobile Nav */}
      <nav className="lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-[400px] h-16 bg-white shadow-[0_10px_40px_rgba(0,0,0,0.1)] rounded-full border border-gray-100 flex justify-around items-center px-6 z-[100]">
        <Link href="/" className="text-gray-400 hover:text-[#3a5b5e] transition-colors"><Wallet size={20} /></Link>
        <Link href="/splitter" className="text-[#3a5b5e]"><Plus size={24} className="bg-[#e0f2fe] p-1 rounded-md" /></Link>
        <Link href="/shop-clearing" className="text-gray-400 hover:text-[#3a5b5e] transition-colors"><ShoppingCart size={20} /></Link>
      </nav>
    </main>
  );
}