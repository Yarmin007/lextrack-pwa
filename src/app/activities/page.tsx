"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { 
  Plus, X, Trash2, Wallet, ShoppingCart, Calculator, 
  CheckCircle2, AlertCircle, Send, User, Banknote, LayoutDashboard, 
  Users, Flame, ClipboardList, ChevronLeft, Search, UserCheck, Pencil, Filter, Building2, ChevronDown, ChevronUp, FileText, Check, Receipt
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

interface ItemClaim {
  id: string;
  item_id: string;
  participant_id: string;
}

interface InvoiceItem {
  id: string;
  invoice_id: string;
  item_name: string;
  qty: number | string;
  total_price: number | string;
  claims: ItemClaim[];
}

interface Invoice {
  id: string;
  activity_id: string;
  invoice_title: string;
  items: InvoiceItem[];
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
  invoices?: Invoice[];
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
  claimedItemsText: string[];
}

export default function ActivitiesPage() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [masterMembers, setMasterMembers] = useState<MasterMember[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  
  // Navigation State
  const [selectedActId, setSelectedActId] = useState<string | null>(null);
  const [activeTab, setActiveHostTab] = useState<'roster' | 'expenses' | 'finance' | 'shopping'>('roster');
  
  // Master Directory Visibility Toggle
  const [showMasterDirectory, setShowMasterDirectory] = useState(false);

  // Manual Check-in Modal State for Activity
  const [isCheckInModalOpen, setIsCheckInModalOpen] = useState(false);
  const [checkInSearch, setCheckInSearch] = useState("");
  const [selectedCheckInMemberIds, setSelectedCheckInMemberIds] = useState<string[]>([]);

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

  // Shared Expense Form States
  const [expDesc, setExpDesc] = useState("");
  const [expPaidBy, setExpPaidBy] = useState("");
  const [expAmount, setExpAmount] = useState("");

  // Itemized Invoice Form States
  const [newInvoiceTitle, setNewInvoiceTitle] = useState("");
  const [newItemName, setNewItemName] = useState("");
  const [newItemQty, setNewItemQty] = useState("1");
  const [newItemPrice, setNewItemPrice] = useState("");
  const [targetInvoiceIdForItem, setTargetInvoiceIdForItem] = useState("");

  // Optional Group Creation
  const [newGroupName, setNewGroupName] = useState("");

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
        const [partsRes, shopRes, expRes, invRes] = await Promise.all([
          supabase.from('activity_participants').select('*').eq('activity_id', act.id),
          supabase.from('activity_shopping').select('*').eq('activity_id', act.id),
          supabase.from('activity_expenses').select('*').eq('activity_id', act.id),
          supabase.from('activity_invoices').select('*').eq('activity_id', act.id)
        ]);

        const rawInvoices = invRes.data || [];
        const invoicesWithItems = await Promise.all(rawInvoices.map(async (inv: any) => {
          const itemsRes = await supabase.from('activity_invoice_items').select('*').eq('invoice_id', inv.id);
          const rawItems = itemsRes.data || [];

          const itemsWithClaims = await Promise.all(rawItems.map(async (itm: any) => {
            const claimsRes = await supabase.from('activity_item_claims').select('*').eq('item_id', itm.id);
            return {
              ...itm,
              claims: claimsRes.data || []
            };
          }));

          return {
            ...inv,
            items: itemsWithClaims
          };
        }));

        return {
          ...act,
          groups_list: act.groups_list || [],
          split_mode: act.split_mode || 'all',
          manual_exclusions: act.manual_exclusions || [],
          participants: partsRes.data || [],
          shopping: shopRes.data || [],
          expenses_breakdown: expRes.data || [],
          invoices: invoicesWithItems
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

  // --- Calculations ---
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

  const calculateGrandTotalExpenses = (activity?: Activity) => {
    if (!activity) return 0;
    const sharedTotal = (activity.expenses_breakdown || []).reduce((sum, e) => sum + (parseFloat(e.amount as string) || 0), 0);
    
    let invoiceTotal = 0;
    (activity.invoices || []).forEach(inv => {
      inv.items.forEach(itm => {
        invoiceTotal += (parseFloat(itm.total_price as string) || 0);
      });
    });

    return sharedTotal + invoiceTotal;
  };

  const getBillingLedgerGrouped = (activity?: Activity): BillingLedgerItem[] => {
    if (!activity || !activity.participants) return [];

    const exclusions = activity.manual_exclusions || [];
    const mode = activity.split_mode || 'all';
    const billsMap: Record<string, BillingLedgerItem> = {};

    // 1. Initialize Head Ledger Cards
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
          whatsappShared: p.whatsapp_shared || false,
          claimedItemsText: []
        };
      }

      const isExcludedManually = exclusions.includes(p.id);
      const isKidExcludedByMode = mode === 'adults_only' && profile?.member_type === 'kid';
      const isBillable = !isExcludedManually && !isKidExcludedByMode;

      billsMap[headId].attendees.push(profileName + (isBillable ? "" : " (Excluded)"));
      if (!p.has_paid) billsMap[headId].hasPaid = false; 
    });

    // 2. Add General Shared Expenses (Equal Split)
    const eligibleParticipants = activity.participants.filter((p: Participant) => {
      if (exclusions.includes(p.id)) return false;
      const profile = masterMembers.find((m: MasterMember) => m.id === p.master_member_id);
      if (mode === 'adults_only' && profile?.member_type === 'kid') return false;
      return true;
    });

    const generalSharedTotal = (activity.expenses_breakdown || []).reduce((sum, e) => sum + (parseFloat(e.amount as string) || 0), 0);
    if (eligibleParticipants.length > 0 && generalSharedTotal > 0) {
      const perHeadGeneralShare = generalSharedTotal / eligibleParticipants.length;
      eligibleParticipants.forEach(p => {
        const headId = p.head_id || p.master_member_id || p.id;
        if (billsMap[headId]) {
          billsMap[headId].totalDue += perHeadGeneralShare;
        }
      });
    }

    // 3. Add Itemized Invoice Claims
    (activity.invoices || []).forEach(inv => {
      inv.items.forEach(item => {
        const itemPrice = parseFloat(item.total_price as string) || 0;
        const claims = item.claims || [];
        if (claims.length > 0) {
          const sharePerClaimant = itemPrice / claims.length;
          claims.forEach(c => {
            const claimantPart = activity.participants.find(p => p.id === c.participant_id);
            if (claimantPart) {
              const headId = claimantPart.head_id || claimantPart.master_member_id || claimantPart.id;
              if (billsMap[headId]) {
                billsMap[headId].totalDue += sharePerClaimant;
                billsMap[headId].claimedItemsText.push(`${item.item_name} (${claimantPart.primary_name}): MVR ${sharePerClaimant.toFixed(2)}`);
              }
            }
          });
        }
      });
    });

    return Object.values(billsMap);
  };

  const calculateSharePerHead = (activity?: Activity) => {
    if (!activity) return 0;
    const eligibleCount = calculateEligiblePayingHeadCount(activity);
    if (eligibleCount === 0) return 0;
    const generalSharedTotal = (activity.expenses_breakdown || []).reduce((sum, e) => sum + (parseFloat(e.amount as string) || 0), 0);
    return generalSharedTotal / eligibleCount;
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

  // --- Activity & Split Handlers ---
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
      showToast(error?.message || "Error creating activity session", "error");
    }
  };

  const handleDeleteActivity = async (actId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!confirm("Delete this entire activity?")) return;

    try {
      await supabase.from('activity_participants').delete().eq('activity_id', actId);
      await supabase.from('activity_shopping').delete().eq('activity_id', actId);
      await supabase.from('activity_expenses').delete().eq('activity_id', actId);
      await supabase.from('activity_invoices').delete().eq('activity_id', actId);

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

  // Shared Expense Handlers
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
    if (!error) {
      setExpDesc("");
      setExpPaidBy("");
      setExpAmount("");
      showToast("Shared expense logged!");
      fetchActivitiesData();
    } else {
      showToast(`DB Error: ${error.message}`, "error");
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
      setEditExpenseModal({ isOpen: false, item: null, desc: "", paidBy: "", amount: "" });
      showToast("Expense updated!");
      fetchActivitiesData();
    }
  };

  const handleRemoveExpenseItem = async (itemId: string) => {
    const { error } = await supabase.from('activity_expenses').delete().eq('id', itemId);
    if (!error) {
      fetchActivitiesData();
      showToast("Shared expense item removed");
    }
  };

  // --- Itemized Invoice Handlers ---
  const handleCreateInvoice = async (actId: string) => {
    if (!newInvoiceTitle.trim()) return showToast("Invoice title required", "error");

    const { error } = await supabase.from('activity_invoices').insert({
      activity_id: actId,
      invoice_title: newInvoiceTitle.trim()
    });

    if (!error) {
      setNewInvoiceTitle("");
      showToast("New Invoice Added!");
      fetchActivitiesData();
    } else {
      showToast(`Error adding invoice: ${error.message}`, "error");
    }
  };

  const handleRemoveInvoice = async (invId: string) => {
    if (!confirm("Delete this invoice and all its items?")) return;
    const { error } = await supabase.from('activity_invoices').delete().eq('id', invId);
    if (!error) {
      showToast("Invoice deleted");
      fetchActivitiesData();
    }
  };

  const handleAddItemToInvoice = async (invId: string) => {
    if (!newItemName.trim()) return showToast("Item description required", "error");
    const parsedQty = parseFloat(newItemQty) || 1;
    const parsedPrice = parseFloat(newItemPrice) || 0;
    if (parsedPrice <= 0) return showToast("Enter valid total price", "error");

    const { error } = await supabase.from('activity_invoice_items').insert({
      invoice_id: invId,
      item_name: newItemName.trim(),
      qty: parsedQty,
      total_price: parsedPrice
    });

    if (!error) {
      setNewItemName("");
      setNewItemQty("1");
      setNewItemPrice("");
      setTargetInvoiceIdForItem("");
      showToast("Item added to invoice!");
      fetchActivitiesData();
    } else {
      showToast(`Error adding item: ${error.message}`, "error");
    }
  };

  const handleRemoveInvoiceItem = async (itemId: string) => {
    const { error } = await supabase.from('activity_invoice_items').delete().eq('id', itemId);
    if (!error) {
      fetchActivitiesData();
      showToast("Item removed from invoice");
    }
  };

  const handleToggleItemClaim = async (itemId: string, participantId: string, currentClaims: ItemClaim[]) => {
    const existingClaim = currentClaims.find(c => c.participant_id === participantId);

    if (existingClaim) {
      await supabase.from('activity_item_claims').delete().eq('id', existingClaim.id);
    } else {
      await supabase.from('activity_item_claims').insert({
        item_id: itemId,
        participant_id: participantId
      });
    }

    fetchActivitiesData();
  };

  // WhatsApp Single Person Invoice Broadcast
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

  const handleSharePersonalWhatsApp = async (act: Activity, ledgerItem: BillingLedgerItem) => {
    const activeBank = bankAccounts.find(b => b.id === selectedBankIdForInvoice) || bankAccounts[0];
    const formattedDate = act.activity_date ? act.activity_date.split('-').reverse().join('/') : new Date().toLocaleDateString('en-GB');
    const grandTotal = calculateGrandTotalExpenses(act);

    let msg = `INVOICE\n`;
    msg += `Bill To: ${ledgerItem.headName.toUpperCase()}\n`;
    msg += `Bill Date: ${formattedDate}\n\n`;
    msg += `(${formattedDate})\n`;
    msg += `•⁠ ⁠${act.title.toUpperCase()}\n`;

    // 1. Shared General Expenses
    if (act.expenses_breakdown && act.expenses_breakdown.length > 0) {
      const eligibleCount = calculateEligiblePayingHeadCount(act);
      act.expenses_breakdown.forEach((exp: ExpenseItem) => {
        const share = (parseFloat(exp.amount as string) || 0) / (eligibleCount || 1);
        msg += `    └ ${exp.description.toUpperCase()} (Shared): MVR ${share.toFixed(2)}\n`;
      });
    }

    // 2. Itemized Invoice Claims
    if (ledgerItem.claimedItemsText.length > 0) {
      ledgerItem.claimedItemsText.forEach(line => {
        msg += `    └ ${line.toUpperCase()}\n`;
      });
    }

    msg += `    -----------------------------------\n`;
    msg += `    Total Event Cost: MVR ${grandTotal.toFixed(2)}\n`;
    msg += `    Included: ${ledgerItem.attendees.join(', ')}\n`;
    msg += `    Subtotal: ${ledgerItem.totalDue.toFixed(2)} MVR\n\n`;
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
      showToast(`DB Error: ${error.message}`, "error");
    }
  };

  const handleDeleteMasterMember = async (member: MasterMember) => {
    if (!confirm(`Permanently delete "${member.full_name}" from Master Directory?`)) return;

    const { error } = await supabase.from('activity_master_members').delete().eq('id', member.id);
    if (!error) {
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

    if (!error) {
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

  const handleAddSelectedMembersToActivity = async (actId: string) => {
    if (selectedCheckInMemberIds.length === 0) return showToast("Select members to add", "error");

    const unaddedSelected = masterMembers.filter(m => 
      selectedCheckInMemberIds.includes(m.id) &&
      !currentActivity?.participants.some(p => p.master_member_id === m.id)
    );

    if (unaddedSelected.length === 0) {
      setIsCheckInModalOpen(false);
      return showToast("Selected members are already in this activity", "error");
    }

    const payload = unaddedSelected.map((m: MasterMember) => ({
      activity_id: actId,
      primary_name: m.full_name,
      master_member_id: m.id,
      head_id: m.dependent_id || m.id,
      has_paid: false,
      assigned_group: "",
      whatsapp_shared: false
    }));

    const { error } = await supabase.from('activity_participants').insert(payload);
    if (!error) {
      fetchActivitiesData();
      setIsCheckInModalOpen(false);
      setSelectedCheckInMemberIds([]);
      showToast(`Added ${unaddedSelected.length} member(s) to activity!`);
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
    if (!error) {
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
    await supabase.from('activity_participants').update({ head_id: selectedNewHeadId }).in('id', dependentIds);
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

      {/* SELECTIVE MASTER MEMBER CHECK-IN MODAL */}
      {isCheckInModalOpen && currentActivity && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-[1000] flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 max-w-lg w-full shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-2">
                <UserCheck size={16} className="text-slate-600"/> Add Members from Master Directory
              </h3>
              <button onClick={() => setIsCheckInModalOpen(false)} className="text-slate-400 hover:text-slate-800 p-1"><X size={18}/></button>
            </div>

            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
              <input 
                type="text" 
                placeholder="Search master profiles..." 
                value={checkInSearch}
                onChange={(e) => setCheckInSearch(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 pl-9 pr-3 py-2 rounded-xl text-xs font-semibold focus:outline-none"
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[200px]">
              {masterMembers
                .filter(m => !currentActivity.participants.some(p => p.master_member_id === m.id))
                .filter(m => m.full_name.toLowerCase().includes(checkInSearch.toLowerCase()))
                .map((m: MasterMember) => {
                  const isChecked = selectedCheckInMemberIds.includes(m.id);
                  const depHead = m.dependent_id ? masterMembers.find(h => h.id === m.dependent_id) : null;

                  return (
                    <label 
                      key={m.id} 
                      className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-colors ${isChecked ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-50 border-slate-100 text-slate-800 hover:bg-slate-100'}`}
                    >
                      <div className="flex items-center gap-2 truncate pr-2">
                        <input 
                          type="checkbox" 
                          checked={isChecked}
                          onChange={() => {
                            setSelectedCheckInMemberIds(prev => 
                              prev.includes(m.id) ? prev.filter(id => id !== m.id) : [...prev, m.id]
                            );
                          }}
                          className="rounded border-slate-300 text-slate-900 focus:ring-0"
                        />
                        <span className="text-xs font-bold truncate">{m.full_name}</span>
                        {m.member_type === 'kid' && (
                          <span className={`text-[8px] font-extrabold uppercase px-1.5 py-0.2 rounded ${isChecked ? 'bg-amber-400 text-slate-900' : 'bg-[#FFF3CD] text-[#B47000]'}`}>
                            KID
                          </span>
                        )}
                      </div>

                      <span className={`text-[9px] font-semibold ${isChecked ? 'text-slate-300' : 'text-slate-400'}`}>
                        {depHead ? `Under: ${depHead.full_name}` : 'Primary'}
                      </span>
                    </label>
                  );
                })}
            </div>

            <div className="pt-2 border-t border-slate-100 flex gap-2">
              <button 
                onClick={() => setIsCheckInModalOpen(false)}
                className="flex-1 py-2.5 bg-slate-100 text-slate-600 font-bold text-xs rounded-xl hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={() => handleAddSelectedMembersToActivity(currentActivity.id)}
                className="flex-1 py-2.5 bg-slate-900 text-white font-bold text-xs rounded-xl hover:bg-slate-800 transition-colors"
              >
                Add Selected ({selectedCheckInMemberIds.length})
              </button>
            </div>
          </div>
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
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-2">
              <Pencil size={16} className="text-slate-600"/> Edit Shared Expense
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

            <div className="flex gap-2 pt-2 border-t border-slate-100">
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
                <p className="text-xs font-semibold text-slate-500 mt-1">Manage events, track expenses, and view collection stats.</p>
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

              {/* ACTIVITIES GRID WITH GRAPHICAL STATS */}
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
                      const stats = calculateReceivedSummary(a);
                      const totalBillable = stats.totalCollected + stats.totalOutstanding;
                      const collectedPct = totalBillable > 0 ? Math.min(100, Math.round((stats.totalCollected / totalBillable) * 100)) : 0;
                      const grandExpense = calculateGrandTotalExpenses(a);

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
                          
                          <div className="bg-slate-50/80 border border-slate-100 p-2.5 rounded-xl mb-3 space-y-1.5">
                            <div className="flex justify-between items-center text-[10px] font-bold">
                              <span className="text-slate-400 uppercase tracking-wider">Collected</span>
                              <span className="text-slate-800">{collectedPct}% <span className="text-slate-400 font-normal">({stats.totalCollected.toFixed(0)} / {totalBillable.toFixed(0)} MVR)</span></span>
                            </div>
                            <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                              <div 
                                className="bg-emerald-500 h-full transition-all duration-300"
                                style={{ width: `${collectedPct}%` }}
                              />
                            </div>
                          </div>

                          <div className="mt-auto grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">
                            <div>
                              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Total Expense</p>
                              <p className="text-xs font-black text-slate-800">MVR {grandExpense.toFixed(0)}</p>
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

              {/* COLLAPSIBLE MASTER DIRECTORY SECTION */}
              <div className="bg-white rounded-2xl border border-slate-200/60 shadow-[0_2px_12px_rgba(0,0,0,0.02)] overflow-hidden">
                <div 
                  onClick={() => setShowMasterDirectory(!showMasterDirectory)}
                  className="p-4 sm:p-5 flex items-center justify-between cursor-pointer hover:bg-slate-50/50 transition-colors select-none"
                >
                  <div className="flex items-center gap-2">
                    <Users size={18} className="text-slate-500"/>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Master Members Directory</h3>
                      <p className="text-[10px] font-semibold text-slate-400 mt-0.5">Manage permanent profiles and dependency links across events.</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="hidden sm:inline-block text-[10px] font-bold text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                      {totalMasterAdults} Adults | {totalMasterKids} Kids | {totalMasterPrimary} Primary | {totalMasterDependent} Dependents
                    </span>
                    <button className="p-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-700 transition-colors">
                      {showMasterDirectory ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                    </button>
                  </div>
                </div>

                {showMasterDirectory && (
                  <div className="p-4 sm:p-5 border-t border-slate-100 animate-in fade-in duration-200">
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
                )}
              </div>
            </div>

          ) : currentActivity ? (

            // ==========================================
            // SPECIFIC ACTIVITY DETAILS VIEW
            // ==========================================
            <div className="space-y-4 sm:space-y-6 animate-in slide-in-from-right-4 duration-300">
              
              {/* Back Button & Header */}
              <div className="flex flex-col sm:flex-row justify-between sm:items-end gap-3 border-b border-slate-200/60 pb-3 sm:pb-4">
                <div>
                  <button onClick={() => setSelectedActId(null)} className="text-[10px] font-bold text-slate-400 hover:text-slate-800 uppercase tracking-wider flex items-center gap-1 mb-1.5 transition-colors">
                    <ChevronLeft size={14}/> Back to Hub
                  </button>
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-tight">{currentActivity.title}</h2>
                  <p className="text-[11px] font-semibold text-slate-500 mt-0.5">{currentActivity.activity_date}</p>
                </div>
                
                <button onClick={() => handleDeleteActivity(currentActivity.id)} className="text-rose-500 hover:text-rose-700 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 bg-rose-50 px-2.5 py-1.5 rounded-lg border border-rose-100 transition-colors w-fit">
                  <Trash2 size={13}/> Delete Event
                </button>
              </div>

              {/* Metrics Hero */}
              <div className="bg-white rounded-2xl p-3.5 sm:p-5 border border-slate-200/80 shadow-[0_2px_12px_rgba(0,0,0,0.02)] grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="border-r border-slate-100 pr-2 flex flex-col justify-center">
                  <span className="text-[9px] font-extrabold uppercase text-slate-400 tracking-wider block">Grand Total</span>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="text-[10px] font-bold text-slate-400">MVR</span>
                    <span className="text-base sm:text-2xl font-black text-slate-900 truncate">
                      {calculateGrandTotalExpenses(currentActivity).toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="lg:border-r border-slate-100 pr-2 flex flex-col justify-center">
                  <span className="text-[9px] font-extrabold uppercase text-slate-400 tracking-wider block">Shared Cost / Pax</span>
                  <p className="text-base sm:text-xl font-black text-slate-900 mt-0.5">MVR {calculateSharePerHead(currentActivity).toFixed(2)}</p>
                </div>

                <div className="border-r border-slate-100 pr-2 flex flex-col justify-center col-span-1">
                  <span className="text-[9px] font-extrabold uppercase text-slate-400 tracking-wider block">Attendance</span>
                  <p className="text-base sm:text-xl font-black text-slate-900 mt-0.5">
                    {calculateBreakdown(currentActivity).total} pax
                    <span className="text-[10px] font-semibold text-slate-400 block sm:inline sm:ml-1">
                      ({calculateBreakdown(currentActivity).adults}A, {calculateBreakdown(currentActivity).kids}K)
                    </span>
                  </p>
                </div>

                <div className="col-span-1 lg:col-span-1 flex flex-col justify-center">
                  <button onClick={() => setIsBankModalOpen(true)} className="w-full bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-bold uppercase tracking-wider py-2 sm:py-3 rounded-xl shadow-xs flex items-center justify-center gap-1 transition-transform active:scale-95">
                    <Building2 size={13}/> Bank Details
                  </button>
                </div>
              </div>

              {/* TABS NAVIGATION */}
              <div className="bg-white rounded-xl border border-slate-200/80 p-1 flex overflow-x-auto no-scrollbar shadow-xs gap-1">
                <button onClick={() => setActiveHostTab('roster')} className={`py-2 px-3 text-[10px] sm:text-xs font-bold uppercase tracking-wider rounded-lg transition-all whitespace-nowrap ${activeTab === 'roster' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-500 hover:text-slate-900'}`}>
                  👥 Attendees
                </button>
                <button onClick={() => setActiveHostTab('expenses')} className={`py-2 px-3 text-[10px] sm:text-xs font-bold uppercase tracking-wider rounded-lg transition-all whitespace-nowrap ${activeTab === 'expenses' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-500 hover:text-slate-900'}`}>
                  💸 Expenses & Receipts
                </button>
                <button onClick={() => setActiveHostTab('finance')} className={`py-2 px-3 text-[10px] sm:text-xs font-bold uppercase tracking-wider rounded-lg transition-all whitespace-nowrap ${activeTab === 'finance' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-500 hover:text-slate-900'}`}>
                  📊 Billing Ledger
                </button>
                <button onClick={() => setActiveHostTab('shopping')} className={`py-2 px-3 text-[10px] sm:text-xs font-bold uppercase tracking-wider rounded-lg transition-all whitespace-nowrap ${activeTab === 'shopping' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-500 hover:text-slate-900'}`}>
                  🛒 Shopping
                </button>
              </div>

              {/* TAB 1: ATTENDEES ROSTER */}
              {activeTab === 'roster' && (
                <div className="bg-white rounded-2xl border border-slate-200/80 p-3 sm:p-5 shadow-[0_2px_12px_rgba(0,0,0,0.02)] space-y-4">
                  <div className="flex flex-col gap-2.5 bg-slate-50 border border-slate-100 p-3 rounded-xl">
                    <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center justify-between">
                      <button 
                        onClick={() => setIsCheckInModalOpen(true)}
                        className="w-full sm:flex-1 h-9 px-3 bg-white border border-slate-200 hover:border-slate-300 text-slate-800 font-bold text-xs rounded-xl shadow-xs flex items-center justify-between transition-colors"
                      >
                        <span className="flex items-center gap-1.5 truncate">
                          <UserCheck size={14} className="text-slate-500 shrink-0"/> Select Specific Members...
                        </span>
                        <ChevronDown size={14} className="text-slate-400 shrink-0"/>
                      </button>

                      <button 
                        onClick={() => handleImportAllMembers(currentActivity.id)} 
                        className="w-full sm:w-auto h-9 px-3.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-[10px] uppercase tracking-wider rounded-xl shadow-xs transition-transform active:scale-95 flex items-center justify-center gap-1 shrink-0"
                      >
                        <UserCheck size={13}/> Import All
                      </button>
                    </div>

                    <div className="w-full border-t border-slate-200/60 pt-2 flex items-center gap-2">
                      <input type="text" placeholder="Logistics Group (e.g. BBQ, Games)" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} className="w-full bg-white border border-slate-200 p-2 rounded-xl text-xs font-semibold focus:outline-none"/>
                      <button onClick={() => handleAddGroupDB(currentActivity)} className="bg-slate-200 hover:bg-slate-300 text-slate-800 text-[10px] font-bold uppercase tracking-wider px-3 h-8 rounded-xl transition-colors shrink-0">
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
                    <div className="py-10 text-center text-slate-400 font-semibold text-xs">
                      No attendees added yet. Use the check-in options above.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {Array.from(new Set(currentActivity.participants.map((p: Participant) => p.head_id || p.master_member_id || p.id))).map((headId) => {
                        const headProfile = masterMembers.find((m: MasterMember) => m.id === headId);
                        const headPart = currentActivity.participants.find((p: Participant) => p.master_member_id === headId || p.id === headId);
                        const primaryName = headProfile?.full_name || headPart?.primary_name || "Primary Head";

                        const familyDependents = currentActivity.participants.filter(
                          (p: Participant) => (p.head_id === headId) && (p.master_member_id !== headId) && (p.id !== headId)
                        );

                        return (
                          <div key={headId} className="bg-white rounded-2xl border border-slate-200 p-3 flex flex-col shadow-xs gap-2 relative group">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-2 pr-6">
                              <span className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-tight truncate">{primaryName}</span>
                              <span className="text-[8px] font-bold text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100 shrink-0">
                                Primary
                              </span>
                            </div>

                            {headPart && (
                              <button 
                                onClick={() => handleInitiateRemoveParticipant(headPart)} 
                                className="absolute top-2.5 right-2 text-slate-300 hover:text-rose-500 p-1"
                              >
                                <X size={14}/>
                              </button>
                            )}

                            {familyDependents.length > 0 ? (
                              <div className="flex flex-col gap-1">
                                {familyDependents.map((p: Participant) => {
                                  const prof = masterMembers.find((m: MasterMember) => m.id === p.master_member_id);
                                  return (
                                    <div key={p.id} className="bg-slate-50/80 border border-slate-100 rounded-xl p-1.5 flex items-center justify-between relative">
                                      <div className="flex items-center gap-1.5 truncate pr-5">
                                        <span className="text-xs font-bold text-slate-800 uppercase tracking-tight truncate">{prof?.full_name || p.primary_name}</span>
                                        {prof?.member_type === 'kid' && (
                                          <span className="text-[7px] font-extrabold uppercase px-1 py-0.2 rounded bg-[#FFF3CD] text-[#B47000] shrink-0">
                                            KID
                                          </span>
                                        )}
                                      </div>

                                      <button 
                                        onClick={() => handleInitiateRemoveParticipant(p)} 
                                        className="text-slate-300 hover:text-rose-500 p-0.5"
                                      >
                                        <X size={12}/>
                                      </button>
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

              {/* TAB 2: EXPENSES LOG (SHARED & ITEMIZED INVOICES) */}
              {activeTab === 'expenses' && (
                <div className="space-y-4 sm:space-y-6">
                  {/* SECTION A: SHARED EXPENSES (EVERYONE SPLIT EQUALLY) */}
                  <div className="bg-white rounded-2xl border border-slate-200/80 p-3 sm:p-5 shadow-[0_2px_12px_rgba(0,0,0,0.02)] space-y-3">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <Receipt size={15} className="text-slate-500"/> Shared Expenses (Equal Split)
                    </h3>

                    <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl space-y-2.5">
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                        <input 
                          type="text" 
                          placeholder="Description (e.g. Speedboat Fuel)" 
                          value={expDesc} 
                          onChange={(e) => setExpDesc(e.target.value)} 
                          className="sm:col-span-5 w-full bg-white border border-slate-200 p-2 rounded-xl text-xs font-bold text-slate-800 focus:outline-none"
                        />
                        
                        <select 
                          value={expPaidBy} 
                          onChange={(e) => setExpPaidBy(e.target.value)} 
                          className="sm:col-span-4 w-full bg-white border border-slate-200 p-2 rounded-xl text-xs font-bold text-slate-800 focus:outline-none"
                        >
                          <option value="" disabled>Paid By...</option>
                          {currentActivity.participants.map((p: Participant) => (
                            <option key={p.id} value={p.primary_name}>{p.primary_name}</option>
                          ))}
                        </select>

                        <div className="sm:col-span-3 relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">MVR</span>
                          <input 
                            type="number" 
                            placeholder="0.00" 
                            value={expAmount} 
                            onChange={(e) => setExpAmount(e.target.value)} 
                            className="w-full bg-white border border-slate-200 py-2 pl-11 pr-2 rounded-xl text-xs font-bold text-slate-800 focus:outline-none"
                          />
                        </div>
                      </div>
                      
                      <button 
                        onClick={() => handleAddExpenseItem(currentActivity.id)} 
                        className="w-full h-8.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-[10px] uppercase tracking-wider rounded-xl shadow-xs flex items-center justify-center gap-1.5"
                      >
                        <Plus size={13}/> Add Shared Expense
                      </button>
                    </div>

                    <div className="space-y-1.5">
                      {(!currentActivity.expenses_breakdown || currentActivity.expenses_breakdown.length === 0) ? (
                        <p className="p-3 text-center text-slate-400 font-medium text-[11px]">No general shared expenses added.</p>
                      ) : (
                        currentActivity.expenses_breakdown.map((item: ExpenseItem) => (
                          <div key={item.id} className="bg-slate-50 border border-slate-100 p-2.5 rounded-xl flex items-center justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="font-bold text-slate-800 text-xs truncate">{item.description}</p>
                              <p className="text-[9px] font-semibold text-slate-400">Paid by: <span className="text-slate-700">{item.paid_by_name}</span></p>
                            </div>
                            
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="font-black text-slate-900 text-xs">MVR {parseFloat(item.amount as string).toFixed(2)}</span>
                              <button onClick={() => handleRemoveExpenseItem(item.id)} className="text-slate-300 hover:text-rose-500 p-1">
                                <X size={14}/>
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* SECTION B: ITEMIZED INVOICES */}
                  <div className="bg-white rounded-2xl border border-slate-200/80 p-3 sm:p-5 shadow-[0_2px_12px_rgba(0,0,0,0.02)] space-y-4">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-2 border-b border-slate-100">
                      <div>
                        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                          <FileText size={15} className="text-slate-500"/> Itemized Receipts (Meal Orders / Trips)
                        </h3>
                      </div>

                      {/* Add Receipt Header */}
                      <div className="flex items-center gap-1.5 w-full sm:w-auto">
                        <input 
                          type="text" 
                          placeholder="e.g. Jugo Trip, Cafe Lunch" 
                          value={newInvoiceTitle} 
                          onChange={(e) => setNewInvoiceTitle(e.target.value)} 
                          className="bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-xl text-xs font-semibold focus:outline-none grow sm:w-44 text-slate-800"
                        />
                        <button 
                          onClick={() => handleCreateInvoice(currentActivity.id)}
                          className="bg-slate-900 text-white font-bold text-[10px] uppercase px-3 py-1.5 rounded-xl shrink-0"
                        >
                          + Receipt
                        </button>
                      </div>
                    </div>

                    {/* Invoices List */}
                    {(!currentActivity.invoices || currentActivity.invoices.length === 0) ? (
                      <div className="py-6 text-center text-slate-400 font-semibold text-xs border border-dashed border-slate-200 rounded-xl">
                        No itemized receipts created yet.
                      </div>
                    ) : (
                      currentActivity.invoices.map((inv: Invoice) => (
                        <div key={inv.id} className="bg-slate-50/80 border border-slate-200 rounded-2xl p-3 space-y-3">
                          <div className="flex justify-between items-center border-b border-slate-200/60 pb-2">
                            <h4 className="font-black text-slate-900 text-xs uppercase tracking-tight">{inv.invoice_title}</h4>
                            <button onClick={() => handleRemoveInvoice(inv.id)} className="text-slate-400 hover:text-rose-500 p-0.5">
                              <Trash2 size={13}/>
                            </button>
                          </div>

                          {/* Add Item Form to Invoice */}
                          <div className="bg-white border border-slate-200/80 p-2.5 rounded-xl flex flex-col sm:flex-row gap-1.5 items-stretch sm:items-center">
                            <input 
                              type="text" 
                              placeholder="Item Name (e.g. Mixberry Mojito)" 
                              value={targetInvoiceIdForItem === inv.id ? newItemName : ""} 
                              onChange={(e) => {
                                setTargetInvoiceIdForItem(inv.id);
                                setNewItemName(e.target.value);
                              }}
                              className="bg-slate-50 border border-slate-200 p-1.5 rounded-lg text-xs font-semibold focus:outline-none grow text-slate-800"
                            />
                            
                            <div className="flex gap-1.5">
                              <input 
                                type="number" 
                                placeholder="Qty" 
                                value={targetInvoiceIdForItem === inv.id ? newItemQty : "1"} 
                                onChange={(e) => {
                                  setTargetInvoiceIdForItem(inv.id);
                                  setNewItemQty(e.target.value);
                                }}
                                className="w-12 bg-slate-50 border border-slate-200 p-1.5 rounded-lg text-xs font-semibold text-center focus:outline-none shrink-0 text-slate-800"
                              />

                              <input 
                                type="number" 
                                placeholder="Total MVR" 
                                value={targetInvoiceIdForItem === inv.id ? newItemPrice : ""} 
                                onChange={(e) => {
                                  setTargetInvoiceIdForItem(inv.id);
                                  setNewItemPrice(e.target.value);
                                }}
                                className="w-24 bg-slate-50 border border-slate-200 p-1.5 rounded-lg text-xs font-semibold focus:outline-none shrink-0 text-slate-800"
                              />

                              <button 
                                onClick={() => handleAddItemToInvoice(inv.id)}
                                className="bg-slate-900 text-white font-bold text-[10px] uppercase px-2.5 py-1.5 rounded-lg shrink-0"
                              >
                                + Add
                              </button>
                            </div>
                          </div>

                          {/* Items List with Live Claim Toggles */}
                          <div className="space-y-2">
                            {inv.items.map((item: InvoiceItem) => {
                              const totalP = parseFloat(item.total_price as string) || 0;
                              const claimsCount = item.claims?.length || 0;
                              const isFullyClaimed = claimsCount > 0;

                              return (
                                <div key={item.id} className="bg-white border border-slate-200/80 rounded-xl p-2.5 space-y-2">
                                  <div className="flex justify-between items-start gap-1">
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-1.5">
                                        <span className="font-bold text-slate-900 text-xs truncate">{item.item_name}</span>
                                        <span className="text-[9px] font-extrabold text-slate-400 bg-slate-100 px-1 py-0.2 rounded shrink-0">
                                          x{item.qty}
                                        </span>
                                      </div>
                                      <p className="text-[10px] font-semibold text-slate-400 mt-0.5">
                                        Price: <b className="text-slate-800">MVR {totalP.toFixed(2)}</b>
                                      </p>
                                    </div>

                                    <div className="flex items-center gap-1.5 shrink-0">
                                      <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded border ${isFullyClaimed ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-amber-50 text-amber-600 border-amber-200'}`}>
                                        {isFullyClaimed ? '0 Balance ✅' : `Unassigned`}
                                      </span>

                                      <button onClick={() => handleRemoveInvoiceItem(item.id)} className="text-slate-300 hover:text-rose-500 p-0.5">
                                        <X size={13}/>
                                      </button>
                                    </div>
                                  </div>

                                  {/* Mobile Responsive Player Claims Row */}
                                  <div className="pt-1.5 border-t border-slate-100">
                                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Assigned To:</span>
                                    <div className="flex gap-1 overflow-x-auto pb-1 no-scrollbar">
                                      {currentActivity.participants.map((p: Participant) => {
                                        const isClaimedByMe = item.claims?.some(c => c.participant_id === p.id);
                                        return (
                                          <button 
                                            key={p.id} 
                                            onClick={() => handleToggleItemClaim(item.id, p.id, item.claims || [])}
                                            className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-bold border shrink-0 transition-colors ${isClaimedByMe ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-50 text-slate-600 border-slate-200'}`}
                                          >
                                            {isClaimedByMe && <Check size={10} className="text-emerald-400"/>}
                                            <span className="truncate max-w-20">{p.primary_name}</span>
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: FINANCES / BILLING LEDGER */}
              {activeTab === 'finance' && (
                <div className="bg-white rounded-2xl border border-slate-200/80 p-3 sm:p-5 shadow-[0_2px_12px_rgba(0,0,0,0.02)] space-y-4">
                  
                  {/* SUMMARY CARDS */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl flex flex-col justify-center">
                      <span className="text-[9px] font-extrabold uppercase text-slate-400 tracking-wider">Total Received</span>
                      <p className="text-base sm:text-xl font-black text-emerald-600 mt-0.5">MVR {receivedMetrics.totalCollected.toFixed(0)}</p>
                    </div>

                    <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl flex flex-col justify-center">
                      <span className="text-[9px] font-extrabold uppercase text-slate-400 tracking-wider">Total Pending</span>
                      <p className="text-base sm:text-xl font-black text-amber-600 mt-0.5">MVR {receivedMetrics.totalOutstanding.toFixed(0)}</p>
                    </div>

                    <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl flex flex-col justify-center">
                      <span className="text-[9px] font-extrabold uppercase text-slate-400 tracking-wider">Progress</span>
                      <div className="flex items-center justify-between mt-0.5">
                        <span className="text-xs font-black text-slate-800">
                          {((receivedMetrics.totalCollected / ((receivedMetrics.totalCollected + receivedMetrics.totalOutstanding) || 1)) * 100).toFixed(0)}%
                        </span>
                        <span className="text-[9px] font-bold text-slate-400">
                          Target: { (receivedMetrics.totalCollected + receivedMetrics.totalOutstanding).toFixed(0) } MVR
                        </span>
                      </div>
                      <div className="w-full bg-slate-200 h-1 rounded-full mt-1 overflow-hidden">
                        <div 
                          className="bg-emerald-500 h-full transition-all duration-300"
                          style={{ width: `${Math.min(100, (receivedMetrics.totalCollected / ((receivedMetrics.totalCollected + receivedMetrics.totalOutstanding) || 1)) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* SPLIT CONTROLS */}
                  <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl flex flex-col sm:flex-row gap-2.5 justify-between items-stretch sm:items-center">
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1">
                      <Filter size={13} className="text-slate-500"/> Split Rules
                    </span>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      <select 
                        value={selectedBankIdForInvoice}
                        onChange={(e) => setSelectedBankIdForInvoice(e.target.value)}
                        className="bg-white border border-slate-200 px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-700 focus:outline-none"
                      >
                        <option value="" disabled>Select Bank...</option>
                        {bankAccounts.map((b: BankAccount) => (
                          <option key={b.id} value={b.id}>Bank: {b.account_name} ({b.currency})</option>
                        ))}
                      </select>

                      <div className="flex items-center gap-1 bg-white border border-slate-200 p-1 rounded-xl">
                        <button 
                          onClick={() => handleUpdateSplitMode(currentActivity.id, 'all')}
                          className={`flex-1 sm:flex-none px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase transition-colors ${currentActivity.split_mode === 'all' ? 'bg-slate-900 text-white' : 'text-slate-500'}`}
                        >
                          All ({currentActivity.participants.length})
                        </button>
                        <button 
                          onClick={() => handleUpdateSplitMode(currentActivity.id, 'adults_only')}
                          className={`flex-1 sm:flex-none px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase transition-colors ${currentActivity.split_mode === 'adults_only' ? 'bg-slate-900 text-white' : 'text-slate-500'}`}
                        >
                          Adults Only ({calculateBreakdown(currentActivity).adults})
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* MANUAL EXCLUSION CHECKBOX LIST */}
                  <div className="bg-slate-50/50 border border-slate-100 p-2.5 rounded-xl space-y-1.5">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">Uncheck to Exclude from Shared Expenses:</span>
                    <div className="flex flex-wrap gap-1">
                      {currentActivity.participants.map((p: Participant) => {
                        const prof = masterMembers.find((m: MasterMember) => m.id === p.master_member_id);
                        const exclusions = currentActivity.manual_exclusions || [];
                        const isExcluded = exclusions.includes(p.id);
                        const isKidByMode = currentActivity.split_mode === 'adults_only' && prof?.member_type === 'kid';

                        return (
                          <label key={p.id} className={`flex items-center gap-1 border px-2 py-0.5 rounded-md cursor-pointer text-[10px] font-bold transition-all ${isExcluded || isKidByMode ? 'bg-slate-100 text-slate-400 border-slate-200 line-through' : 'bg-white text-slate-800 border-slate-200'}`}>
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

                  {/* BILLING LEDGER ITEMS */}
                  <div className="space-y-2 border-t border-slate-100 pt-3">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider px-1">Grouped Dues</h3>

                    {getBillingLedgerGrouped(currentActivity).length === 0 ? (
                      <p className="p-6 text-center text-slate-400 font-medium text-xs">No ledger data available. Add attendees first.</p>
                    ) : (
                      getBillingLedgerGrouped(currentActivity).map((item: BillingLedgerItem, idx: number) => (
                        <div key={idx} className="bg-slate-50/80 border border-slate-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between sm:justify-start gap-2">
                              <h4 className="font-bold text-slate-900 text-xs sm:text-sm truncate">{item.headName}</h4>
                              <span className="font-black text-amber-600 text-xs sm:hidden">MVR {item.totalDue.toFixed(0)}</span>
                            </div>
                            <p className="text-[10px] text-slate-500 font-semibold mt-0.5 truncate">For: {item.attendees.join(', ')}</p>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-0 border-slate-200/60">
                            <span className="font-black text-amber-600 text-sm hidden sm:inline-block pr-2">MVR {item.totalDue.toFixed(0)}</span>

                            <div className="flex items-center gap-1.5 w-full sm:w-auto">
                              <button 
                                onClick={async () => {
                                  const newPaidState = !item.hasPaid;
                                  handleUpdateParticipantLocal(currentActivity.id, item.initialPartId, "has_paid", newPaidState);
                                  await supabase.from('activity_participants').update({ has_paid: newPaidState }).eq('activity_id', currentActivity.id).eq('head_id', currentActivity.participants.find((p: Participant) => p.id === item.initialPartId)?.head_id);
                                  fetchActivitiesData();
                                }}
                                className={`flex-1 sm:flex-none px-2.5 py-1.5 rounded-lg font-black text-[9px] uppercase tracking-wider border transition-colors ${item.hasPaid ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-amber-50 text-amber-600 border-amber-200'}`}
                              >
                                {item.hasPaid ? 'Paid ✅' : 'Mark Paid ⏳'}
                              </button>

                              <button 
                                onClick={() => handleSharePersonalWhatsApp(currentActivity, item)}
                                className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg font-bold text-[9px] uppercase tracking-wider transition-colors flex items-center justify-center gap-1 ${item.whatsappShared ? 'bg-emerald-600 text-white' : 'bg-slate-900 text-white hover:bg-slate-800'}`}
                              >
                                <Send size={10}/>
                                {item.whatsappShared ? 'Shared ✅' : 'WhatsApp'}
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* TAB 4: SHOPPING LIST */}
              {activeTab === 'shopping' && (
                <div className="bg-white rounded-2xl border border-slate-200/80 p-3 sm:p-5 shadow-[0_2px_12px_rgba(0,0,0,0.02)] space-y-3">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider"><ClipboardList size={14} className="inline mr-1 text-slate-400"/> Provisions List</h3>
                    <button onClick={() => handleAddShoppingItem(currentActivity.id)} className="bg-slate-900 text-white font-bold text-[10px] uppercase px-2.5 py-1 rounded-xl flex items-center gap-1">
                      <Plus size={12}/> Add
                    </button>
                  </div>

                  {currentActivity.shopping.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-8 font-semibold">No provisions logged.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {currentActivity.shopping.map((item: ShoppingItem) => (
                        <div key={item.id} className="flex gap-2 items-center bg-slate-50 border border-slate-100 p-2 rounded-xl">
                          <button 
                            onClick={() => {
                              handleUpdateShopLocal(currentActivity.id, item.id, "is_bought", !item.is_bought);
                              handleSaveShopDB(item.id, "is_bought", !item.is_bought);
                            }}
                            className="text-slate-400 p-0.5 shrink-0"
                          >
                            {item.is_bought ? <CheckCircle2 size={16} className="text-emerald-500"/> : <div className="w-3.5 h-3.5 rounded border border-slate-300 bg-white"/>}
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
                            className="w-12 bg-white border border-slate-200 p-1 rounded-lg text-xs font-bold text-center focus:outline-none text-slate-600 shrink-0"
                          />

                          <button onClick={() => handleRemoveShopItem(item.id)} className="text-slate-300 hover:text-rose-500 p-0.5 shrink-0"><X size={14}/></button>
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