"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { 
  Gamepad2, Plus, Trash2, Trophy, Users, Shield, Award, 
  ChevronLeft, LayoutDashboard, Banknote, Calculator, ShoppingCart, Flame, User, CheckCircle2, AlertCircle, RefreshCw, X, Wallet, Spade, Dices, Sparkles, Layers, Search, Star, Pencil
} from "lucide-react";
import Link from "next/link";

interface MasterMember {
  id: string;
  full_name: string;
}

// Tournament Types
interface TournamentParticipant {
  id: string;
  competition_id: string;
  player_name: string;
  master_member_id?: string;
  total_score: number;
  wins: number;
}

interface Match {
  id: string;
  competition_id: string;
  round_name: string;
  player1_name: string;
  player2_name: string;
  player1_score: number | string;
  player2_score: number | string;
  winner_name: string | null;
}

interface Competition {
  id: string;
  title: string;
  game_type: string;
  status: string;
  participants: TournamentParticipant[];
  matches: Match[];
}

// Casual Game Types (e.g. Digu)
interface CasualPlayer {
  id: string;
  session_id: string;
  player_name: string;
  master_member_id?: string;
}

interface CasualRoundScore {
  id: string;
  session_id: string;
  round_number: number;
  player_id: string;
  score: number;
  is_gin?: boolean;
}

interface CasualSession {
  id: string;
  session_name: string;
  game_title: string;
  target_rounds: number;
  players: CasualPlayer[];
  rounds: CasualRoundScore[];
}

