"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { 
  Gamepad2, Plus, Trash2, Trophy, Users, Shield, Award, 
  ChevronLeft, CheckCircle2, AlertCircle, X, Spade, Sparkles, Search, Star, Pencil, UserPlus, Flame as FireIcon, Users2, User, Hash, Calendar, Clock
} from "lucide-react";

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
  created_at?: string;
  participants: TournamentParticipant[];
  matches: Match[];
}

// Casual Game Types (Digu, 10, Bondi)
interface CasualPlayer {
  id: string;
  session_id: string;
  player_name: string;
  master_member_id?: string;
  team_number?: number;
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
  play_mode?: 'solo' | 'duo';
  target_rounds: number;
  created_at?: string;
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
  const [playMode, setPlayMode] = useState<'solo' | 'duo'>('solo');
  const [targetRoundsInput, setTargetRoundsInput] = useState("5");

  // Add Player Pop-over State
  const [isAddPlayerModalOpen, setIsAddPlayerModalOpen] = useState(false);
  const [playerSearchQuery, setPlayerSearchQuery] = useState("");
  const [selectedTeamNumber, setSelectedTeamNumber] = useState<number>(1);

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

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
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
          play_mode: s.play_mode || 'solo',
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

  // --- Handlers ---
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
      showToast(`${nameToAdd} added!`);
      setIsAddPlayerModalOpen(false);
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

