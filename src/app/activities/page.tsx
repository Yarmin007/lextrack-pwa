"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { 
  Plus, X, Trash2, Wallet, ShoppingCart, Calculator, 
  CheckCircle2, AlertCircle, Send, User, Banknote, LayoutDashboard, 
  Users, Flame, ClipboardList, Layers, UserPlus, ChevronLeft, Search, UserCheck, Pencil, Receipt
} from "lucide-react";
import Link from "next/link";

// --- Types ---
interface MasterMember {
  id: string;
  full_name: string;
  member_type: 'adult' | 'kid';
  dependent_id: string | null;
  created_at?: string;
}

interface Participant {
  id: string;
  activity_id: string;
  primary_name: string;
  master_member_id?: string;
  head_id?: string;
  spouse_name?: string;
  kids_names?: string;
  has_paid: boolean;
  assigned_group?: string;
}

interface ShoppingItem {
  id: string;
  activity_id: string;
  item_name: string;
  qty: string;
  estimated_cost: number;
  is_bought: boolean;
  assigned_to_name?: string;
}

interface ExpenseItem {
  id: string;
  activity_id: string;
  description: string;
  paid_by_name: string;
  amount: number | string;
}

interface Activity {
  id: string;
  title: string;
  activity_date: string;
  total_expenses: number | string;
  groups_list?: string[];
  participants: Participant[];
  shopping: ShoppingItem[];
  expenses_breakdown?: ExpenseItem[];
}

interface BillingLedgerItem {
  headName: string;
  attendees: string[];
  totalDue: number;
  hasPaid: boolean;
  initialPartId: string;
}