export default function GamingPage() {
  const [hubTab, setHubTab] = useState<'casual' | 'tournaments'>('casual');
  const [selectedCasualCategory, setSelectedCasualCategory] = useState<string | null>(null);

  // Competitions State
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [selectedCompId, setSelectedCompId] = useState<string | null>(null);

  // Casual Game Sessions State
  const [casualSessions, setCasualSessions] = useState<CasualSession[]>([]);
  const [selectedCasualId, setSelectedCasualId] = useState<string | null>(null);

  const [masterMembers, setMasterMembers] = useState<MasterMember[]>([]);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [loading, setLoading] = useState(false);

  // Competition Form States
  const [compTitle, setCompTitle] = useState("");
  const [gameType, setGameType] = useState("FIFA / PS");

  // Casual Session Form States
  const [casualName, setCasualName] = useState("");
  const [targetRoundsInput, setTargetRoundsInput] = useState("5");

  // Live Master Member Search State
  const [playerSearchQuery, setPlayerSearchQuery] = useState("");
  const [customPlayerName, setCustomPlayerName] = useState("");

  // Log Tournament Match Form
  const [p1Name, setP1Name] = useState("");
  const [p2Name, setP2Name] = useState("");
  const [p1Score, setP1Score] = useState("");
  const [p2Score, setP2Score] = useState("");
  const [roundLabel, setRoundName] = useState("Round 1");

  // Log Casual Round Scores State
  const [roundScoresInput, setRoundScoresInput] = useState<Record<string, string>>({});
  const [ginPlayerId, setGinPlayerId] = useState<string | null>(null);

  // Edit Round Modal State
  const [editRoundModal, setEditMemberModal] = useState<{
    isOpen: boolean;
    roundNumber: number | null;
    scores: Record<string, string>;
    ginId: string | null;
  }>({
    isOpen: false,
    roundNumber: null,
    scores: {},
    ginId: null
  });

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchMasterMembers = async () => {
    const { data } = await supabase.from('activity_master_members').select('id, full_name').order('full_name', { ascending: true });
    if (data) setMasterMembers(data as MasterMember[]);
  };

  const fetchCompetitions = useCallback(async () => {
    setLoading(true);
    const { data: compData, error } = await supabase.from('gaming_competitions').select('*').order('created_at', { ascending: false });

    if (!error && compData) {
      const consolidated: Competition[] = await Promise.all(compData.map(async (c: any) => {
        const [pRes, mRes] = await Promise.all([
          supabase.from('gaming_participants').select('*').eq('competition_id', c.id).order('total_score', { ascending: false }),
          supabase.from('gaming_matches').select('*').eq('competition_id', c.id).order('created_at', { ascending: false })
        ]);
        return {
          ...c,
          participants: pRes.data || [],
          matches: mRes.data || []
        };
      }));
      setCompetitions(consolidated);
    }
    setLoading(false);
  }, []);

  const fetchCasualSessions = useCallback(async () => {
    setLoading(true);
    const { data: sesData, error } = await supabase.from('casual_game_sessions').select('*').order('created_at', { ascending: false });

    if (!error && sesData) {
      const consolidated: CasualSession[] = await Promise.all(sesData.map(async (s: any) => {
        const [pRes, rRes] = await Promise.all([
          supabase.from('casual_game_players').select('*').eq('session_id', s.id).order('created_at', { ascending: true }),
          supabase.from('casual_game_rounds').select('*').eq('session_id', s.id).order('round_number', { ascending: true })
        ]);
        return {
          ...s,
          target_rounds: s.target_rounds || 5,
          players: pRes.data || [],
          rounds: rRes.data || []
        };
      }));
      setCasualSessions(consolidated);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchMasterMembers();
    fetchCompetitions();
    fetchCasualSessions();
  }, [fetchCompetitions, fetchCasualSessions]);

  const currentComp = competitions.find(c => c.id === selectedCompId);
  const currentCasual = casualSessions.find(s => s.id === selectedCasualId);

  // --- Handlers for Tournaments ---
  const handleCreateCompetition = async () => {
    if (!compTitle.trim()) return showToast("Enter competition name", "error");

    const { data, error } = await supabase.from('gaming_competitions').insert({
      title: compTitle.trim(),
      game_type: gameType,
      status: 'active'
    }).select().single();

    if (!error && data) {
      setCompTitle("");
      showToast("Competition created!");
      fetchCompetitions();
      setSelectedCompId(data.id);
    } else {
      showToast(`Error: ${error?.message}`, "error");
    }
  };

  const handleDeleteCompetition = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!confirm("Delete tournament?")) return;

    await supabase.from('gaming_competitions').delete().eq('id', id);
    if (selectedCompId === id) setSelectedCompId(null);
    showToast("Competition deleted");
    fetchCompetitions();
  };

  const handleAddPlayerToCompetitionName = async (nameToAdd: string, masterId?: string) => {
    if (!currentComp) return;

    const isAlready = currentComp.participants.some(p => p.player_name.toLowerCase() === nameToAdd.toLowerCase());
    if (isAlready) return showToast("Player already in tournament", "error");

    const { error } = await supabase.from('gaming_participants').insert({
      competition_id: currentComp.id,
      player_name: nameToAdd,
      master_member_id: masterId || null,
      total_score: 0,
      wins: 0
    });

    if (!error) {
      setPlayerSearchQuery("");
      setCustomPlayerName("");
      showToast(`${nameToAdd} added!`);
      fetchCompetitions();
    }
  };

  const handleRemoveTournamentPlayer = async (pId: string) => {
    await supabase.from('gaming_participants').delete().eq('id', pId);
    fetchCompetitions();
  };

  const handleLogMatch = async () => {
    if (!currentComp) return;
    if (!p1Name || !p2Name) return showToast("Select both players", "error");
    if (p1Name === p2Name) return showToast("Players must be different", "error");

    const s1 = parseFloat(p1Score) || 0;
    const s2 = parseFloat(p2Score) || 0;

    let winner = null;
    if (s1 > s2) winner = p1Name;
    else if (s2 > s1) winner = p2Name;

    const { error } = await supabase.from('gaming_matches').insert({
      competition_id: currentComp.id,
      round_name: roundLabel.trim() || 'Match',
      player1_name: p1Name,
      player2_name: p2Name,
      player1_score: s1,
      player2_score: s2,
      winner_name: winner
    });

    if (!error) {
      const p1Obj = currentComp.participants.find(p => p.player_name === p1Name);
      const p2Obj = currentComp.participants.find(p => p.player_name === p2Name);

      if (p1Obj) {
        await supabase.from('gaming_participants').update({
          total_score: (p1Obj.total_score || 0) + s1,
          wins: (p1Obj.wins || 0) + (winner === p1Name ? 1 : 0)
        }).eq('id', p1Obj.id);
      }

      if (p2Obj) {
        await supabase.from('gaming_participants').update({
          total_score: (p2Obj.total_score || 0) + s2,
          wins: (p2Obj.wins || 0) + (winner === p2Name ? 1 : 0)
        }).eq('id', p2Obj.id);
      }

      setP1Score("");
      setP2Score("");
      showToast("Match recorded!");
      fetchCompetitions();
    }
  };

  const handleRemoveMatch = async (mId: string) => {
    await supabase.from('gaming_matches').delete().eq('id', mId);
    fetchCompetitions();
  };

  // --- Handlers for Casual Sessions (Digu) ---
  const handleCreateCasualSession = async () => {
    if (!casualName.trim()) return showToast("Enter session name", "error");
    const category = selectedCasualCategory || "Digu";
    const roundsTarget = parseInt(targetRoundsInput) || 5;

    const { data, error } = await supabase.from('casual_game_sessions').insert({
      session_name: casualName.trim(),
      game_title: category,
      target_rounds: roundsTarget
    }).select().single();

    if (!error && data) {
      setCasualName("");
      showToast(`${category} session started!`);
      fetchCasualSessions();
      setSelectedCasualId(data.id);
    } else {
      showToast(`Error: ${error?.message}`, "error");
    }
  };

  const handleDeleteCasualSession = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!confirm("Delete session and all round scores?")) return;

    await supabase.from('casual_game_sessions').delete().eq('id', id);
    if (selectedCasualId === id) setSelectedCasualId(null);
    showToast("Session deleted");
    fetchCasualSessions();
  };

  const handleAddCasualPlayerName = async (nameToAdd: string, masterId?: string) => {
    if (!currentCasual) return;

    const isAlready = currentCasual.players.some(p => p.player_name.toLowerCase() === nameToAdd.toLowerCase());
    if (isAlready) return showToast("Player already in game", "error");

    const { error } = await supabase.from('casual_game_players').insert({
      session_id: currentCasual.id,
      player_name: nameToAdd,
      master_member_id: masterId || null
    });

    if (!error) {
      setPlayerSearchQuery("");
      setCustomPlayerName("");
      showToast(`${nameToAdd} joined!`);
      fetchCasualSessions();
    }
  };

  const handleRemoveCasualPlayer = async (pId: string) => {
    await supabase.from('casual_game_players').delete().eq('id', pId);
    fetchCasualSessions();
  };

  const handleSaveCasualRoundScores = async () => {
    if (!currentCasual || currentCasual.players.length === 0) return showToast("Add players first", "error");

    const maxRound = currentCasual.rounds.length > 0 
      ? Math.max(...currentCasual.rounds.map(r => r.round_number))
      : 0;
    const nextRoundNum = maxRound + 1;

    const roundPayload = currentCasual.players.map(p => ({
      session_id: currentCasual.id,
      round_number: nextRoundNum,
      player_id: p.id,
      score: parseFloat(roundScoresInput[p.id] || "0") || 0,
      is_gin: ginPlayerId === p.id
    }));

    const { error } = await supabase.from('casual_game_rounds').insert(roundPayload);

    if (!error) {
      setRoundScoresInput({});
      setGinPlayerId(null);
      showToast(`Round ${nextRoundNum} saved!`);
      fetchCasualSessions();
    } else {
      showToast(`Error: ${error.message}`, "error");
    }
  };

  const handleOpenEditRound = (roundNum: number) => {
    if (!currentCasual) return;
    const roundRows = currentCasual.rounds.filter(r => r.round_number === roundNum);
    
    const scoresMap: Record<string, string> = {};
    let ginId: string | null = null;

    roundRows.forEach(r => {
      scoresMap[r.player_id] = r.score.toString();
      if (r.is_gin) ginId = r.player_id;
    });

    setEditMemberModal({
      isOpen: true,
      roundNumber: roundNum,
      scores: scoresMap,
      ginId
    });
  };

  const handleSaveEditedRound = async () => {
    if (!currentCasual || editRoundModal.roundNumber === null) return;

    for (const player of currentCasual.players) {
      const scoreVal = parseFloat(editRoundModal.scores[player.id] || "0") || 0;
      const isGinVal = editRoundModal.ginId === player.id;

      await supabase.from('casual_game_rounds')
        .update({ score: scoreVal, is_gin: isGinVal })
        .eq('session_id', currentCasual.id)
        .eq('round_number', editRoundModal.roundNumber)
        .eq('player_id', player.id);
    }

    setEditMemberModal({ isOpen: false, roundNumber: null, scores: {}, ginId: null });
    showToast(`Round ${editRoundModal.roundNumber} updated!`);
    fetchCasualSessions();
  };

  const handleDeleteCasualRound = async (roundNum: number) => {
    if (!currentCasual) return;
    if (!confirm(`Delete Round ${roundNum}?`)) return;

    await supabase.from('casual_game_rounds')
      .delete()
      .eq('session_id', currentCasual.id)
      .eq('round_number', roundNum);

    showToast(`Round ${roundNum} deleted`);
    fetchCasualSessions();
  };

  const handleAddExtraRound = async () => {
    if (!currentCasual) return;
    const newTarget = (currentCasual.target_rounds || 5) + 1;
    await supabase.from('casual_game_sessions').update({ target_rounds: newTarget }).eq('id', currentCasual.id);
    showToast(`Extended to ${newTarget} Rounds!`);
    fetchCasualSessions();
  };

  const getCasualPlayerTotalScore = (playerId: string) => {
    if (!currentCasual) return 0;
    return currentCasual.rounds
      .filter(r => r.player_id === playerId)
      .reduce((sum, r) => sum + (parseFloat(r.score as any) || 0), 0);
  };

  const getCasualPlayerGinCount = (playerId: string) => {
    if (!currentCasual) return 0;
    return currentCasual.rounds.filter(r => r.player_id === playerId && r.is_gin).length;
  };

  // Rank players by total cumulative score
  const getRankedCasualPlayers = () => {
    if (!currentCasual) return [];
    return [...currentCasual.players].map(p => ({
      ...p,
      totalScore: getCasualPlayerTotalScore(p.id),
      ginCount: getCasualPlayerGinCount(p.id)
    })).sort((a, b) => b.totalScore - a.totalScore);
  };

  const casualGameCategories = [
    { title: "Digu", icon: Spade, bg: "bg-indigo-50 border-indigo-200 text-indigo-700" },
    { title: "Uno", icon: Layers, bg: "bg-amber-50 border-amber-200 text-amber-700" },
    { title: "Poker", icon: Sparkles, bg: "bg-rose-50 border-rose-200 text-rose-700" },
    { title: "Carrom", icon: Dices, bg: "bg-emerald-50 border-emerald-200 text-emerald-700" }
  ];

  const currentRoundsPlayed = currentCasual?.rounds.length 
    ? Math.max(...currentCasual.rounds.map(r => r.round_number))
    : 0;
  const isGameOver = currentCasual ? currentRoundsPlayed >= (currentCasual.target_rounds || 5) : false;

  return (
    <main className="min-h-screen bg-[#F8FAFC] text-[#1E293B] font-sans antialiased flex relative overflow-x-hidden">
      
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-999 px-4 py-2.5 rounded-xl shadow-lg text-xs font-bold text-white flex items-center gap-2 animate-in slide-in-from-top-4 ${toast.type === 'error' ? 'bg-rose-500' : 'bg-slate-900'}`}>
          {toast.type === 'error' ? <AlertCircle size={15}/> : <CheckCircle2 size={15}/>}
          <span>{toast.message}</span>
        </div>
      )}

      {/* EDIT CASUAL ROUND MODAL */}
      {editRoundModal.isOpen && editRoundModal.roundNumber !== null && currentCasual && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-1000 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2.5">
              <h3 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <Pencil size={15} className="text-indigo-600"/> Edit Round {editRoundModal.roundNumber} Scores
              </h3>
              <button onClick={() => setEditMemberModal({ isOpen: false, roundNumber: null, scores: {}, ginId: null })} className="text-slate-400 hover:text-slate-800"><X size={16}/></button>
            </div>

            <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
              {currentCasual.players.map(p => {
                const isGin = editRoundModal.ginId === p.id;
                return (
                  <div key={p.id} className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-800 truncate flex-1">{p.player_name}</span>

                    <button 
                      type="button"
                      onClick={() => setEditMemberModal(prev => ({ ...prev, ginId: isGin ? null : p.id }))}
                      className={`p-1.5 rounded-lg border text-[10px] font-black flex items-center gap-1 transition-colors ${isGin ? 'bg-amber-400 text-slate-900 border-amber-400' : 'bg-white text-slate-400 border-slate-200'}`}
                    >
                      <Star size={12} className={isGin ? 'fill-slate-900' : ''}/> Gin
                    </button>

                    <input 
                      type="number" 
                      value={editRoundModal.scores[p.id] || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        setEditMemberModal(prev => ({
                          ...prev,
                          scores: { ...prev.scores, [p.id]: val }
                        }));
                      }}
                      className="w-20 bg-white border border-slate-200 p-1.5 rounded-lg text-xs font-bold text-slate-900 focus:outline-none"
                    />
                  </div>
                );
              })}
            </div>

            <div className="flex gap-2 pt-2 border-t border-slate-100">
              <button 
                onClick={() => setEditMemberModal({ isOpen: false, roundNumber: null, scores: {}, ginId: null })} 
                className="flex-1 py-2 bg-slate-100 text-slate-600 font-bold text-xs rounded-xl hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveEditedRound} 
                className="flex-1 py-2 bg-slate-900 text-white font-bold text-xs rounded-xl hover:bg-slate-800 transition-colors"
              >
                Save Round
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PC DESKTOP NAVIGATION DOCK */}
      <aside className="hidden lg:flex w-72 bg-white border-r border-slate-200/80 flex-col p-6 sticky top-0 h-screen shrink-0 z-40">
        <div className="flex items-center gap-3 mb-10 px-2">
          <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center text-white font-black shadow-md">L</div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-slate-900 leading-none">Lextrack</h1>
            <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-400 mt-1">LexCorp System</p>
          </div>
        </div>
        <nav className="space-y-1 grow">
          <Link href="/" className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium hover:bg-slate-50 text-slate-500 hover:text-slate-900 transition-all"><LayoutDashboard size={18}/> Dashboard</Link>
          <Link href="/tracker" className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium hover:bg-slate-50 text-slate-500 hover:text-slate-900 transition-all"><Banknote size={18}/> Tracker</Link>
          <Link href="/splitter" className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium hover:bg-slate-50 text-slate-500 hover:text-slate-900 transition-all"><Calculator size={18}/> Splitter</Link>
          <Link href="/shop-clearing" className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium hover:bg-slate-50 text-slate-500 hover:text-slate-900 transition-all"><ShoppingCart size={18}/> Clearing</Link>
          <Link href="/activities" className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium hover:bg-slate-50 text-slate-500 hover:text-slate-900 transition-all"><Flame size={18}/> Activities</Link>
          <button onClick={() => { setSelectedCompId(null); setSelectedCasualId(null); setSelectedCasualCategory(null); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${!selectedCompId && !selectedCasualId ? 'bg-slate-900 text-white shadow-sm' : 'hover:bg-slate-50 text-slate-500'}`}><Gamepad2 size={18}/> Gaming Hub</button>
          <Link href="/myself" className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium hover:bg-slate-50 text-slate-500 hover:text-slate-900 transition-all"><User size={18}/> Myself</Link>
        </nav>
      </aside>

      {/* CORE VIEWPORT */}
      <div className="grow flex flex-col min-h-screen overflow-y-auto w-full min-w-0">
        <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 pb-32">
          
          {selectedCompId === null && selectedCasualId === null ? (
            // ==========================================
            // MAIN GAMING HUB DASHBOARD VIEW
            // ==========================================
            <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-300">
              <header className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                    <Gamepad2 size={24} className="text-indigo-600"/> Gaming & Scorekeeper Hub
                  </h2>
                  <p className="text-xs font-semibold text-slate-500 mt-1">Select between casual game scorekeeping or competitive tournaments.</p>
                </div>

                <div className="flex items-center gap-1 bg-white border border-slate-200 p-1 rounded-xl shadow-xs w-fit">
                  <button 
                    onClick={() => { setHubTab('casual'); setSelectedCasualCategory(null); }}
                    className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors ${hubTab === 'casual' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-500 hover:text-slate-900'}`}
                  >
                    🃏 Casual Play
                  </button>
                  <button 
                    onClick={() => { setHubTab('tournaments'); setSelectedCasualCategory(null); }}
                    className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors ${hubTab === 'tournaments' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-500 hover:text-slate-900'}`}
                  >
                    🏆 Tournaments
                  </button>
                </div>
              </header>

              {/* OVERALL STATS BANNERS */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div className="bg-white border border-slate-200/80 p-4 rounded-2xl shadow-xs">
                  <span className="text-[9px] font-extrabold uppercase text-slate-400 tracking-wider">Casual Sessions Logged</span>
                  <p className="text-xl sm:text-2xl font-black text-slate-900 mt-1">{casualSessions.length}</p>
                </div>
                <div className="bg-white border border-slate-200/80 p-4 rounded-2xl shadow-xs">
                  <span className="text-[9px] font-extrabold uppercase text-slate-400 tracking-wider">Active Tournaments</span>
                  <p className="text-xl sm:text-2xl font-black text-indigo-600 mt-1">{competitions.length}</p>
                </div>
                <div className="bg-white border border-slate-200/80 p-4 rounded-2xl shadow-xs">
                  <span className="text-[9px] font-extrabold uppercase text-slate-400 tracking-wider">Saved Directory Players</span>
                  <p className="text-xl sm:text-2xl font-black text-amber-600 mt-1">{masterMembers.length}</p>
                </div>
              </div>

              {/* TAB 1: CASUAL PLAY */}
              {hubTab === 'casual' && (
                <div className="space-y-6">
                  {selectedCasualCategory === null ? (
                    <div className="space-y-4">
                      <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                        <Spade size={16} className="text-indigo-600"/> Select Casual Game Type
                      </h3>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {casualGameCategories.map((cat, idx) => {
                          const IconComponent = cat.icon;
                          const categorySessions = casualSessions.filter(s => s.game_title === cat.title);

                          return (
                            <div 
                              key={idx}
                              onClick={() => setSelectedCasualCategory(cat.title)}
                              className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs hover:shadow-md hover:border-slate-300 transition-all cursor-pointer group flex flex-col justify-between"
                            >
                              <div>
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${cat.bg} mb-3 group-hover:scale-105 transition-transform`}>
                                  <IconComponent size={20}/>
                                </div>
                                <h4 className="font-black text-slate-900 text-base">{cat.title}</h4>
                              </div>

                              <div className="border-t border-slate-100 pt-3 mt-4 flex justify-between items-center text-[10px] font-bold text-slate-500">
                                <span>Sessions: <b className="text-slate-800">{categorySessions.length}</b></span>
                                <span className="text-indigo-600 group-hover:translate-x-0.5 transition-transform">Open →</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    // INSIDE SPECIFIC GAME CATEGORY (e.g. Digu)
                    <div className="space-y-6">
                      <div className="flex justify-between items-center border-b border-slate-200 pb-3">
                        <button 
                          onClick={() => setSelectedCasualCategory(null)}
                          className="text-xs font-bold text-slate-500 hover:text-slate-900 flex items-center gap-1 uppercase tracking-wider"
                        >
                          <ChevronLeft size={14}/> Back to Categories
                        </button>
                        <span className="text-xs font-black uppercase text-indigo-600 bg-indigo-50 px-3 py-1 rounded-lg border border-indigo-100">
                          {selectedCasualCategory} Mode
                        </span>
                      </div>

                      {/* CREATE SESSION WITH TARGET ROUNDS */}
                      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row gap-3 items-stretch sm:items-end">
                        <div className="grow">
                          <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1 block">
                            Session Title
                          </label>
                          <input 
                            type="text" 
                            placeholder={`e.g. Friday ${selectedCasualCategory} Match`} 
                            value={casualName} 
                            onChange={(e) => setCasualName(e.target.value)} 
                            className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-bold text-slate-800 focus:outline-none"
                          />
                        </div>

                        <div className="w-full sm:w-36">
                          <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1 block">Total Rounds</label>
                          <input 
                            type="number" 
                            value={targetRoundsInput} 
                            onChange={(e) => setTargetRoundsInput(e.target.value)} 
                            className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-bold text-slate-800 focus:outline-none"
                            placeholder="5"
                          />
                        </div>

                        <button 
                          onClick={handleCreateCasualSession}
                          className="h-10 px-5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-xs transition-transform active:scale-95 flex items-center justify-center gap-1.5 shrink-0"
                        >
                          <Plus size={15}/> Start {selectedCasualCategory}
                        </button>
                      </div>

                      {/* ACTIVE SESSIONS FOR THIS GAME CATEGORY */}
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                          <Gamepad2 size={16} className="text-indigo-600"/> Saved {selectedCasualCategory} Sessions
                        </h3>

                        {casualSessions.filter(s => s.game_title === selectedCasualCategory).length === 0 ? (
                          <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-200 text-slate-400 font-semibold text-xs shadow-xs">
                            No active {selectedCasualCategory} sessions found. Start a new session above!
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
                            {casualSessions.filter(s => s.game_title === selectedCasualCategory).map((s: CasualSession) => {
                              const roundsCount = s.rounds.length > 0 ? Math.max(...s.rounds.map(r => r.round_number)) : 0;
                              return (
                                <div 
                                  key={s.id}
                                  onClick={() => setSelectedCasualId(s.id)}
                                  className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all cursor-pointer group flex flex-col relative"
                                >
                                  <div className="flex justify-between items-start mb-3 pr-6">
                                    <div>
                                      <h4 className="font-extrabold text-slate-900 group-hover:text-indigo-600 transition-colors text-sm sm:text-base">{s.session_name}</h4>
                                    </div>
                                  </div>

                                  <button 
                                    onClick={(e) => handleDeleteCasualSession(s.id, e)}
                                    className="absolute top-3.5 right-3 text-slate-300 hover:text-rose-500 p-1 rounded-lg"
                                  >
                                    <Trash2 size={14}/>
                                  </button>

                                  <div className="mt-auto grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 text-[10px] font-bold text-slate-500">
                                    <div>Players: <b className="text-slate-800">{s.players.length}</b></div>
                                    <div>Progress: <b className="text-slate-800">{roundsCount} / {s.target_rounds || 5} Rounds</b></div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: TOURNAMENTS */}
              {hubTab === 'tournaments' && (
                <div className="space-y-6">
                  <div className="bg-white rounded-2xl p-3.5 sm:p-5 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row gap-3 items-stretch sm:items-end">
                    <div className="grow">
                      <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1 block">Tournament Title</label>
                      <input 
                        type="text" 
                        placeholder="e.g. Resort FIFA Championship, Friday Badminton Cup" 
                        value={compTitle} 
                        onChange={(e) => setCompTitle(e.target.value)} 
                        className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-bold text-slate-800 focus:outline-none"
                      />
                    </div>

                    <div className="w-full sm:w-48">
                      <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1 block">Game Category</label>
                      <select 
                        value={gameType} 
                        onChange={(e) => setGameType(e.target.value)} 
                        className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-bold text-slate-700 focus:outline-none"
                      >
                        <option value="FIFA / PS">🎮 FIFA / Console</option>
                        <option value="Badminton">🏸 Badminton</option>
                        <option value="Cards / Uno">🃏 Cards / Uno</option>
                        <option value="Board Game">🎲 Board Games</option>
                        <option value="Carrom">⚪ Carrom</option>
                        <option value="General">🏆 General Sports</option>
                      </select>
                    </div>

                    <button 
                      onClick={handleCreateCompetition}
                      className="h-10 px-5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-xs transition-transform active:scale-95 flex items-center justify-center gap-1.5 shrink-0"
                    >
                      <Plus size={15}/> Create Tournament
                    </button>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2"><Trophy size={16} className="text-amber-500"/> Active Tournaments</h3>
                    {competitions.length === 0 ? (
                      <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-200 text-slate-400 font-semibold text-xs shadow-xs">
                        No tournaments active. Create your first game session above!
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
                        {competitions.map((c: Competition) => {
                          const topPlayer = c.participants[0];
                          return (
                            <div 
                              key={c.id}
                              onClick={() => setSelectedCompId(c.id)}
                              className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all cursor-pointer group flex flex-col relative"
                            >
                              <div className="flex justify-between items-start mb-3 pr-6">
                                <div>
                                  <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded bg-indigo-50 text-indigo-600 border border-indigo-100">
                                    {c.game_type}
                                  </span>
                                  <h4 className="font-extrabold text-slate-900 group-hover:text-indigo-600 transition-colors text-sm sm:text-base mt-1.5">{c.title}</h4>
                                </div>
                              </div>

                              <button 
                                onClick={(e) => handleDeleteCompetition(c.id, e)}
                                className="absolute top-3.5 right-3 text-slate-300 hover:text-rose-500 p-1 rounded-lg"
                              >
                                <Trash2 size={14}/>
                              </button>

                              <div className="bg-slate-50 border border-slate-100 p-2.5 rounded-xl my-3 flex justify-between items-center text-xs">
                                <div className="flex items-center gap-1.5">
                                  <Award size={16} className="text-amber-500 shrink-0"/>
                                  <span className="font-bold text-slate-800 truncate">{topPlayer ? topPlayer.player_name : 'No scores yet'}</span>
                                </div>
                                <span className="font-black text-indigo-600">{topPlayer ? `${topPlayer.total_score} pts` : '0 pts'}</span>
                              </div>

                              <div className="mt-auto grid grid-cols-2 gap-2 border-t border-slate-100 pt-2.5 text-[10px] font-bold text-slate-500">
                                <div>Players: <b className="text-slate-800">{c.participants.length}</b></div>
                                <div>Matches: <b className="text-slate-800">{c.matches.length}</b></div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

          ) : currentCasual ? (

            // ==========================================
            // SPECIFIC CASUAL GAME SESSION (DIGU SCOREKEEPER)
            // ==========================================
            <div className="space-y-5 sm:space-y-6 animate-in slide-in-from-right-4 duration-300">
              <div className="flex flex-col sm:flex-row justify-between sm:items-end gap-3 border-b border-slate-200/60 pb-4">
                <div>
                  <button onClick={() => setSelectedCasualId(null)} className="text-[10px] font-bold text-slate-400 hover:text-slate-800 uppercase tracking-wider flex items-center gap-1 mb-2 transition-colors">
                    <ChevronLeft size={14}/> Back to Casual Sessions
                  </button>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl sm:text-2xl font-black text-slate-900">{currentCasual.session_name}</h2>
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-indigo-50 text-indigo-600 border border-indigo-100">
                      {currentCasual.game_title}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-extrabold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
                    Round: {currentRoundsPlayed} / {currentCasual.target_rounds || 5}
                  </span>
                  <button onClick={() => handleDeleteCasualSession(currentCasual.id)} className="text-rose-500 hover:text-rose-700 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 bg-rose-50 px-3 py-1.5 rounded-lg border border-rose-100 transition-colors">
                    <Trash2 size={13}/> Delete
                  </button>
                </div>
              </div>

              {/* GAME OVER NOTIFICATION BANNER */}
              {isGameOver && (
                <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-lg flex flex-col sm:flex-row items-center justify-between gap-3 animate-in fade-in">
                  <div className="flex items-center gap-3">
                    <Trophy size={24} className="text-amber-400 shrink-0"/>
                    <div>
                      <h3 className="text-sm font-black uppercase tracking-wider text-amber-400">GAME OVER! Target Rounds Completed</h3>
                      <p className="text-xs font-semibold text-slate-300">
                        Winner: <b>{getRankedCasualPlayers()[0]?.player_name || 'N/A'}</b> ({getRankedCasualPlayers()[0]?.totalScore || 0} pts)
                      </p>
                    </div>
                  </div>

                  <button 
                    onClick={handleAddExtraRound}
                    className="w-full sm:w-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-transform active:scale-95 shrink-0"
                  >
                    + Add Extra Round
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* LEFT 5 COLUMNS: LIVE RANKINGS & SEARCH PLAYER ADDITION */}
                <div className="lg:col-span-5 space-y-5">
                  
                  {/* SEARCH & ADD PLAYER BOX */}
                  <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs space-y-3">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <Users size={15} className="text-slate-500"/> Add Session Player
                    </h3>

                    <div className="space-y-3">
                      {/* Live Filter Search Input for Master List */}
                      <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                        <input 
                          type="text" 
                          placeholder="Search Master Directory or type custom..." 
                          value={playerSearchQuery}
                          onChange={(e) => setPlayerSearchQuery(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 pl-9 pr-3 py-2.5 rounded-xl text-xs font-bold text-slate-800 focus:outline-none"
                        />
                      </div>

                      {/* Filtered Search Results */}
                      {playerSearchQuery.trim() !== "" && (
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-2 max-h-40 overflow-y-auto space-y-1">
                          {masterMembers
                            .filter(m => m.full_name.toLowerCase().includes(playerSearchQuery.toLowerCase()))
                            .map(m => (
                              <button 
                                key={m.id}
                                onClick={() => handleAddCasualPlayerName(m.full_name, m.id)}
                                className="w-full text-left px-2.5 py-1.5 rounded-lg bg-white hover:bg-indigo-50 text-xs font-bold text-slate-800 hover:text-indigo-600 transition-colors flex items-center justify-between"
                              >
                                <span>{m.full_name}</span>
                                <span className="text-[9px] font-extrabold text-indigo-600 uppercase">+ Add</span>
                              </button>
                            ))}

                          <button 
                            onClick={() => handleAddCasualPlayerName(playerSearchQuery.trim())}
                            className="w-full text-left px-2.5 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold flex items-center justify-between"
                          >
                            <span>Add Custom: "{playerSearchQuery}"</span>
                            <Plus size={13}/>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* RANKING SCOREBOARD (Rank 1, 2, 3...) */}
                  <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs space-y-3">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <Trophy size={16} className="text-amber-500"/> Standings Leaderboard
                    </h3>

                    {currentCasual.players.length === 0 ? (
                      <p className="text-xs text-slate-400 italic text-center py-6">No players added to this session yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {getRankedCasualPlayers().map((p, idx) => (
                          <div key={p.id} className="flex items-center justify-between bg-slate-50 border border-slate-100 p-3 rounded-xl text-xs">
                            <div className="flex items-center gap-2.5 truncate">
                              <span className={`w-6 h-6 rounded-full flex items-center justify-center font-black text-xs shrink-0 ${idx === 0 ? 'bg-amber-400 text-slate-900 shadow-xs' : idx === 1 ? 'bg-slate-300 text-slate-800' : idx === 2 ? 'bg-amber-700 text-white' : 'bg-slate-200 text-slate-600'}`}>
                                {idx + 1}
                              </span>
                              <div className="truncate">
                                <span className="font-bold text-slate-900 block truncate">{p.player_name}</span>
                                {p.ginCount > 0 && (
                                  <span className="text-[9px] font-extrabold text-amber-600 flex items-center gap-0.5">
                                    <Star size={10} className="fill-amber-500 text-amber-500"/> {p.ginCount} Gin
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                              <span className="font-black text-indigo-600 text-base">{p.totalScore} pts</span>
                              <button onClick={() => handleRemoveCasualPlayer(p.id)} className="text-slate-300 hover:text-rose-500 p-0.5">
                                <X size={14}/>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* RIGHT 7 COLUMNS: ROUND-BY-ROUND SCORE ENTRY WITH "GIN" STAR */}
                <div className="lg:col-span-7 space-y-5">
                  
                  {/* LOG NEW ROUND FORM */}
                  {!isGameOver && (
                    <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs space-y-4">
                      <div className="flex justify-between items-center border-b border-slate-100 pb-2.5">
                        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                          <Gamepad2 size={16} className="text-indigo-600"/> Log Round {currentRoundsPlayed + 1} Score
                        </h3>
                        <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 bg-slate-100 text-slate-600 rounded">
                          Round {currentRoundsPlayed + 1} of {currentCasual.target_rounds || 5}
                        </span>
                      </div>

                      {currentCasual.players.length === 0 ? (
                        <p className="text-xs text-slate-400 italic py-4">Search and add players on the left to start logging round scores.</p>
                      ) : (
                        <div className="space-y-3">
                          <span className="text-[9px] font-bold uppercase text-slate-400 block">Click ⭐ Star on the player who "Gin" / Won this round:</span>
                          
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            {currentCasual.players.map(p => {
                              const isGin = ginPlayerId === p.id;
                              return (
                                <div key={p.id} className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl flex items-center justify-between gap-2">
                                  <span className="text-xs font-bold text-slate-800 truncate flex-1">{p.player_name}</span>

                                  {/* Star Button for Gin */}
                                  <button 
                                    type="button"
                                    onClick={() => setGinPlayerId(isGin ? null : p.id)}
                                    className={`p-1.5 rounded-lg border text-[10px] font-black flex items-center gap-1 transition-colors ${isGin ? 'bg-amber-400 text-slate-900 border-amber-400' : 'bg-white text-slate-400 border-slate-200'}`}
                                    title="Mark as Round Gin Winner"
                                  >
                                    <Star size={12} className={isGin ? 'fill-slate-900' : ''}/> Gin
                                  </button>

                                  <input 
                                    type="number" 
                                    placeholder="Points" 
                                    value={roundScoresInput[p.id] || ""}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setRoundScoresInput(prev => ({ ...prev, [p.id]: val }));
                                    }}
                                    className="w-20 bg-white border border-slate-200 p-1.5 rounded-lg text-xs font-bold text-slate-900 focus:outline-none"
                                  />
                                </div>
                              );
                            })}
                          </div>

                          <button 
                            onClick={handleSaveCasualRoundScores}
                            className="w-full h-10 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-xs transition-transform active:scale-95"
                          >
                            Save Round {currentRoundsPlayed + 1} Scores
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ROUNDS LOG MATRIX TABLE WITH EDIT BUTTON */}
                  <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs space-y-3">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Round-By-Round Breakdown Log</h3>

                    {currentCasual.rounds.length === 0 ? (
                      <p className="text-xs text-slate-400 italic text-center py-6">No rounds logged yet.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-left text-xs font-semibold">
                          <thead>
                            <tr className="bg-slate-50 text-slate-400 uppercase font-bold text-[9px] tracking-wider border-b border-slate-100">
                              <th className="p-2.5">Round</th>
                              {currentCasual.players.map(p => (
                                <th key={p.id} className="p-2.5 text-center">{p.player_name}</th>
                              ))}
                              <th className="p-2.5 text-center">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {Array.from(new Set(currentCasual.rounds.map(r => r.round_number))).map(rNum => (
                              <tr key={rNum} className="hover:bg-slate-50/50">
                                <td className="p-2.5 font-bold text-slate-900">Round {rNum}</td>
                                {currentCasual.players.map(p => {
                                  const rMatch = currentCasual.rounds.find(r => r.round_number === rNum && r.player_id === p.id);
                                  return (
                                    <td key={p.id} className="p-2.5 text-center font-bold text-slate-700">
                                      {rMatch ? (
                                        <span className="inline-flex items-center gap-1">
                                          {rMatch.score}
                                          {rMatch.is_gin && <Star size={10} className="fill-amber-500 text-amber-500 inline"/>}
                                        </span>
                                      ) : '-'}
                                    </td>
                                  );
                                })}
                                <td className="p-2.5 text-center flex items-center justify-center gap-1">
                                  <button onClick={() => handleOpenEditRound(rNum)} className="text-slate-400 hover:text-slate-800 p-1">
                                    <Pencil size={13}/>
                                  </button>
                                  <button onClick={() => handleDeleteCasualRound(rNum)} className="text-slate-300 hover:text-rose-500 p-1">
                                    <X size={14}/>
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

          ) : currentComp ? (

            // ==========================================
            // SPECIFIC COMPETITION SCOREBOARD
            // ==========================================
            <div className="space-y-5 sm:space-y-6 animate-in slide-in-from-right-4 duration-300">
              <div className="flex flex-col sm:flex-row justify-between sm:items-end gap-3 border-b border-slate-200/60 pb-4">
                <div>
                  <button onClick={() => setSelectedCompId(null)} className="text-[10px] font-bold text-slate-400 hover:text-slate-800 uppercase tracking-wider flex items-center gap-1 mb-2 transition-colors">
                    <ChevronLeft size={14}/> Back to Tournaments Hub
                  </button>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl sm:text-2xl font-black text-slate-900">{currentComp.title}</h2>
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-indigo-50 text-indigo-600 border border-indigo-100">
                      {currentComp.game_type}
                    </span>
                  </div>
                </div>

                <button onClick={() => handleDeleteCompetition(currentComp.id)} className="text-rose-500 hover:text-rose-700 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 bg-rose-50 px-3 py-1.5 rounded-lg border border-rose-100 transition-colors w-fit">
                  <Trash2 size={13}/> Delete Tournament
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                <div className="lg:col-span-5 space-y-5">
                  <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs space-y-3">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <Users size={15} className="text-slate-500"/> Add Player / Participant
                    </h3>

                    <div className="space-y-3">
                      <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                        <input 
                          type="text" 
                          placeholder="Search Master Directory or type custom..." 
                          value={playerSearchQuery}
                          onChange={(e) => setPlayerSearchQuery(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 pl-9 pr-3 py-2.5 rounded-xl text-xs font-bold text-slate-800 focus:outline-none"
                        />
                      </div>

                      {playerSearchQuery.trim() !== "" && (
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-2 max-h-40 overflow-y-auto space-y-1">
                          {masterMembers
                            .filter(m => m.full_name.toLowerCase().includes(playerSearchQuery.toLowerCase()))
                            .map(m => (
                              <button 
                                key={m.id}
                                onClick={() => handleAddPlayerToCompetitionName(m.full_name, m.id)}
                                className="w-full text-left px-2.5 py-1.5 rounded-lg bg-white hover:bg-indigo-50 text-xs font-bold text-slate-800 hover:text-indigo-600 transition-colors flex items-center justify-between"
                              >
                                <span>{m.full_name}</span>
                                <span className="text-[9px] font-extrabold text-indigo-600 uppercase">+ Add</span>
                              </button>
                            ))}

                          <button 
                            onClick={() => handleAddPlayerToCompetitionName(playerSearchQuery.trim())}
                            className="w-full text-left px-2.5 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold flex items-center justify-between"
                          >
                            <span>Add Custom: "{playerSearchQuery}"</span>
                            <Plus size={13}/>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs space-y-3">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <Trophy size={16} className="text-amber-500"/> Standings Leaderboard
                    </h3>

                    {currentComp.participants.length === 0 ? (
                      <p className="text-xs text-slate-400 italic text-center py-6">No players added yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {currentComp.participants.map((p, idx) => (
                          <div key={p.id} className="flex items-center justify-between bg-slate-50 border border-slate-100 p-2.5 rounded-xl text-xs">
                            <div className="flex items-center gap-2 truncate">
                              <span className={`w-5 h-5 rounded-full flex items-center justify-center font-black text-[10px] shrink-0 ${idx === 0 ? 'bg-amber-400 text-slate-900' : idx === 1 ? 'bg-slate-300 text-slate-800' : idx === 2 ? 'bg-amber-700 text-white' : 'bg-slate-200 text-slate-600'}`}>
                                {idx + 1}
                              </span>
                              <span className="font-bold text-slate-900 truncate">{p.player_name}</span>
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                              <span className="text-[10px] font-bold text-slate-400">{p.wins} Wins</span>
                              <span className="font-black text-slate-900">{p.total_score} pts</span>
                              <button onClick={() => handleRemoveTournamentPlayer(p.id)} className="text-slate-300 hover:text-rose-500 p-0.5">
                                <X size={14}/>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="lg:col-span-7 space-y-5">
                  <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs space-y-3">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <Shield size={16} className="text-indigo-600"/> Log Match Result
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                      <div className="sm:col-span-12">
                        <input 
                          type="text" 
                          placeholder="Round Name (e.g. Semi-Finals, Match 1)" 
                          value={roundLabel} 
                          onChange={(e) => setRoundName(e.target.value)} 
                          className="w-full bg-slate-50 border border-slate-200 p-2 rounded-xl text-xs font-bold text-slate-800 focus:outline-none"
                        />
                      </div>

                      <div className="sm:col-span-6 bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-2">
                        <span className="text-[9px] font-bold uppercase text-slate-400 block">Player / Team 1</span>
                        <select 
                          value={p1Name} 
                          onChange={(e) => setP1Name(e.target.value)} 
                          className="w-full bg-white border border-slate-200 p-2 rounded-xl text-xs font-bold text-slate-800 focus:outline-none"
                        >
                          <option value="">Select Player...</option>
                          {currentComp.participants.map(p => (
                            <option key={p.id} value={p.player_name}>{p.player_name}</option>
                          ))}
                        </select>
                        <input 
                          type="number" 
                          placeholder="Score" 
                          value={p1Score} 
                          onChange={(e) => setP1Score(e.target.value)} 
                          className="w-full bg-white border border-slate-200 p-2 rounded-xl text-xs font-black text-slate-900 focus:outline-none"
                        />
                      </div>

                      <div className="sm:col-span-6 bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-2">
                        <span className="text-[9px] font-bold uppercase text-slate-400 block">Player / Team 2</span>
                        <select 
                          value={p2Name} 
                          onChange={(e) => setP2Name(e.target.value)} 
                          className="w-full bg-white border border-slate-200 p-2 rounded-xl text-xs font-bold text-slate-800 focus:outline-none"
                        >
                          <option value="">Select Player...</option>
                          {currentComp.participants.map(p => (
                            <option key={p.id} value={p.player_name}>{p.player_name}</option>
                          ))}
                        </select>
                        <input 
                          type="number" 
                          placeholder="Score" 
                          value={p2Score} 
                          onChange={(e) => setP2Score(e.target.value)} 
                          className="w-full bg-white border border-slate-200 p-2 rounded-xl text-xs font-black text-slate-900 focus:outline-none"
                        />
                      </div>
                    </div>

                    <button 
                      onClick={handleLogMatch}
                      className="w-full h-10 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-xs transition-transform active:scale-95"
                    >
                      Save Match Score
                    </button>
                  </div>

                  <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs space-y-3">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Recorded Matches Log</h3>

                    {currentComp.matches.length === 0 ? (
                      <p className="text-xs text-slate-400 italic text-center py-6">No matches recorded yet.</p>
                    ) : (
                      <div className="space-y-2.5">
                        {currentComp.matches.map((m: Match) => (
                          <div key={m.id} className="bg-slate-50 border border-slate-200/80 p-3 rounded-xl flex items-center justify-between text-xs">
                            <div>
                              <span className="text-[9px] font-extrabold uppercase text-slate-400 block mb-0.5">{m.round_name}</span>
                              <p className="font-bold text-slate-900">
                                <span className={m.winner_name === m.player1_name ? 'text-emerald-600 font-extrabold' : ''}>{m.player1_name} ({m.player1_score})</span> 
                                <span className="text-slate-400 mx-1.5">vs</span> 
                                <span className={m.winner_name === m.player2_name ? 'text-emerald-600 font-extrabold' : ''}>{m.player2_name} ({m.player2_score})</span>
                              </p>
                            </div>

                            <button onClick={() => handleRemoveMatch(m.id)} className="text-slate-300 hover:text-rose-500 p-1">
                              <X size={15}/>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : null}

        </div>

        {/* MOBILE FLOATING NAV DOCKBAR */}
        <nav className="lg:hidden fixed bottom-4 left-1/2 -translate-x-1/2 w-[92%] max-w-90 h-14 bg-white/95 border border-slate-200/80 shadow-md rounded-2xl flex justify-around items-center px-2 z-100 backdrop-blur-md">
          <Link href="/" className="text-slate-400 hover:text-slate-800"><Wallet size={18} /></Link>
          <Link href="/tracker" className="text-slate-400 hover:text-slate-800"><Banknote size={18} /></Link>
          <Link href="/splitter" className="text-slate-400 hover:text-slate-800"><Calculator size={18} /></Link>
          <Link href="/activities" className="text-slate-400 hover:text-slate-800"><Flame size={18} /></Link>
          <button onClick={() => { setSelectedCompId(null); setSelectedCasualId(null); setSelectedCasualCategory(null); }} className="text-slate-900"><Gamepad2 size={18} className="bg-slate-100 p-2 w-8 h-8 rounded-lg" /></button>
        </nav>
      </div>
    </main>
  );
}