  // --- Handlers for Casual Sessions (Digu, 10, Bondi) ---
  const handleCreateCasualSession = async () => {
    if (!casualName.trim()) return showToast("Enter session name", "error");
    const category = selectedCasualCategory || "Digu";
    const roundsTarget = parseInt(targetRoundsInput) || 5;

    const { data, error } = await supabase.from('casual_game_sessions').insert({
      session_name: casualName.trim(),
      game_title: category,
      play_mode: playMode,
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

    const payload: any = {
      session_id: currentCasual.id,
      player_name: nameToAdd,
      master_member_id: masterId || null
    };

    if (currentCasual.play_mode === 'duo') {
      payload.team_number = selectedTeamNumber;
    }

    const { error } = await supabase.from('casual_game_players').insert(payload);

    if (!error) {
      setPlayerSearchQuery("");
      showToast(`${nameToAdd} joined!`);
      setIsAddPlayerModalOpen(false);
      fetchCasualSessions();
    }
  };

  const handleRemoveCasualPlayer = async (pId: string) => {
    await supabase.from('casual_game_players').delete().eq('id', pId);
    fetchCasualSessions();
  };

  const handleScoreInputChange = (playerId: string, val: string) => {
    if (!currentCasual) return;

    if (currentCasual.play_mode === 'duo') {
      const activePlayer = currentCasual.players.find(p => p.id === playerId);
      const teamNum = activePlayer?.team_number || 1;
      const teammates = currentCasual.players.filter(p => (p.team_number || 1) === teamNum);

      setRoundScoresInput(prev => {
        const next = { ...prev };
        teammates.forEach(tm => {
          next[tm.id] = val;
        });
        return next;
      });
    } else {
      setRoundScoresInput(prev => ({ ...prev, [playerId]: val }));
    }
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
      showToast(`Error saving round: ${error.message}`, "error");
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

  const getRankedCasualPlayers = () => {
    if (!currentCasual) return [];
    return [...currentCasual.players].map(p => ({
      ...p,
      totalScore: getCasualPlayerTotalScore(p.id),
      ginCount: getCasualPlayerGinCount(p.id)
    })).sort((a, b) => b.totalScore - a.totalScore);
  };

  // --- CAREER STATS CALCULATION ---
  const calculateTopCareerStats = () => {
    const playerStatsMap: Record<string, { name: string; matches: number; totalScore: number; maxSingleGame: number; ginCount: number }> = {};

    casualSessions.forEach(s => {
      s.players.forEach(p => {
        if (!playerStatsMap[p.player_name]) {
          playerStatsMap[p.player_name] = { name: p.player_name, matches: 0, totalScore: 0, maxSingleGame: 0, ginCount: 0 };
        }

        const pRounds = s.rounds.filter(r => r.player_id === p.id);
        const matchTotal = pRounds.reduce((sum, r) => sum + (parseFloat(r.score as any) || 0), 0);
        const matchGins = pRounds.filter(r => r.is_gin).length;

        playerStatsMap[p.player_name].matches += 1;
        playerStatsMap[p.player_name].totalScore += matchTotal;
        playerStatsMap[p.player_name].ginCount += matchGins;
        if (matchTotal > playerStatsMap[p.player_name].maxSingleGame) {
          playerStatsMap[p.player_name].maxSingleGame = matchTotal;
        }
      });
    });

    const statsArray = Object.values(playerStatsMap);

    const mostPlayed = [...statsArray].sort((a, b) => b.matches - a.matches)[0];
    const highestTotalScore = [...statsArray].sort((a, b) => b.totalScore - a.totalScore)[0];
    const highestSingleMatch = [...statsArray].sort((a, b) => b.maxSingleGame - a.maxSingleGame)[0];
    const mostGins = [...statsArray].sort((a, b) => b.ginCount - a.ginCount)[0];

    return {
      mostPlayed: mostPlayed ? { name: mostPlayed.name, val: `${mostPlayed.matches} games` } : { name: "N/A", val: "0" },
      highestTotalScore: highestTotalScore ? { name: highestTotalScore.name, val: `${highestTotalScore.totalScore} pts` } : { name: "N/A", val: "0" },
      highestSingleMatch: highestSingleMatch ? { name: highestSingleMatch.name, val: `${highestSingleMatch.maxSingleGame} pts` } : { name: "N/A", val: "0" },
      mostGins: mostGins ? { name: mostGins.name, val: `${mostGins.ginCount} Gins` } : { name: "N/A", val: "0" }
    };
  };

  const careerStats = calculateTopCareerStats();

  const casualGameCategories = [
    { 
      title: "Digu", 
      icon: Spade, 
      badge: "Card Classic",
      desc: "Solo & Duo 2v2 Team Scoring",
      gradient: "from-slate-900 via-indigo-950 to-slate-900 border-indigo-500/30 text-white" 
    },
    { 
      title: "10", 
      icon: Hash, 
      badge: "Points Match",
      desc: "10-Points Card Game",
      gradient: "from-slate-900 via-amber-950 to-slate-900 border-amber-500/30 text-white" 
    },
    { 
      title: "Bondi", 
      icon: Sparkles, 
      badge: "Round Game",
      desc: "Classic Round Points Tracker",
      gradient: "from-slate-900 via-emerald-950 to-slate-900 border-emerald-500/30 text-white" 
    }
  ];

  const currentRoundsPlayed = currentCasual?.rounds.length 
    ? Math.max(...currentCasual.rounds.map(r => r.round_number))
    : 0;
  const isGameOver = currentCasual ? currentRoundsPlayed >= (currentCasual.target_rounds || 5) : false;

  return (
    <div className="w-full max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 py-3 sm:py-8 pb-28">
      
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-999 px-4 py-2.5 rounded-xl shadow-lg text-xs font-bold text-white flex items-center gap-2 animate-in slide-in-from-top-4 ${toast.type === 'error' ? 'bg-rose-500' : 'bg-slate-900'}`}>
          {toast.type === 'error' ? <AlertCircle size={15}/> : <CheckCircle2 size={15}/>}
          <span>{toast.message}</span>
        </div>
      )}

      {/* ADD PLAYER MODAL */}
      {isAddPlayerModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-1000 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 max-w-sm w-full shadow-2xl space-y-3">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <UserPlus size={15} className="text-indigo-600"/> Add Session Player
              </h3>
              <button onClick={() => setIsAddPlayerModalOpen(false)} className="text-slate-400 p-1"><X size={16}/></button>
            </div>

            {currentCasual?.play_mode === 'duo' && (
              <div className="bg-slate-50 border border-slate-200 p-2 rounded-xl flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">Assign to Team:</span>
                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => setSelectedTeamNumber(1)}
                    className={`px-3 py-1 rounded-lg text-xs font-extrabold transition-colors ${selectedTeamNumber === 1 ? 'bg-indigo-600 text-white' : 'bg-white border text-slate-600'}`}
                  >
                    Team 1
                  </button>
                  <button 
                    onClick={() => setSelectedTeamNumber(2)}
                    className={`px-3 py-1 rounded-lg text-xs font-extrabold transition-colors ${selectedTeamNumber === 2 ? 'bg-amber-600 text-white' : 'bg-white border text-slate-600'}`}
                  >
                    Team 2
                  </button>
                </div>
              </div>
            )}

            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
              <input 
                type="text" 
                placeholder="Search Master Directory or type name..." 
                value={playerSearchQuery}
                onChange={(e) => setPlayerSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 pl-9 pr-3 py-2 rounded-xl text-xs font-bold text-slate-800 focus:outline-none"
              />
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-2 max-h-48 overflow-y-auto space-y-1">
              {masterMembers
                .filter(m => m.full_name.toLowerCase().includes(playerSearchQuery.toLowerCase()))
                .map(m => (
                  <button 
                    key={m.id}
                    onClick={() => {
                      if (currentCasual) handleAddCasualPlayerName(m.full_name, m.id);
                      else if (currentComp) handleAddPlayerToCompetitionName(m.full_name, m.id);
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg bg-white hover:bg-indigo-50 text-xs font-bold text-slate-800 hover:text-indigo-600 transition-colors flex items-center justify-between"
                  >
                    <span>{m.full_name}</span>
                    <span className="text-[9px] font-extrabold text-indigo-600 uppercase">+ Add</span>
                  </button>
                ))}

              {playerSearchQuery.trim() !== "" && (
                <button 
                  onClick={() => {
                    if (currentCasual) handleAddCasualPlayerName(playerSearchQuery.trim());
                    else if (currentComp) handleAddPlayerToCompetitionName(playerSearchQuery.trim());
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold flex items-center justify-between"
                >
                  <span>Add Custom: "{playerSearchQuery}"</span>
                  <Plus size={13}/>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* EDIT CASUAL ROUND MODAL */}
      {editRoundModal.isOpen && editRoundModal.roundNumber !== null && currentCasual && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-1000 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 max-w-sm w-full shadow-2xl space-y-3">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Pencil size={15} className="text-indigo-600"/> Edit Round {editRoundModal.roundNumber} Scores
              </h3>
              <button onClick={() => setEditMemberModal({ isOpen: false, roundNumber: null, scores: {}, ginId: null })} className="text-slate-400"><X size={16}/></button>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {currentCasual.players.map(p => {
                const isGin = editRoundModal.ginId === p.id;
                return (
                  <div key={p.id} className="bg-slate-50 border border-slate-200 p-2 rounded-xl flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-800 truncate flex-1">{p.player_name}</span>

                    <button 
                      type="button"
                      onClick={() => setEditMemberModal(prev => ({ ...prev, ginId: isGin ? null : p.id }))}
                      className={`p-1 rounded text-[9px] font-black flex items-center gap-0.5 border ${isGin ? 'bg-amber-400 text-slate-900 border-amber-400' : 'bg-white text-slate-400 border-slate-200'}`}
                    >
                      <Star size={11} className={isGin ? 'fill-slate-900' : ''}/> Gin
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
                      className="w-16 bg-white border border-slate-200 p-1 rounded-lg text-xs font-bold text-slate-900 focus:outline-none"
                    />
                  </div>
                );
              })}
            </div>

            <div className="flex gap-2 pt-2 border-t border-slate-100">
              <button 
                onClick={() => setEditMemberModal({ isOpen: false, roundNumber: null, scores: {}, ginId: null })} 
                className="flex-1 py-2 bg-slate-100 text-slate-600 font-bold text-xs rounded-xl"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveEditedRound} 
                className="flex-1 py-2 bg-slate-900 text-white font-bold text-xs rounded-xl"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedCompId === null && selectedCasualId === null ? (
        // ==========================================
        // MAIN GAMING HUB DASHBOARD VIEW
        // ==========================================
        <div className="space-y-5 animate-in fade-in duration-300">
          <header className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                <Gamepad2 size={22} className="text-indigo-600"/> Gaming Scorekeeper Hub
              </h2>
            </div>

            <div className="flex items-center gap-1 bg-white border border-slate-200 p-1 rounded-xl shadow-xs w-fit">
              <button 
                onClick={() => { setHubTab('casual'); setSelectedCasualCategory(null); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors ${hubTab === 'casual' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-500'}`}
              >
                🃏 Casual Cards
              </button>
              <button 
                onClick={() => { setHubTab('tournaments'); setSelectedCasualCategory(null); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors ${hubTab === 'tournaments' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-500'}`}
              >
                🏆 Tournaments
              </button>
            </div>
          </header>

          {/* ALL-TIME CAREER STATISTICS INSIGHTS */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
            <div className="bg-white border border-slate-200/80 p-3 rounded-2xl shadow-xs">
              <span className="text-[9px] font-extrabold uppercase text-slate-400 tracking-wider flex items-center gap-1">
                <Gamepad2 size={11} className="text-indigo-600"/> Most Played
              </span>
              <p className="text-xs font-black text-slate-900 truncate mt-1">{careerStats.mostPlayed.name}</p>
              <span className="text-[10px] font-bold text-indigo-600">{careerStats.mostPlayed.val}</span>
            </div>

            <div className="bg-white border border-slate-200/80 p-3 rounded-2xl shadow-xs">
              <span className="text-[9px] font-extrabold uppercase text-slate-400 tracking-wider flex items-center gap-1">
                <Trophy size={11} className="text-amber-500"/> Most Points
              </span>
              <p className="text-xs font-black text-slate-900 truncate mt-1">{careerStats.highestTotalScore.name}</p>
              <span className="text-[10px] font-bold text-amber-600">{careerStats.highestTotalScore.val}</span>
            </div>

            <div className="bg-white border border-slate-200/80 p-3 rounded-2xl shadow-xs">
              <span className="text-[9px] font-extrabold uppercase text-slate-400 tracking-wider flex items-center gap-1">
                <FireIcon size={11} className="text-rose-500"/> Single Game Record
              </span>
              <p className="text-xs font-black text-slate-900 truncate mt-1">{careerStats.highestSingleMatch.name}</p>
              <span className="text-[10px] font-bold text-rose-600">{careerStats.highestSingleMatch.val}</span>
            </div>

            <div className="bg-white border border-slate-200/80 p-3 rounded-2xl shadow-xs">
              <span className="text-[9px] font-extrabold uppercase text-slate-400 tracking-wider flex items-center gap-1">
                <Star size={11} className="fill-amber-400 text-amber-500"/> Most Gins
              </span>
              <p className="text-xs font-black text-slate-900 truncate mt-1">{careerStats.mostGins.name}</p>
              <span className="text-[10px] font-bold text-amber-600">{careerStats.mostGins.val}</span>
            </div>
          </div>

          {/* CASUAL PLAY VIEW */}
          {hubTab === 'casual' && (
            <div className="space-y-4">
              {selectedCasualCategory === null ? (
                // GAME CATEGORY BLOCKS SELECTION SCREEN
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Spade size={15} className="text-indigo-600"/> Choose Game Type
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                    {casualGameCategories.map((cat, idx) => {
                      const IconComponent = cat.icon;
                      const categorySessions = casualSessions.filter(s => s.game_title === cat.title);

                      return (
                        <div 
                          key={idx}
                          onClick={() => setSelectedCasualCategory(cat.title)}
                          className={`bg-gradient-to-r ${cat.gradient} p-4 sm:p-5 rounded-2xl border shadow-md hover:shadow-lg transition-all cursor-pointer group flex flex-col justify-between relative overflow-hidden`}
                        >
                          <div className="absolute right-2 bottom-0 opacity-10 pointer-events-none">
                            <IconComponent size={110} />
                          </div>

                          <div className="relative z-10 space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-white/10 border border-white/10 text-white">
                                {cat.badge}
                              </span>
                              <span className="text-[10px] font-bold text-slate-300">
                                {categorySessions.length} active
                              </span>
                            </div>

                            <div className="flex items-center gap-2 pt-1">
                              <div className="w-8 h-8 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20">
                                <IconComponent size={18} className="text-white"/>
                              </div>
                              <div>
                                <h4 className="font-black text-white text-base sm:text-lg leading-tight">{cat.title}</h4>
                                <p className="text-[10px] font-medium text-slate-300">{cat.desc}</p>
                              </div>
                            </div>
                          </div>

                          <div className="relative z-10 mt-4 border-t border-white/10 pt-2.5 flex justify-between items-center text-[10px] font-bold text-indigo-300">
                            <span>Open & Play</span>
                            <span className="group-hover:translate-x-1 transition-transform">→</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                // INSIDE SPECIFIC GAME CATEGORY
                <div className="space-y-4">
                  <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                    <button 
                      onClick={() => setSelectedCasualCategory(null)}
                      className="text-xs font-bold text-slate-500 hover:text-slate-900 flex items-center gap-1 uppercase tracking-wider"
                    >
                      <ChevronLeft size={14}/> Back to Game Categories
                    </button>
                    <span className="text-xs font-black uppercase text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-lg border border-indigo-100">
                      {selectedCasualCategory} Mode
                    </span>
                  </div>

                  {/* CREATE SESSION WITH MODE & TARGET ROUNDS */}
                  <div className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-200 shadow-xs space-y-3">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Initialize New {selectedCasualCategory} Match</span>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                      <input 
                        type="text" 
                        placeholder={`Session Name (e.g. Friday ${selectedCasualCategory})`} 
                        value={casualName} 
                        onChange={(e) => setCasualName(e.target.value)} 
                        className="sm:col-span-6 bg-slate-50 border border-slate-200 p-2 rounded-xl text-xs font-bold text-slate-800 focus:outline-none"
                      />

                      {/* SOLO vs DUO TOGGLE */}
                      <div className="sm:col-span-3 flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200">
                        <button 
                          type="button"
                          onClick={() => setPlayMode('solo')}
                          className={`flex-1 py-1 rounded-lg text-[10px] font-black uppercase flex items-center justify-center gap-0.5 transition-colors ${playMode === 'solo' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}
                        >
                          <User size={11}/> Solo
                        </button>
                        <button 
                          type="button"
                          onClick={() => setPlayMode('duo')}
                          className={`flex-1 py-1 rounded-lg text-[10px] font-black uppercase flex items-center justify-center gap-0.5 transition-colors ${playMode === 'duo' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}
                        >
                          <Users2 size={11}/> Duo
                        </button>
                      </div>

                      <input 
                        type="number" 
                        value={targetRoundsInput} 
                        onChange={(e) => setTargetRoundsInput(e.target.value)} 
                        className="sm:col-span-3 bg-slate-50 border border-slate-200 p-2 rounded-xl text-xs font-bold text-slate-800 text-center focus:outline-none"
                        placeholder="5 Rounds"
                      />
                    </div>

                    <button 
                      onClick={handleCreateCasualSession}
                      className="w-full h-9 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-xs transition-transform active:scale-95 flex items-center justify-center gap-1.5"
                    >
                      <Plus size={14}/> Start {selectedCasualCategory} ({playMode === 'duo' ? '2v2 Duo' : 'Solo'})
                    </button>
                  </div>

                  {/* ACTIVE SESSIONS FOR THIS GAME WITH AUTOMATIC DATE DISPLAY */}
                  <div className="space-y-2">
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                      <Gamepad2 size={14} className="text-indigo-600"/> Saved {selectedCasualCategory} Sessions
                    </h3>

                    {casualSessions.filter(s => s.game_title === selectedCasualCategory).length === 0 ? (
                      <div className="text-center py-10 bg-white rounded-2xl border border-dashed border-slate-200 text-slate-400 font-semibold text-xs">
                        No active {selectedCasualCategory} sessions found. Create one above!
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {casualSessions.filter(s => s.game_title === selectedCasualCategory).map((s: CasualSession) => {
                          const roundsCount = s.rounds.length > 0 ? Math.max(...s.rounds.map(r => r.round_number)) : 0;
                          return (
                            <div 
                              key={s.id}
                              onClick={() => setSelectedCasualId(s.id)}
                              className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs hover:border-slate-300 cursor-pointer flex flex-col relative"
                            >
                              <div className="flex justify-between items-start mb-2 pr-6">
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[8px] font-extrabold uppercase px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-600 border border-indigo-100">
                                      {s.play_mode === 'duo' ? 'Duo (2v2)' : 'Solo'}
                                    </span>
                                    {/* AUTOMATIC DATE DISPLAY BADGE */}
                                    <span className="text-[9px] font-bold text-slate-400 flex items-center gap-0.5">
                                      <Calendar size={10}/> {formatDate(s.created_at)}
                                    </span>
                                  </div>
                                  <h4 className="font-extrabold text-slate-900 text-sm truncate mt-1">{s.session_name}</h4>
                                </div>
                              </div>

                              <button 
                                onClick={(e) => handleDeleteCasualSession(s.id, e)}
                                className="absolute top-3 right-2.5 text-slate-300 hover:text-rose-500 p-1"
                              >
                                <Trash2 size={13}/>
                              </button>

                              <div className="mt-2 grid grid-cols-2 gap-2 border-t border-slate-100 pt-2 text-[10px] font-bold text-slate-500">
                                <div>Players: <b className="text-slate-800">{s.players.length}</b></div>
                                <div>Progress: <b className="text-slate-800">{roundsCount} / {s.target_rounds || 5} Rds</b></div>
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

          {/* TOURNAMENTS VIEW */}
          {hubTab === 'tournaments' && (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-xs flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-end">
                <div className="grow">
                  <label className="text-[9px] font-bold uppercase text-slate-400 mb-1 block">Tournament Title</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Resort FIFA Championship" 
                    value={compTitle} 
                    onChange={(e) => setCompTitle(e.target.value)} 
                    className="w-full bg-slate-50 border border-slate-200 p-2 rounded-xl text-xs font-bold text-slate-800 focus:outline-none"
                  />
                </div>

                <div className="w-full sm:w-40">
                  <label className="text-[9px] font-bold uppercase text-slate-400 mb-1 block">Category</label>
                  <select 
                    value={gameType} 
                    onChange={(e) => setGameType(e.target.value)} 
                    className="w-full bg-slate-50 border border-slate-200 p-2 rounded-xl text-xs font-bold text-slate-700 focus:outline-none"
                  >
                    <option value="FIFA / PS">🎮 FIFA / Console</option>
                    <option value="Badminton">🏸 Badminton</option>
                    <option value="General">🏆 General Sports</option>
                  </select>
                </div>

                <button 
                  onClick={handleCreateCompetition}
                  className="h-9 px-4 bg-slate-900 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-xs shrink-0"
                >
                  + Create
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {competitions.map((c: Competition) => {
                  const topPlayer = c.participants[0];
                  return (
                    <div 
                      key={c.id}
                      onClick={() => setSelectedCompId(c.id)}
                      className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs hover:border-slate-300 cursor-pointer flex flex-col relative"
                    >
                      <div className="flex justify-between items-start mb-2 pr-6">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[8px] font-extrabold uppercase px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-600 border border-indigo-100">
                              {c.game_type}
                            </span>
                            <span className="text-[9px] font-bold text-slate-400 flex items-center gap-0.5">
                              <Calendar size={10}/> {formatDate(c.created_at)}
                            </span>
                          </div>
                          <h4 className="font-extrabold text-slate-900 text-sm mt-1">{c.title}</h4>
                        </div>
                      </div>

                      <button 
                        onClick={(e) => handleDeleteCompetition(c.id, e)}
                        className="absolute top-3 right-2.5 text-slate-300 hover:text-rose-500 p-1"
                      >
                        <Trash2 size={13}/>
                      </button>

                      <div className="bg-slate-50 border border-slate-100 p-2 rounded-xl my-2 flex justify-between items-center text-xs">
                        <div className="flex items-center gap-1.5 truncate">
                          <Award size={14} className="text-amber-500 shrink-0"/>
                          <span className="font-bold text-slate-800 truncate">{topPlayer ? topPlayer.player_name : 'No scores'}</span>
                        </div>
                        <span className="font-black text-indigo-600 text-xs">{topPlayer ? `${topPlayer.total_score} pts` : '0 pts'}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

      ) : currentCasual ? (

        // ==========================================
        // SINGLE VIEWPORT CASUAL SCOREKEEPER
        // ==========================================
        <div className="space-y-3 animate-in fade-in duration-200">
          
          {/* Sticky Top Header */}
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <div className="flex items-center gap-2 truncate">
              <button onClick={() => setSelectedCasualId(null)} className="p-1 rounded-lg bg-slate-100 text-slate-600">
                <ChevronLeft size={16}/>
              </button>
              <div>
                <div className="flex items-center gap-1.5">
                  <h2 className="text-sm sm:text-base font-black text-slate-900 truncate">{currentCasual.session_name}</h2>
                  <span className="text-[9px] font-bold text-slate-400 flex items-center gap-0.5 shrink-0">
                    <Calendar size={10}/> {formatDate(currentCasual.created_at)}
                  </span>
                </div>
                <span className="text-[9px] font-extrabold uppercase text-indigo-600 block">
                  {currentCasual.game_title} • {currentCasual.play_mode === 'duo' ? 'Duo Mode (2v2)' : 'Solo Mode'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[10px] font-extrabold uppercase bg-slate-100 text-slate-700 px-2 py-1 rounded-lg border border-slate-200">
                Rd {currentRoundsPlayed}/{currentCasual.target_rounds || 5}
              </span>
              <button 
                onClick={() => setIsAddPlayerModalOpen(true)}
                className="p-1.5 bg-slate-900 text-white rounded-lg text-xs font-bold flex items-center gap-1"
              >
                <UserPlus size={13}/>
              </button>
              <button onClick={() => handleDeleteCasualSession(currentCasual.id)} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg">
                <Trash2 size={14}/>
              </button>
            </div>
          </div>

          {/* GAME OVER NOTIFICATION */}
          {isGameOver && (
            <div className="bg-slate-900 text-white p-2.5 rounded-xl flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 truncate">
                <Trophy size={18} className="text-amber-400 shrink-0"/>
                <span className="text-xs font-bold truncate">
                  Winner: <b>{getRankedCasualPlayers()[0]?.player_name || 'N/A'}</b> ({getRankedCasualPlayers()[0]?.totalScore || 0} pts)
                </span>
              </div>
              <button onClick={handleAddExtraRound} className="px-2.5 py-1 bg-indigo-600 text-white text-[10px] font-bold uppercase rounded-lg shrink-0">
                + Extra Round
              </button>
            </div>
          )}

          {/* HORIZONTAL LIVE SCOREBOARD BADGES */}
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {getRankedCasualPlayers().map((p, idx) => (
              <div key={p.id} className="bg-white border border-slate-200/80 px-2.5 py-1.5 rounded-xl shadow-2xs shrink-0 flex items-center gap-2">
                <span className={`w-4 h-4 rounded-full flex items-center justify-center font-black text-[9px] ${idx === 0 ? 'bg-amber-400 text-slate-900' : idx === 1 ? 'bg-slate-300 text-slate-800' : 'bg-slate-100 text-slate-600'}`}>
                  {idx + 1}
                </span>
                <div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-bold text-slate-900 max-w-20 truncate">{p.player_name}</span>
                    {currentCasual.play_mode === 'duo' && (
                      <span className={`text-[8px] font-black px-1 rounded ${p.team_number === 2 ? 'bg-amber-100 text-amber-800' : 'bg-indigo-100 text-indigo-800'}`}>
                        T{p.team_number || 1}
                      </span>
                    )}
                    {p.ginCount > 0 && (
                      <span className="text-[9px] font-extrabold text-amber-600 flex items-center">
                        <Star size={9} className="fill-amber-500 text-amber-500"/>{p.ginCount}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-black text-indigo-600 block leading-none">{p.totalScore} pts</span>
                </div>
                <button onClick={() => handleRemoveCasualPlayer(p.id)} className="text-slate-300 hover:text-rose-500 p-0.5 ml-1">
                  <X size={12}/>
                </button>
              </div>
            ))}
          </div>

          {/* SINGLE INTEGRATED MATRIX TABLE */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-2 sm:p-3 shadow-xs space-y-2">
            <div className="overflow-x-auto max-h-[60vh]">
              <table className="w-full border-collapse text-left text-xs font-semibold">
                <thead>
                  <tr className="bg-slate-50 text-slate-400 uppercase font-bold text-[9px] border-b border-slate-100">
                    <th className="p-2 min-w-16">Round</th>
                    {currentCasual.players.map(p => (
                      <th key={p.id} className="p-2 text-center min-w-20">
                        {p.player_name}
                        {currentCasual.play_mode === 'duo' && (
                          <span className={`block text-[8px] font-extrabold ${p.team_number === 2 ? 'text-amber-600' : 'text-indigo-600'}`}>
                            Team {p.team_number || 1}
                          </span>
                        )}
                      </th>
                    ))}
                    <th className="p-2 text-center min-w-10">Act</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {Array.from(new Set(currentCasual.rounds.map(r => r.round_number))).map(rNum => (
                    <tr key={rNum} className="hover:bg-slate-50/50">
                      <td className="p-2 font-bold text-slate-900 text-xs">Rd {rNum}</td>
                      {currentCasual.players.map(p => {
                        const rMatch = currentCasual.rounds.find(r => r.round_number === rNum && r.player_id === p.id);
                        return (
                          <td key={p.id} className="p-2 text-center font-bold text-slate-700 text-xs">
                            {rMatch ? (
                              <span className="inline-flex items-center gap-0.5">
                                {rMatch.score}
                                {rMatch.is_gin && <Star size={9} className="fill-amber-500 text-amber-500 inline"/>}
                              </span>
                            ) : '-'}
                          </td>
                        );
                      })}
                      <td className="p-2 text-center">
                        <button onClick={() => handleOpenEditRound(rNum)} className="text-slate-400 p-0.5"><Pencil size={11}/></button>
                      </td>
                    </tr>
                  ))}

                  {!isGameOver && currentCasual.players.length > 0 && (
                    <tr className="bg-indigo-50/30 font-bold border-t-2 border-indigo-100">
                      <td className="p-2 text-indigo-700 font-black text-xs">
                        Rd {currentRoundsPlayed + 1}
                      </td>
                      {currentCasual.players.map(p => {
                        const isGin = ginPlayerId === p.id;
                        return (
                          <td key={p.id} className="p-1.5 text-center">
                            <div className="flex flex-col items-center gap-1">
                              <button 
                                type="button"
                                onClick={() => setGinPlayerId(isGin ? null : p.id)}
                                className={`p-1 rounded text-[8px] font-black flex items-center gap-0.5 border ${isGin ? 'bg-amber-400 text-slate-900 border-amber-400' : 'bg-white text-slate-400 border-slate-200'}`}
                              >
                                <Star size={9} className={isGin ? 'fill-slate-900' : ''}/> Gin
                              </button>

                              <input 
                                type="number" 
                                placeholder="0"
                                value={roundScoresInput[p.id] || ""}
                                onChange={(e) => handleScoreInputChange(p.id, e.target.value)}
                                className="w-14 bg-white border border-slate-200 p-1 rounded-md text-xs font-black text-center text-slate-900 focus:outline-none shadow-2xs"
                              />
                            </div>
                          </td>
                        );
                      })}
                      <td className="p-1.5 text-center">
                        <button 
                          onClick={handleSaveCasualRoundScores}
                          className="p-2 bg-slate-900 text-white rounded-lg text-xs font-bold"
                          title="Save Round"
                        >
                          <CheckCircle2 size={14}/>
                        </button>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      ) : currentComp ? (

        // ==========================================
        // TOURNAMENT MATCH LOGGING VIEW
        // ==========================================
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <button onClick={() => setSelectedCompId(null)} className="p-1 rounded-lg bg-slate-100 text-slate-600">
              <ChevronLeft size={16}/>
            </button>
            <div>
              <h2 className="text-sm font-black text-slate-900 truncate">{currentComp.title}</h2>
              <span className="text-[9px] font-bold text-slate-400 flex items-center gap-0.5">
                <Calendar size={10}/> {formatDate(currentComp.created_at)}
              </span>
            </div>
            <button onClick={() => setIsAddPlayerModalOpen(true)} className="p-1.5 bg-slate-900 text-white rounded-lg text-xs font-bold">
              + Player
            </button>
          </div>

          <div className="bg-white rounded-2xl p-3 border border-slate-200 space-y-2">
            <span className="text-[9px] font-bold uppercase text-slate-400">Leaderboard</span>
            <div className="space-y-1.5">
              {currentComp.participants.map((p, idx) => (
                <div key={p.id} className="flex justify-between items-center bg-slate-50 p-2 rounded-xl text-xs font-bold">
                  <div className="flex items-center gap-2">
                    <span>#{idx + 1}</span>
                    <span>{p.player_name}</span>
                  </div>
                  <span className="text-indigo-600">{p.total_score} pts ({p.wins}W)</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl p-3 border border-slate-200 space-y-2">
            <span className="text-[9px] font-bold uppercase text-slate-400">Log Match Result</span>
            <div className="grid grid-cols-2 gap-2">
              <select value={p1Name} onChange={(e) => setP1Name(e.target.value)} className="bg-slate-50 p-2 rounded-xl text-xs font-bold border border-slate-200">
                <option value="">Player 1...</option>
                {currentComp.participants.map(p => <option key={p.id} value={p.player_name}>{p.player_name}</option>)}
              </select>
              <input type="number" placeholder="P1 Score" value={p1Score} onChange={(e) => setP1Score(e.target.value)} className="bg-slate-50 p-2 rounded-xl text-xs font-bold border border-slate-200"/>

              <select value={p2Name} onChange={(e) => setP2Name(e.target.value)} className="bg-slate-50 p-2 rounded-xl text-xs font-bold border border-slate-200">
                <option value="">Player 2...</option>
                {currentComp.participants.map(p => <option key={p.id} value={p.player_name}>{p.player_name}</option>)}
              </select>
              <input type="number" placeholder="P2 Score" value={p2Score} onChange={(e) => setP2Score(e.target.value)} className="bg-slate-50 p-2 rounded-xl text-xs font-bold border border-slate-200"/>
            </div>

            <button onClick={handleLogMatch} className="w-full py-2 bg-slate-900 text-white text-xs font-bold uppercase rounded-xl">
              Save Match
            </button>
          </div>
        </div>
      ) : null}

    </div>
  );
}