export default function ActivitiesPage() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [masterMembers, setMasterMembers] = useState<MasterMember[]>([]);
  
  // Navigation State: null means we are on the Main Hub Dashboard
  const [selectedActId, setSelectedActId] = useState<string | null>(null);
  const [activeTab, setActiveHostTab] = useState<'roster' | 'expenses' | 'finance' | 'shopping'>('roster');
  
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  const [loading, setLoading] = useState(false);

  // Form states
  const [actTitle, setActTitle] = useState("");
  const [actDate, setActDate] = useState(new Date().toISOString().split('T')[0]);

  // Master Directory States
  const [newProfileName, setNewProfileName] = useState("");
  const [newProfileType, setNewProfileType] = useState<'adult' | 'kid'>('adult');
  const [newProfileDependentId, setNewProfileDependentId] = useState("");
  const [masterSearchQuery, setMasterSearchQuery] = useState("");

  // Edit Master Member Modal State
  const [editMemberModal, setEditMemberModal] = useState<{
    isOpen: boolean;
    member: MasterMember | null;
    editName: string;
    editType: 'adult' | 'kid';
    editDependentId: string;
  }>({
    isOpen: false,
    member: null,
    editName: "",
    editType: "adult",
    editDependentId: ""
  });

  // Optional Group Creation
  const [newGroupName, setNewGroupName] = useState("");

  // Expense Tab Form States
  const [expDesc, setExpDesc] = useState("");
  const [expPaidBy, setExpPaidBy] = useState("");
  const [expAmount, setExpAmount] = useState("");

  // Primary Removal Reassignment Modal State
  const [reassignModal, setReassignModal] = useState<{
    isOpen: boolean;
    removingParticipant: Participant | null;
    dependentsToReassign: Participant[];
  }>({
    isOpen: false,
    removingParticipant: null,
    dependentsToReassign: []
  });
  const [selectedNewHeadId, setSelectedNewHeadId] = useState<string>("");

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchMasterListProfiles = async () => {
    const { data, error } = await supabase.from('activity_master_members').select('*').order('full_name', { ascending: true });
    if (!error && data) {
      setMasterMembers(data as MasterMember[]);
    }
  };

  const fetchActivitiesData = useCallback(async () => {
    setLoading(true);
    const { data: actData, error: actErr } = await supabase.from('activities').select('*').order('activity_date', { ascending: false });
    
    if (!actErr && actData) {
      const consolidated: Activity[] = await Promise.all(actData.map(async (act: any) => {
        const [partsRes, shopRes, expRes] = await Promise.all([
          supabase.from('activity_participants').select('*').eq('activity_id', act.id),
          supabase.from('activity_shopping').select('*').eq('activity_id', act.id),
          supabase.from('activity_expenses').select('*').eq('activity_id', act.id)
        ]);
        return {
          ...act,
          groups_list: act.groups_list || [],
          participants: partsRes.data || [],
          shopping: shopRes.data || [],
          expenses_breakdown: expRes.data || []
        };
      }));
      setActivities(consolidated);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchMasterListProfiles();
    fetchActivitiesData();
  }, [fetchActivitiesData]);

  const currentActivity = activities.find((a: Activity) => a.id === selectedActId);

  // --- Breakdown metrics ---
  const calculateBreakdown = (activity?: Activity) => {
    let adults = 0;
    let kids = 0;

    if (activity && activity.participants) {
      activity.participants.forEach((p: Participant) => {
        const profile = masterMembers.find((m: MasterMember) => m.id === p.master_member_id);
        if (profile) {
          if (profile.member_type === 'kid') kids += 1;
          else adults += 1;
        } else {
          adults += 1;
        }
      });
    }
    return { adults, kids, total: adults + kids };
  };

  const calculateSharePerHead = (activity?: Activity) => {
    if (!activity) return 0;
    const { total } = calculateBreakdown(activity);
    if (total === 0) return 0;
    const totalExp = typeof activity.total_expenses === 'number' ? activity.total_expenses : parseFloat(activity.total_expenses) || 0;
    return totalExp / total;
  };

  const getBillingLedgerGrouped = (activity?: Activity, sharePerHead: number = 0): BillingLedgerItem[] => {
    if (!activity || !activity.participants) return [];
    
    const billsMap: Record<string, BillingLedgerItem> = {};

    activity.participants.forEach((p: Participant) => {
      const profile = masterMembers.find((m: MasterMember) => m.id === p.master_member_id);
      const profileName = profile ? profile.full_name : p.primary_name;
      
      let headId = p.head_id || p.master_member_id || p.id;
      let headName = profileName;

      const masterHead = masterMembers.find((m: MasterMember) => m.id === headId);
      if (masterHead) {
        headName = masterHead.full_name;
      } else {
        const partHead = activity.participants.find((part: Participant) => part.master_member_id === headId || part.id === headId);
        if (partHead) headName = partHead.primary_name;
      }

      if (!billsMap[headId]) {
        billsMap[headId] = {
          headName: headName,
          attendees: [],
          totalDue: 0,
          hasPaid: p.has_paid,
          initialPartId: p.id
        };
      }

      billsMap[headId].attendees.push(profileName);
      billsMap[headId].totalDue += sharePerHead;
      if (!p.has_paid) billsMap[headId].hasPaid = false; 
    });

    return Object.values(billsMap);
  };

  // --- Handlers ---
  const handleCreateActivity = async () => {
    if (!actTitle.trim()) return showToast("Activity title required", "error");
    
    const { data, error } = await supabase
      .from('activities')
      .insert({ title: actTitle.trim(), activity_date: actDate, total_expenses: 0, groups_list: [] })
      .select()
      .single();

    if (!error && data) {
      showToast("New Activity Created!");
      setActTitle("");
      fetchActivitiesData();
    } else {
      console.error("Supabase Error (Create Activity):", error);
      const errorMessage = error?.message || error?.details || error?.hint || (error && Object.keys(error).length > 0 ? JSON.stringify(error) : "Database schema mismatch or RLS restriction");
      showToast(errorMessage, "error");
    }
  };

  const handleDeleteActivity = async (actId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!confirm("Delete this entire activity?")) return;

    try {
      await supabase.from('activity_participants').delete().eq('activity_id', actId);
      await supabase.from('activity_shopping').delete().eq('activity_id', actId);
      await supabase.from('activity_expenses').delete().eq('activity_id', actId);

      const { error } = await supabase.from('activities').delete().eq('id', actId);

      if (error) {
        showToast(`DB Error: ${error.message}`, "error");
      } else {
        showToast("Activity deleted");
        if (selectedActId === actId) {
          setSelectedActId(null);
        }
        fetchActivitiesData();
      }
    } catch (err: any) {
      showToast("Failed to delete activity", "error");
    }
  };

  // --- Expense Handlers ---
  const handleAddExpenseItem = async (actId: string) => {
    if (!expDesc.trim()) return showToast("Description is required", "error");
    if (!expPaidBy) return showToast("Select who paid for this expense", "error");
    const parsedAmount = parseFloat(expAmount) || 0;
    if (parsedAmount <= 0) return showToast("Enter a valid expense amount", "error");

    const payload = {
      activity_id: actId,
      description: expDesc.trim(),
      paid_by_name: expPaidBy,
      amount: parsedAmount
    };

    const { error } = await supabase.from('activity_expenses').insert(payload);
    if (error) {
      showToast(`DB Error: ${error.message}`, "error");
    } else {
      setExpDesc("");
      setExpPaidBy("");
      setExpAmount("");
      
      // Auto-recalculate total activity expenses
      const currentExpenses = currentActivity?.expenses_breakdown || [];
      const newTotal = currentExpenses.reduce((sum, item) => sum + (parseFloat(item.amount as string) || 0), 0) + parsedAmount;
      await supabase.from('activities').update({ total_expenses: newTotal }).eq('id', actId);
      
      showToast("Expense logged!");
      fetchActivitiesData();
    }
  };

  const handleRemoveExpenseItem = async (actId: string, itemId: string) => {
    const { error } = await supabase.from('activity_expenses').delete().eq('id', itemId);
    if (!error) {
      const remainingExpenses = (currentActivity?.expenses_breakdown || []).filter(item => item.id !== itemId);
      const newTotal = remainingExpenses.reduce((sum, item) => sum + (parseFloat(item.amount as string) || 0), 0);
      await supabase.from('activities').update({ total_expenses: newTotal }).eq('id', actId);
      
      fetchActivitiesData();
      showToast("Expense item removed");
    }
  };

  const handleCreateMasterMember = async () => {
    if (!newProfileName.trim()) return showToast("Profile name required", "error");
    
    const payload = {
      full_name: newProfileName.trim(),
      member_type: newProfileType,
      dependent_id: newProfileDependentId || null
    };

    const { error } = await supabase.from('activity_master_members').insert(payload);
    
    if (!error) {
      showToast("Profile added to Master List!");
      setNewProfileName("");
      setNewProfileDependentId("");
      fetchMasterListProfiles();
    } else {
      console.error("Supabase Error (Create Member):", error);
      const errorMessage = error?.message || error?.details || JSON.stringify(error);
      showToast(`DB Error: ${errorMessage}`, "error");
    }
  };

  const handleDeleteMasterMember = async (member: MasterMember) => {
    if (!confirm(`Permanently delete "${member.full_name}" from Master Directory?`)) return;

    const { error } = await supabase.from('activity_master_members').delete().eq('id', member.id);
    if (error) {
      showToast(`Error deleting profile: ${error.message}`, "error");
    } else {
      showToast("Profile deleted from directory");
      fetchMasterListProfiles();
    }
  };

  const handleOpenEditModal = (member: MasterMember) => {
    setEditMemberModal({
      isOpen: true,
      member,
      editName: member.full_name,
      editType: member.member_type,
      editDependentId: member.dependent_id || ""
    });
  };

  const handleSaveEditMasterMember = async () => {
    if (!editMemberModal.member || !editMemberModal.editName.trim()) return;

    const payload = {
      full_name: editMemberModal.editName.trim(),
      member_type: editMemberModal.editType,
      dependent_id: editMemberModal.editDependentId || null
    };

    const { error } = await supabase
      .from('activity_master_members')
      .update(payload)
      .eq('id', editMemberModal.member.id);

    if (error) {
      showToast(`Error updating profile: ${error.message}`, "error");
    } else {
      showToast("Profile updated!");
      setEditMemberModal({ isOpen: false, member: null, editName: "", editType: "adult", editDependentId: "" });
      fetchMasterListProfiles();
      fetchActivitiesData();
    }
  };

  const handleUpdateExpense = async (actId: string, val: string) => {
    setActivities((prev: Activity[]) => prev.map((a: Activity) => a.id === actId ? { ...a, total_expenses: val } : a));
    await supabase.from('activities').update({ total_expenses: parseFloat(val) || 0 }).eq('id', actId);
  };

  const handleAddMemberToActivity = async (actId: string, masterMemberObj: MasterMember) => {
    const isAlreadyAdded = currentActivity?.participants.some((p: Participant) => p.master_member_id === masterMemberObj.id);
    if (isAlreadyAdded) return showToast("Member already in this activity", "error");

    const newAttendee = { 
      activity_id: actId, 
      primary_name: masterMemberObj.full_name, 
      master_member_id: masterMemberObj.id,
      head_id: masterMemberObj.dependent_id || masterMemberObj.id,
      has_paid: false, 
      assigned_group: "" 
    };

    const { error } = await supabase.from('activity_participants').insert(newAttendee);
    if (error) {
      console.error("Supabase Error (Add Member):", error);
      const errorMessage = error?.message || error?.details || JSON.stringify(error);
      showToast(`DB Error: ${errorMessage}`, "error");
    } else {
      fetchActivitiesData();
      showToast(`${masterMemberObj.full_name} checked in`);
    }
  };

  const handleImportAllMembers = async (actId: string) => {
    if (!currentActivity) return;
    
    const unaddedMembers = masterMembers.filter(
      (m: MasterMember) => !currentActivity.participants.some((p: Participant) => p.master_member_id === m.id)
    );

    if (unaddedMembers.length === 0) {
      return showToast("All master directory members are already in this activity", "error");
    }

    const payload = unaddedMembers.map((m: MasterMember) => ({
      activity_id: actId,
      primary_name: m.full_name,
      master_member_id: m.id,
      head_id: m.dependent_id || m.id,
      has_paid: false,
      assigned_group: ""
    }));

    const { error } = await supabase.from('activity_participants').insert(payload);
    if (error) {
      console.error("Supabase Error (Import All):", error);
      showToast(`DB Error: ${error.message}`, "error");
    } else {
      fetchActivitiesData();
      showToast(`Imported ${unaddedMembers.length} members to activity!`);
    }
  };

  const handleInitiateRemoveParticipant = (p: Participant) => {
    if (!currentActivity) return;

    const profile = masterMembers.find((m: MasterMember) => m.id === p.master_member_id);
    const isPrimary = !profile?.dependent_id;

    if (isPrimary && p.master_member_id) {
      const dependentsInActivity = currentActivity.participants.filter(
        (part: Participant) => part.id !== p.id && part.head_id === p.master_member_id
      );

      if (dependentsInActivity.length > 0) {
        setReassignModal({
          isOpen: true,
          removingParticipant: p,
          dependentsToReassign: dependentsInActivity
        });
        return;
      }
    }

    handleRemoveParticipant(p.id);
  };

  const handleConfirmReassignAndRemove = async () => {
    if (!selectedNewHeadId || !reassignModal.removingParticipant || !currentActivity) return;

    const dependentIds = reassignModal.dependentsToReassign.map(d => d.id);
    const { error: updateErr } = await supabase
      .from('activity_participants')
      .update({ head_id: selectedNewHeadId })
      .in('id', dependentIds);

    if (updateErr) {
      showToast("Failed to reassign dependents", "error");
      return;
    }

    await handleRemoveParticipant(reassignModal.removingParticipant.id);

    setReassignModal({ isOpen: false, removingParticipant: null, dependentsToReassign: [] });
    setSelectedNewHeadId("");
    showToast("Primary removed & dependents reassigned!");
  };

  const handleUpdateParticipantLocal = (actId: string, partId: string, field: string, val: any) => {
    setActivities((prev: Activity[]) => prev.map((a: Activity) => a.id === actId ? {
      ...a,
      participants: a.participants.map((p: Participant) => p.id === partId ? { ...p, [field]: val } : p)
    } : a));
  };

  const handleSaveParticipantDB = async (partId: string, field: string, val: any) => {
    await supabase.from('activity_participants').update({ [field]: val }).eq('id', partId);
  };

  const handleRemoveParticipant = async (partId: string) => {
    await supabase.from('activity_participants').delete().eq('id', partId);
    fetchActivitiesData();
  };

  const handleAddShoppingItem = async (actId: string) => {
    const newItem = { activity_id: actId, item_name: "New Provision Item", qty: "1", estimated_cost: 0, is_bought: false, assigned_to_name: "" };
    const { data } = await supabase.from('activity_shopping').insert(newItem).select().single();
    if (data) fetchActivitiesData();
  };

  const handleUpdateShopLocal = (actId: string, itemId: string, field: string, val: any) => {
    setActivities((prev: Activity[]) => prev.map((a: Activity) => a.id === actId ? {
      ...a,
      shopping: a.shopping.map((s: ShoppingItem) => s.id === itemId ? { ...s, [field]: val } : s)
    } : a));
  };

  const handleSaveShopDB = async (itemId: string, field: string, val: any) => {
    await supabase.from('activity_shopping').update({ [field]: val }).eq('id', itemId);
  };

  const handleRemoveShopItem = async (itemId: string) => {
    await supabase.from('activity_shopping').delete().eq('id', itemId);
    fetchActivitiesData();
  };

  const handleAddGroupDB = async (act: Activity) => {
    if (!newGroupName.trim()) return;
    const nextGroups = [...(act.groups_list || []), newGroupName.trim()];
    setActivities((prev: Activity[]) => prev.map((a: Activity) => a.id === act.id ? { ...a, groups_list: nextGroups } : a));
    await supabase.from('activities').update({ groups_list: nextGroups }).eq('id', act.id);
    setNewGroupName("");
    showToast("Group Created!");
  };

  const handleRemoveGroupDB = async (act: Activity, targetGroupName: string) => {
    const nextGroups = (act.groups_list || []).filter((g: string) => g !== targetGroupName);
    setActivities((prev: Activity[]) => prev.map((a: Activity) => a.id === act.id ? { ...a, groups_list: nextGroups } : a));
    await supabase.from('activities').update({ groups_list: nextGroups }).eq('id', act.id);
    await supabase.from('activity_participants').update({ assigned_group: "" }).eq('activity_id', act.id).eq('assigned_group', targetGroupName);
    fetchActivitiesData();
  };

  const handleShareWhatsApp = (act: Activity) => {
    const sharePerHead = calculateSharePerHead(act);
    const ledger = getBillingLedgerGrouped(act, sharePerHead);
    const totalExp = typeof act.total_expenses === 'number' ? act.total_expenses : parseFloat(act.total_expenses) || 0;
    
    let msg = `*🏡 INVOICE SUMMARY: ${act.title.toUpperCase()}*\n📅 Date: ${act.activity_date}\n💰 Total Expense: MVR ${totalExp.toFixed(2)}\n📊 Per Person: MVR ${sharePerHead.toFixed(2)}\n\n*BILLING DETAILS:*\n`;

    ledger.forEach((item: BillingLedgerItem) => {
      msg += `• *Primary Head: ${item.headName}*\n`;
      msg += `  ↳ For: ${item.attendees.join(', ')}\n`;
      msg += `  💳 Amount: *MVR ${item.totalDue.toFixed(0)}* [${item.hasPaid ? 'PAID ✅' : 'PENDING ⏳'}]\n\n`;
    });

    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
  };

  // --- Metrics for Master Directory ---
  const totalMasterAdults = masterMembers.filter((m: MasterMember) => m.member_type === 'adult').length;
  const totalMasterKids = masterMembers.filter((m: MasterMember) => m.member_type === 'kid').length;
  const totalMasterPrimary = masterMembers.filter((m: MasterMember) => !m.dependent_id).length;
  const totalMasterDependent = masterMembers.filter((m: MasterMember) => m.dependent_id).length;

  // Search filter
  const filteredPrimaryMembers = masterMembers
    .filter((m: MasterMember) => !m.dependent_id)
    .filter((primary: MasterMember) => {
      if (!masterSearchQuery.trim()) return true;
      const query = masterSearchQuery.toLowerCase();
      const matchesPrimary = primary.full_name.toLowerCase().includes(query);
      const dependents = masterMembers.filter((dep: MasterMember) => dep.dependent_id === primary.id);
      const matchesDependent = dependents.some((dep: MasterMember) => dep.full_name.toLowerCase().includes(query));
      return matchesPrimary || matchesDependent;
    });

  return (
    <main className="min-h-screen bg-[#F8FAFC] text-[#1E293B] font-sans antialiased flex selection:bg-sky-500/10 relative">
      
      {/* TOAST NOTIFICATION RENDERER */}
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[999] px-4 py-2.5 rounded-xl shadow-lg text-xs font-bold text-white flex items-center gap-2 transition-all animate-in slide-in-from-top-4 ${toast.type === 'error' ? 'bg-rose-500' : 'bg-slate-900'}`}>
          {toast.type === 'error' ? <AlertCircle size={15}/> : <CheckCircle2 size={15}/>}
          {toast.message}
        </div>
      )}

      {/* EDIT MASTER MEMBER MODAL */}
      {editMemberModal.isOpen && editMemberModal.member && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-[1000] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Pencil size={16} className="text-slate-600"/> Edit Master Directory Profile
            </h3>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Full Profile Name</label>
                <input 
                  type="text" 
                  value={editMemberModal.editName}
                  onChange={(e) => setEditMemberModal(prev => ({ ...prev, editName: e.target.value }))}
                  className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-800 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Member Type</label>
                <select 
                  value={editMemberModal.editType}
                  onChange={(e) => setEditMemberModal(prev => ({ ...prev, editType: e.target.value as 'adult' | 'kid' }))}
                  className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-800 focus:outline-none"
                >
                  <option value="adult">Adult</option>
                  <option value="kid">Kid</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Linked Dependency Head</label>
                <select 
                  value={editMemberModal.editDependentId}
                  onChange={(e) => setEditMemberModal(prev => ({ ...prev, editDependentId: e.target.value }))}
                  className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-800 focus:outline-none"
                >
                  <option value="">Primary / Independent (No Dependency)</option>
                  {masterMembers
                    .filter((m: MasterMember) => m.member_type === 'adult' && !m.dependent_id && m.id !== editMemberModal.member?.id)
                    .map((m: MasterMember) => (
                      <option key={m.id} value={m.id}>Under: {m.full_name}</option>
                    ))}
                </select>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button 
                onClick={() => setEditMemberModal({ isOpen: false, member: null, editName: "", editType: "adult", editDependentId: "" })} 
                className="flex-1 py-2.5 bg-slate-100 text-slate-600 font-bold text-xs rounded-xl hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveEditMasterMember} 
                className="flex-1 py-2.5 bg-slate-900 text-white font-bold text-xs rounded-xl hover:bg-slate-800 transition-colors"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REASSIGNMENT MODAL */}
      {reassignModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-[1000] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <AlertCircle size={18} className="text-amber-500"/> Reassign Dependents Header
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              You are removing Primary Head <b className="text-slate-900">{reassignModal.removingParticipant?.primary_name}</b> from this activity. 
              Please select who will become the new Primary Head for their dependents in this event:
            </p>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Affected Dependents:</span>
              <p className="text-xs font-bold text-slate-700">{reassignModal.dependentsToReassign.map(d => d.primary_name).join(', ')}</p>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Select New Primary Head for Activity:</label>
              <select 
                value={selectedNewHeadId}
                onChange={(e) => setSelectedNewHeadId(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-800 focus:outline-none"
              >
                <option value="" disabled>Choose active member...</option>
                {currentActivity?.participants
                  .filter((p: Participant) => p.id !== reassignModal.removingParticipant?.id)
                  .map((p: Participant) => (
                    <option key={p.id} value={p.master_member_id || p.id}>{p.primary_name}</option>
                  ))}
              </select>
            </div>

            <div className="flex gap-2 pt-2">
              <button 
                onClick={() => setReassignModal({ isOpen: false, removingParticipant: null, dependentsToReassign: [] })} 
                className="flex-1 py-2.5 bg-slate-100 text-slate-600 font-bold text-xs rounded-xl hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleConfirmReassignAndRemove} 
                disabled={!selectedNewHeadId}
                className="flex-1 py-2.5 bg-slate-900 text-white font-bold text-xs rounded-xl hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                Confirm & Remove
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
        <nav className="space-y-1 flex-grow">
          <Link href="/" className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium hover:bg-slate-50 text-slate-500 hover:text-slate-900 transition-all duration-150"><LayoutDashboard size={18}/> Dashboard</Link>
          <Link href="/tracker" className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium hover:bg-slate-50 text-slate-500 hover:text-slate-900 transition-all duration-150"><Banknote size={18}/> Tracker</Link>
          <Link href="/splitter" className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium hover:bg-slate-50 text-slate-500 hover:text-slate-900 transition-all duration-150"><Calculator size={18}/> Splitter</Link>
          <Link href="/shop-clearing" className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium hover:bg-slate-50 text-slate-500 hover:text-slate-900 transition-all duration-150"><ShoppingCart size={18}/> Clearing</Link>
          <button onClick={() => setSelectedActId(null)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${!selectedActId ? 'bg-slate-900 text-white shadow-sm' : 'hover:bg-slate-50 text-slate-500 hover:text-slate-900'}`}><Flame size={18}/> Activities</button>
          <Link href="/myself" className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium hover:bg-slate-50 text-slate-500 hover:text-slate-900 transition-all duration-150"><User size={18}/> Myself</Link>
        </nav>
      </aside>

      {/* CORE VIEWPORT CANVAS FRAME */}
      <div className="flex-grow flex flex-col min-h-screen overflow-y-auto bg-[#F8FAFC]">
        <div className="w-full max-w-[1240px] mx-auto px-4 lg:px-8 py-6 lg:py-8 pb-40">
          
          {selectedActId === null ? (
            // ==========================================
            // DASHBOARD / HUB VIEW
            // ==========================================
            <div className="space-y-8 animate-in fade-in duration-300">
              <header>
                <h2 className="text-xl lg:text-2xl font-bold tracking-tight text-slate-900">Activity Hub</h2>
                <p className="text-xs font-semibold text-slate-500 mt-1">Manage events, track expenses, and configure your master directory.</p>
              </header>

              {/* CREATE ACTIVITY ACTION SECTION */}
              <div className="bg-white rounded-xl p-4 border border-slate-200/60 shadow-[0_2px_12px_rgba(0,0,0,0.02)] flex flex-col sm:flex-row gap-3 items-end">
                <div className="flex flex-col flex-grow w-full">
                  <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1 pl-0.5">Initialize New Event Workspace</label>
                  <input type="text" placeholder="e.g. Maafushi Beach BBQ Trip, Kuda Bandos Picnic" value={actTitle} onChange={(e) => setActTitle(e.target.value)} className="bg-slate-50 border border-slate-100 p-2 rounded-xl text-xs font-semibold focus:outline-none"/>
                </div>
                <div className="flex flex-col w-full sm:w-40">
                  <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1 pl-0.5">Event Date</label>
                  <input type="date" value={actDate} onChange={(e) => setActDate(e.target.value)} className="bg-slate-50 border border-slate-100 p-2 rounded-xl text-xs font-semibold focus:outline-none text-slate-500"/>
                </div>
                <button onClick={handleCreateActivity} className="w-full sm:w-auto h-9 px-5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs uppercase tracking-wider rounded-xl shadow-xs flex items-center justify-center gap-1 shrink-0 transition-transform active:scale-95"><Plus size={14}/> Create Activity</button>
              </div>

              {/* ACTIVITIES GRID */}
              <div>
                <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2"><Flame size={16} className="text-slate-400"/> All Created Activities</h3>
                {activities.length === 0 ? (
                  <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-200 text-slate-400 font-semibold text-sm shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
                    No activities created yet. Initialize your first event above.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {activities.map((a: Activity) => {
                      const breakdown = calculateBreakdown(a);
                      return (
                        <div 
                          key={a.id} 
                          onClick={() => { setSelectedActId(a.id); setActiveHostTab('roster'); }}
                          className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-[0_2px_12px_rgba(0,0,0,0.02)] hover:shadow-md hover:border-slate-300 transition-all cursor-pointer group flex flex-col relative"
                        >
                          <div className="flex justify-between items-start mb-4 pr-6">
                            <h4 className="font-bold text-slate-900 group-hover:text-sky-600 transition-colors leading-tight">{a.title}</h4>
                            <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100 shrink-0">{a.activity_date}</span>
                          </div>

                          {/* Delete Activity Button from Dashboard Card */}
                          <button 
                            onClick={(e) => handleDeleteActivity(a.id, e)}
                            className="absolute top-4 right-3 text-slate-300 hover:text-rose-500 p-1 rounded-lg hover:bg-rose-50 transition-colors opacity-0 group-hover:opacity-100"
                            title="Delete Activity"
                          >
                            <Trash2 size={14}/>
                          </button>
                          
                          <div className="mt-auto grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">
                            <div>
                              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Total Expense</p>
                              <p className="text-xs font-black text-slate-800">MVR {typeof a.total_expenses === 'number' ? a.total_expenses.toFixed(0) : parseFloat(a.total_expenses).toFixed(0)}</p>
                            </div>
                            <div>
                              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Attendees</p>
                              <p className="text-xs font-bold text-slate-600">{breakdown.total} pax ({breakdown.adults} Adults, {breakdown.kids} Kids)</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="my-8 border-t border-slate-200/60 w-full" />

              {/* MASTER DIRECTORY */}
              <div>
                <h3 className="text-sm font-bold text-slate-900 mb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Users size={16} className="text-slate-400"/> Master Members Directory
                  </div>
                  <div className="text-[10px] font-bold text-slate-500 bg-white px-3 py-1.5 rounded-lg border border-slate-200/60 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
                    {totalMasterAdults} Adults | {totalMasterKids} Kids | {totalMasterPrimary} Primary | {totalMasterDependent} Dependents
                  </div>
                </h3>
                
                <div className="bg-white rounded-2xl border border-slate-200/60 p-5 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
                  {/* Create Member Form */}
                  <div className="mb-6 space-y-4">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1">Add Profile to Master Record</h4>
                    <div className="flex flex-col md:flex-row gap-3">
                      <input 
                        type="text" 
                        placeholder="Full Profile Name" 
                        value={newProfileName} 
                        onChange={(e) => setNewProfileName(e.target.value)} 
                        className="flex-1 bg-white border border-slate-200 px-4 py-3 rounded-xl text-sm font-semibold focus:outline-none text-slate-800"
                      />
                      
                      <select 
                        value={newProfileType} 
                        onChange={(e) => setNewProfileType(e.target.value as 'adult' | 'kid')} 
                        className="w-full md:w-32 bg-white border border-slate-200 px-4 py-3 rounded-xl text-sm font-semibold focus:outline-none text-slate-700"
                      >
                        <option value="adult">Adult</option>
                        <option value="kid">Kid</option>
                      </select>

                      <select 
                        value={newProfileDependentId} 
                        onChange={(e) => setNewProfileDependentId(e.target.value)} 
                        className="flex-1 bg-white border border-slate-200 px-4 py-3 rounded-xl text-sm font-semibold focus:outline-none text-slate-600"
                      >
                        <option value="">Primary / Independent (No Dependency)</option>
                        {masterMembers.filter((m: MasterMember) => m.member_type === 'adult' && !m.dependent_id).map((m: MasterMember) => (
                          <option key={m.id} value={m.id}>Under: {m.full_name}</option>
                        ))}
                      </select>
                      
                      <button 
                        onClick={handleCreateMasterMember} 
                        className="w-full md:w-auto px-6 py-3 bg-[#0F172A] text-white font-bold text-[11px] uppercase tracking-widest rounded-xl shadow-xs transition-transform active:scale-95 shrink-0"
                      >
                        Save Profile
                      </button>
                    </div>
                  </div>

                  {/* Search Bar */}
                  <div className="mb-4 relative">
                    <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                      type="text" 
                      placeholder="Search directory by name..." 
                      value={masterSearchQuery}
                      onChange={(e) => setMasterSearchQuery(e.target.value)}
                      className="w-full sm:w-72 bg-white border border-slate-200 pl-10 pr-4 py-2.5 rounded-xl text-xs font-semibold focus:outline-none text-slate-800 shadow-sm"
                    />
                  </div>

                  {/* Display Directory (Grouped by Primary Family Block) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredPrimaryMembers.map((primary: MasterMember) => {
                      const dependents = masterMembers.filter(m => m.dependent_id === primary.id);
                      
                      return (
                        <div key={primary.id} className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col shadow-sm gap-3 relative group">
                          {/* Primary Member Header */}
                          <div className="flex items-center justify-between border-b border-slate-100 pb-3 pr-12">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-slate-900 uppercase tracking-tight">{primary.full_name}</span>
                              {primary.member_type === 'kid' && (
                                <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-md tracking-wider bg-[#FFF3CD] text-[#B47000]">
                                  KID
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-400 font-semibold tracking-wide">
                              Primary
                            </span>
                          </div>

                          {/* Primary Controls (Edit & Delete) */}
                          <div className="absolute top-3.5 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => handleOpenEditModal(primary)}
                              className="text-slate-400 hover:text-slate-800 p-1 rounded-md hover:bg-slate-100 transition-colors"
                              title="Edit Profile"
                            >
                              <Pencil size={13}/>
                            </button>
                            <button 
                              onClick={() => handleDeleteMasterMember(primary)}
                              className="text-slate-400 hover:text-rose-600 p-1 rounded-md hover:bg-rose-50 transition-colors"
                              title="Delete Profile"
                            >
                              <X size={14}/>
                            </button>
                          </div>

                          {/* Dependents Stack */}
                          {dependents.length > 0 ? (
                            <div className="flex flex-col gap-2">
                              {dependents.map(dep => (
                                <div key={dep.id} className="flex items-center justify-between bg-slate-50/80 border border-slate-100 rounded-xl p-2.5 relative group/dep">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-slate-700 uppercase tracking-tight">{dep.full_name}</span>
                                    {dep.member_type === 'kid' && (
                                      <span className="text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded-md tracking-wider bg-[#FFF3CD] text-[#B47000]">
                                        KID
                                      </span>
                                    )}
                                  </div>

                                  {/* Dependent Controls (Edit & Delete) */}
                                  <div className="flex items-center gap-1 opacity-0 group-hover/dep:opacity-100 transition-opacity">
                                    <button 
                                      onClick={() => handleOpenEditModal(dep)}
                                      className="text-slate-400 hover:text-slate-800 p-0.5 rounded hover:bg-slate-200 transition-colors"
                                      title="Edit Dependent"
                                    >
                                      <Pencil size={12}/>
                                    </button>
                                    <button 
                                      onClick={() => handleDeleteMasterMember(dep)}
                                      className="text-slate-400 hover:text-rose-600 p-0.5 rounded hover:bg-rose-100 transition-colors"
                                      title="Delete Dependent"
                                    >
                                      <X size={13}/>
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-[10px] text-slate-400 italic py-1 px-1">No dependents linked.</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

          ) : currentActivity ? (

            // ==========================================
            // SPECIFIC ACTIVITY DETAILS VIEW
            // ==========================================
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
              
              {/* Back Button & Header */}
              <div className="flex flex-col sm:flex-row justify-between sm:items-end gap-4 border-b border-slate-200/60 pb-5">
                <div>
                  <button onClick={() => setSelectedActId(null)} className="text-[10px] font-bold text-slate-400 hover:text-slate-800 uppercase tracking-wider flex items-center gap-1 mb-3 transition-colors">
                    <ChevronLeft size={14}/> Back to Hub Dashboard
                  </button>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">{currentActivity.title}</h2>
                  <p className="text-xs font-semibold text-slate-500 mt-1">{currentActivity.activity_date}</p>
                </div>
                
                <button onClick={() => handleDeleteActivity(currentActivity.id)} className="text-rose-500 hover:text-rose-700 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 bg-rose-50 px-3 py-1.5 rounded-lg border border-rose-100 transition-colors w-fit">
                  <Trash2 size={13}/> Delete Activity
                </button>
              </div>

              {/* Metrics Hero */}
              <div className="bg-white rounded-2xl p-4 lg:p-6 border border-slate-200/80 shadow-[0_2px_12px_rgba(0,0,0,0.02)] grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="border-r border-slate-100 pr-2 lg:pr-4 flex flex-col justify-center">
                  <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider block">Total Expense</span>
                  <div className="flex items-center gap-1 mt-1">
                    <span className="text-xs font-bold text-slate-400">MVR</span>
                    <input 
                      type="number" 
                      value={currentActivity.total_expenses} 
                      onChange={(e) => handleUpdateExpense(currentActivity.id, e.target.value)} 
                      className="text-lg lg:text-2xl font-black text-slate-900 bg-transparent w-full focus:outline-none placeholder-slate-300"
                      placeholder="0"
                    />
                  </div>
                </div>

                <div className="border-r border-slate-100 pr-2 lg:pr-4 flex flex-col justify-center">
                  <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider block">Cost / Person</span>
                  <p className="text-lg lg:text-xl font-black text-slate-900 mt-1">MVR {calculateSharePerHead(currentActivity).toFixed(2)}</p>
                </div>

                <div className="lg:border-r border-slate-100 pr-2 lg:pr-4 flex flex-col justify-center">
                  <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider block">Total Attendance</span>
                  <p className="text-lg lg:text-xl font-black text-slate-900 mt-1">
                    {calculateBreakdown(currentActivity).total} pax 
                    <span className="text-xs font-semibold text-slate-400 block sm:inline sm:ml-1">
                      ({calculateBreakdown(currentActivity).adults} Adults, {calculateBreakdown(currentActivity).kids} Kids)
                    </span>
                  </p>
                </div>

                <div className="col-span-2 lg:col-span-1 flex flex-col justify-center">
                  <button onClick={() => handleShareWhatsApp(currentActivity)} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold uppercase tracking-wider py-3 rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition-transform active:scale-95">
                    <Send size={14}/> Share Summary
                  </button>
                </div>
              </div>

              {/* TABS NAVIGATION */}
              <div className="bg-white rounded-xl border border-slate-200/80 px-2 flex overflow-x-auto no-scrollbar shadow-xs">
                <button onClick={() => setActiveHostTab('roster')} className={`py-3 px-5 text-[10px] sm:text-xs font-bold uppercase tracking-wider border-b-2 transition-all whitespace-nowrap ${activeTab === 'roster' ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-700'}`}>
                  👥 Attendees Roster
                </button>
                <button onClick={() => setActiveHostTab('expenses')} className={`py-3 px-5 text-[10px] sm:text-xs font-bold uppercase tracking-wider border-b-2 transition-all whitespace-nowrap ${activeTab === 'expenses' ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-700'}`}>
                  💸 Expenses
                </button>
                <button onClick={() => setActiveHostTab('finance')} className={`py-3 px-5 text-[10px] sm:text-xs font-bold uppercase tracking-wider border-b-2 transition-all whitespace-nowrap ${activeTab === 'finance' ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-700'}`}>
                  📊 Billing Ledger
                </button>
                <button onClick={() => setActiveHostTab('shopping')} className={`py-3 px-5 text-[10px] sm:text-xs font-bold uppercase tracking-wider border-b-2 transition-all whitespace-nowrap ${activeTab === 'shopping' ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-700'}`}>
                  🛒 Shopping List
                </button>
              </div>

              {/* TAB 1: ATTENDEES ROSTER */}
              {activeTab === 'roster' && (
                <div className="bg-white rounded-2xl border border-slate-200/80 p-4 lg:p-6 shadow-[0_2px_12px_rgba(0,0,0,0.02)] space-y-6">
                  
                  {/* Check-In, Import All & Group Toolbar */}
                  <div className="flex flex-col gap-4 bg-slate-50 border border-slate-100 p-4 rounded-xl">
                    <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
                      <div className="w-full sm:flex-1">
                        <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1 pl-0.5 block">Check-In Single Profile</label>
                        <select 
                          defaultValue="" 
                          onChange={(e) => {
                            const match = masterMembers.find((m: MasterMember) => m.id === e.target.value);
                            if (match) handleAddMemberToActivity(currentActivity.id, match);
                            e.target.value = "";
                          }} 
                          className="bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-800 focus:outline-none w-full"
                        >
                          <option value="" disabled>Select Profile from Master Directory...</option>
                          {masterMembers.map((m: MasterMember) => (
                            <option key={m.id} value={m.id}>{m.full_name} ({m.member_type.toUpperCase()})</option>
                          ))}
                        </select>
                      </div>

                      {/* IMPORT ALL MEMBERS BUTTON */}
                      <button 
                        onClick={() => handleImportAllMembers(currentActivity.id)} 
                        className="w-full sm:w-auto h-10 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold text-[10px] uppercase tracking-wider rounded-xl shadow-xs transition-transform active:scale-95 flex items-center justify-center gap-1.5 shrink-0"
                      >
                        <UserCheck size={14}/> Import Entire Master Directory
                      </button>
                    </div>

                    <div className="w-full border-t border-slate-200/60 pt-3 flex items-end gap-2">
                      <div className="flex-grow">
                        <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1 pl-0.5 block">Optional: Create Logistics Group</label>
                        <input type="text" placeholder="e.g. BBQ Setup, Games" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} className="w-full bg-white border border-slate-200 p-2.5 rounded-xl text-xs font-semibold focus:outline-none"/>
                      </div>
                      <button onClick={() => handleAddGroupDB(currentActivity)} className="bg-slate-200 hover:bg-slate-300 text-slate-800 text-[10px] font-bold uppercase tracking-wider px-4 h-10 rounded-xl transition-colors shrink-0">
                        + Group
                      </button>
                    </div>
                  </div>

                  {/* Active Groups Tag Bar */}
                  {currentActivity.groups_list && currentActivity.groups_list.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[9px] font-bold uppercase text-slate-400">Available Groups:</span>
                      {currentActivity.groups_list.map((gName: string, idx: number) => (
                        <div key={idx} className="bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-bold px-2 py-1 rounded-lg flex items-center gap-1">
                          <span>{gName}</span>
                          <button onClick={() => handleRemoveGroupDB(currentActivity, gName)} className="text-slate-400 hover:text-rose-500"><X size={12}/></button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Checked-In Roster Grid (Grouped by Primary Head) */}
                  {currentActivity.participants.length === 0 ? (
                    <div className="py-12 text-center text-slate-400 font-semibold text-xs">
                      No attendees in this activity yet. Check individual members or import everyone above.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {Array.from(new Set(currentActivity.participants.map((p: Participant) => p.head_id || p.master_member_id || p.id))).map((headId) => {
                        const headProfile = masterMembers.find((m: MasterMember) => m.id === headId);
                        const headPart = currentActivity.participants.find((p: Participant) => p.master_member_id === headId || p.id === headId);
                        const primaryName = headProfile?.full_name || headPart?.primary_name || "Primary Head";

                        const familyDependents = currentActivity.participants.filter(
                          (p: Participant) => (p.head_id === headId) && (p.master_member_id !== headId) && (p.id !== headId)
                        );

                        return (
                          <div key={headId} className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col shadow-xs gap-3 relative group">
                            {/* Primary Head Card Header */}
                            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 pr-6">
                              <span className="text-sm font-bold text-slate-900 uppercase tracking-tight">{primaryName}</span>
                              <span className="text-[9px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                                Primary Head
                              </span>
                            </div>

                            {/* Remove Primary Head Button */}
                            {headPart && (
                              <button 
                                onClick={() => handleInitiateRemoveParticipant(headPart)} 
                                className="absolute top-3.5 right-3 text-slate-300 hover:text-rose-500 p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <X size={14}/>
                              </button>
                            )}

                            {/* Primary Head Group Assigner (If Groups Exist) */}
                            {headPart && currentActivity.groups_list && currentActivity.groups_list.length > 0 && (
                              <div className="pb-1 border-b border-slate-50">
                                <select 
                                  value={headPart.assigned_group || ""} 
                                  onChange={(e) => { 
                                    handleUpdateParticipantLocal(currentActivity.id, headPart.id, "assigned_group", e.target.value); 
                                    handleSaveParticipantDB(headPart.id, "assigned_group", e.target.value); 
                                  }} 
                                  className="bg-slate-50 border border-slate-100 rounded-lg px-2 py-1 text-[10px] font-semibold text-slate-600 focus:outline-none w-full"
                                >
                                  <option value="">Group: Unassigned</option>
                                  {currentActivity.groups_list.map((g: string, gIdx: number) => (
                                    <option key={gIdx} value={g}>{g}</option>
                                  ))}
                                </select>
                              </div>
                            )}

                            {/* Dependents Checked In Below Primary Head */}
                            {familyDependents.length > 0 ? (
                              <div className="flex flex-col gap-2">
                                {familyDependents.map((p: Participant) => {
                                  const prof = masterMembers.find((m: MasterMember) => m.id === p.master_member_id);
                                  return (
                                    <div key={p.id} className="bg-slate-50/80 border border-slate-100 rounded-xl p-2.5 flex flex-col gap-2 relative group/item">
                                      <div className="flex items-center justify-between pr-6">
                                        <div className="flex items-center gap-2">
                                          <span className="text-xs font-bold text-slate-800 uppercase tracking-tight">{prof?.full_name || p.primary_name}</span>
                                          {prof?.member_type === 'kid' && (
                                            <span className="text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-[#FFF3CD] text-[#B47000]">
                                              KID
                                            </span>
                                          )}
                                        </div>
                                      </div>

                                      <button 
                                        onClick={() => handleInitiateRemoveParticipant(p)} 
                                        className="absolute top-2 right-2 text-slate-300 hover:text-rose-500 p-0.5 opacity-0 group-hover/item:opacity-100 transition-opacity"
                                      >
                                        <X size={14}/>
                                      </button>

                                      {currentActivity.groups_list && currentActivity.groups_list.length > 0 && (
                                        <div className="pt-1">
                                          <select 
                                            value={p.assigned_group || ""} 
                                            onChange={(e) => { 
                                              handleUpdateParticipantLocal(currentActivity.id, p.id, "assigned_group", e.target.value); 
                                              handleSaveParticipantDB(p.id, "assigned_group", e.target.value); 
                                            }} 
                                            className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-[10px] font-semibold text-slate-600 focus:outline-none w-full"
                                          >
                                            <option value="">Group: Unassigned</option>
                                            {currentActivity.groups_list.map((g: string, gIdx: number) => (
                                              <option key={gIdx} value={g}>{g}</option>
                                            ))}
                                          </select>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="text-[10px] text-slate-400 italic py-0.5 px-1">No dependents checked in.</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: EXPENSES LOG (NEW) */}
              {activeTab === 'expenses' && (
                <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-[0_2px_12px_rgba(0,0,0,0.02)] space-y-6">
                  {/* Add Expense Entry Form */}
                  <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl space-y-3">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-0.5">Log Expense Entry</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                      <div className="sm:col-span-5">
                        <input 
                          type="text" 
                          placeholder="Expense Description (e.g. Speedboat Fuel, BBQ Supplies)" 
                          value={expDesc} 
                          onChange={(e) => setExpDesc(e.target.value)} 
                          className="w-full bg-white border border-slate-200 p-2.5 rounded-xl text-xs font-bold text-slate-800 focus:outline-none"
                        />
                      </div>
                      
                      <div className="sm:col-span-4">
                        <select 
                          value={expPaidBy} 
                          onChange={(e) => setExpPaidBy(e.target.value)} 
                          className="w-full bg-white border border-slate-200 p-2.5 rounded-xl text-xs font-bold text-slate-800 focus:outline-none"
                        >
                          <option value="" disabled>Paid By...</option>
                          {currentActivity.participants.map((p: Participant) => (
                            <option key={p.id} value={p.primary_name}>{p.primary_name}</option>
                          ))}
                        </select>
                      </div>

                      <div className="sm:col-span-3">
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">MVR</span>
                          <input 
                            type="number" 
                            placeholder="0.00" 
                            value={expAmount} 
                            onChange={(e) => setExpAmount(e.target.value)} 
                            className="w-full bg-white border border-slate-200 py-2.5 pl-12 pr-3 rounded-xl text-xs font-bold text-slate-800 focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>
                    
                    <button 
                      onClick={() => handleAddExpenseItem(currentActivity.id)} 
                      className="w-full h-9 bg-slate-900 hover:bg-slate-800 text-white font-bold text-[10px] uppercase tracking-wider rounded-xl shadow-xs transition-transform active:scale-95 flex items-center justify-center gap-1.5"
                    >
                      <Plus size={14}/> Add Expense Item
                    </button>
                  </div>

                  {/* Expenses Breakdown Table */}
                  <div className="border border-slate-100 rounded-xl overflow-hidden shadow-xs">
                    <table className="w-full border-collapse text-left text-xs font-semibold">
                      <thead>
                        <tr className="bg-slate-50 text-slate-400 uppercase font-bold text-[9px] tracking-wider border-b border-slate-100">
                          <th className="p-3.5">Expense Description</th>
                          <th className="p-3.5">Paid By</th>
                          <th className="p-3.5 text-right">Amount (MVR)</th>
                          <th className="p-3.5 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(!currentActivity.expenses_breakdown || currentActivity.expenses_breakdown.length === 0) ? (
                          <tr><td colSpan={4} className="p-8 text-center text-slate-400 font-medium">No expenses logged yet. Add itemized expenses above.</td></tr>
                        ) : (
                          currentActivity.expenses_breakdown.map((item: ExpenseItem) => (
                            <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                              <td className="p-3.5 font-bold text-slate-800">{item.description}</td>
                              <td className="p-3.5 text-slate-600 font-bold">{item.paid_by_name}</td>
                              <td className="p-3.5 text-right font-black text-slate-900">MVR {parseFloat(item.amount as string).toFixed(2)}</td>
                              <td className="p-3.5 text-center">
                                <button onClick={() => handleRemoveExpenseItem(currentActivity.id, item.id)} className="text-slate-300 hover:text-rose-500 p-1">
                                  <X size={15}/>
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 3: FINANCES / BILLING LEDGER */}
              {activeTab === 'finance' && (
                <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
                  <div className="p-4 bg-slate-50 border-b border-slate-100">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Consolidated Payment Responsibilities</h3>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left text-xs font-semibold">
                      <thead>
                        <tr className="bg-slate-50/50 text-slate-400 uppercase font-bold text-[9px] tracking-wider border-b border-slate-100">
                          <th className="p-4">Primary / Family Head</th>
                          <th className="p-4">Attendees Covered</th>
                          <th className="p-4 text-right">Aggregated Due</th>
                          <th className="p-4 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {getBillingLedgerGrouped(currentActivity, calculateSharePerHead(currentActivity)).length === 0 ? (
                          <tr><td colSpan={4} className="p-12 text-center text-slate-400 font-medium">No ledger data available. Add attendees first.</td></tr>
                        ) : (
                          getBillingLedgerGrouped(currentActivity, calculateSharePerHead(currentActivity)).map((item: BillingLedgerItem, idx: number) => (
                            <tr key={idx} className="hover:bg-slate-50/40 transition-colors">
                              <td className="p-4 font-bold text-slate-900">{item.headName}</td>
                              <td className="p-4 text-slate-500 text-[10px] max-w-[200px] leading-relaxed">{item.attendees.join(', ')}</td>
                              <td className="p-4 text-right font-black text-amber-600">MVR {item.totalDue.toFixed(0)}</td>
                              <td className="p-4 text-center">
                                <button 
                                  onClick={async () => {
                                    const newPaidState = !item.hasPaid;
                                    handleUpdateParticipantLocal(currentActivity.id, item.initialPartId, "has_paid", newPaidState);
                                    await supabase.from('activity_participants').update({ has_paid: newPaidState }).eq('activity_id', currentActivity.id).eq('head_id', currentActivity.participants.find((p: Participant) => p.id === item.initialPartId)?.head_id);
                                    fetchActivitiesData();
                                  }}
                                  className={`px-3 py-1.5 rounded-lg font-black text-[9px] uppercase tracking-wider border transition-colors ${item.hasPaid ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}
                                >
                                  {item.hasPaid ? 'Paid ✅' : 'Pending ⏳'}
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 4: SHOPPING LIST */}
              {activeTab === 'shopping' && (
                <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-[0_2px_12px_rgba(0,0,0,0.02)] space-y-4">
                  <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider"><ClipboardList size={14} className="inline mr-1 text-slate-400"/> Provision Checklist</h3>
                    <button onClick={() => handleAddShoppingItem(currentActivity.id)} className="bg-slate-900 text-white font-bold text-[10px] uppercase px-3 py-1.5 rounded-xl transition-transform active:scale-95 flex items-center gap-1">
                      <Plus size={12}/> Add Item
                    </button>
                  </div>

                  {currentActivity.shopping.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-12 font-semibold">No provisions added to the list.</p>
                  ) : (
                    <div className="space-y-2.5">
                      {currentActivity.shopping.map((item: ShoppingItem) => (
                        <div key={item.id} className="flex flex-wrap sm:flex-nowrap gap-2 items-center bg-slate-50 border border-slate-100 p-2.5 rounded-xl">
                          <button 
                            onClick={() => {
                              handleUpdateShopLocal(currentActivity.id, item.id, "is_bought", !item.is_bought);
                              handleSaveShopDB(item.id, "is_bought", !item.is_bought);
                            }}
                            className="text-slate-400 hover:text-slate-900 p-0.5 shrink-0"
                          >
                            {item.is_bought ? <CheckCircle2 size={18} className="text-emerald-500"/> : <div className="w-4 h-4 rounded-md border border-slate-300 bg-white"/>}
                          </button>

                          <input 
                            type="text" 
                            value={item.item_name} 
                            onChange={(e) => handleUpdateShopLocal(currentActivity.id, item.id, "item_name", e.target.value)} 
                            onBlur={(e) => handleSaveShopDB(item.id, "item_name", e.target.value)} 
                            className={`flex-grow min-w-[120px] bg-white border border-slate-200 px-2.5 py-1.5 rounded-lg text-xs font-bold focus:outline-none ${item.is_bought ? 'line-through text-slate-400 bg-slate-50' : 'text-slate-800'}`} 
                            placeholder="Item description"
                          />

                          <input 
                            type="text" 
                            placeholder="Qty" 
                            value={item.qty} 
                            onChange={(e) => handleUpdateShopLocal(currentActivity.id, item.id, "qty", e.target.value)} 
                            onBlur={(e) => handleSaveShopDB(item.id, "qty", e.target.value)} 
                            className="w-16 bg-white border border-slate-200 p-1.5 rounded-lg text-xs font-bold text-center focus:outline-none text-slate-600 shrink-0"
                          />

                          <button onClick={() => handleRemoveShopItem(item.id)} className="text-slate-300 hover:text-rose-500 p-1 shrink-0 ml-auto sm:ml-0"><X size={15}/></button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : null}

        </div>

        {/* MOBILE FLOATING NAV DOCKBAR CONTAINER */}
        <nav className="lg:hidden fixed bottom-5 left-1/2 -translate-x-1/2 w-[92%] max-w-[360px] h-14 bg-white/90 border border-slate-200/60 shadow-[0_8px_30px_rgba(0,0,0,0.06)] rounded-xl flex justify-around items-center px-2 z-[100] backdrop-blur-md">
          <Link href="/" className="text-slate-400 hover:text-slate-800 transition-colors active:scale-95"><Wallet size={18} /></Link>
          <Link href="/tracker" className="text-slate-400 hover:text-slate-800 transition-colors active:scale-95"><Banknote size={18} /></Link>
          <Link href="/splitter" className="text-slate-400 hover:text-slate-800 transition-colors active:scale-95"><Calculator size={18} /></Link>
          <Link href="/shop-clearing" className="text-slate-400 hover:text-slate-800 transition-colors active:scale-95"><ShoppingCart size={18} /></Link>
          <button onClick={() => setSelectedActId(null)} className="text-slate-900 transition-transform duration-200 active:scale-95"><Flame size={18} className="bg-slate-100 p-2 w-8 h-8 rounded-lg" /></button>
        </nav>
      </div>
    </main>
  );
}