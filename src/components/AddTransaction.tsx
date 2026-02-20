"use client";

import { useState } from "react";
import { X } from "lucide-react";

interface AddTransactionProps {
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => Promise<void>;
}

export default function AddTransaction({ isOpen, onClose, onRefresh }: AddTransactionProps) {
  const [amount, setAmount] = useState("");
  
  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Your save logic here
    onClose();
    await onRefresh();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-[2.5rem] w-full max-w-md p-8 shadow-2xl relative">
        <button onClick={onClose} className="absolute top-6 right-6 text-[#A0AEC0] hover:text-[#364d54]">
          <X size={24} />
        </button>
        <h2 className="text-2xl font-black mb-6 text-[#3a5b5e]">Add Transaction</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-[#A0AEC0] mb-2">Amount (MVR)</label>
            <input 
              type="number" 
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-[#F8FAFB] border border-[#E0E7E9] rounded-2xl p-4 font-bold focus:outline-none focus:border-[#5fa4ad]"
              placeholder="0.00"
              required
            />
          </div>
          <button type="submit" className="w-full bg-[#3a5b5e] text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all">
            Save
          </button>
        </form>
      </div>
    </div>
  );
}