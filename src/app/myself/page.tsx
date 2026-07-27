'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Scale, Compass, Lock, Plus, Trash2, Calendar, 
  ShieldCheck, FileText, CheckCircle2, AlertCircle, X, 
  TrendingDown, TrendingUp, UploadCloud, Tag, User, MapPin, ExternalLink
} from 'lucide-react';

type SubTab = 'weight' | 'trips' | 'vault';

interface WeightLog {
  id: string;
  weight_kg: number;
  log_date: string;
  notes?: string;
  created_at?: string;
}

interface TripLog {
  id: string;
  destination: string;
  start_date: string;
  end_date?: string;
  budget_mvr: number;
  status: 'upcoming' | 'completed';
  notes?: string;
}

interface VaultDoc {
  id: string;
  title: string;
  category: string;
  file_url?: string;
  created_at: string;
}

export default function MyselfPage() {
  const [activeTab, setActiveTab] = useState<SubTab>('weight');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [loading, setLoading] = useState(false);

  // Data States
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([]);
  const [trips, setTrips] = useState<TripLog[]>([]);
  const [vaultDocs, setVaultDocs] = useState<VaultDoc[]>([]);

  // Weight Form
  const [weightKgInput, setWeightKgInput] = useState('');
  const [weightNotesInput, setWeightNotesInput] = useState('');
  const [targetWeight, setTargetWeight] = useState('70');

  // Trip Form
  const [tripDest, setTripDest] = useState('');
  const [tripStart, setTripStart] = useState(new Date().toISOString().split('T')[0]);
  const [tripEnd, setTripEnd] = useState('');
  const [tripBudget, setTripBudget] = useState('');
  const [tripStatus, setTripStatus] = useState<'upcoming' | 'completed'>('upcoming');
  const [tripNotes, setTripNotes] = useState('');

  // Vault Form Modal
  const [isVaultModalOpen, setIsVaultModalOpen] = useState(false);
  const [docTitle, setDocTitle] = useState('');
  const [docCategory, setDocCategory] = useState('ID & Passport');
  const [docFileUrl, setDocFileUrl] = useState('');

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchPersonalData = useCallback(async () => {
    setLoading(true);
    const [wRes, tRes, vRes] = await Promise.all([
      supabase.from('myself_weight_logs').select('*').order('log_date', { ascending: false }),
      supabase.from('myself_trips').select('*').order('start_date', { ascending: false }),
      supabase.from('myself_vault_docs').select('*').order('created_at', { ascending: false })
    ]);

    if (wRes.data) setWeightLogs(wRes.data as WeightLog[]);
    if (tRes.data) setTrips(tRes.data as TripLog[]);
    if (vRes.data) setVaultDocs(vRes.data as VaultDoc[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchPersonalData();
  }, [fetchPersonalData]);

  // --- Handlers: Weight ---
  const handleAddWeightLog = async () => {
    const val = parseFloat(weightKgInput) || 0;
    if (val <= 0) return showToast('Enter a valid weight in kg', 'error');

    const payload = {
      weight_kg: val,
      log_date: new Date().toISOString().split('T')[0],
      notes: weightNotesInput.trim()
    };

    const { error } = await supabase.from('myself_weight_logs').insert(payload);
    if (!error) {
      showToast('Weight log saved!');
      setWeightKgInput('');
      setWeightNotesInput('');
      fetchPersonalData();
    } else {
      showToast(`Error: ${error.message}`, 'error');
    }
  };

  const handleDeleteWeightLog = async (id: string) => {
    if (!confirm('Delete this weight entry?')) return;
    await supabase.from('myself_weight_logs').delete().eq('id', id);
    fetchPersonalData();
    showToast('Weight log deleted');
  };

  // --- Handlers: Trips ---
  const handleAddTrip = async () => {
    if (!tripDest.trim()) return showToast('Enter destination name', 'error');

    const payload = {
      destination: tripDest.trim(),
      start_date: tripStart,
      end_date: tripEnd || null,
      budget_mvr: parseFloat(tripBudget) || 0,
      status: tripStatus,
      notes: tripNotes.trim()
    };

    const { error } = await supabase.from('myself_trips').insert(payload);
    if (!error) {
      showToast('Trip entry added!');
      setTripDest('');
      setTripBudget('');
      setTripNotes('');
      fetchPersonalData();
    } else {
      showToast(`Error: ${error.message}`, 'error');
    }
  };

  const handleDeleteTrip = async (id: string) => {
    if (!confirm('Delete this trip?')) return;
    await supabase.from('myself_trips').delete().eq('id', id);
    fetchPersonalData();
    showToast('Trip record deleted');
  };

  // --- Handlers: Vault ---
  const handleAddVaultDoc = async () => {
    if (!docTitle.trim()) return showToast('Enter document title', 'error');

    const payload = {
      title: docTitle.trim(),
      category: docCategory,
      file_url: docFileUrl.trim()
    };

    const { error } = await supabase.from('myself_vault_docs').insert(payload);
    if (!error) {
      showToast('Document stored in vault!');
      setDocTitle('');
      setDocFileUrl('');
      setIsVaultModalOpen(false);
      fetchPersonalData();
    } else {
      showToast(`Error: ${error.message}`, 'error');
    }
  };

  const handleDeleteVaultDoc = async (id: string) => {
    if (!confirm('Delete document from vault?')) return;
    await supabase.from('myself_vault_docs').delete().eq('id', id);
    fetchPersonalData();
    showToast('Document removed');
  };

  // Weight Metrics
  const latestWeight = weightLogs[0]?.weight_kg || 0;
  const previousWeight = weightLogs[1]?.weight_kg || latestWeight;
  const weightDiff = latestWeight - previousWeight;

  return (
    <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-8 pb-28">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[999] px-4 py-2.5 rounded-xl shadow-lg text-xs font-bold text-white flex items-center gap-2 animate-in slide-in-from-top-4 ${toast.type === 'error' ? 'bg-rose-500' : 'bg-slate-900'}`}>
          {toast.type === 'error' ? <AlertCircle size={15}/> : <CheckCircle2 size={15}/>}
          <span>{toast.message}</span>
        </div>
      )}

      {/* VAULT UPLOAD MODAL */}
      {isVaultModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-[1000] flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 max-w-sm w-full shadow-2xl space-y-3">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Lock size={15} className="text-indigo-600"/> Add Document Record
              </h3>
              <button onClick={() => setIsVaultModalOpen(false)} className="text-slate-400 p-1"><X size={16}/></button>
            </div>

            <div className="space-y-2.5">
              <div>
                <label className="text-[9px] font-bold uppercase text-slate-400 block mb-1">Document Title</label>
                <input 
                  type="text" 
                  placeholder="e.g. Passport Copy, House Lease Agreement" 
                  value={docTitle} 
                  onChange={(e) => setDocTitle(e.target.value)} 
                  className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-bold text-slate-800 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[9px] font-bold uppercase text-slate-400 block mb-1">Category</label>
                <select 
                  value={docCategory} 
                  onChange={(e) => setDocCategory(e.target.value)} 
                  className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-bold text-slate-700 focus:outline-none"
                >
                  <option value="ID & Passport">🆔 ID & Passport</option>
                  <option value="Contracts & Leases">📜 Contracts & Leases</option>
                  <option value="Receipts & Finance">🧾 Receipts & Finance</option>
                  <option value="Medical & Health">🏥 Medical & Health</option>
                  <option value="General">📂 General</option>
                </select>
              </div>

              <div>
                <label className="text-[9px] font-bold uppercase text-slate-400 block mb-1">File Link or Cloud URL (Optional)</label>
                <input 
                  type="text" 
                  placeholder="https://drive.google.com/... or storage link" 
                  value={docFileUrl} 
                  onChange={(e) => setDocFileUrl(e.target.value)} 
                  className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-bold text-slate-800 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-slate-100">
              <button 
                onClick={() => setIsVaultModalOpen(false)} 
                className="flex-1 py-2 bg-slate-100 text-slate-600 font-bold text-xs rounded-xl"
              >
                Cancel
              </button>
              <button 
                onClick={handleAddVaultDoc} 
                className="flex-1 py-2 bg-slate-900 text-white font-bold text-xs rounded-xl"
              >
                Store Document
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HEADER & SUBTAB SWITCHER */}
      <header className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 mb-5">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
            <User size={22} className="text-indigo-600"/> Personal Space
          </h2>
          <p className="text-xs font-semibold text-slate-500 mt-0.5">Track personal health metrics, travel itineraries, and document archives.</p>
        </div>

        <div className="flex items-center gap-1 bg-white border border-slate-200 p-1 rounded-xl shadow-2xs w-fit">
          <button 
            onClick={() => setActiveTab('weight')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors ${activeTab === 'weight' ? 'bg-slate-900 text-white shadow-2xs' : 'text-slate-500'}`}
          >
            ⚖️ Weight
          </button>
          <button 
            onClick={() => setActiveTab('trips')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors ${activeTab === 'trips' ? 'bg-slate-900 text-white shadow-2xs' : 'text-slate-500'}`}
          >
            🗺️ Trips
          </button>
          <button 
            onClick={() => setActiveTab('vault')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors ${activeTab === 'vault' ? 'bg-slate-900 text-white shadow-2xs' : 'text-slate-500'}`}
          >
            🔒 Vault
          </button>
        </div>
      </header>

      {/* TAB 1: WEIGHT TRACKER */}
      {activeTab === 'weight' && (
        <div className="space-y-5 animate-in fade-in duration-200">
          
          {/* STATS METRIC CARDS */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white border border-slate-200/80 p-4 rounded-2xl shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-[9px] font-extrabold uppercase text-slate-400 tracking-wider">Current Weight</span>
                <p className="text-xl font-black text-slate-900 mt-0.5">{latestWeight ? `${latestWeight} kg` : 'N/A'}</p>
              </div>
              <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                <Scale size={18}/>
              </div>
            </div>

            <div className="bg-white border border-slate-200/80 p-4 rounded-2xl shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-[9px] font-extrabold uppercase text-slate-400 tracking-wider">Target Weight</span>
                <div className="flex items-center gap-1 mt-0.5">
                  <input 
                    type="number" 
                    value={targetWeight} 
                    onChange={(e) => setTargetWeight(e.target.value)} 
                    className="w-12 text-xl font-black text-indigo-600 bg-slate-50 border border-slate-200 px-1 rounded-md focus:outline-none"
                  />
                  <span className="text-xs font-bold text-slate-400">kg</span>
                </div>
              </div>
              <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                <ShieldCheck size={18}/>
              </div>
            </div>

            <div className="bg-white border border-slate-200/80 p-4 rounded-2xl shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-[9px] font-extrabold uppercase text-slate-400 tracking-wider">Last Change</span>
                <p className={`text-xl font-black mt-0.5 ${weightDiff < 0 ? 'text-emerald-600' : weightDiff > 0 ? 'text-rose-600' : 'text-slate-800'}`}>
                  {weightDiff === 0 ? '0 kg' : `${weightDiff > 0 ? '+' : ''}${weightDiff.toFixed(1)} kg`}
                </p>
              </div>
              <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${weightDiff <= 0 ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-rose-50 border-rose-100 text-rose-600'}`}>
                {weightDiff <= 0 ? <TrendingDown size={18}/> : <TrendingUp size={18}/>}
              </div>
            </div>
          </div>

          {/* LOG WEIGHT ENTRY FORM */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 sm:p-5 shadow-2xs space-y-3">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Plus size={15} className="text-indigo-600"/> Log New Weight Entry
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
              <div className="sm:col-span-4 relative">
                <input 
                  type="number" 
                  placeholder="Weight (kg)" 
                  value={weightKgInput} 
                  onChange={(e) => setWeightKgInput(e.target.value)} 
                  className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-bold text-slate-900 focus:outline-none"
                />
              </div>

              <div className="sm:col-span-8">
                <input 
                  type="text" 
                  placeholder="Notes (e.g. Morning, after workout, before breakfast)" 
                  value={weightNotesInput} 
                  onChange={(e) => setWeightNotesInput(e.target.value)} 
                  className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-bold text-slate-800 focus:outline-none"
                />
              </div>
            </div>

            <button 
              onClick={handleAddWeightLog}
              className="w-full h-10 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-2xs transition-transform active:scale-95 flex items-center justify-center gap-1.5"
            >
              <Plus size={14}/> Save Weight Log
            </button>
          </div>

          {/* WEIGHT LOGS HISTORY TABLE */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs space-y-3">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Weight History Log</h3>

            {weightLogs.length === 0 ? (
              <p className="text-xs text-slate-400 italic text-center py-8">No weight logs recorded yet. Add your first log above!</p>
            ) : (
              <div className="divide-y divide-slate-100 max-h-[50vh] overflow-y-auto pr-1">
                {weightLogs.map((log) => (
                  <div key={log.id} className="flex justify-between items-center py-2.5 hover:bg-slate-50/50 rounded-xl px-2 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-black text-xs shrink-0">
                        {log.weight_kg}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900">{log.weight_kg} kg</p>
                        <p className="text-[10px] font-semibold text-slate-400 flex items-center gap-1 mt-0.5">
                          <Calendar size={10}/> {new Date(log.log_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                          {log.notes && <span>• {log.notes}</span>}
                        </p>
                      </div>
                    </div>

                    <button onClick={() => handleDeleteWeightLog(log.id)} className="text-slate-300 hover:text-rose-500 p-1">
                      <Trash2 size={13}/>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: TRIP DIARY */}
      {activeTab === 'trips' && (
        <div className="space-y-5 animate-in fade-in duration-200">
          
          {/* ADD TRIP FORM */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 sm:p-5 shadow-2xs space-y-3">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Compass size={15} className="text-indigo-600"/> Record Trip Itinerary
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
              <input 
                type="text" 
                placeholder="Destination (e.g. Fuvahmulah, Colombo, Dubai)" 
                value={tripDest} 
                onChange={(e) => setTripDest(e.target.value)} 
                className="sm:col-span-5 bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-bold text-slate-800 focus:outline-none"
              />

              <div className="sm:col-span-3">
                <input 
                  type="date" 
                  value={tripStart} 
                  onChange={(e) => setTripStart(e.target.value)} 
                  className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-bold text-slate-700 focus:outline-none"
                />
              </div>

              <div className="sm:col-span-4">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">MVR</span>
                  <input 
                    type="number" 
                    placeholder="Est. Budget" 
                    value={tripBudget} 
                    onChange={(e) => setTripBudget(e.target.value)} 
                    className="w-full bg-slate-50 border border-slate-200 py-2.5 pl-12 pr-3 rounded-xl text-xs font-bold text-slate-800 focus:outline-none"
                  />
                </div>
              </div>

              <div className="sm:col-span-12">
                <input 
                  type="text" 
                  placeholder="Notes & Highlights (e.g. Resort stay, Diving trip, Hotel bookings)" 
                  value={tripNotes} 
                  onChange={(e) => setTripNotes(e.target.value)} 
                  className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-bold text-slate-800 focus:outline-none"
                />
              </div>
            </div>

            <button 
              onClick={handleAddTrip}
              className="w-full h-10 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-2xs transition-transform active:scale-95 flex items-center justify-center gap-1.5"
            >
              <Plus size={14}/> Save Trip Entry
            </button>
          </div>

          {/* TRIPS GRID LIST */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Recorded Journeys</h3>

            {trips.length === 0 ? (
              <p className="text-xs text-slate-400 italic text-center py-10 bg-white rounded-2xl border border-dashed border-slate-200">
                No trips logged. Record your upcoming or past travels above!
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {trips.map((t) => (
                  <div key={t.id} className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2 relative group">
                    <div className="flex justify-between items-start pr-6">
                      <div className="flex items-center gap-2">
                        <MapPin size={16} className="text-indigo-600 shrink-0"/>
                        <h4 className="font-extrabold text-slate-900 text-sm truncate">{t.destination}</h4>
                      </div>
                    </div>

                    <button 
                      onClick={() => handleDeleteTrip(t.id)} 
                      className="absolute top-3 right-3 text-slate-300 hover:text-rose-500 p-0.5"
                    >
                      <Trash2 size={13}/>
                    </button>

                    <div className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                      <Calendar size={11}/> {new Date(t.start_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </div>

                    {t.notes && (
                      <p className="text-xs font-medium text-slate-600 bg-slate-50 p-2 rounded-xl border border-slate-100 line-clamp-2">
                        {t.notes}
                      </p>
                    )}

                    <div className="pt-2 border-t border-slate-100 flex justify-between items-center text-xs">
                      <span className="text-[10px] font-extrabold text-slate-400 uppercase">Budget</span>
                      <span className="font-black text-indigo-600">MVR {Number(t.budget_mvr).toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: DOCUMENT VAULT */}
      {activeTab === 'vault' && (
        <div className="space-y-5 animate-in fade-in duration-200">
          
          <div className="flex justify-between items-center bg-white border border-slate-200/80 p-4 rounded-2xl shadow-2xs">
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <Lock size={15} className="text-indigo-600"/> Secure Document Storage
              </h3>
              <p className="text-[10px] font-semibold text-slate-400 mt-0.5">Archive IDs, Passports, Contracts, and Receipts safely.</p>
            </div>

            <button 
              onClick={() => setIsVaultModalOpen(true)}
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-2xs transition-transform active:scale-95 flex items-center gap-1.5 shrink-0"
            >
              <Plus size={14}/> + Add Doc
            </button>
          </div>

          {/* VAULT DOCS GRID */}
          <div>
            {vaultDocs.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-200 space-y-2">
                <Lock size={28} className="mx-auto text-slate-300"/>
                <p className="text-xs text-slate-400 italic">Vault is currently empty. Store your first document record above!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {vaultDocs.map((doc) => (
                  <div key={doc.id} className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col justify-between relative group">
                    <div className="space-y-2 pr-6">
                      <span className="text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 border border-indigo-100">
                        {doc.category}
                      </span>
                      <h4 className="font-extrabold text-slate-900 text-sm">{doc.title}</h4>
                    </div>

                    <button 
                      onClick={() => handleDeleteVaultDoc(doc.id)} 
                      className="absolute top-3.5 right-3 text-slate-300 hover:text-rose-500 p-0.5"
                    >
                      <Trash2 size={13}/>
                    </button>

                    <div className="pt-3 border-t border-slate-100 mt-3 flex justify-between items-center text-[10px] font-bold text-slate-400">
                      <span>{new Date(doc.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                      {doc.file_url ? (
                        <a 
                          href={doc.file_url} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="text-indigo-600 font-extrabold flex items-center gap-0.5 hover:underline"
                        >
                          View File <ExternalLink size={10}/>
                        </a>
                      ) : (
                        <span className="text-slate-300">No URL link</span>
                      )}
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