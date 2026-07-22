"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { 
  Plus, X, Trash2, Wallet, ShoppingCart, Calculator, 
  CheckCircle2, AlertCircle, Send, User, Banknote, LayoutDashboard, 
  Users, Flame, ClipboardList, Layers, UserPlus, ChevronLeft, Search, UserCheck, Pencil, Receipt, Filter, Building2
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
  whatsapp_shared?: boolean;
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
  split_mode?: 'all' | 'adults_only';
  manual_exclusions?: string[];
  participants: Participant[];
  shopping: ShoppingItem[];
  expenses_breakdown?: ExpenseItem[];
}

interface BankAccount {
  id: string;
  account_name: string;
  account_number: string;
  currency: string;
  is_default: boolean;
}

interface BillingLedgerItem {
  headId: string;
  headName: string;
  attendees: string[];
  totalDue: number;
  hasPaid: boolean;
  initialPartId: string;
  whatsappShared: boolean;
}

export default function ActivitiesPage() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [masterMembers, setMasterMembers] = useState<MasterMember[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  
  // Navigation State
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

  // Bank Account Modal / Form States
  const [isBankModalOpen, setIsBankModalOpen] = useState(false);
  const [bankAccountName, setBankAccountName] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [bankCurrency, setBankCurrency] = useState("MVR");
  const [selectedBankIdForInvoice, setSelectedBankIdForInvoice] = useState<string>("");

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

  // Edit Expense Modal State
  const [editExpenseModal, setEditExpenseModal] = useState<{
    isOpen: boolean;
    item: ExpenseItem | null;
    desc: string;
    paidBy: string;
    amount: string;
  }>({
    isOpen: false,
    item: null,
    desc: "",
    paidBy: "",
    amount: ""
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

  const fetchBankAccounts = async () => {
    const { data, error } = await supabase.from('saved_bank_accounts').select('*').order('created_at', { ascending: true });
    if (!error && data) {
      setBankAccounts(data as BankAccount[]);
      if (data.length > 0 && !selectedBankIdForInvoice) {
        const defaultAcc = data.find((b: BankAccount) => b.is_default) || data[0];
        setSelectedBankIdForInvoice(defaultAcc.id);
      }
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
          split_mode: act.split_mode || 'all',
          manual_exclusions: act.manual_exclusions || [],
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
    fetchBankAccounts();
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

  const calculateEligiblePayingHeadCount = (activity?: Activity) => {
    if (!activity || !activity.participants) return 0;
    const exclusions = activity.manual_exclusions || [];
    const mode = activity.split_mode || 'all';

    return activity.participants.filter((p: Participant) => {
      if (exclusions.includes(p.id)) return false;
      const profile = masterMembers.find((m: MasterMember) => m.id === p.master_member_id);
      if (mode === 'adults_only' && profile?.member_type === 'kid') return false;
      return true;
    }).length;
  };

  const calculateSharePerHead = (activity?: Activity) => {
    if (!activity) return 0;
    const eligibleCount = calculateEligiblePayingHeadCount(activity);
    if (eligibleCount === 0) return 0;
    const totalExp = typeof activity.total_expenses === 'number' ? activity.total_expenses : parseFloat(activity.total_expenses) || 0;
    return totalExp / eligibleCount;
  };

  const getBillingLedgerGrouped = (activity?: Activity): BillingLedgerItem[] => {
    if (!activity || !activity.participants) return [];
    
    const sharePerHead = calculateSharePerHead(activity);
    const exclusions = activity.manual_exclusions || [];
    const mode = activity.split_mode || 'all';
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
          headId: headId,
          headName: headName,
          attendees: [],
          totalDue: 0,
          hasPaid: p.has_paid,
          initialPartId: p.id,
          whatsappShared: p.whatsapp_shared || false
        };
      }

      const isExcludedManually = exclusions.includes(p.id);
      const isKidExcludedByMode = mode === 'adults_only' && profile?.member_type === 'kid';
      const isBillable = !isExcludedManually && !isKidExcludedByMode;

      billsMap[headId].attendees.push(profileName + (isBillable ? "" : " (Excluded)"));
      if (isBillable) {
        billsMap[headId].totalDue += sharePerHead;
      }

      if (!p.has_paid) billsMap[headId].hasPaid = false; 
    });

    return Object.values(billsMap);
  };

  const calculateReceivedSummary = (activity?: Activity) => {
    const ledger = getBillingLedgerGrouped(activity);
    let totalCollected = 0;
    let totalOutstanding = 0;

    ledger.forEach(item => {
      if (item.hasPaid) {
        totalCollected += item.totalDue;
      } else {
        totalOutstanding += item.totalDue;
      }
    });

    return { totalCollected, totalOutstanding };
  };

  // --- Bank Account Handlers ---
  const handleSaveBankAccount = async () => {
    if (!bankAccountName.trim() || !bankAccountNumber.trim()) {
      return showToast("Account name and number are required", "error");
    }

    const payload = {
      account_name: bankAccountName.trim(),
      account_number: bankAccountNumber.trim(),
      currency: bankCurrency,
      is_default: bankAccounts.length === 0
    };

    const { error } = await supabase.from('saved_bank_accounts').insert(payload);
    if (!error) {
      showToast("Bank Account Saved!");
      setBankAccountName("");
      setBankAccountNumber("");
      fetchBankAccounts();
    } else {
      showToast(`Error saving bank account: ${error.message}`, "error");
    }
  };

  const handleDeleteBankAccount = async (id: string) => {
    const { error } = await supabase.from('saved_bank_accounts').delete().eq('id', id);
    if (!error) {
      showToast("Bank account removed");
      fetchBankAccounts();
    }
  };

  // --- Handlers ---
  const handleUpdateSplitMode = async (actId: string, newMode: 'all' | 'adults_only') => {
    setActivities(prev => prev.map(a => a.id === actId ? { ...a, split_mode: newMode } : a));
    await supabase.from('activities').update({ split_mode: newMode }).eq('id', actId);
    showToast("Distribution rule saved!");
  };

  const toggleManualExclusion = async (actId: string, partId: string) => {
    if (!currentActivity) return;
    const currentExclusions = currentActivity.manual_exclusions || [];
    const nextExclusions = currentExclusions.includes(partId)
      ? currentExclusions.filter(id => id !== partId)
      : [...currentExclusions, partId];

    setActivities(prev => prev.map(a => a.id === actId ? { ...a, manual_exclusions: nextExclusions } : a));
    await supabase.from('activities').update({ manual_exclusions: nextExclusions }).eq('id', actId);
  };

  const handleCreateActivity = async () => {
    if (!actTitle.trim()) return showToast("Activity title required", "error");
    
    const { data, error } = await supabase
      .from('activities')
      .insert({ title: actTitle.trim(), activity_date: actDate, total_expenses: 0, groups_list: [], split_mode: 'all', manual_exclusions: [] })
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
      
      const currentExpenses = currentActivity?.expenses_breakdown || [];
      const newTotal = currentExpenses.reduce((sum, item) => sum + (parseFloat(item.amount as string) || 0), 0) + parsedAmount;
      await supabase.from('activities').update({ total_expenses: newTotal }).eq('id', actId);
      
      showToast("Expense logged!");
      fetchActivitiesData();
    }
  };

  const handleSaveEditExpense = async () => {
    if (!editExpenseModal.item || !editExpenseModal.desc.trim() || !currentActivity) return;
    const parsedAmount = parseFloat(editExpenseModal.amount) || 0;

    const payload = {
      description: editExpenseModal.desc.trim(),
      paid_by_name: editExpenseModal.paidBy,
      amount: parsedAmount
    };

    const { error } = await supabase
      .from('activity_expenses')
      .update(payload)
      .eq('id', editExpenseModal.item.id);

    if (error) {
      showToast(`Error updating expense: ${error.message}`, "error");
    } else {
      const remainingExpenses = (currentActivity.expenses_breakdown || []).map(item => 
        item.id === editExpenseModal.item?.id ? { ...item, ...payload } : item
      );
      const newTotal = remainingExpenses.reduce((sum, item) => sum + (parseFloat(item.amount as string) || 0), 0);
      await supabase.from('activities').update({ total_expenses: newTotal }).eq('id', currentActivity.id);

      setEditExpenseModal({ isOpen: false, item: null, desc: "", paidBy: "", amount: "" });
      showToast("Expense updated!");
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

  // Mobile-Optimized WhatsApp Sharing
  const openWhatsAppLink = (msg: string) => {
    const encoded = encodeURIComponent(msg);
    const isMobile = typeof window !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const url = `https://api.whatsapp.com/send?text=${encoded}`;
    
    if (isMobile) {
      window.location.href = url;
    } else {
      window.open(url, "_blank");
    }
  };

  // WhatsApp Group Summary
  const handleShareWhatsApp = (act: Activity) => {
    const sharePerHead = calculateSharePerHead(act);
    const ledger = getBillingLedgerGrouped(act);
    const totalExp = typeof act.total_expenses === 'number' ? act.total_expenses : parseFloat(act.total_expenses) || 0;
    
    let msg = `*🏡 INVOICE SUMMARY: ${act.title.toUpperCase()}*\n📅 Date: ${act.activity_date}\n💰 Total Expense: MVR ${totalExp.toFixed(2)}\n📊 Per Person: MVR ${sharePerHead.toFixed(2)}\n\n*BILLING DETAILS:*\n`;

    ledger.forEach((item: BillingLedgerItem) => {
      msg += `• *Primary Head: ${item.headName}*\n`;
      msg += `  ↳ For: ${item.attendees.join(', ')}\n`;
      msg += `  💳 Amount: *MVR ${item.totalDue.toFixed(0)}* [${item.hasPaid ? 'PAID ✅' : 'PENDING ⏳'}]\n\n`;
    });

    openWhatsAppLink(msg);
  };

  // WhatsApp Personal Structured Invoice Broadcast
  const handleSharePersonalWhatsApp = async (act: Activity, ledgerItem: BillingLedgerItem) => {
    const activeBank = bankAccounts.find(b => b.id === selectedBankIdForInvoice) || bankAccounts[0];

    const formattedDate = act.activity_date ? act.activity_date.split('-').reverse().join('/') : new Date().toLocaleDateString('en-GB');
    const totalExp = typeof act.total_expenses === 'number' ? act.total_expenses : parseFloat(act.total_expenses) || 0;
    const sharePerHead = calculateSharePerHead(act);
    const eligibleCount = calculateEligiblePayingHeadCount(act);
    const familyPaxCount = ledgerItem.attendees.filter(a => !a.includes('(Excluded)')).length;

    let msg = `INVOICE\n`;
    msg += `Bill To: ${ledgerItem.headName.toUpperCase()}\n`;
    msg += `Bill Date: ${formattedDate}\n\n`;
    msg += `(${formattedDate})\n`;
    msg += `•⁠ ⁠${act.title.toUpperCase()}\n`;

    if (act.expenses_breakdown && act.expenses_breakdown.length > 0) {
      act.expenses_breakdown.forEach((exp: ExpenseItem) => {
        msg += `    └ ${exp.description.toUpperCase()}: MVR ${parseFloat(exp.amount as string).toFixed(2)}\n`;
      });
    }

    msg += `    -----------------------------------\n`;
    msg += `    Total Event Cost: MVR ${totalExp.toFixed(2)}\n`;
    msg += `    Split Among: ${eligibleCount} Paying Pax\n`;
    msg += `    Cost Per Head: MVR ${sharePerHead.toFixed(2)}\n`;
    msg += `    -----------------------------------\n`;
    msg += `    Included: ${ledgerItem.attendees.join(', ')}\n`;
    msg += `    Subtotal (${familyPaxCount} pax × MVR ${sharePerHead.toFixed(2)}): ${ledgerItem.totalDue.toFixed(2)} MVR\n\n`;
    msg += `TOTAL DUE: ${ledgerItem.totalDue.toFixed(2)} MVR\n\n`;

    if (activeBank) {
      msg += `ACCOUNT DETAIL\n\n`;
      msg += `${activeBank.account_name} - ${activeBank.currency}\n`;
      msg += `${activeBank.account_number}\n`;
    }

    await supabase.from('activity_participants')
      .update({ whatsapp_shared: true })
      .eq('activity_id', act.id)
      .eq('head_id', ledgerItem.headId);

    fetchActivitiesData();
    openWhatsAppLink(msg);
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

  const handleUpdateExpenseVal = async (actId: string, val: string) => {
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
      assigned_group: "",
      whatsapp_shared: false
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
      assigned_group: "",
      whatsapp_shared: false
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

  // Metrics for Master Directory
  const totalMasterAdults = masterMembers.filter((m: MasterMember) => m.member_type === 'adult').length;
  const totalMasterKids = masterMembers.filter((m: MasterMember) => m.member_type === 'kid').length;
  const totalMasterPrimary = masterMembers.filter((m: MasterMember) => !m.dependent_id).length;
  const totalMasterDependent = masterMembers.filter((m: MasterMember) => m.dependent_id).length;

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

  const receivedMetrics = calculateReceivedSummary(currentActivity);

  return (
    <main className="min-h-screen bg-[#F8FAFC] text-[#1E293B] font-sans antialiased flex selection:bg-sky-500/10 relative overflow-x-hidden">
      
      {/* TOAST NOTIFICATION RENDERER */}
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[999] px-4 py-2.5 rounded-xl shadow-lg text-xs font-bold text-white flex items-center gap-2 transition-all animate-in slide-in-from-top-4 w-[90%] max-w-sm justify-center ${toast.type === 'error' ? 'bg-rose-500' : 'bg-slate-900'}`}>
          {toast.type === 'error' ? <AlertCircle size={15}/> : <CheckCircle2 size={15}/>}
          <span className="truncate">{toast.message}</span>
        </div>
      )}

      {/* SAVED BANK ACCOUNTS MANAGMENT MODAL */}
      {isBankModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-[1000] flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 max-w-lg w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-2">
                <Building2 size={16} className="text-slate-600"/> Saved Bank Accounts
              </h3>
              <button onClick={() => setIsBankModalOpen(false)} className="text-slate-400 hover:text-slate-800 p-1"><X size={18}/></button>
            </div>

            {/* Add Bank Account Form */}
            <div className="bg-slate-50 p-3 sm:p-4 rounded-xl border border-slate-100 space-y-3">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Add New Account</span>
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                <input 
                  type="text" 
                  placeholder="Account Holder Name" 
                  value={bankAccountName} 
                  onChange={(e) => setBankAccountName(e.target.value)} 
                  className="sm:col-span-6 bg-white border border-slate-200 p-2.5 rounded-xl text-xs font-bold text-slate-800 focus:outline-none"
                />
                <input 
                  type="text" 
                  placeholder="Account Number" 
                  value={bankAccountNumber} 
                  onChange={(e) => setBankAccountNumber(e.target.value)} 
                  className="sm:col-span-4 bg-white border border-slate-200 p-2.5 rounded-xl text-xs font-bold text-slate-800 focus:outline-none"
                />
                <select 
                  value={bankCurrency} 
                  onChange={(e) => setBankCurrency(e.target.value)} 
                  className="sm:col-span-2 bg-white border border-slate-200 p-2.5 rounded-xl text-xs font-bold text-slate-700 focus:outline-none"
                >
                  <option value="MVR">MVR</option>
                  <option value="USD">USD</option>
                </select>
              </div>
              <button 
                onClick={handleSaveBankAccount} 
                className="w-full h-9 bg-slate-900 hover:bg-slate-800 text-white font-bold text-[10px] uppercase tracking-wider rounded-xl transition-transform active:scale-95"
              >
                + Save Account
              </button>
            </div>

            {/* Existing Accounts List */}
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Existing Saved Accounts</span>
              {bankAccounts.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No bank accounts saved yet.</p>
              ) : (
                bankAccounts.map((b: BankAccount) => (
                  <div key={b.id} className="flex justify-between items-center bg-slate-50 border border-slate-100 p-3 rounded-xl text-xs">
                    <div className="truncate mr-2">
                      <p className="font-bold text-slate-900 truncate">{b.account_name} - <span className="text-slate-500">{b.currency}</span></p>
                      <p className="text-slate-500 font-mono text-[11px] mt-0.5 truncate">{b.account_number}</p>
                    </div>
                    <button onClick={() => handleDeleteBankAccount(b.id)} className="text-slate-300 hover:text-rose-500 p-1 shrink-0"><X size={16}/></button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* EDIT EXPENSE MODAL */}
      {editExpenseModal.isOpen && editExpenseModal.item && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-[1000] flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-2">
              <Pencil size={16} className="text-slate-600"/> Edit Expense Entry
            </h3>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Expense Description</label>
                <input 
                  type="text" 
                  value={editExpenseModal.desc}
                  onChange={(e) => setEditExpenseModal(prev => ({ ...prev, desc: e.target.value }))}
                  className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-800 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Paid By</label>
                <select 
                  value={editExpenseModal.paidBy}
                  onChange={(e) => setEditExpenseModal(prev => ({ ...prev, paidBy: e.target.value }))}
                  className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-800 focus:outline-none"
                >
                  {currentActivity?.participants.map((p: Participant) => (
                    <option key={p.id} value={p.primary_name}>{p.primary_name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Amount (MVR)</label>
                <input 
                  type="number" 
                  value={editExpenseModal.amount}
                  onChange={(e) => setEditExpenseModal(prev => ({ ...prev, amount: e.target.value }))}
                  className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-800 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button 
                onClick={() => setEditExpenseModal({ isOpen: false, item: null, desc: "", paidBy: "", amount: "" })} 
                className="flex-1 py-2.5 bg-slate-100 text-slate-600 font-bold text-xs rounded-xl hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveEditExpense} 
                className="flex-1 py-2.5 bg-slate-900 text-white font-bold text-xs rounded-xl hover:bg-slate-800 transition-colors"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT MASTER MEMBER MODAL */}
      {editMemberModal.isOpen && editMemberModal.member && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-[1000] flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-2">
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
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-[1000] flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-2">
              <AlertCircle size={18} className="text-amber-500 shrink-0"/> Reassign Dependents Header
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
      <div className="flex-grow flex flex-col min-h-screen overflow-y-auto bg-[#F8FAFC] w-full min-w-0">
        <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 pb-32">
          
          {selectedActId === null ? (
            // ==========================================
            // DASHBOARD / HUB VIEW
            // ==========================================
            <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-300">
              <header>
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">Activity Hub</h2>
                <p className="text-xs font-semibold text-slate-500 mt-1">Manage events, track expenses, and configure your master directory.</p>
              </header>

              {/* CREATE ACTIVITY ACTION SECTION */}
              <div className="bg-white rounded-2xl p-3.5 sm:p-4 border border-slate-200/60 shadow-[0_2px_12px_rgba(0,0,0,0.02)] flex flex-col sm:flex-row gap-3 items-stretch sm:items-end">
                <div className="flex flex-col flex-grow w-full">
                  <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1 pl-0.5">Initialize New Event Workspace</label>
                  <input type="text" placeholder="e.g. Maafushi Beach BBQ Trip, Kuda Bandos Picnic" value={actTitle} onChange={(e) => setActTitle(e.target.value)} className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-semibold focus:outline-none text-slate-800"/>
                </div>
                <div className="flex flex-col w-full sm:w-40">
                  <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1 pl-0.5">Event Date</label>
                  <input type="date" value={actDate} onChange={(e) => setActDate(e.target.value)} className="bg-slate-50 border border-slate-200 p-2 rounded-xl text-xs font-semibold focus:outline-none text-slate-600"/>
                </div>
                <button onClick={handleCreateActivity} className="w-full sm:w-auto h-10 px-5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs uppercase tracking-wider rounded-xl shadow-xs flex items-center justify-center gap-1 shrink-0 transition-transform active:scale-95"><Plus size={14}/> Create Activity</button>
              </div>

              {/* ACTIVITIES GRID */}
              <div>
                <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2"><Flame size={16} className="text-slate-400"/> All Created Activities</h3>
                {activities.length === 0 ? (
                  <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-200 text-slate-400 font-semibold text-sm shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
                    No activities created yet. Initialize your first event above.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
                    {activities.map((a: Activity) => {
                      const breakdown = calculateBreakdown(a);
                      return (
                        <div 
                          key={a.id} 
                          onClick={() => { setSelectedActId(a.id); setActiveHostTab('roster'); }}
                          className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/60 shadow-[0_2px_12px_rgba(0,0,0,0.02)] hover:shadow-md hover:border-slate-300 transition-all cursor-pointer group flex flex-col relative"
                        >
                          <div className="flex justify-between items-start mb-3 pr-6">
                            <h4 className="font-bold text-slate-900 group-hover:text-sky-600 transition-colors leading-tight text-sm sm:text-base">{a.title}</h4>
                            <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100 shrink-0 ml-2">{a.activity_date}</span>
                          </div>

                          <button 
                            onClick={(e) => handleDeleteActivity(a.id, e)}
                            className="absolute top-3.5 right-3 text-slate-300 hover:text-rose-500 p-1 rounded-lg hover:bg-rose-50 transition-colors"
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
                              <p className="text-xs font-bold text-slate-600">{breakdown.total} pax ({breakdown.adults}A, {breakdown.kids}K)</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="my-6 border-t border-slate-200/60 w-full" />

              {/* MASTER DIRECTORY */}
              <div>
                <h3 className="text-sm font-bold text-slate-900 mb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Users size={16} className="text-slate-400"/> Master Members Directory
                  </div>
                  <div className="text-[10px] font-bold text-slate-500 bg-white px-3 py-1.5 rounded-lg border border-slate-200/60 shadow-[0_2px_12px_rgba(0,0,0,0.02)] w-fit">
                    {totalMasterAdults} Adults | {totalMasterKids} Kids | {totalMasterPrimary} Primary | {totalMasterDependent} Dependents
                  </div>
                </h3>
                
                <div className="bg-white rounded-2xl border border-slate-200/60 p-4 sm:p-5 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
                  <div className="mb-6 space-y-3">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1">Add Profile to Master Record</h4>
                    <div className="flex flex-col sm:flex-row flex-wrap gap-2.5">
                      <input 
                        type="text" 
                        placeholder="Full Profile Name" 
                        value={newProfileName} 
                        onChange={(e) => setNewProfileName(e.target.value)} 
                        className="flex-1 min-w-[200px] bg-white border border-slate-200 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold focus:outline-none text-slate-800"
                      />
                      
                      <select 
                        value={newProfileType} 
                        onChange={(e) => setNewProfileType(e.target.value as 'adult' | 'kid')} 
                        className="w-full sm:w-28 bg-white border border-slate-200 px-3 py-2.5 rounded-xl text-xs sm:text-sm font-semibold focus:outline-none text-slate-700"
                      >
                        <option value="adult">Adult</option>
                        <option value="kid">Kid</option>
                      </select>

                      <select 
                        value={newProfileDependentId} 
                        onChange={(e) => setNewProfileDependentId(e.target.value)} 
                        className="flex-1 min-w-[200px] bg-white border border-slate-200 px-3 py-2.5 rounded-xl text-xs sm:text-sm font-semibold focus:outline-none text-slate-600"
                      >
                        <option value="">Primary / Independent (No Dependency)</option>
                        {masterMembers.filter((m: MasterMember) => m.member_type === 'adult' && !m.dependent_id).map((m: MasterMember) => (
                          <option key={m.id} value={m.id}>Under: {m.full_name}</option>
                        ))}
                      </select>
                      
                      <button 
                        onClick={handleCreateMasterMember} 
                        className="w-full sm:w-auto px-5 py-2.5 bg-[#0F172A] text-white font-bold text-[11px] uppercase tracking-widest rounded-xl shadow-xs transition-transform active:scale-95 shrink-0"
                      >
                        Save Profile
                      </button>
                    </div>
                  </div>

                  <div className="mb-4 relative">
                    <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                      type="text" 
                      placeholder="Search directory by name..." 
                      value={masterSearchQuery}
                      onChange={(e) => setMasterSearchQuery(e.target.value)}
                      className="w-full sm:w-72 bg-white border border-slate-200 pl-9 pr-4 py-2 rounded-xl text-xs font-semibold focus:outline-none text-slate-800 shadow-xs"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {filteredPrimaryMembers.map((primary: MasterMember) => {
                      const dependents = masterMembers.filter(m => m.dependent_id === primary.id);
                      
                      return (
                        <div key={primary.id} className="bg-white border border-slate-200 rounded-2xl p-3.5 flex flex-col shadow-xs gap-2.5 relative group">
                          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 pr-12">
                            <div className="flex items-center gap-1.5 truncate">
                              <span className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-tight truncate">{primary.full_name}</span>
                              {primary.member_type === 'kid' && (
                                <span className="text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded-md tracking-wider bg-[#FFF3CD] text-[#B47000] shrink-0">
                                  KID
                                </span>
                              )}
                            </div>
                            <span className="text-[9px] text-slate-400 font-semibold tracking-wide shrink-0">
                              Primary
                            </span>
                          </div>

                          <div className="absolute top-3 right-2 flex items-center gap-1">
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

                          {dependents.length > 0 ? (
                            <div className="flex flex-col gap-1.5">
                              {dependents.map(dep => (
                                <div key={dep.id} className="flex items-center justify-between bg-slate-50/80 border border-slate-100 rounded-xl p-2 relative group/dep">
                                  <div className="flex items-center gap-1.5 truncate">
                                    <span className="text-xs font-bold text-slate-700 uppercase tracking-tight truncate">{dep.full_name}</span>
                                    {dep.member_type === 'kid' && (
                                      <span className="text-[7px] font-extrabold uppercase px-1 py-0.5 rounded-md tracking-wider bg-[#FFF3CD] text-[#B47000] shrink-0">
                                        KID
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-1 shrink-0">
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
                            <div className="text-[10px] text-slate-400 italic py-0.5 px-1">No dependents linked.</div>
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
            <div className="space-y-5 sm:space-y-6 animate-in slide-in-from-right-4 duration-300">
              
              {/* Back Button & Header */}
              <div className="flex flex-col sm:flex-row justify-between sm:items-end gap-3 border-b border-slate-200/60 pb-4">
                <div>
                  <button onClick={() => setSelectedActId(null)} className="text-[10px] font-bold text-slate-400 hover:text-slate-800 uppercase tracking-wider flex items-center gap-1 mb-2 transition-colors">
                    <ChevronLeft size={14}/> Back to Hub Dashboard
                  </button>
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-tight">{currentActivity.title}</h2>
                  <p className="text-xs font-semibold text-slate-500 mt-0.5">{currentActivity.activity_date}</p>
                </div>
                
                <button onClick={() => handleDeleteActivity(currentActivity.id)} className="text-rose-500 hover:text-rose-700 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 bg-rose-50 px-3 py-1.5 rounded-lg border border-rose-100 transition-colors w-fit">
                  <Trash2 size={13}/> Delete Activity
                </button>
              </div>

              {/* Metrics Hero */}
              <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-[0_2px_12px_rgba(0,0,0,0.02)] grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <div className="border-r border-slate-100 pr-2 flex flex-col justify-center">
                  <span className="text-[9px] sm:text-[10px] font-extrabold uppercase text-slate-400 tracking-wider block">Total Expense</span>
                  <div className="flex items-center gap-1 mt-1">
                    <span className="text-xs font-bold text-slate-400">MVR</span>
                    <input 
                      type="number" 
                      value={currentActivity.total_expenses} 
                      onChange={(e) => handleUpdateExpenseVal(currentActivity.id, e.target.value)} 
                      className="text-base sm:text-2xl font-black text-slate-900 bg-transparent w-full focus:outline-none placeholder-slate-300"
                      placeholder="0"
                    />
                  </div>
                </div>

                <div className="lg:border-r border-slate-100 pr-2 flex flex-col justify-center">
                  <span className="text-[9px] sm:text-[10px] font-extrabold uppercase text-slate-400 tracking-wider block">Cost / Person (Split)</span>
                  <p className="text-base sm:text-xl font-black text-slate-900 mt-1">MVR {calculateSharePerHead(currentActivity).toFixed(2)}</p>
                </div>

                <div className="border-r border-slate-100 pr-2 flex flex-col justify-center col-span-1">
                  <span className="text-[9px] sm:text-[10px] font-extrabold uppercase text-slate-400 tracking-wider block">Total Attendance</span>
                  <p className="text-base sm:text-xl font-black text-slate-900 mt-1">
                    {calculateBreakdown(currentActivity).total} pax 
                    <span className="text-[10px] sm:text-xs font-semibold text-slate-400 block sm:inline sm:ml-1">
                      ({calculateBreakdown(currentActivity).adults}A, {calculateBreakdown(currentActivity).kids}K)
                    </span>
                  </p>
                </div>

                <div className="col-span-1 lg:col-span-1 flex flex-col justify-center">
                  <button onClick={() => setIsBankModalOpen(true)} className="w-full bg-slate-900 hover:bg-slate-800 text-white text-[10px] sm:text-xs font-bold uppercase tracking-wider py-2.5 sm:py-3 rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition-transform active:scale-95">
                    <Building2 size={13}/> Bank Accounts
                  </button>
                </div>
              </div>

              {/* TABS NAVIGATION */}
              <div className="bg-white rounded-xl border border-slate-200/80 p-1 flex overflow-x-auto no-scrollbar shadow-xs gap-1">
                <button onClick={() => setActiveHostTab('roster')} className={`py-2.5 px-3.5 text-[10px] sm:text-xs font-bold uppercase tracking-wider rounded-lg transition-all whitespace-nowrap ${activeTab === 'roster' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-500 hover:text-slate-900'}`}>
                  👥 Attendees
                </button>
                <button onClick={() => setActiveHostTab('expenses')} className={`py-2.5 px-3.5 text-[10px] sm:text-xs font-bold uppercase tracking-wider rounded-lg transition-all whitespace-nowrap ${activeTab === 'expenses' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-500 hover:text-slate-900'}`}>
                  💸 Expenses
                </button>
                <button onClick={() => setActiveHostTab('finance')} className={`py-2.5 px-3.5 text-[10px] sm:text-xs font-bold uppercase tracking-wider rounded-lg transition-all whitespace-nowrap ${activeTab === 'finance' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-500 hover:text-slate-900'}`}>
                  📊 Billing Ledger
                </button>
                <button onClick={() => setActiveHostTab('shopping')} className={`py-2.5 px-3.5 text-[10px] sm:text-xs font-bold uppercase tracking-wider rounded-lg transition-all whitespace-nowrap ${activeTab === 'shopping' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-500 hover:text-slate-900'}`}>
                  🛒 Shopping
                </button>
              </div>

              {/* TAB 1: ATTENDEES ROSTER */}
              {activeTab === 'roster' && (
                <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 sm:p-6 shadow-[0_2px_12px_rgba(0,0,0,0.02)] space-y-5">
                  <div className="flex flex-col gap-3 bg-slate-50 border border-slate-100 p-3 sm:p-4 rounded-xl">
                    <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
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

                      <button 
                        onClick={() => handleImportAllMembers(currentActivity.id)} 
                        className="w-full sm:w-auto h-10 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold text-[10px] uppercase tracking-wider rounded-xl shadow-xs transition-transform active:scale-95 flex items-center justify-center gap-1.5 shrink-0"
                      >
                        <UserCheck size={14}/> Import All Master
                      </button>
                    </div>

                    <div className="w-full border-t border-slate-200/60 pt-2.5 flex items-end gap-2">
                      <div className="flex-grow">
                        <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1 pl-0.5 block">Optional: Create Logistics Group</label>
                        <input type="text" placeholder="e.g. BBQ Setup, Games" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} className="w-full bg-white border border-slate-200 p-2 rounded-xl text-xs font-semibold focus:outline-none"/>
                      </div>
                      <button onClick={() => handleAddGroupDB(currentActivity)} className="bg-slate-200 hover:bg-slate-300 text-slate-800 text-[10px] font-bold uppercase tracking-wider px-3.5 h-9 rounded-xl transition-colors shrink-0">
                        + Group
                      </button>
                    </div>
                  </div>

                  {currentActivity.groups_list && currentActivity.groups_list.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[9px] font-bold uppercase text-slate-400">Groups:</span>
                      {currentActivity.groups_list.map((gName: string, idx: number) => (
                        <div key={idx} className="bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-bold px-2 py-0.5 rounded-lg flex items-center gap-1">
                          <span>{gName}</span>
                          <button onClick={() => handleRemoveGroupDB(currentActivity, gName)} className="text-slate-400 hover:text-rose-500"><X size={12}/></button>
                        </div>
                      ))}
                    </div>
                  )}

                  {currentActivity.participants.length === 0 ? (
                    <div className="py-12 text-center text-slate-400 font-semibold text-xs">
                      No attendees in this activity yet. Check individual members or import everyone above.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                      {Array.from(new Set(currentActivity.participants.map((p: Participant) => p.head_id || p.master_member_id || p.id))).map((headId) => {
                        const headProfile = masterMembers.find((m: MasterMember) => m.id === headId);
                        const headPart = currentActivity.participants.find((p: Participant) => p.master_member_id === headId || p.id === headId);
                        const primaryName = headProfile?.full_name || headPart?.primary_name || "Primary Head";

                        const familyDependents = currentActivity.participants.filter(
                          (p: Participant) => (p.head_id === headId) && (p.master_member_id !== headId) && (p.id !== headId)
                        );

                        return (
                          <div key={headId} className="bg-white rounded-2xl border border-slate-200 p-3.5 flex flex-col shadow-xs gap-2.5 relative group">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-2 pr-6">
                              <span className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-tight truncate">{primaryName}</span>
                              <span className="text-[8px] font-bold text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100 shrink-0">
                                Primary
                              </span>
                            </div>

                            {headPart && (
                              <button 
                                onClick={() => handleInitiateRemoveParticipant(headPart)} 
                                className="absolute top-3 right-2 text-slate-300 hover:text-rose-500 p-1 transition-opacity"
                              >
                                <X size={14}/>
                              </button>
                            )}

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

                            {familyDependents.length > 0 ? (
                              <div className="flex flex-col gap-1.5">
                                {familyDependents.map((p: Participant) => {
                                  const prof = masterMembers.find((m: MasterMember) => m.id === p.master_member_id);
                                  return (
                                    <div key={p.id} className="bg-slate-50/80 border border-slate-100 rounded-xl p-2 flex flex-col gap-1.5 relative group/item">
                                      <div className="flex items-center justify-between pr-5">
                                        <div className="flex items-center gap-1.5 truncate">
                                          <span className="text-xs font-bold text-slate-800 uppercase tracking-tight truncate">{prof?.full_name || p.primary_name}</span>
                                          {prof?.member_type === 'kid' && (
                                            <span className="text-[7px] font-extrabold uppercase px-1 py-0.2 rounded bg-[#FFF3CD] text-[#B47000] shrink-0">
                                              KID
                                            </span>
                                          )}
                                        </div>
                                      </div>

                                      <button 
                                        onClick={() => handleInitiateRemoveParticipant(p)} 
                                        className="absolute top-1.5 right-1.5 text-slate-300 hover:text-rose-500 p-0.5"
                                      >
                                        <X size={13}/>
                                      </button>

                                      {currentActivity.groups_list && currentActivity.groups_list.length > 0 && (
                                        <div>
                                          <select 
                                            value={p.assigned_group || ""} 
                                            onChange={(e) => { 
                                              handleUpdateParticipantLocal(currentActivity.id, p.id, "assigned_group", e.target.value); 
                                              handleSaveParticipantDB(p.id, "assigned_group", e.target.value); 
                                            }} 
                                            className="bg-white border border-slate-200 rounded-lg px-2 py-0.5 text-[9px] font-semibold text-slate-600 focus:outline-none w-full"
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

              {/* TAB 2: EXPENSES LOG */}
              {activeTab === 'expenses' && (
                <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 sm:p-5 shadow-[0_2px_12px_rgba(0,0,0,0.02)] space-y-5">
                  <div className="bg-slate-50 border border-slate-100 p-3.5 rounded-xl space-y-3">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-0.5">Log Expense Entry</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                      <div className="sm:col-span-5">
                        <input 
                          type="text" 
                          placeholder="Expense Description (e.g. Fuel, BBQ)" 
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

                  {/* Responsive Expense List (Card View on Mobile, Table on Desktop) */}
                  <div className="space-y-2 border-t border-slate-100 pt-4">
                    {(!currentActivity.expenses_breakdown || currentActivity.expenses_breakdown.length === 0) ? (
                      <p className="p-8 text-center text-slate-400 font-medium text-xs">No expenses logged yet. Add itemized expenses above.</p>
                    ) : (
                      currentActivity.expenses_breakdown.map((item: ExpenseItem) => (
                        <div key={item.id} className="bg-slate-50 border border-slate-100 p-3 rounded-xl flex items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-slate-800 text-xs truncate">{item.description}</p>
                            <p className="text-[10px] font-semibold text-slate-500 mt-0.5">Paid by: <span className="text-slate-700">{item.paid_by_name}</span></p>
                          </div>
                          
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="font-black text-slate-900 text-xs sm:text-sm">MVR {parseFloat(item.amount as string).toFixed(2)}</span>
                            <div className="flex items-center gap-1">
                              <button 
                                onClick={() => setEditExpenseModal({
                                  isOpen: true,
                                  item,
                                  desc: item.description,
                                  paidBy: item.paid_by_name,
                                  amount: item.amount.toString()
                                })} 
                                className="text-slate-400 hover:text-slate-800 p-1 rounded hover:bg-slate-200 transition-colors"
                              >
                                <Pencil size={13}/>
                              </button>
                              <button onClick={() => handleRemoveExpenseItem(currentActivity.id, item.id)} className="text-slate-300 hover:text-rose-500 p-1 rounded hover:bg-rose-50 transition-colors">
                                <X size={15}/>
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: FINANCES / BILLING LEDGER */}
              {activeTab === 'finance' && (
                <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 sm:p-5 shadow-[0_2px_12px_rgba(0,0,0,0.02)] space-y-5">
                  
                  {/* FINANCIAL SUMMARY CARDS */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="bg-slate-50 border border-slate-100 p-3.5 rounded-xl flex flex-col justify-center">
                      <span className="text-[9px] font-extrabold uppercase text-slate-400 tracking-wider">Total Received</span>
                      <p className="text-lg sm:text-xl font-black text-emerald-600 mt-0.5">MVR {receivedMetrics.totalCollected.toFixed(0)}</p>
                    </div>

                    <div className="bg-slate-50 border border-slate-100 p-3.5 rounded-xl flex flex-col justify-center">
                      <span className="text-[9px] font-extrabold uppercase text-slate-400 tracking-wider">Total Pending</span>
                      <p className="text-lg sm:text-xl font-black text-amber-600 mt-0.5">MVR {receivedMetrics.totalOutstanding.toFixed(0)}</p>
                    </div>

                    <div className="bg-slate-50 border border-slate-100 p-3.5 rounded-xl flex flex-col justify-center">
                      <span className="text-[9px] font-extrabold uppercase text-slate-400 tracking-wider">Collection Progress</span>
                      <div className="flex items-center justify-between mt-0.5">
                        <span className="text-xs sm:text-sm font-black text-slate-800">
                          {((receivedMetrics.totalCollected / ((receivedMetrics.totalCollected + receivedMetrics.totalOutstanding) || 1)) * 100).toFixed(0)}%
                        </span>
                        <span className="text-[9px] font-bold text-slate-400">
                          Target: MVR {(receivedMetrics.totalCollected + receivedMetrics.totalOutstanding).toFixed(0)}
                        </span>
                      </div>
                      <div className="w-full bg-slate-200 h-1.5 rounded-full mt-1 overflow-hidden">
                        <div 
                          className="bg-emerald-500 h-full transition-all duration-300"
                          style={{ width: `${Math.min(100, (receivedMetrics.totalCollected / ((receivedMetrics.totalCollected + receivedMetrics.totalOutstanding) || 1)) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* SPLIT CONFIGURATION & BANK SELECTOR */}
                  <div className="bg-slate-50 border border-slate-100 p-3.5 rounded-xl flex flex-col gap-3 justify-between items-stretch">
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                        <Filter size={14} className="text-slate-500"/> Cost Distribution Rules
                      </h4>
                    </div>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      <select 
                        value={selectedBankIdForInvoice}
                        onChange={(e) => setSelectedBankIdForInvoice(e.target.value)}
                        className="bg-white border border-slate-200 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 focus:outline-none shadow-xs w-full sm:w-auto"
                      >
                        <option value="" disabled>Select Invoice Bank...</option>
                        {bankAccounts.map((b: BankAccount) => (
                          <option key={b.id} value={b.id}>Bank: {b.account_name} ({b.currency})</option>
                        ))}
                      </select>

                      <div className="flex items-center gap-1 bg-white border border-slate-200 p-1 rounded-xl shadow-xs w-full sm:w-auto">
                        <button 
                          onClick={() => handleUpdateSplitMode(currentActivity.id, 'all')}
                          className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-colors ${currentActivity.split_mode === 'all' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-500'}`}
                        >
                          All ({currentActivity.participants.length})
                        </button>
                        <button 
                          onClick={() => handleUpdateSplitMode(currentActivity.id, 'adults_only')}
                          className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-colors ${currentActivity.split_mode === 'adults_only' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-500'}`}
                        >
                          Adults Only ({calculateBreakdown(currentActivity).adults})
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* MANUAL EXCLUSION CHECKBOX LIST */}
                  <div className="bg-slate-50/50 border border-slate-100 p-3 rounded-xl space-y-2">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Uncheck to Exclude from Bill:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {currentActivity.participants.map((p: Participant) => {
                        const prof = masterMembers.find((m: MasterMember) => m.id === p.master_member_id);
                        const exclusions = currentActivity.manual_exclusions || [];
                        const isExcluded = exclusions.includes(p.id);
                        const isKidByMode = currentActivity.split_mode === 'adults_only' && prof?.member_type === 'kid';

                        return (
                          <label key={p.id} className={`flex items-center gap-1 border px-2 py-0.5 rounded-lg cursor-pointer text-[11px] font-bold transition-all ${isExcluded || isKidByMode ? 'bg-slate-100 text-slate-400 border-slate-200 line-through' : 'bg-white text-slate-800 border-slate-200 shadow-xs'}`}>
                            <input 
                              type="checkbox" 
                              checked={!isExcluded && !isKidByMode}
                              disabled={isKidByMode}
                              onChange={() => toggleManualExclusion(currentActivity.id, p.id)}
                              className="rounded border-slate-300 text-slate-900 focus:ring-0 w-3 h-3"
                            />
                            <span>{p.primary_name}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* MOBILE RESPONSIVE BILLING LEDGER CARDS */}
                  <div className="space-y-3 border-t border-slate-100 pt-4">
                    <div className="flex justify-between items-center px-1">
                      <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Grouped Responsibilities</h3>
                      <span className="text-[10px] font-bold text-slate-500">
                        Share: <b className="text-slate-900">MVR {calculateSharePerHead(currentActivity).toFixed(0)}</b>/pax
                      </span>
                    </div>

                    {getBillingLedgerGrouped(currentActivity).length === 0 ? (
                      <p className="p-8 text-center text-slate-400 font-medium text-xs">No ledger data available. Add attendees first.</p>
                    ) : (
                      getBillingLedgerGrouped(currentActivity).map((item: BillingLedgerItem, idx: number) => (
                        <div key={idx} className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex flex-col gap-2">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-bold text-slate-900 text-xs sm:text-sm">{item.headName}</h4>
                              <p className="text-[10px] text-slate-500 font-semibold mt-0.5">Covering: {item.attendees.join(', ')}</p>
                            </div>
                            <span className="font-black text-amber-600 text-sm sm:text-base shrink-0 ml-2">MVR {item.totalDue.toFixed(0)}</span>
                          </div>

                          <div className="flex items-center gap-2 pt-2 border-t border-slate-200/60 mt-1">
                            <button 
                              onClick={async () => {
                                const newPaidState = !item.hasPaid;
                                handleUpdateParticipantLocal(currentActivity.id, item.initialPartId, "has_paid", newPaidState);
                                await supabase.from('activity_participants').update({ has_paid: newPaidState }).eq('activity_id', currentActivity.id).eq('head_id', currentActivity.participants.find((p: Participant) => p.id === item.initialPartId)?.head_id);
                                fetchActivitiesData();
                              }}
                              className={`flex-1 py-2 rounded-lg font-extrabold text-[10px] uppercase tracking-wider border transition-colors ${item.hasPaid ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-amber-50 text-amber-600 border-amber-200'}`}
                            >
                              {item.hasPaid ? 'Paid ✅' : 'Mark Paid ⏳'}
                            </button>

                            <button 
                              onClick={() => handleSharePersonalWhatsApp(currentActivity, item)}
                              className={`flex-1 py-2 rounded-lg font-bold text-[10px] uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 ${item.whatsappShared ? 'bg-emerald-600 text-white' : 'bg-slate-900 text-white hover:bg-slate-800'}`}
                            >
                              <Send size={12}/>
                              {item.whatsappShared ? 'Shared ✅' : 'WhatsApp Bill'}
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* TAB 4: SHOPPING LIST */}
              {activeTab === 'shopping' && (
                <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 sm:p-5 shadow-[0_2px_12px_rgba(0,0,0,0.02)] space-y-4">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider"><ClipboardList size={14} className="inline mr-1 text-slate-400"/> Provision Checklist</h3>
                    <button onClick={() => handleAddShoppingItem(currentActivity.id)} className="bg-slate-900 text-white font-bold text-[10px] uppercase px-3 py-1.5 rounded-xl transition-transform active:scale-95 flex items-center gap-1">
                      <Plus size={12}/> Add Item
                    </button>
                  </div>

                  {currentActivity.shopping.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-12 font-semibold">No provisions added to the list.</p>
                  ) : (
                    <div className="space-y-2">
                      {currentActivity.shopping.map((item: ShoppingItem) => (
                        <div key={item.id} className="flex gap-2 items-center bg-slate-50 border border-slate-100 p-2 rounded-xl">
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
                            className={`flex-grow min-w-0 bg-white border border-slate-200 px-2 py-1 rounded-lg text-xs font-bold focus:outline-none ${item.is_bought ? 'line-through text-slate-400 bg-slate-50' : 'text-slate-800'}`} 
                            placeholder="Item description"
                          />

                          <input 
                            type="text" 
                            placeholder="Qty" 
                            value={item.qty} 
                            onChange={(e) => handleUpdateShopLocal(currentActivity.id, item.id, "qty", e.target.value)} 
                            onBlur={(e) => handleSaveShopDB(item.id, "qty", e.target.value)} 
                            className="w-14 bg-white border border-slate-200 p-1 rounded-lg text-xs font-bold text-center focus:outline-none text-slate-600 shrink-0"
                          />

                          <button onClick={() => handleRemoveShopItem(item.id)} className="text-slate-300 hover:text-rose-500 p-1 shrink-0"><X size={15}/></button>
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
        <nav className="lg:hidden fixed bottom-4 left-1/2 -translate-x-1/2 w-[92%] max-w-[360px] h-14 bg-white/95 border border-slate-200/80 shadow-[0_8px_30px_rgba(0,0,0,0.08)] rounded-2xl flex justify-around items-center px-2 z-[100] backdrop-blur-md">
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