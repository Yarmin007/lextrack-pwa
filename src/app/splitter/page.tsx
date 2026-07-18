"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { 
  Plus, X, Trash2, Wallet, ShoppingCart, Calculator, Settings, 
  CheckCircle2, AlertCircle, ChevronDown, ChevronUp, Send, User, 
  Landmark, Banknote, Users, Edit2, Package, CheckSquare, ArrowUpRight, ArrowDownRight, LayoutDashboard
} from "lucide-react";
import Link from "next/link";

// 1. FIX: True Database-Compliant UUID Generator
const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

// Sort events Newest to Oldest for the UI
const sortEventsDesc = (arr: any[]) => [...arr].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

export default function SplitterPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

  // MVR Bank State
  const [showBankModal, setShowBankModal] = useState(false);
  const [mvrBankName, setMvrBankName] = useState("");
  const [mvrBankNo, setMvrBankNo] = useState("");

  // DB-Backed Adjustments (+ Debt / - Recv)
  const [adjustments, setAdjustments] = useState<any[]>([]);
  
  // Local Shared Statuses (Maps person -> last shared total amount)
  const [sharedStatuses, setSharedStatuses] = useState<Record<string, number>>({});

  // Directory State (Now linked to Supabase)
  const [directory, setDirectory] = useState<{id: string, name: string, nickname: string}[]>([]);
  const [showDirModal, setShowDirModal] = useState(false);
  const [dirName, setDirName] = useState("");
  const [dirNick, setDirNick] = useState("");
  const [editingDirId, setEditingDirId] = useState<string | null>(null);

  // Merge Users State
  const [isMerging, setIsMerging] = useState(false);
  const [mergeSourceId, setMergeSourceId] = useState("");
  const [mergeTargetId, setMergeTargetId] = useState("");

  // Details Tile State & Dropdown State
  const [expandedPerson, setExpandedPerson] = useState<string | null>(null);
  const [focusedParticipantId, setFocusedParticipantId] = useState<string | null>(null);

  // UX Animation Delay State to lock user list sorting positions while clicking "Pay"
  const [sortingLockTimer, setSortingLockTimer] = useState<NodeJS.Timeout | null>(null);
  const [lockedOrderKeys, setLockedOrderKeys] = useState<string[]>([]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchData = useCallback(async () => {
    const [eventsRes, adjsRes, dirRes] = await Promise.all([
      supabase.from('splitter_events').select('*').order('event_date', { ascending: false }),
      supabase.from('splitter_adjustments').select('*').order('created_at', { ascending: true }),
      supabase.from('directory').select('*').order('name', { ascending: true })
    ]);
    
    if (eventsRes.data) {
      const usedIds = new Set();
      const getSafeId = (id: string | undefined) => {
        if (!id || usedIds.has(id)) {
          const newId = generateId();
          usedIds.add(newId);
          return newId;
        }
        usedIds.add(id);
        return id;
      };

      const mapped = eventsRes.data.map(e => ({
        id: e.id,
        title: e.title,
        date: e.event_date,
        mode: e.mode,
        totalBill: e.total_bill?.toString() || "",
        delivery: e.delivery_fee?.toString() || "",
        gst: e.gst?.toString() || "",
        discount: e.discount?.toString() || "",
        invoiceItems: e.invoice_items || [],
        participants: (e.participants || []).map((p: any) => {
          let mergedItems = p.items || [];
          if (mergedItems.length === 0 && p.amount) {
            mergedItems = [{ id: getSafeId(undefined), desc: "Food", price: p.amount, qty: 1 }];
          }
          return {
            ...p,
            id: getSafeId(p.id),
            paysMain: p.paysMain !== undefined ? p.paysMain : (p.isIncluded !== false), 
            paysDelivery: p.paysDelivery !== undefined ? p.paysDelivery : (p.isIncluded !== false),
            items: mergedItems.map((item: any) => ({ ...item, id: getSafeId(item.id), qty: item.qty || 1 }))
          };
        })
      }));
      setEvents(sortEventsDesc(mapped));
    }

    if (adjsRes.data && Array.isArray(adjsRes.data)) {
      setAdjustments(adjsRes.data);
    }

    if (dirRes.data && Array.isArray(dirRes.data)) {
      setDirectory(dirRes.data);
    }
  }, []);

  useEffect(() => {
    fetchData();

    // Load Local Banks and Statuses
    const savedBankName = localStorage.getItem("lextrack_mvr_bank_name");
    const savedBankNo = localStorage.getItem("lextrack_mvr_bank_no");
    if (savedBankName) setMvrBankName(savedBankName);
    if (savedBankNo) setMvrBankNo(savedBankNo);

    const savedStatuses = localStorage.getItem("lextrack_shared_statuses");
    if (savedStatuses) setSharedStatuses(JSON.parse(savedStatuses));
  }, [fetchData]);

  const saveMvrBank = () => {
    if (!mvrBankName || !mvrBankNo) return showToast("Please fill both fields.", "error");
    localStorage.setItem("lextrack_mvr_bank_name", mvrBankName);
    localStorage.setItem("lextrack_mvr_bank_no", mvrBankNo);
    setShowBankModal(false);
    showToast("MVR Bank saved successfully!");
  };

  const saveToDirectory = async () => {
    if (!dirName.trim()) return showToast("Name is required", "error");
    
    if (editingDirId) {
      const { error } = await supabase.from('directory').update({ name: dirName.trim(), nickname: dirNick.trim() }).eq('id', editingDirId);
      if (!error) {
        setDirectory(directory.map(d => d.id === editingDirId ? { ...d, name: dirName.trim(), nickname: dirNick.trim() } : d));
        showToast("User updated in directory");
      } else {
        console.error("Supabase Error Updating User:", error);
        showToast("Error updating user", "error");
      }
      setEditingDirId(null);
    } else {
      const newEntry = { id: generateId(), name: dirName.trim(), nickname: dirNick.trim() };
      const { error } = await supabase.from('directory').insert(newEntry);
      if (!error) {
        setDirectory([...directory, newEntry]);
        showToast("User added to directory");
      } else {
        console.error("Supabase Error Saving User:", error);
        showToast("Error saving user", "error");
      }
    }
    setDirName("");
    setDirNick("");
  };

  const extractUsers = async () => {
    const existingNames = new Set(directory.map(d => d.name.trim().toLowerCase()));
    let newUsers: any[] = [];
    
    events.forEach(ev => {
      ev.participants.forEach((p: any) => {
        if (p.name && p.name.trim()) {
          const key = p.name.trim().toLowerCase();
          if (!existingNames.has(key)) {
            existingNames.add(key);
            newUsers.push({ id: generateId(), name: p.name.trim(), nickname: "" });
          }
        }
      });
    });

    if (newUsers.length > 0) {
      const { error } = await supabase.from('directory').insert(newUsers);
      if (!error) {
        setDirectory([...directory, ...newUsers]);
        showToast(`Extracted ${newUsers.length} new users!`);
      } else {
        console.error("Supabase Error Extracting Users:", error);
        showToast("Error saving extracted users", "error");
      }
    } else {
      showToast("No new users found to extract.");
    }
  };

  const deleteFromDirectory = async (id: string) => {
    const { error } = await supabase.from('directory').delete().eq('id', id);
    if (!error) {
      setDirectory(directory.filter(d => d.id !== id));
      showToast("User removed from directory");
    } else {
      console.error("Supabase Error Deleting User:", error);
      showToast("Error deleting user", "error");
    }
  };

  const handleMergeUsers = async () => {
    if (!mergeSourceId || !mergeTargetId) return showToast("Select both users", "error");
    if (mergeSourceId === mergeTargetId) return showToast("Cannot merge a user into themselves", "error");

    const sourceUser = directory.find(d => d.id === mergeSourceId);
    const targetUser = directory.find(d => d.id === mergeTargetId);

    if (!sourceUser || !targetUser) return showToast("Invalid users selected", "error");

    if (!confirm(`Are you sure you want to merge '${sourceUser.name}' into '${targetUser.name}'? This will update all past events and cannot be undone.`)) return;

    const sourceKey = sourceUser.name.trim().toLowerCase();
    const targetKey = targetUser.name.trim().toLowerCase();

    let errorOccurred = false;

    // 1. Update Adjustments in Database
    const { error: adjError } = await supabase
      .from('splitter_adjustments')
      .update({ person_name: targetKey })
      .eq('person_name', sourceKey);
    
    if (adjError) {
      console.error("Adjustment merge error:", adjError);
      errorOccurred = true;
    }

    // 2. Find and Update Events with the source user
    const eventsToUpdate = events.filter(ev => ev.participants.some((p: any) => p.name?.trim().toLowerCase() === sourceKey));
    
    for (const ev of eventsToUpdate) {
      const updatedParticipants = ev.participants.map((p: any) => {
        if (p.name?.trim().toLowerCase() === sourceKey) {
          return { ...p, name: targetUser.name };
        }
        return p;
      });
      
      const payload = {
        id: ev.id,
        title: ev.title,
        event_date: ev.date,
        mode: ev.mode,
        total_bill: parseFloat(ev.totalBill) || 0,
        delivery_fee: parseFloat(ev.delivery) || 0,
        gst: parseFloat(ev.gst) || 0,
        discount: parseFloat(ev.discount) || 0,
        invoice_items: ev.invoiceItems || [],
        participants: updatedParticipants
      };

      const { error: evError } = await supabase.from('splitter_events').upsert(payload);
      if (evError) {
        console.error("Event merge error:", evError);
        errorOccurred = true;
      }
    }

    // 3. Delete Source User from Directory
    await supabase.from('directory').delete().eq('id', mergeSourceId);

    if (errorOccurred) {
      showToast("Merge completed with some errors. Refreshing...", "error");
    } else {
      showToast("Merged successfully! Reloading data...");
    }
    
    setTimeout(() => {
      window.location.reload();
    }, 1500);
  };

  // --- STRICT ID-BASED STATE UPDATERS ---
  const createNewEvent = () => {
    const newId = generateId();
    const today = new Date().toISOString().split('T')[0];
    const newEvent = {
      id: newId,
      title: "New Split",
      date: today,
      mode: 'universal',
      totalBill: "",
      delivery: "",
      gst: "",
      discount: "",
      invoiceItems: [],
      participants: [{ id: generateId(), name: "", items: [], hasPaid: false, paysMain: true, paysDelivery: true }]
    };
    setEvents(prev => sortEventsDesc([newEvent, ...prev]));
    setExpanded(prev => ({ ...prev, [newId]: true }));
  };

  const updateEvent = (eventId: string, field: string, value: any) => { setEvents(prev => prev.map(e => e.id === eventId ? { ...e, [field]: value } : e)); };
  
  // --- INVOICE MASTER LOGIC ---
  const addInvoiceItem = (eventId: string) => {
    setEvents(prev => prev.map(e => e.id === eventId ? { ...e, invoiceItems: [...(e.invoiceItems || []), { id: generateId(), desc: "", qty: 1, price: "" }] } : e));
  };
  const updateInvoiceItem = (eventId: string, invId: string, field: string, value: any) => {
    setEvents(prev => prev.map(e => e.id === eventId ? { ...e, invoiceItems: (e.invoiceItems || []).map((inv:any) => inv.id === invId ? { ...inv, [field]: value } : inv) } : e));
  };
  const removeInvoiceItem = (eventId: string, invId: string) => {
    setEvents(prev => prev.map(e => e.id === eventId ? { ...e, invoiceItems: (e.invoiceItems || []).filter((inv:any) => inv.id !== invId) } : e));
  };
  
  const moveUnclaimedToShared = (eventId: string) => {
    const ev = events.find(e => e.id === eventId);
    if (!ev) return;
    
    const masterSubtotal = (ev.invoiceItems || []).reduce((sum: number, inv: any) => sum + ((parseFloat(inv.qty)||0) * (parseFloat(inv.price)||0)), 0);
    
    let claimedSubtotal = 0;
    ev.participants.forEach((p: any) => {
      claimedSubtotal += (p.items || []).reduce((sum: number, item: any) => sum + ((parseFloat(item.price) || 0) * (parseFloat(item.qty) || 1)), 0);
    });

    let unclaimed = masterSubtotal - claimedSubtotal;
    if (unclaimed < 0) unclaimed = 0;

    updateEvent(eventId, 'totalBill', unclaimed.toFixed(2));
    showToast(`MVR ${unclaimed.toFixed(2)} unassigned moved to Shared Items!`);
  };

  const addParticipant = (eventId: string) => { setEvents(prev => prev.map(e => e.id === eventId ? { ...e, participants: [...e.participants, { id: generateId(), name: "", items: [], hasPaid: false, paysMain: true, paysDelivery: true }] } : e)); };
  const removeParticipant = (eventId: string, pId: string) => { setEvents(prev => prev.map(e => e.id === eventId ? { ...e, participants: e.participants.filter((p:any) => p.id !== pId) } : e)); };
  const updateParticipant = (eventId: string, pId: string, field: string, value: any) => { setEvents(prev => prev.map(e => e.id === eventId ? { ...e, participants: e.participants.map((p:any) => p.id === pId ? { ...p, [field]: value } : p) } : e)); };
  const addParticipantItem = (eventId: string, pId: string) => { setEvents(prev => prev.map(e => e.id === eventId ? { ...e, participants: e.participants.map((p:any) => p.id === pId ? { ...p, items: [...(p.items || []), { id: generateId(), desc: "", qty: 1, price: "" }] } : p) } : e)); };
  
  const updateParticipantItem = (eventId: string, pId: string, itemId: string, field: string, value: string) => { 
    setEvents(prev => prev.map(e => {
      if (e.id !== eventId) return e;
      
      let autoPrice: string | null = null;
      if (field === 'desc') {
        const matchedInv = (e.invoiceItems || []).find((inv: any) => inv.desc.toLowerCase() === value.toLowerCase());
        if (matchedInv) autoPrice = matchedInv.price;
      }

      return { 
        ...e, 
        participants: e.participants.map((p:any) => p.id === pId ? { 
          ...p, 
          items: (p.items || []).map((it:any) => {
            if (it.id !== itemId) return it;
            const nextIt = { ...it, [field]: value };
            if (autoPrice !== null) nextIt.price = autoPrice;
            return nextIt;
          }) 
        } : p) 
      };
    })); 
  };
  
  const removeParticipantItem = (eventId: string, pId: string, itemId: string) => { setEvents(prev => prev.map(e => e.id === eventId ? { ...e, participants: e.participants.map((p:any) => p.id === pId ? { ...p, items: (p.items || []).filter((it:any) => it.id !== itemId) } : p) } : e)); };

  const lockSortingTemporarily = (currentPendingList: any[]) => {
    if (sortingLockTimer) clearTimeout(sortingLockTimer);
    if (lockedOrderKeys.length === 0) {
      setLockedOrderKeys(currentPendingList.map(p => p.name.trim().toLowerCase()));
    }
    const timer = setTimeout(() => {
      setLockedOrderKeys([]);
    }, 5000); // Locks sorting layout index positions for 5 full seconds before allowing jumps
    setSortingLockTimer(timer);
  };

  const markAsPaidFromTile = async (eventId: string, participantId: string, currentPendingList: any[]) => {
    lockSortingTemporarily(currentPendingList);
    
    const ev = events.find(e => e.id === eventId);
    if (!ev) return;
    
    const updatedParticipants = ev.participants.map((p: any) => 
      p.id === participantId ? { ...p, hasPaid: true } : p
    );
    
    setEvents(prev => prev.map(e => e.id === eventId ? { ...e, participants: updatedParticipants } : e));
    
    const participantsWithShares = updatedParticipants.map((p: any) => ({
      ...p,
      share: calculateShare({ ...ev, participants: updatedParticipants }, p)
    }));

    const payload = {
      id: ev.id,
      title: ev.title,
      event_date: ev.date,
      mode: ev.mode,
      total_bill: parseFloat(ev.totalBill) || 0,
      delivery_fee: parseFloat(ev.delivery) || 0,
      gst: parseFloat(ev.gst) || 0,
      discount: parseFloat(ev.discount) || 0,
      invoice_items: ev.invoiceItems || [],
      participants: participantsWithShares
    };

    const { error } = await supabase.from('splitter_events').upsert(payload);
    
    if (!error) {
      showToast("Marked as paid!");
    } else {
      showToast("Error saving to cloud", "error");
      setEvents(prev => prev.map(e => e.id === eventId ? ev : e));
    }
  };

  // --- BATCH CONFIRM FULL RECOVERY PAY ---
  const markPersonFullyPaid = async (person: any, currentPendingList: any[]) => {
    if (!confirm(`Mark all ${person.details.length} events for ${person.name} as fully paid?`)) return;
    
    lockSortingTemporarily(currentPendingList);
    
    // Create localized mutations map
    const eventsToUpdateMap: Record<string, any> = {};
    
    person.details.forEach((d: any) => {
      const matchEv = events.find(e => e.id === d.eventId);
      if (matchEv) {
        if (!eventsToUpdateMap[matchEv.id]) {
          eventsToUpdateMap[matchEv.id] = JSON.parse(JSON.stringify(matchEv));
        }
        eventsToUpdateMap[matchEv.id].participants = eventsToUpdateMap[matchEv.id].participants.map((p: any) => 
          p.id === d.participantId ? { ...p, hasPaid: true } : p
        );
      }
    });

    // Run parallel mutations pipeline across local state + database streams
    try {
      await Promise.all(
        Object.values(eventsToUpdateMap).map(async (ev: any) => {
          const shares = ev.participants.map((p: any) => ({
            ...p,
            share: calculateShare(ev, p)
          }));
          
          const payload = {
            id: ev.id,
            title: ev.title,
            event_date: ev.date,
            mode: ev.mode,
            total_bill: parseFloat(ev.totalBill) || 0,
            delivery_fee: parseFloat(ev.delivery) || 0,
            gst: parseFloat(ev.gst) || 0,
            discount: parseFloat(ev.discount) || 0,
            invoice_items: ev.invoiceItems || [],
            participants: shares
          };
          
          const { error } = await supabase.from('splitter_events').upsert(payload);
          if (error) throw error;
        })
      );

      // Mutate UI locally upon successful database confirmation responses
      setEvents(prev => prev.map(e => {
        if (eventsToUpdateMap[e.id]) {
          const target = eventsToUpdateMap[e.id];
          return {
            ...e,
            participants: target.participants.map((p: any) => ({
              ...p,
              share: calculateShare(target, p)
            }))
          };
        }
        return e;
      }));

      showToast(`Settled all ${person.name} records completely!`);
    } catch (err) {
      console.error(err);
      showToast("Error executing global settlement bundle", "error");
    }
  };

  // --- FIX: DATABASE-BACKED ADJUSTMENTS ---
  const addAdjustment = async (personName: string) => {
    const key = personName.trim().toLowerCase();
    const newAdj = { id: generateId(), person_name: key, type: 'payment', desc_text: "", amount: 0 }; 
    
    setAdjustments(prev => Array.isArray(prev) ? [...prev, newAdj] : [newAdj]);
    const { error } = await supabase.from('splitter_adjustments').insert(newAdj);
    if (error) showToast("Error connecting to DB", "error");
  };

  const updateAdjustmentLocal = (id: string, field: string, value: any) => {
    setAdjustments(prev => prev.map(a => a.id === id ? { ...a, [field]: value } : a));
  };

  const saveAdjustmentDB = async (id: string, field: string, value: any) => {
    let finalValue = value;
    if (field === 'amount') finalValue = parseFloat(value) || 0; 
    const { error } = await supabase.from('splitter_adjustments').update({ [field]: finalValue }).eq('id', id);
    if (error) showToast("Failed to save to cloud", "error");
  };

  const removeAdjustmentDB = async (id: string) => {
    setAdjustments(prev => prev.filter(a => a.id !== id));
    const { error } = await supabase.from('splitter_adjustments').delete().eq('id', id);
    if (error) showToast("Failed to delete", "error");
  };

  // --- REBUILT MATH ENGINE ---
  const calculateShare = (event: any, participant: any) => {
    let subtotal = 0;
    subtotal += (participant.items || []).reduce((sum: number, item: any) => sum + ((parseFloat(item.price) || 0) * (parseFloat(item.qty) || 1)), 0);

    const mainCount = Math.max(1, event.participants.filter((p: any) => p.paysMain !== false).length);
    if (participant.paysMain !== false) {
      const sharedNum = parseFloat(event.totalBill) || 0;
      subtotal += (sharedNum / mainCount);
    }

    const gstPercent = parseFloat(event.gst) || 0;
    const gstAmount = subtotal * (gstPercent / 100);
    let total = subtotal + gstAmount;

    if (participant.paysDelivery !== false) {
      const devCount = Math.max(1, event.participants.filter((p: any) => p.paysDelivery !== false).length);
      const deliveryNum = parseFloat(event.delivery) || 0;
      total += (deliveryNum / devCount);
    }

    if (participant.paysMain !== false) {
      const discountNum = parseFloat(event.discount) || 0;
      total -= (discountNum / mainCount);
    }

    return Math.max(0, total);
  };

  const saveEvent = async (eventId: string) => {
    const ev = events.find(e => e.id === eventId);
    if (!ev) return;

    const participantsWithShares = ev.participants.map((p: any) => ({
      ...p,
      share: calculateShare(ev, p)
    }));

    const payload = {
      id: ev.id,
      title: ev.title,
      event_date: ev.date,
      mode: 'universal',
      total_bill: parseFloat(ev.totalBill) || 0,
      delivery_fee: parseFloat(ev.delivery) || 0,
      gst: parseFloat(ev.gst) || 0,
      discount: parseFloat(ev.discount) || 0,
      invoice_items: ev.invoiceItems || [],
      participants: participantsWithShares
    };

    let updatedEvents = [...events];

    const { data, error } = await supabase.from('splitter_events').upsert(payload).select().single();
    
    if (!error && data) { 
      updatedEvents = events.map(e => e.id === eventId ? { ...e, id: data.id, participants: participantsWithShares } : e);
      setExpanded(prev => ({ ...prev, [eventId]: false, [data.id]: true }));
      showToast("Event saved!");
    } else {
      showToast("Error saving event", "error");
      console.error(error);
    }

    setEvents(sortEventsDesc(updatedEvents));
  };

  const deleteEvent = async (eventId: string) => {
    if (!confirm("Delete this entire event?")) return;
    const { error } = await supabase.from('splitter_events').delete().eq('id', eventId);
    if (!error) {
      setEvents(prev => prev.filter(e => e.id !== eventId));
      showToast("Event deleted");
    }
  };

  // --- LIVE INVOICE AGGREGATION ---
  const getPendingByPerson = () => {
    const personMap: Record<string, any> = {};

    events.forEach(ev => {
      const mainCount = Math.max(1, ev.participants.filter((p: any) => p.paysMain !== false).length);
      const devCount = Math.max(1, ev.participants.filter((p: any) => p.paysDelivery !== false).length);

      ev.participants.forEach((p: any) => {
        const key = p.name?.trim().toLowerCase();
        
        // --- EXCLUDE YAMIN ---
        if (key === 'yamin' || key === 'abdulla yamin') return; 

        if (!p.hasPaid && key) {
          const share = calculateShare(ev, p);

          const itemsSubtotal = (p.items || []).reduce((sum: number, item: any) => sum + ((parseFloat(item.price) || 0) * (parseFloat(item.qty) || 1)), 0);
          const sharedSubtotal = p.paysMain !== false ? (parseFloat(ev.totalBill) || 0) / mainCount : 0;
          const gstPercent = parseFloat(ev.gst) || 0;
          const gstAmount = (itemsSubtotal + sharedSubtotal) * (gstPercent / 100);
          const discountShare = p.paysMain !== false ? (parseFloat(ev.discount) || 0) / mainCount : 0;
          const deliverySplit = p.paysDelivery !== false ? (parseFloat(ev.delivery) || 0) / devCount : 0;

          if (!personMap[key]) {
            personMap[key] = { name: p.name.trim(), totalOwed: 0, details: [] };
          }

          personMap[key].totalOwed += share;
          personMap[key].details.push({
            eventId: ev.id,
            participantId: p.id,
            title: ev.title,
            date: ev.date,
            mode: ev.mode,
            share: share,
            items: p.items || [],
            itemsSubtotal,
            sharedSubtotal,
            gstPercent,
            gstAmount,
            discountShare,
            deliverySplit,
            paysMain: p.paysMain !== false
          });
        }
      });
    });

    const standardSortList = Object.values(personMap);

    // If an interaction lock array is active, use that specific layout key map position
    if (lockedOrderKeys.length > 0) {
      return standardSortList.sort((a, b) => {
        const indexA = lockedOrderKeys.indexOf(a.name.trim().toLowerCase());
        const indexB = lockedOrderKeys.indexOf(b.name.trim().toLowerCase());
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
        return b.totalOwed - a.totalOwed;
      });
    }

    return standardSortList.sort((a, b) => b.totalOwed - a.totalOwed);
  };

  const sendPersonalInvoice = (person: any, personAdjs: any[], finalTotal: number) => {
    if (!mvrBankName || !mvrBankNo) return showToast("Please set your MVR Bank Account first.", "error");

    const today = new Date();
    const formattedDate = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;

    let msg = `*INVOICE*\nBill To: ${person.name.toUpperCase()}\nBill Date: ${formattedDate}\n\n`;

    const sortedDetails = [...person.details].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    if (sortedDetails.length > 0) {
      sortedDetails.forEach((d: any) => {
        const [y, m, day] = d.date.split('-');
        msg += `(${day}/${m}/${y})\n• ${d.title.toUpperCase()}\n`;
        
        d.items.forEach((item: any) => {
          if (item.desc || item.price) {
            msg += `    └ ${item.desc || "Item"} (x${item.qty || 1}): ${((parseFloat(item.price)||0)*(parseFloat(item.qty)||1)).toFixed(2)}\n`;
          }
        });

        if (d.sharedSubtotal > 0) msg += `    └ Shared Items: ${d.sharedSubtotal.toFixed(2)}\n`;
        if (d.gstAmount > 0) msg += `    └ GST (${d.gstPercent}%): +${d.gstAmount.toFixed(2)}\n`;
        if (d.deliverySplit > 0) msg += `    └ Delivery Fee: +${d.deliverySplit.toFixed(2)}\n`;
        if (d.discountShare > 0) msg += `    └ Discount: -${d.discountShare.toFixed(2)}\n`;

        if (d.share === 0 && d.items.length === 0) {
          msg += `    └ (Exempt from Event)\n`;
        }
        
        msg += `    Subtotal: ${d.share.toFixed(2)} MVR\n\n`;
      });
    }

    const charges = personAdjs.filter(a => a.type === 'charge');
    const payments = personAdjs.filter(a => a.type === 'payment');

    if (charges.length > 0 || payments.length > 0) {
      msg += `*Adjustments:*\n`;
      charges.forEach((item: any) => {
        if (item.desc_text || item.amount) msg += `    └ ${item.desc_text || "Debt"}: +${item.amount || 0} MVR\n`;
      });
      payments.forEach((item: any) => {
        if (item.desc_text || item.amount) msg += `    └ ${item.desc_text || "Payment"}: -${item.amount || 0} MVR\n`;
      });
      msg += `\n`;
    }

    msg += `*TOTAL DUE: ${finalTotal.toFixed(2)} MVR*\n\n`;
    msg += `*ACCOUNT DETAIL*\n\n`;
    msg += `${mvrBankName}\n${mvrBankNo}`;

    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
    
    const personKey = person.name.trim().toLowerCase();
    setSharedStatuses(prev => {
      const next = { ...prev, [personKey]: finalTotal };
      localStorage.setItem("lextrack_shared_statuses", JSON.stringify(next));
      return next;
    });
  };

  // --- GLOBAL TOTALS ENGINE ---
  let globalTotalOwed = 0;
  let globalTotalCollected = 0;

  events.forEach(ev => {
    ev.participants.forEach((p: any) => {
      const key = p.name?.trim().toLowerCase();
      if (key === 'yamin' || key === 'abdulla yamin') return; 

      const share = calculateShare(ev, p);
      if (p.hasPaid) globalTotalCollected += share; else globalTotalOwed += share;
    });
  });

  const safeAdjustments = Array.isArray(adjustments) ? adjustments : [];
  
  safeAdjustments.forEach(adj => {
    if (adj.person_name === 'yamin' || adj.person_name === 'abdulla yamin') return; 

    const amt = parseFloat(adj.amount) || 0;
    if (adj.type === 'payment') {
      globalTotalCollected += amt;
      globalTotalOwed -= amt; 
    } else if (adj.type === 'charge') {
      globalTotalOwed += amt;
    }
  });

  const pendingPeople = getPendingByPerson();

  return (
    <main className="min-h-screen bg-[#F8FAFC] text-[#1E293B] font-sans antialiased flex selection:bg-sky-500/10">

      {toast && (
        <div className={`fixed top-6 right-1/2 translate-x-1/2 lg:translate-x-0 lg:right-6 z-[400] px-5 py-3.5 rounded-xl shadow-xl flex items-center gap-3 text-xs font-bold animate-in fade-in slide-in-from-top-4 duration-200 bg-slate-950 text-white`}>
          {toast.type === 'success' ? <CheckCircle2 size={16} className="text-emerald-400" /> : <AlertCircle size={16} className="text-rose-400" />}
          {toast.message}
        </div>
      )}

      {/* PREMIUM SIDEBAR FOR PC DOCK */}
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
          <Link href="/splitter" className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold bg-slate-900 text-white shadow-sm transition-all duration-200"><Calculator size={18}/> Splitter</Link>
          <Link href="/shop-clearing" className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium hover:bg-slate-50 text-slate-500 hover:text-slate-900 transition-all duration-150"><ShoppingCart size={18}/> Clearing</Link>
          <Link href="/myself" className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium hover:bg-slate-50 text-slate-500 hover:text-slate-900 transition-all duration-150"><User size={18}/> Myself</Link>
        </nav>
        <button className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-slate-400 hover:text-slate-600 transition-colors duration-150"><Settings size={18}/> Settings</button>
      </aside>

      {/* CORE FRAME CONTAINER */}
      <div className="flex-grow flex flex-col min-h-screen overflow-y-auto bg-[#F8FAFC]">
        <div className="w-full max-w-[1140px] mx-auto px-4 lg:px-8 py-6 lg:py-8 pb-40">
          
          <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <div>
              <h2 className="text-xl lg:text-2xl font-bold tracking-tight text-slate-900">Split Ledger</h2>
              <p className="text-xs font-medium text-slate-400 mt-0.5">Universal Group Bill Splitter</p>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <button onClick={() => setShowDirModal(true)} className="flex-1 sm:flex-none h-10 px-4 rounded-xl bg-white border border-slate-200/60 text-slate-700 font-semibold text-xs uppercase tracking-wider shadow-sm flex items-center justify-center gap-2 hover:bg-slate-50 active:scale-95 transition-all">
                <Users size={14}/> Directory
              </button>
              <button onClick={() => setShowBankModal(true)} className="flex-1 sm:flex-none h-10 px-4 rounded-xl bg-white border border-slate-200/60 text-slate-700 font-semibold text-xs uppercase tracking-wider shadow-sm flex items-center justify-center gap-2 hover:bg-slate-50 active:scale-95 transition-all">
                <Landmark size={14}/> MVR Bank
              </button>
              <button onClick={createNewEvent} className="flex-1 sm:flex-none h-10 px-5 rounded-xl bg-slate-900 text-white font-semibold text-xs uppercase tracking-wider shadow-sm flex items-center justify-center gap-2 active:scale-95 transition-all">
                <Plus size={14}/> New Split
              </button>
            </div>
          </header>

          {/* TOTAL CARD SUMMARIES */}
          <div className="grid grid-cols-2 gap-5 mb-8">
            <div className="bg-white rounded-2xl p-5 border border-slate-200/60 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5"><ArrowDownRight size={14} className="text-amber-500"/> Total Pending Owed</p>
              <p className="text-2xl font-extrabold text-amber-600">MVR {globalTotalOwed.toLocaleString(undefined, {maximumFractionDigits:0})}</p>
            </div>
            <div className="bg-white rounded-2xl p-5 border border-slate-200/60 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5"><ArrowUpRight size={14} className="text-emerald-500"/> Total Collected</p>
              <p className="text-2xl font-extrabold text-emerald-600">MVR {globalTotalCollected.toLocaleString(undefined, {maximumFractionDigits:0})}</p>
            </div>
          </div>

          {/* CONSOLIDATED PENDING PEOPLE */}
          {pendingPeople.length > 0 && (
            <div className="mb-10">
              <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400 mb-4 pl-1">Pending By Person</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {pendingPeople.map((person, idx) => {
                  const personKey = person.name.trim().toLowerCase();
                  
                  const personAdjs = safeAdjustments.filter(a => a.person_name === personKey);
                  const chargeTotal = personAdjs.filter(a => a.type === 'charge').reduce((s, a) => s + (parseFloat(a.amount) || 0), 0);
                  const paymentTotal = personAdjs.filter(a => a.type === 'payment').reduce((s, a) => s + (parseFloat(a.amount) || 0), 0);
                  
                  const finalTotal = person.totalOwed + chargeTotal - paymentTotal;
                  const isShared = sharedStatuses[personKey] === finalTotal;

                  return (
                    <div key={idx} className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-[0_2px_12px_rgba(0,0,0,0.02)] flex flex-col justify-between transition-all duration-200 hover:shadow-md">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <div className="flex items-center gap-2 mb-0.5">
                            <User size={15} className="text-slate-400"/>
                            <h4 className="font-bold text-slate-900 text-base max-w-[130px] truncate">{person.name}</h4>
                          </div>
                          <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">{person.details.length} pending event(s)</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[9px] font-bold uppercase text-slate-400">Total Due</p>
                          <p className="font-extrabold text-amber-600 text-base">MVR {finalTotal.toFixed(0)}</p>
                        </div>
                      </div>

                      <div className="flex justify-between items-center mb-4">
                        <button onClick={() => setExpandedPerson(expandedPerson === personKey ? null : personKey)} className="text-[10px] font-bold text-sky-600 flex items-center gap-0.5 uppercase tracking-wider">
                          {expandedPerson === personKey ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}
                          {expandedPerson === personKey ? "Hide Details" : "View Details"}
                        </button>

                        <button 
                          onClick={() => markPersonFullyPaid(person, pendingPeople)}
                          className="text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-100 px-2 py-1 rounded-lg hover:bg-emerald-100 flex items-center gap-1 transition-colors"
                        >
                          <CheckSquare size={12}/> Settle All
                        </button>
                      </div>

                      {expandedPerson === personKey && (
                        <div className="mb-4 bg-slate-50/70 p-3 rounded-xl border border-slate-100 space-y-2.5 max-h-48 overflow-y-auto">
                          {person.details.map((d: any, dIdx: number) => (
                            <div key={dIdx} className="flex justify-between items-center border-b border-slate-100 pb-2 last:border-0 last:pb-0">
                              <div className="max-w-[120px]">
                                <p className="font-semibold text-xs text-slate-800 uppercase truncate">{d.title}</p>
                                <p className="text-[9px] text-slate-400 font-bold">{d.date}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-amber-600 text-xs">MVR {d.share.toFixed(0)}</span>
                                <button 
                                  onClick={() => markAsPaidFromTile(d.eventId, d.participantId, pendingPeople)}
                                  className="bg-white border border-slate-200 text-slate-700 px-2 py-1 rounded-md font-bold text-[9px] uppercase tracking-wider hover:bg-slate-50 active:scale-95 transition-transform"
                                >
                                  Pay
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="mb-4 bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Adjustments</span>
                          <button onClick={() => addAdjustment(person.name)} className="text-sky-600 flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-wider active:scale-95 transition-transform"><Plus size={10}/> Add</button>
                        </div>
                        <div className="space-y-2">
                          {personAdjs.map(adj => (
                            <div key={adj.id} className="flex gap-1 items-center animate-in fade-in">
                              <select 
                                value={adj.type} 
                                onChange={e => {
                                  updateAdjustmentLocal(adj.id, 'type', e.target.value);
                                  saveAdjustmentDB(adj.id, 'type', e.target.value);
                                }} 
                                className={`w-20 border border-slate-200 rounded-lg p-1.5 text-[9px] font-bold uppercase tracking-wider focus:outline-none ${adj.type === 'payment' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}
                              >
                                <option value="charge">+ Debt</option>
                                <option value="payment">- Recv</option>
                              </select>
                              <input 
                                placeholder={adj.type === 'payment' ? "Bank Trf" : "Old Debt"} 
                                value={adj.desc_text || ''} 
                                onChange={e => updateAdjustmentLocal(adj.id, 'desc_text', e.target.value)} 
                                onBlur={e => saveAdjustmentDB(adj.id, 'desc_text', e.target.value)}
                                className="flex-grow min-w-[50px] bg-white border border-slate-200 rounded-lg p-1 text-xs font-semibold focus:outline-none" 
                              />
                              <input 
                                placeholder="MVR" 
                                type="number" 
                                value={adj.amount} 
                                onChange={e => updateAdjustmentLocal(adj.id, 'amount', e.target.value)} 
                                onBlur={e => saveAdjustmentDB(adj.id, 'amount', e.target.value)}
                                className="w-14 bg-white border border-slate-200 rounded-lg p-1 text-xs font-semibold text-center focus:outline-none" 
                              />
                              <button onClick={() => removeAdjustmentDB(adj.id)} className="text-slate-300 hover:text-rose-500"><Trash2 size={13}/></button>
                            </div>
                          ))}
                        </div>
                      </div>

                      <button 
                        onClick={() => sendPersonalInvoice(person, personAdjs, finalTotal)} 
                        className={`w-full py-2.5 rounded-xl font-bold text-[10px] uppercase tracking-wider transition-all flex justify-center items-center gap-1.5 ${isShared ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' : 'bg-sky-50 text-sky-600 hover:bg-sky-100'}`}
                      >
                        {isShared ? <><CheckCircle2 size={13}/> Shared ✅</> : <><Send size={13}/> Send WA Invoice</>}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400 mb-4 pl-1">Events Ledger</h3>
          
          <div className="space-y-4">
            {events.length === 0 && (
              <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-200 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
                <Calculator size={44} className="mx-auto text-slate-300 mb-3" />
                <p className="font-semibold text-slate-400 text-sm">No splits recorded yet.</p>
              </div>
            )}

            {events.map((ev) => {
              const isExpanded = expanded[ev.id];
              const eventTotal = ev.participants.reduce((s: number, p: any) => s + calculateShare(ev, p), 0);
              const collected = ev.participants.filter((p:any) => p.hasPaid).reduce((s: number, p: any) => s + calculateShare(ev, p), 0);
              const isFullyPaid = collected >= eventTotal && eventTotal > 0;

              const masterSubtotal = (ev.invoiceItems || []).reduce((sum: number, inv: any) => sum + ((parseFloat(inv.qty)||0) * (parseFloat(inv.price)||0)), 0);
              const masterGST = masterSubtotal * ((parseFloat(ev.gst)||0)/100);
              const masterDisc = parseFloat(ev.discount) || 0;
              const masterGrandTotal = masterSubtotal + masterGST - masterDisc;

              return (
                <div key={ev.id} className={`bg-white rounded-2xl border border-slate-200/60 shadow-[0_2px_12px_rgba(0,0,0,0.02)] transition-all duration-200 ${isExpanded ? 'ring-1 ring-slate-900 shadow-md' : ''}`}>
                  
                  <div className="p-4 flex items-center justify-between cursor-pointer select-none" onClick={() => setExpanded(prev => ({...prev, [ev.id]: !isExpanded}))}>
                    <div className="flex items-center gap-4.5">
                      <div className="w-11 h-11 rounded-xl flex items-center justify-center border border-slate-100 shadow-sm bg-slate-50 text-slate-800">
                        <Calculator size={18}/>
                      </div>
                      <div>
                        <h3 className="font-bold text-base text-slate-950">{ev.title}</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{ev.date} • {ev.participants.length} People</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-6">
                      <div className="hidden sm:block text-right">
                        <p className="text-[10px] font-bold uppercase text-slate-400">Total / Collected</p>
                        <p className={`font-extrabold text-sm ${isFullyPaid ? 'text-emerald-600' : 'text-slate-800'}`}>
                          {collected.toFixed(0)} / {eventTotal.toFixed(0)}
                        </p>
                      </div>
                      <div className="text-slate-400">
                        {isExpanded ? <ChevronUp size={20}/> : <ChevronDown size={20}/>}
                      </div>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="p-5 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl">
                      
                      {/* MASTER INVOICE CONTAINER */}
                      <div className="bg-white rounded-xl border border-slate-200/60 overflow-hidden mb-6 shadow-sm">
                        <div className="flex justify-between items-center p-3.5 border-b border-slate-100 bg-slate-50">
                          <div className="flex items-center gap-2">
                            <Package size={15} className="text-slate-700"/>
                            <h4 className="text-[10px] font-bold uppercase text-slate-700 tracking-wider">Master Invoice</h4>
                            <span className="ml-2 text-[9px] font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200 shadow-2xl">Grand Total: {masterGrandTotal.toFixed(2)} MVR</span>
                          </div>
                          <button onClick={() => addInvoiceItem(ev.id)} className="text-slate-700 font-bold text-[9px] uppercase flex items-center gap-0.5 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 active:scale-95 transition-transform shadow-2xl">
                            <Plus size={11}/> Add Master Item
                          </button>
                        </div>
                        
                        <div className="p-4 space-y-3">
                          {(ev.invoiceItems || []).map((inv: any) => (
                            <div key={inv.id} className="flex gap-2 items-center">
                              <input type="text" placeholder="Item Name (e.g. Adult Jersey)" value={inv.desc} onChange={e => updateInvoiceItem(ev.id, inv.id, 'desc', e.target.value)} className="flex-grow bg-slate-50 border border-slate-100 p-2 rounded-xl text-xs font-semibold focus:outline-none"/>
                              <input type="number" placeholder="Qty" value={inv.qty} onChange={e => updateInvoiceItem(ev.id, inv.id, 'qty', e.target.value)} className="w-16 bg-slate-50 border border-slate-100 p-2 rounded-xl text-xs font-semibold text-center focus:outline-none"/>
                              <input type="number" placeholder="Price/ea" value={inv.price} onChange={e => updateInvoiceItem(ev.id, inv.id, 'price', e.target.value)} className="w-24 bg-slate-50 border border-slate-100 p-2 rounded-xl text-xs font-semibold focus:outline-none"/>
                              <button onClick={() => removeInvoiceItem(ev.id, inv.id)} className="text-slate-300 hover:text-rose-500 p-1"><Trash2 size={15}/></button>
                            </div>
                          ))}

                          <div className="flex flex-wrap sm:flex-nowrap gap-4 border-t border-slate-100 pt-4 mt-2">
                            <div className="flex flex-col w-full sm:w-1/3">
                              <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1 pl-0.5">GST (%)</label>
                              <input type="number" value={ev.gst} onChange={e => updateEvent(ev.id, 'gst', e.target.value)} className="bg-slate-50 border border-slate-100 p-2 rounded-xl text-xs font-semibold focus:outline-none" placeholder="0"/>
                            </div>
                            <div className="flex flex-col w-full sm:w-1/3">
                              <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1 pl-0.5">Discount (MVR)</label>
                              <input type="number" value={ev.discount} onChange={e => updateEvent(ev.id, 'discount', e.target.value)} className="bg-slate-50 border border-slate-100 p-2 rounded-xl text-xs font-semibold focus:outline-none" placeholder="0"/>
                            </div>
                            <div className="flex flex-col w-full sm:w-1/3 justify-end">
                              <button onClick={() => moveUnclaimedToShared(ev.id)} className="w-full h-9 bg-sky-50 text-sky-600 border border-sky-100 rounded-xl font-bold text-[9px] uppercase tracking-wider shadow-sm hover:bg-sky-100 active:scale-95 transition-transform flex items-center justify-center gap-1">
                                <Calculator size={12}/> Add Unclaimed to Shared
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* INVENTORY CHECKER */}
                        {(ev.invoiceItems || []).length > 0 && (
                          <div className="bg-amber-50/30 p-4 border-t border-amber-100/50">
                            <h5 className="text-[9px] font-bold uppercase tracking-wider text-amber-600 mb-2.5">Inventory Balance Checker</h5>
                            <div className="space-y-2">
                              {ev.invoiceItems.map((inv: any) => {
                                const claimed = ev.participants.reduce((sum: number, p: any) => sum + (p.items || []).filter((i: any) => i.desc.trim().toLowerCase() === inv.desc.trim().toLowerCase()).reduce((s: number, i: any) => s + (parseFloat(i.qty) || 1), 0), 0);
                                const remaining = (parseFloat(inv.qty) || 0) - claimed;
                                return (
                                  <div key={inv.id} className="flex justify-between items-center text-xs font-semibold text-slate-700 bg-white p-2.5 rounded-lg shadow-sm border border-slate-100">
                                    <span>{inv.desc || "Unnamed Item"} (Total: {inv.qty || 0})</span>
                                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${remaining < 0 ? 'bg-rose-50 text-rose-600' : remaining === 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                                      {remaining === 0 ? 'All Claimed ✅' : remaining < 0 ? `Over-claimed by ${Math.abs(remaining)}` : `${remaining} left`}
                                    </span>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <div className="flex flex-col">
                          <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1 pl-0.5">Event Title</label>
                          <input type="text" value={ev.title} onChange={e => updateEvent(ev.id, 'title', e.target.value)} className="bg-white border border-slate-200 p-2.5 rounded-xl text-xs font-semibold focus:outline-none"/>
                        </div>
                        <div className="flex flex-col">
                          <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1 pl-0.5">Date</label>
                          <input type="date" value={ev.date} onChange={e => updateEvent(ev.id, 'date', e.target.value)} className="bg-white border border-slate-200 p-2.5 rounded-xl text-xs font-semibold focus:outline-none"/>
                        </div>
                        <div className="flex gap-2">
                          <div className="flex flex-col w-1/2">
                            <label className="text-[9px] font-bold uppercase tracking-wider text-sky-600 mb-1 pl-0.5">Shared Items</label>
                            <input type="number" value={ev.totalBill} onChange={e => updateEvent(ev.id, 'totalBill', e.target.value)} className="bg-white border border-slate-200 p-2.5 rounded-xl text-xs font-semibold focus:outline-none text-sky-600" placeholder="0"/>
                          </div>
                          <div className="flex flex-col w-1/2">
                            <label className="text-[9px] font-bold uppercase tracking-wider text-amber-600 mb-1 pl-0.5">Delivery/Fees</label>
                            <input type="number" value={ev.delivery} onChange={e => updateEvent(ev.id, 'delivery', e.target.value)} className="bg-white border border-slate-200 p-2.5 rounded-xl text-xs font-semibold focus:outline-none text-amber-600" placeholder="0"/>
                          </div>
                        </div>
                      </div>

                      {/* PARTICIPANT ENTRY CARDS */}
                      <div className="bg-white rounded-xl border border-slate-200/60 overflow-hidden mb-6">
                        <div className="flex justify-between items-center p-3.5 border-b border-slate-100 bg-slate-50">
                          <h4 className="text-[10px] font-bold uppercase text-slate-700 tracking-wider">Participants</h4>
                          <button onClick={() => addParticipant(ev.id)} className="text-sky-600 bg-sky-50 font-bold text-[9px] uppercase flex items-center gap-0.5 px-2.5 py-1.5 rounded-lg border border-sky-100 active:scale-95 transition-transform">
                            <Plus size={11}/> Add Person
                          </button>
                        </div>
                        
                        <div className="divide-y divide-slate-100">
                          {ev.participants.map((p: any) => {
                            const share = calculateShare(ev, p);
                            return (
                              <div key={p.id} className="p-4 flex flex-col gap-3">
                                <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                                  <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-400 flex-shrink-0">P</div>
                                  
                                  <div className="relative flex-grow min-w-[80px]">
                                    <input 
                                      type="text" 
                                      placeholder="Name" 
                                      value={p.name} 
                                      onChange={e => {
                                        updateParticipant(ev.id, p.id, "name", e.target.value);
                                        setFocusedParticipantId(p.id);
                                      }} 
                                      onFocus={() => setFocusedParticipantId(p.id)}
                                      onBlur={() => setTimeout(() => setFocusedParticipantId(null), 200)}
                                      className="w-full bg-transparent border-none focus:outline-none font-bold text-sm p-0"
                                    />
                                    {focusedParticipantId === p.id && directory.length > 0 && (
                                      <div className="absolute top-full left-0 mt-2 w-48 bg-white border border-slate-200 shadow-xl rounded-xl z-50 max-h-48 overflow-y-auto">
                                        {directory.filter(user => user.name.toLowerCase().includes(p.name.toLowerCase()) || user.nickname.toLowerCase().includes(p.name.toLowerCase())).map(user => (
                                          <div 
                                            key={user.id} 
                                            className="p-3 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0"
                                            onClick={() => {
                                              updateParticipant(ev.id, p.id, "name", user.name);
                                              setFocusedParticipantId(null);
                                            }}
                                          >
                                            <p className="text-xs font-bold text-slate-800">{user.name}</p>
                                            {user.nickname && <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">{user.nickname}</p>}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                  
                                  <div className="w-20 text-right font-extrabold text-sm text-slate-800 mr-2">
                                    <span className="text-[9px] text-slate-400 mr-0.5 font-bold">MVR</span>{share.toFixed(0)}
                                  </div>

                                  <button 
                                    onClick={() => updateParticipant(ev.id, p.id, "hasPaid", !p.hasPaid)}
                                    className={`px-2 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-colors w-16 text-center ${p.hasPaid ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-amber-50 text-amber-600 border border-amber-100 hover:bg-amber-100'}`}
                                  >
                                    {p.hasPaid ? 'Paid' : 'Pending'}
                                  </button>
                                  
                                  <button onClick={() => removeParticipant(ev.id, p.id)} className="text-slate-300 hover:text-rose-500 p-1"><Trash2 size={15}/></button>
                                </div>

                                <div className="pl-8 flex gap-2">
                                  <button 
                                    onClick={() => updateParticipant(ev.id, p.id, "paysMain", p.paysMain === false ? true : false)}
                                    className={`px-2 py-0.5 rounded-md text-[8px] font-bold uppercase tracking-wider transition-colors text-center ${p.paysMain !== false ? 'bg-sky-50 text-sky-600' : 'bg-slate-100 text-slate-400 line-through'}`}
                                  >
                                    {p.paysMain !== false ? 'Bill: Yes' : 'Bill: No'}
                                  </button>
                                  <button 
                                    onClick={() => updateParticipant(ev.id, p.id, "paysDelivery", p.paysDelivery === false ? true : false)}
                                    className={`px-2 py-0.5 rounded-md text-[8px] font-bold uppercase tracking-wider transition-colors text-center ${p.paysDelivery !== false ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-400 line-through'}`}
                                  >
                                    {p.paysDelivery !== false ? 'Deliv: Yes' : 'Deliv: No'}
                                  </button>
                                </div>

                                <div className="pl-8 pr-1 space-y-2 mt-1">
                                  {(p.items || []).map((item: any) => (
                                    <div key={item.id} className="flex items-center gap-2">
                                      <input 
                                        type="text" 
                                        placeholder="Item Name" 
                                        maxLength={18}
                                        list={`master-items-${ev.id}`}
                                        value={item.desc} 
                                        onChange={e => updateParticipantItem(ev.id, p.id, item.id, "desc", e.target.value)} 
                                        className="flex-grow bg-slate-50 rounded-lg border border-slate-100 focus:outline-none text-xs font-semibold p-1.5" 
                                      />
                                      <input 
                                        type="number" 
                                        placeholder="Qty" 
                                        value={item.qty} 
                                        onChange={e => updateParticipantItem(ev.id, p.id, item.id, "qty", e.target.value)} 
                                        className="w-12 bg-slate-50 rounded-lg border border-slate-100 focus:outline-none text-xs font-semibold p-1.5 text-center" 
                                      />
                                      <input 
                                        type="number" 
                                        placeholder="Price/ea" 
                                        value={item.price} 
                                        onChange={e => updateParticipantItem(ev.id, p.id, item.id, "price", e.target.value)} 
                                        className="w-16 bg-slate-50 rounded-lg border border-slate-100 focus:outline-none text-xs font-semibold p-1.5 text-center" 
                                      />
                                      <button onClick={() => removeParticipantItem(ev.id, p.id, item.id)} className="text-slate-300 hover:text-rose-500 p-1"><X size={13}/></button>
                                    </div>
                                  ))}
                                  
                                  <datalist id={`master-items-${ev.id}`}>
                                    {(ev.invoiceItems || []).map((inv: any) => (
                                      <option key={inv.id} value={inv.desc} />
                                    ))}
                                  </datalist>

                                  <button onClick={() => addParticipantItem(ev.id, p.id)} className="text-slate-400 font-bold text-[9px] uppercase tracking-wider flex items-center gap-0.5 mt-1 hover:text-slate-700">
                                    <Plus size={9}/> Add Personal Item
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="flex flex-wrap sm:flex-nowrap justify-between items-center gap-4">
                        <button onClick={() => deleteEvent(ev.id)} className="text-rose-500 text-[10px] font-bold uppercase flex items-center gap-0.5 hover:text-rose-700">
                          <Trash2 size={13}/> Delete Event
                        </button>
                        <button onClick={() => saveEvent(ev.id)} className="w-full sm:w-auto h-10 px-6 rounded-xl bg-slate-900 text-white font-semibold text-xs uppercase tracking-wider shadow-sm active:scale-95 transition-all">
                          Save Event
                        </button>
                      </div>

                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 2026 LIGHT PORTABLE BOTTOM NAV FOR MOBILE HUB */}
        <nav className="lg:hidden fixed bottom-5 left-1/2 -translate-x-1/2 w-[92%] max-w-[360px] h-14 bg-white/90 border border-slate-200/60 shadow-[0_8px_30px_rgba(0,0,0,0.06)] rounded-xl flex justify-around items-center px-2 z-[100] backdrop-blur-md">
          <Link href="/" className="text-slate-400 hover:text-slate-800 transition-colors active:scale-95"><Wallet size={18} /></Link>
          <Link href="/tracker" className="text-slate-400 hover:text-slate-800 transition-colors active:scale-95"><Banknote size={18} /></Link>
          <Link href="/splitter" className="text-slate-900 transition-transform duration-200 active:scale-95"><Calculator size={18} className="bg-slate-100 p-2 w-8 h-8 rounded-lg" /></Link>
          <Link href="/shop-clearing" className="text-slate-400 hover:text-slate-800 transition-colors active:scale-95"><ShoppingCart size={18} /></Link>
          <Link href="/myself" className="text-slate-400 hover:text-slate-800 transition-colors active:scale-95"><User size={18} /></Link>
        </nav>
      </div>

      {showBankModal && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs z-[300] flex justify-center items-end sm:items-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-t-2xl sm:rounded-2xl p-5 shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-bold tracking-tight text-slate-900">Set MVR Bank Account</h3>
              <button onClick={() => setShowBankModal(false)} className="bg-slate-50 p-1.5 rounded-full text-slate-400 hover:bg-slate-100"><X size={15}/></button>
            </div>
            <p className="text-xs text-slate-400 mb-4">Account metadata bound directly onto active WhatsApp invoices.</p>
            <div className="space-y-2.5 mb-5">
              <input type="text" placeholder="Bank Name (e.g. BML MVR)" value={mvrBankName} onChange={e => setMvrBankName(e.target.value)} className="w-full bg-slate-50 border border-slate-100 p-3 rounded-xl text-xs font-semibold focus:outline-none" />
              <input type="text" placeholder="Account Number" value={mvrBankNo} onChange={e => setMvrBankNo(e.target.value)} className="w-full bg-slate-50 border border-slate-100 p-3 rounded-xl text-xs font-semibold focus:outline-none" />
            </div>
            <button onClick={saveMvrBank} className="w-full bg-slate-900 text-white p-3 rounded-xl font-bold text-xs uppercase tracking-wider shadow-sm active:scale-95 transition-transform">Save Bank</button>
          </div>
        </div>
      )}

      {showDirModal && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs z-[300] flex justify-center items-end sm:items-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-t-2xl sm:rounded-2xl p-5 shadow-2xl flex flex-col max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-base font-bold tracking-tight text-slate-900">User Directory</h3>
              <div className="flex items-center gap-2">
                <button onClick={() => setIsMerging(!isMerging)} className={`text-[9px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-xl transition-colors ${isMerging ? 'bg-amber-50 text-amber-600 border border-amber-100' : 'bg-slate-50 text-slate-500 border border-slate-100'}`}>
                  {isMerging ? 'Cancel Merge' : 'Merge Users'}
                </button>
                <button onClick={() => setShowDirModal(false)} className="bg-slate-50 p-1.5 rounded-full text-slate-400 hover:bg-slate-100"><X size={15}/></button>
              </div>
            </div>
            
            {isMerging && (
              <div className="mb-5 bg-amber-50/50 border border-amber-100 p-4 rounded-xl">
                <h4 className="text-[10px] font-bold text-amber-700 uppercase tracking-wider mb-2.5">Merge Duplicate Profile Links</h4>
                <div className="flex flex-col gap-2 mb-4">
                  <select value={mergeSourceId} onChange={e => setMergeSourceId(e.target.value)} className="w-full bg-white border border-slate-200 p-2 rounded-xl text-xs font-semibold focus:outline-none">
                    <option value="">Select User to REMOVE...</option>
                    {directory.map(d => <option key={`src-${d.id}`} value={d.id}>{d.name}</option>)}
                  </select>
                  <div className="text-center text-amber-500 font-bold text-[9px] uppercase tracking-widest">Merge History Into</div>
                  <select value={mergeTargetId} onChange={e => setMergeTargetId(e.target.value)} className="w-full bg-white border border-slate-200 p-2 rounded-xl text-xs font-semibold focus:outline-none">
                    <option value="">Select User to KEEP...</option>
                    {directory.map(d => <option key={`tgt-${d.id}`} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <button onClick={handleMergeUsers} className="w-full bg-amber-600 text-white p-2.5 rounded-xl font-bold text-[10px] uppercase tracking-wider shadow-sm active:scale-95 transition-transform">
                  Confirm & Sync Parameters
                </button>
              </div>
            )}
            
            <div className="flex gap-1.5 mb-4">
              <input placeholder="Full Name" value={dirName} onChange={e => setDirName(e.target.value)} className="flex-grow bg-slate-50 border border-slate-100 p-2.5 rounded-xl text-xs font-semibold focus:outline-none" />
              <input placeholder="Nickname" value={dirNick} onChange={e => setDirNick(e.target.value)} className="w-1/3 bg-slate-50 border border-slate-100 p-2.5 rounded-xl text-xs font-semibold focus:outline-none" />
              <button onClick={saveToDirectory} className="bg-slate-900 text-white px-3.5 rounded-xl font-bold hover:bg-slate-800 transition-colors flex items-center justify-center shadow-sm">
                {editingDirId ? <CheckCircle2 size={16}/> : <Plus size={16}/>}
              </button>
              {editingDirId && (
                <button onClick={() => { setEditingDirId(null); setDirName(""); setDirNick(""); }} className="bg-slate-100 text-slate-500 px-3.5 rounded-xl font-bold hover:bg-slate-200 transition-colors">
                  <X size={16}/>
                </button>
              )}
            </div>
            
            <button onClick={extractUsers} className="w-full bg-sky-50 text-sky-600 p-2.5 rounded-xl font-bold text-[10px] uppercase tracking-wider mb-5 border border-sky-100 hover:bg-sky-100 transition-colors">
              Auto-Extract from Unlinked Logs
            </button>

            <div className="space-y-2 flex-grow overflow-y-auto">
              {directory.map(user => (
                <div key={user.id} className="flex justify-between items-center p-3 bg-slate-50/70 rounded-xl border border-slate-100">
                  <div>
                    <p className="font-bold text-slate-800 text-xs">{user.name}</p>
                    {user.nickname && <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">{user.nickname}</p>}
                  </div>
                  <div className="flex items-center">
                    <button onClick={() => { setDirName(user.name); setDirNick(user.nickname); setEditingDirId(user.id); }} className="text-slate-400 hover:text-sky-600 p-1.5 rounded-full hover:bg-white transition-colors"><Edit2 size={14}/></button>
                    <button onClick={() => deleteFromDirectory(user.id)} className="text-slate-400 hover:text-rose-500 p-1.5 rounded-full hover:bg-white transition-colors"><Trash2 size={14}/></button>
                  </div>
                </div>
              ))}
              {directory.length === 0 && (
                <div className="text-center py-6 text-slate-400 font-semibold text-xs">
                  Directory database index is clear.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}