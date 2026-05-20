"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { 
  Utensils, Navigation, Plus, X, Trash2, Wallet, 
  ShoppingCart, ReceiptText, Calculator, Settings, 
  PieChart, CheckCircle2, AlertCircle, ChevronDown, ChevronUp, Send, User, Landmark, Banknote, Users, Edit2, Package
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

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    async function fetchData() {
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

      // Load Directory directly from Supabase
      if (dirRes.data && Array.isArray(dirRes.data)) {
        setDirectory(dirRes.data);
      }
    }
    fetchData();

    // Load Local Banks and Statuses
    const savedBankName = localStorage.getItem("lextrack_mvr_bank_name");
    const savedBankNo = localStorage.getItem("lextrack_mvr_bank_no");
    if (savedBankName) setMvrBankName(savedBankName);
    if (savedBankNo) setMvrBankNo(savedBankNo);

    const savedStatuses = localStorage.getItem("lextrack_shared_statuses");
    if (savedStatuses) setSharedStatuses(JSON.parse(savedStatuses));
  }, []);

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
    
    // Hard refresh to fully sync the updated JSON arrays and recalcs perfectly
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

  const markAsPaidFromTile = async (eventId: string, participantId: string) => {
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

  // --- REBUILT MATH ENGINE (PRO-RATA GST/DISCOUNT & ISOLATED SHARED ITEMS) ---
  const calculateShare = (event: any, participant: any) => {
    let subtotal = 0;

    // 1. Personal Items Subtotal
    subtotal += (participant.items || []).reduce((sum: number, item: any) => sum + ((parseFloat(item.price) || 0) * (parseFloat(item.qty) || 1)), 0);

    // 2. Extra Shared Amount (from the explicit totalBill field)
    const mainCount = Math.max(1, event.participants.filter((p: any) => p.paysMain !== false).length);
    if (participant.paysMain !== false) {
      const sharedNum = parseFloat(event.totalBill) || 0;
      subtotal += (sharedNum / mainCount);
    }

    // 3. Apply GST to their specific portion
    const gstPercent = parseFloat(event.gst) || 0;
    const gstAmount = subtotal * (gstPercent / 100);
    let total = subtotal + gstAmount;

    // 4. Delivery Fee (Usually no GST on delivery)
    if (participant.paysDelivery !== false) {
      const devCount = Math.max(1, event.participants.filter((p: any) => p.paysDelivery !== false).length);
      const deliveryNum = parseFloat(event.delivery) || 0;
      total += (deliveryNum / devCount);
    }

    // 5. Discount (Split equally among main payers)
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

          // Calculate precise breakdown for WA invoice
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

    return Object.values(personMap).sort((a, b) => b.totalOwed - a.totalOwed);
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
            msg += `   └ ${item.desc || "Item"} (x${item.qty || 1}): ${((parseFloat(item.price)||0)*(parseFloat(item.qty)||1)).toFixed(2)}\n`;
          }
        });

        if (d.sharedSubtotal > 0) msg += `   └ Shared Items: ${d.sharedSubtotal.toFixed(2)}\n`;
        if (d.gstAmount > 0) msg += `   └ GST (${d.gstPercent}%): +${d.gstAmount.toFixed(2)}\n`;
        if (d.deliverySplit > 0) msg += `   └ Delivery Fee: +${d.deliverySplit.toFixed(2)}\n`;
        if (d.discountShare > 0) msg += `   └ Discount: -${d.discountShare.toFixed(2)}\n`;

        if (d.share === 0 && d.items.length === 0) {
          msg += `   └ (Exempt from Event)\n`;
        }
        
        msg += `   Subtotal: ${d.share.toFixed(2)} MVR\n\n`;
      });
    }

    const charges = personAdjs.filter(a => a.type === 'charge');
    const payments = personAdjs.filter(a => a.type === 'payment');

    if (charges.length > 0 || payments.length > 0) {
      msg += `*Adjustments:*\n`;
      charges.forEach((item: any) => {
        if (item.desc_text || item.amount) msg += `   └ ${item.desc_text || "Debt"}: +${item.amount || 0} MVR\n`;
      });
      payments.forEach((item: any) => {
        if (item.desc_text || item.amount) msg += `   └ ${item.desc_text || "Payment"}: -${item.amount || 0} MVR\n`;
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

  // --- GLOBAL TOTALS ENGINE (Includes Payments & Debts) ---
  let globalTotalOwed = 0;
  let globalTotalCollected = 0;

  events.forEach(ev => {
    ev.participants.forEach((p: any) => {
      const key = p.name?.trim().toLowerCase();
      // EXCLUDE YAMIN
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
    <main className="min-h-screen bg-[#F0F4F8] text-[#364d54] font-sans flex relative">

      {toast && (
        <div className={`fixed top-6 right-1/2 translate-x-1/2 lg:translate-x-0 lg:right-6 z-[400] px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 text-sm font-bold animate-in fade-in slide-in-from-top-5 duration-300 ${toast.type === 'success' ? 'bg-[#3a5b5e] text-white' : 'bg-red-500 text-white'}`}>
          {toast.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
          {toast.message}
        </div>
      )}

      <aside className="hidden lg:flex w-72 bg-white border-r border-[#E0E7E9] flex-col p-8 sticky top-0 h-screen shrink-0 z-40">
        <div className="mb-12">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#5fa4ad] mb-1">LexCorp Systems</p>
          <h1 className="text-2xl font-black tracking-tighter uppercase">Lextrack</h1>
        </div>
        <nav className="space-y-3 flex-grow">
          <Link href="/" className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-sm font-bold hover:bg-[#F8FAFB] text-[#A0AEC0] transition-all"><Wallet size={20}/> Dashboard</Link>
          <Link href="/tracker" className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-sm font-bold hover:bg-[#F8FAFB] text-[#A0AEC0] transition-all"><Banknote size={20}/> Tracker</Link>
          <Link href="/splitter" className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-sm font-bold bg-[#3a5b5e] text-white shadow-lg transition-all"><Calculator size={20}/> Splitter</Link>
          <Link href="/shop-clearing" className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-sm font-bold hover:bg-[#F8FAFB] text-[#A0AEC0] transition-all"><ShoppingCart size={20}/> Clearing</Link>
          <Link href="/analytics" className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-sm font-bold hover:bg-[#F8FAFB] text-[#A0AEC0] transition-all"><PieChart size={20}/> Analytics</Link>
        </nav>
      </aside>

      <div className="flex-grow flex flex-col min-h-screen overflow-y-auto">
        <div className="w-full max-w-[1200px] mx-auto px-4 lg:px-8 py-6 lg:py-10 pb-40">
          
          <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <div>
              <h2 className="text-2xl lg:text-3xl font-black tracking-tight">Split Ledger</h2>
              <p className="text-[10px] font-bold text-[#A0AEC0] uppercase tracking-widest mt-1">Universal Group Splitter</p>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <button onClick={() => setShowDirModal(true)} className="flex-1 sm:flex-none h-12 px-4 rounded-2xl bg-white border border-[#E0E7E9] text-[#364d54] font-black text-xs uppercase tracking-widest shadow-sm flex items-center justify-center gap-2 active:scale-95 transition-transform">
                <Users size={16}/> Directory
              </button>
              <button onClick={() => setShowBankModal(true)} className="flex-1 sm:flex-none h-12 px-4 rounded-2xl bg-white border border-[#E0E7E9] text-[#364d54] font-black text-xs uppercase tracking-widest shadow-sm flex items-center justify-center gap-2 active:scale-95 transition-transform">
                <Landmark size={16}/> MVR Bank
              </button>
              <button onClick={createNewEvent} className="flex-1 sm:flex-none h-12 px-6 rounded-2xl bg-[#3a5b5e] text-white font-black text-xs uppercase tracking-widest shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-transform">
                <Plus size={16}/> New Split
              </button>
            </div>
          </header>

          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-white p-6 rounded-[2rem] border border-[#E0E7E9] shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-widest text-[#A0AEC0] mb-2">Total Pending Owed</p>
              <p className="text-3xl font-black text-orange-500">MVR {globalTotalOwed.toFixed(0)}</p>
            </div>
            <div className="bg-[#3a5b5e] p-6 rounded-[2rem] shadow-xl text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -mr-10 -mt-10" />
              <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-2">Total Collected</p>
              <p className="text-3xl font-black text-green-300">MVR {globalTotalCollected.toFixed(0)}</p>
            </div>
          </div>

          {/* CONSOLIDATED PENDING BY PERSON */}
          {pendingPeople.length > 0 && (
            <div className="mb-10">
              <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-[#A0AEC0] mb-4 pl-2">Pending By Person</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {pendingPeople.map((person, idx) => {
                  const personKey = person.name.trim().toLowerCase();
                  
                  const personAdjs = safeAdjustments.filter(a => a.person_name === personKey);
                  const chargeTotal = personAdjs.filter(a => a.type === 'charge').reduce((s, a) => s + (parseFloat(a.amount) || 0), 0);
                  const paymentTotal = personAdjs.filter(a => a.type === 'payment').reduce((s, a) => s + (parseFloat(a.amount) || 0), 0);
                  
                  const finalTotal = person.totalOwed + chargeTotal - paymentTotal;
                  const isShared = sharedStatuses[personKey] === finalTotal;

                  return (
                    <div key={idx} className="bg-white p-5 rounded-[2rem] border border-orange-100 shadow-sm flex flex-col justify-between">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <User size={16} className="text-[#A0AEC0]"/>
                            <h4 className="font-black text-[#364d54] text-lg truncate">{person.name}</h4>
                          </div>
                          <p className="text-[10px] font-bold text-orange-400 uppercase tracking-widest">{person.details.length} pending event(s)</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[9px] font-black uppercase text-[#A0AEC0]">Total Due</p>
                          <p className="font-black text-orange-500 text-lg">MVR {finalTotal.toFixed(0)}</p>
                        </div>
                      </div>

                      <button onClick={() => setExpandedPerson(expandedPerson === personKey ? null : personKey)} className="text-[10px] font-bold text-[#5fa4ad] mb-3 flex items-center gap-1 uppercase tracking-widest active:scale-95 transition-transform">
                        {expandedPerson === personKey ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
                        {expandedPerson === personKey ? "Hide Details" : "View Details"}
                      </button>

                      {expandedPerson === personKey && (
                        <div className="mb-4 bg-gray-50 p-3 rounded-xl border border-gray-100 space-y-3">
                          {person.details.map((d: any, dIdx: number) => (
                            <div key={dIdx} className="flex justify-between items-center border-b border-gray-100 pb-2 last:border-0 last:pb-0">
                              <div>
                                <p className="font-bold text-[11px] text-[#364d54] uppercase">{d.title}</p>
                                <p className="text-[9px] text-[#A0AEC0] font-black">{d.date}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="font-black text-orange-500 text-xs">MVR {d.share.toFixed(0)}</span>
                                <button 
                                  onClick={() => markAsPaidFromTile(d.eventId, d.participantId)}
                                  className="bg-green-100 text-green-600 px-2 py-1.5 rounded-lg font-black text-[9px] uppercase tracking-widest hover:bg-green-200 active:scale-95 transition-transform"
                                >
                                  Pay
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="mb-4 bg-gray-50 p-3 rounded-xl border border-gray-100">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-[9px] font-black uppercase tracking-widest text-[#A0AEC0]">Adjustments</span>
                          <button onClick={() => addAdjustment(person.name)} className="text-[#5fa4ad] flex items-center gap-1 text-[9px] font-black uppercase tracking-widest active:scale-95 transition-transform"><Plus size={10}/> Add</button>
                        </div>
                        <div className="space-y-2">
                          {personAdjs.map(adj => (
                            <div key={adj.id} className="flex gap-2 animate-in fade-in">
                              <select 
                                value={adj.type} 
                                onChange={e => {
                                  updateAdjustmentLocal(adj.id, 'type', e.target.value);
                                  saveAdjustmentDB(adj.id, 'type', e.target.value);
                                }} 
                                className={`w-24 border border-[#E0E7E9] rounded-lg p-2 text-[10px] font-black uppercase tracking-widest focus:ring-1 focus:ring-orange-300 ${adj.type === 'payment' ? 'bg-green-50 text-green-600' : 'bg-orange-50 text-orange-600'}`}
                              >
                                <option value="charge">+ Debt</option>
                                <option value="payment">- Recv</option>
                              </select>
                              <input 
                                placeholder={adj.type === 'payment' ? "Bank Trf" : "Old Debt"} 
                                value={adj.desc_text || ''} 
                                onChange={e => updateAdjustmentLocal(adj.id, 'desc_text', e.target.value)} 
                                onBlur={e => saveAdjustmentDB(adj.id, 'desc_text', e.target.value)}
                                className="flex-grow w-full bg-white border border-[#E0E7E9] rounded-lg p-2 text-xs font-bold focus:ring-1 focus:ring-orange-300" 
                              />
                              <input 
                                placeholder="MVR" 
                                type="number" 
                                value={adj.amount} 
                                onChange={e => updateAdjustmentLocal(adj.id, 'amount', e.target.value)} 
                                onBlur={e => saveAdjustmentDB(adj.id, 'amount', e.target.value)}
                                className="w-20 bg-white border border-[#E0E7E9] rounded-lg p-2 text-xs font-bold text-center focus:ring-1 focus:ring-orange-300" 
                              />
                              <button onClick={() => removeAdjustmentDB(adj.id)} className="text-gray-300 hover:text-red-400"><Trash2 size={14}/></button>
                            </div>
                          ))}
                        </div>
                      </div>

                      <button 
                        onClick={() => sendPersonalInvoice(person, personAdjs, finalTotal)} 
                        className={`w-full py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-colors flex justify-center items-center gap-2 ${isShared ? 'bg-green-100 text-green-600 hover:bg-green-200' : 'bg-[#e0f2fe] text-[#0284c7] hover:bg-[#bae6fd]'}`}
                      >
                        {isShared ? <><CheckCircle2 size={14}/> Shared ✅</> : <><Send size={14}/> Send WA Invoice</>}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-[#A0AEC0] mb-4 pl-2">Events Ledger</h3>
          
          <div className="space-y-4">
            {events.length === 0 && (
              <div className="text-center py-20 bg-white rounded-[2rem] border border-dashed border-[#A0AEC0]">
                <Calculator size={48} className="mx-auto text-[#E0E7E9] mb-4" />
                <p className="font-bold text-[#A0AEC0]">No splits recorded yet.</p>
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
                <div key={ev.id} className={`bg-white rounded-[2rem] border border-[#E0E7E9] shadow-sm transition-all duration-300 ${isExpanded ? 'ring-2 ring-[#5fa4ad]/20' : ''}`}>
                  
                  <div className="p-5 flex items-center justify-between cursor-pointer" onClick={() => setExpanded(prev => ({...prev, [ev.id]: !isExpanded}))}>
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-sm bg-[#5fa4ad]">
                        <Calculator size={20}/>
                      </div>
                      <div>
                        <h3 className="font-black text-lg text-[#364d54]">{ev.title}</h3>
                        <p className="text-[10px] font-bold text-[#A0AEC0] uppercase tracking-widest">{ev.date} • {ev.participants.length} People</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-6">
                      <div className="hidden sm:block text-right">
                        <p className="text-[10px] font-black uppercase text-[#A0AEC0]">Total / Collected</p>
                        <p className={`font-black text-sm ${isFullyPaid ? 'text-green-500' : 'text-[#364d54]'}`}>
                          {collected.toFixed(0)} / {eventTotal.toFixed(0)}
                        </p>
                      </div>
                      <div className="text-[#A0AEC0]">
                        {isExpanded ? <ChevronUp size={24}/> : <ChevronDown size={24}/>}
                      </div>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="p-5 border-t border-[#E0E7E9] bg-[#F8FAFB] rounded-b-[2rem]">
                      
                      {/* MASTER INVOICE SECTION */}
                      <div className="bg-white rounded-2xl border border-[#E0E7E9] overflow-hidden mb-6 shadow-sm">
                        <div className="flex justify-between items-center p-4 border-b border-[#E0E7E9] bg-[#F0F4F8]">
                          <div className="flex items-center gap-2">
                            <Package size={16} className="text-[#5fa4ad]"/>
                            <h4 className="text-[10px] font-black uppercase text-[#364d54] tracking-widest">Master Invoice</h4>
                            <span className="ml-2 text-[9px] font-black text-[#5fa4ad] bg-white px-2 py-1 rounded-md border border-[#E0E7E9]">Grand Total: {masterGrandTotal.toFixed(2)} MVR</span>
                          </div>
                          <button onClick={() => addInvoiceItem(ev.id)} className="text-[#5fa4ad] font-bold text-[10px] uppercase flex items-center gap-1 bg-white px-3 py-1.5 rounded-lg active:scale-95 transition-transform border border-[#E0E7E9]">
                            <Plus size={12}/> Add Master Item
                          </button>
                        </div>
                        
                        <div className="p-4 space-y-3">
                          {(ev.invoiceItems || []).map((inv: any) => (
                            <div key={inv.id} className="flex gap-2 items-center">
                              <input type="text" placeholder="Item Name (e.g. Adult Jersey)" value={inv.desc} onChange={e => updateInvoiceItem(ev.id, inv.id, 'desc', e.target.value)} className="flex-grow bg-gray-50 border-none p-3 rounded-xl text-sm font-bold focus:ring-2 focus:ring-[#5fa4ad]"/>
                              <input type="number" placeholder="Qty" value={inv.qty} onChange={e => updateInvoiceItem(ev.id, inv.id, 'qty', e.target.value)} className="w-20 bg-gray-50 border-none p-3 rounded-xl text-sm font-bold text-center focus:ring-2 focus:ring-[#5fa4ad]"/>
                              <input type="number" placeholder="Price/ea" value={inv.price} onChange={e => updateInvoiceItem(ev.id, inv.id, 'price', e.target.value)} className="w-28 bg-gray-50 border-none p-3 rounded-xl text-sm font-bold focus:ring-2 focus:ring-[#5fa4ad]"/>
                              <button onClick={() => removeInvoiceItem(ev.id, inv.id)} className="text-gray-300 hover:text-red-400 p-2"><Trash2 size={16}/></button>
                            </div>
                          ))}

                          <div className="flex flex-wrap sm:flex-nowrap gap-4 border-t border-[#E0E7E9] pt-4 mt-2">
                            <div className="flex flex-col w-full sm:w-1/3">
                              <label className="text-[9px] font-black uppercase tracking-widest text-[#A0AEC0] mb-1 pl-1">GST (%)</label>
                              <input type="number" value={ev.gst} onChange={e => updateEvent(ev.id, 'gst', e.target.value)} className="bg-gray-50 border-none p-3 rounded-xl font-bold focus:ring-2 focus:ring-[#5fa4ad]" placeholder="0"/>
                            </div>
                            <div className="flex flex-col w-full sm:w-1/3">
                              <label className="text-[9px] font-black uppercase tracking-widest text-[#A0AEC0] mb-1 pl-1">Discount (MVR)</label>
                              <input type="number" value={ev.discount} onChange={e => updateEvent(ev.id, 'discount', e.target.value)} className="bg-gray-50 border-none p-3 rounded-xl font-bold focus:ring-2 focus:ring-[#5fa4ad]" placeholder="0"/>
                            </div>
                            <div className="flex flex-col w-full sm:w-1/3 justify-end">
                              <button onClick={() => moveUnclaimedToShared(ev.id)} className="w-full h-[44px] bg-[#e0f2fe] text-[#0284c7] border border-blue-100 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-sm hover:bg-blue-100 active:scale-95 transition-transform flex items-center justify-center gap-2">
                                <Calculator size={14}/> Add Unclaimed to Shared
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* BALANCE CHECKER */}
                        {(ev.invoiceItems || []).length > 0 && (
                          <div className="bg-orange-50/50 p-4 border-t border-orange-100/50">
                            <h5 className="text-[9px] font-black uppercase tracking-widest text-orange-500 mb-3">Inventory Balance Checker</h5>
                            <div className="space-y-2">
                              {ev.invoiceItems.map((inv: any) => {
                                const claimed = ev.participants.reduce((sum: number, p: any) => sum + (p.items || []).filter((i: any) => i.desc.trim().toLowerCase() === inv.desc.trim().toLowerCase()).reduce((s: number, i: any) => s + (parseFloat(i.qty) || 1), 0), 0);
                                const remaining = (parseFloat(inv.qty) || 0) - claimed;
                                return (
                                  <div key={inv.id} className="flex justify-between items-center text-xs font-bold text-[#364d54] bg-white p-2.5 rounded-lg shadow-sm border border-orange-100/50">
                                    <span>{inv.desc || "Unnamed Item"} (Total: {inv.qty || 0})</span>
                                    <span className={`px-2 py-1 rounded-md text-[9px] uppercase tracking-widest ${remaining < 0 ? 'bg-red-100 text-red-600' : remaining === 0 ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'}`}>
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
                          <label className="text-[9px] font-black uppercase tracking-widest text-[#A0AEC0] mb-1 pl-1">Event Title</label>
                          <input type="text" value={ev.title} onChange={e => updateEvent(ev.id, 'title', e.target.value)} className="bg-white border-none p-3 rounded-xl font-bold focus:ring-2 focus:ring-[#5fa4ad]"/>
                        </div>
                        <div className="flex flex-col">
                          <label className="text-[9px] font-black uppercase tracking-widest text-[#A0AEC0] mb-1 pl-1">Date</label>
                          <input type="date" value={ev.date} onChange={e => updateEvent(ev.id, 'date', e.target.value)} className="bg-white border-none p-3 rounded-xl font-bold focus:ring-2 focus:ring-[#5fa4ad]"/>
                        </div>
                        
                        <div className="flex gap-2">
                          <div className="flex flex-col w-1/2">
                            <label className="text-[9px] font-black uppercase tracking-widest text-blue-500 mb-1 pl-1">Shared Items (Equally)</label>
                            <input type="number" value={ev.totalBill} onChange={e => updateEvent(ev.id, 'totalBill', e.target.value)} className="bg-white border-none p-3 rounded-xl font-bold focus:ring-2 focus:ring-blue-400 text-blue-600" placeholder="0"/>
                          </div>
                          <div className="flex flex-col w-1/2">
                            <label className="text-[9px] font-black uppercase tracking-widest text-orange-400 mb-1 pl-1">Delivery/Fees (Equally)</label>
                            <input type="number" value={ev.delivery} onChange={e => updateEvent(ev.id, 'delivery', e.target.value)} className="bg-white border-none p-3 rounded-xl font-bold focus:ring-2 focus:ring-orange-400 text-orange-600" placeholder="0"/>
                          </div>
                        </div>
                      </div>

                      <div className="bg-white rounded-2xl border border-[#E0E7E9] overflow-hidden mb-6">
                        <div className="flex justify-between items-center p-4 border-b border-[#E0E7E9] bg-gray-50">
                          <h4 className="text-[10px] font-black uppercase text-[#364d54] tracking-widest">Participants</h4>
                          <button onClick={() => addParticipant(ev.id)} className="text-[#5fa4ad] font-bold text-[10px] uppercase flex items-center gap-1 bg-[#e0f2fe] px-3 py-1.5 rounded-lg active:scale-95 transition-transform">
                            <Plus size={12}/> Add Person
                          </button>
                        </div>
                        
                        <div className="divide-y divide-[#E0E7E9]">
                          {ev.participants.map((p: any) => {
                            const share = calculateShare(ev, p);
                            
                            return (
                              <div key={p.id} className="p-3 flex flex-col gap-3">
                                
                                <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                                  <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-400 flex-shrink-0">P</div>
                                  
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
                                      className="w-full bg-transparent border-none focus:ring-0 font-bold text-sm p-0"
                                    />
                                    {focusedParticipantId === p.id && directory.length > 0 && (
                                      <div className="absolute top-full left-0 mt-2 w-48 bg-white border border-[#E0E7E9] shadow-2xl rounded-xl z-50 max-h-48 overflow-y-auto">
                                        {directory.filter(user => user.name.toLowerCase().includes(p.name.toLowerCase()) || user.nickname.toLowerCase().includes(p.name.toLowerCase())).map(user => (
                                          <div 
                                            key={user.id} 
                                            className="p-3 hover:bg-[#F8FAFB] cursor-pointer border-b border-[#E0E7E9] last:border-0"
                                            onClick={() => {
                                              updateParticipant(ev.id, p.id, "name", user.name);
                                              setFocusedParticipantId(null);
                                            }}
                                          >
                                            <p className="text-sm font-bold text-[#364d54]">{user.name}</p>
                                            {user.nickname && <p className="text-[10px] text-[#A0AEC0] uppercase tracking-widest">{user.nickname}</p>}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                  
                                  <div className="w-16 text-right font-black text-sm text-[#364d54] mr-1">
                                    <span className="text-[9px] text-[#A0AEC0] mr-0.5">MVR</span>{share.toFixed(0)}
                                  </div>

                                  <button 
                                    onClick={() => updateParticipant(ev.id, p.id, "hasPaid", !p.hasPaid)}
                                    className={`px-2 py-2 rounded-lg text-[8px] font-black uppercase tracking-widest transition-colors w-16 text-center ${p.hasPaid ? 'bg-green-100 text-green-600' : 'bg-orange-50 text-orange-500 hover:bg-orange-100'}`}
                                  >
                                    {p.hasPaid ? 'Paid' : 'Pending'}
                                  </button>
                                  
                                  <button onClick={() => removeParticipant(ev.id, p.id)} className="text-red-300 hover:text-red-500 p-1"><Trash2 size={16}/></button>
                                </div>

                                <div className="pl-8 flex gap-2">
                                  <button 
                                    onClick={() => updateParticipant(ev.id, p.id, "paysMain", p.paysMain === false ? true : false)}
                                    className={`px-2 py-1 rounded-md text-[8px] font-black uppercase tracking-widest transition-colors text-center ${p.paysMain !== false ? 'bg-blue-50 text-blue-500' : 'bg-gray-100 text-gray-400 line-through'}`}
                                  >
                                    {p.paysMain !== false ? 'Bill: Yes' : 'Bill: No'}
                                  </button>
                                  
                                  <button 
                                    onClick={() => updateParticipant(ev.id, p.id, "paysDelivery", p.paysDelivery === false ? true : false)}
                                    className={`px-2 py-1 rounded-md text-[8px] font-black uppercase tracking-widest transition-colors text-center ${p.paysDelivery !== false ? 'bg-indigo-50 text-indigo-500' : 'bg-gray-100 text-gray-400 line-through'}`}
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
                                        list={`master-items-${ev.id}`}
                                        value={item.desc} 
                                        onChange={e => updateParticipantItem(ev.id, p.id, item.id, "desc", e.target.value)} 
                                        className="flex-grow bg-gray-50 rounded-lg border-none focus:ring-1 focus:ring-[#5fa4ad] text-xs font-bold p-2" 
                                      />
                                      <input 
                                        type="number" 
                                        placeholder="Qty" 
                                        value={item.qty} 
                                        onChange={e => updateParticipantItem(ev.id, p.id, item.id, "qty", e.target.value)} 
                                        className="w-16 bg-gray-50 rounded-lg border-none focus:ring-1 focus:ring-[#5fa4ad] text-xs font-bold p-2 text-center" 
                                      />
                                      <input 
                                        type="number" 
                                        placeholder="Price/ea" 
                                        value={item.price} 
                                        onChange={e => updateParticipantItem(ev.id, p.id, item.id, "price", e.target.value)} 
                                        className="w-20 bg-gray-50 rounded-lg border-none focus:ring-1 focus:ring-[#5fa4ad] text-xs font-bold p-2 text-center" 
                                      />
                                      <button onClick={() => removeParticipantItem(ev.id, p.id, item.id)} className="text-gray-300 hover:text-red-400 p-1"><X size={14}/></button>
                                    </div>
                                  ))}
                                  
                                  <datalist id={`master-items-${ev.id}`}>
                                    {(ev.invoiceItems || []).map((inv: any) => (
                                      <option key={inv.id} value={inv.desc} />
                                    ))}
                                  </datalist>

                                  <button onClick={() => addParticipantItem(ev.id, p.id)} className="text-[#A0AEC0] font-bold text-[9px] uppercase tracking-widest flex items-center gap-1 mt-1 hover:text-[#5fa4ad]">
                                    <Plus size={10}/> Add Personal Item
                                  </button>
                                </div>

                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="flex flex-wrap sm:flex-nowrap justify-between items-center gap-4">
                        <button onClick={() => deleteEvent(ev.id)} className="text-red-400 text-[10px] font-bold uppercase flex items-center gap-1 hover:text-red-600">
                          <Trash2 size={14}/> Delete Event
                        </button>
                        
                        <div className="flex gap-2 w-full sm:w-auto">
                          <button onClick={() => saveEvent(ev.id)} className="w-full sm:w-auto h-12 px-8 rounded-xl bg-[#3a5b5e] text-white font-black text-[10px] uppercase tracking-widest shadow-md active:scale-95 transition-all">
                            Save Event
                          </button>
                        </div>
                      </div>

                    </div>
                  )}
                </div>
              );
            })}
          </div>

        </div>

        <nav className="lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 w-[95%] max-w-[400px] h-16 bg-white shadow-[0_10px_40px_rgba(0,0,0,0.1)] rounded-full border border-gray-100 flex justify-around items-center px-4 z-[100]">
          <Link href="/" className="text-gray-400 hover:text-[#3a5b5e] transition-colors"><Wallet size={20} /></Link>
          <Link href="/tracker" className="text-gray-400 hover:text-[#3a5b5e] transition-colors"><Banknote size={20} /></Link>
          <Link href="/splitter" className="text-[#3a5b5e]"><Calculator size={24} className="bg-[#e0f2fe] p-1.5 rounded-xl" /></Link>
          <Link href="/shop-clearing" className="text-gray-400 hover:text-[#3a5b5e] transition-colors"><ShoppingCart size={20} /></Link>
          <Link href="/analytics" className="text-gray-400 hover:text-[#3a5b5e] transition-colors"><PieChart size={20} /></Link>
        </nav>
      </div>

      {showBankModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[300] flex justify-center items-end sm:items-center">
          <div className="bg-white w-full max-w-md rounded-t-[2rem] sm:rounded-[2rem] p-6 animate-in slide-in-from-bottom-8">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-black tracking-tight">Set MVR Bank Account</h3>
              <button onClick={() => setShowBankModal(false)} className="bg-gray-100 p-2 rounded-full text-gray-500 hover:bg-gray-200"><X size={16}/></button>
            </div>
            <p className="text-xs text-[#A0AEC0] mb-6">This account will be attached to all MVR Splitter invoices.</p>
            <div className="space-y-3 mb-6">
              <input type="text" placeholder="Bank Name (e.g. BML MVR)" value={mvrBankName} onChange={e => setMvrBankName(e.target.value)} className="w-full bg-gray-50 border-none p-4 rounded-2xl font-bold focus:ring-2 focus:ring-[#5fa4ad]" />
              <input type="text" placeholder="Account Number" value={mvrBankNo} onChange={e => setMvrBankNo(e.target.value)} className="w-full bg-gray-50 border-none p-4 rounded-2xl font-bold focus:ring-2 focus:ring-[#5fa4ad]" />
            </div>
            <button onClick={saveMvrBank} className="w-full bg-[#3a5b5e] text-white p-4 rounded-2xl font-black uppercase tracking-widest shadow-lg active:scale-95 transition-transform">Save Bank</button>
          </div>
        </div>
      )}

      {showDirModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[300] flex justify-center items-end sm:items-center">
          <div className="bg-white w-full max-w-md rounded-t-[2rem] sm:rounded-[2rem] p-6 animate-in slide-in-from-bottom-8 max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-black tracking-tight">User Directory</h3>
              <div className="flex items-center gap-2">
                <button onClick={() => setIsMerging(!isMerging)} className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl transition-colors ${isMerging ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                  {isMerging ? 'Cancel Merge' : 'Merge Users'}
                </button>
                <button onClick={() => setShowDirModal(false)} className="bg-gray-100 p-2 rounded-full text-gray-500 hover:bg-gray-200"><X size={16}/></button>
              </div>
            </div>
            
            {isMerging && (
              <div className="mb-6 bg-orange-50 border border-orange-100 p-4 rounded-2xl">
                <h4 className="text-[10px] font-black text-orange-600 uppercase tracking-widest mb-3">Merge Duplicate Users</h4>
                <div className="flex flex-col gap-2 mb-3">
                  <select value={mergeSourceId} onChange={e => setMergeSourceId(e.target.value)} className="w-full bg-white border border-orange-200 p-2 rounded-xl text-sm font-bold focus:ring-2 focus:ring-orange-400">
                    <option value="">Select User to REMOVE...</option>
                    {directory.map(d => <option key={`src-${d.id}`} value={d.id}>{d.name}</option>)}
                  </select>
                  <div className="text-center text-orange-400 font-bold text-[10px] uppercase tracking-widest">Into</div>
                  <select value={mergeTargetId} onChange={e => setMergeTargetId(e.target.value)} className="w-full bg-white border border-orange-200 p-2 rounded-xl text-sm font-bold focus:ring-2 focus:ring-orange-400">
                    <option value="">Select User to KEEP...</option>
                    {directory.map(d => <option key={`tgt-${d.id}`} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <button onClick={handleMergeUsers} className="w-full bg-orange-500 text-white p-3 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-md active:scale-95 transition-transform">
                  Confirm & Merge History
                </button>
              </div>
            )}
            
            <div className="flex gap-2 mb-4">
              <input placeholder="Name" value={dirName} onChange={e => setDirName(e.target.value)} className="flex-1 bg-gray-50 border border-gray-100 p-3 rounded-xl text-sm font-bold focus:ring-2 focus:ring-[#5fa4ad]" />
              <input placeholder="Nickname" value={dirNick} onChange={e => setDirNick(e.target.value)} className="w-1/3 bg-gray-50 border border-gray-100 p-3 rounded-xl text-sm font-bold focus:ring-2 focus:ring-[#5fa4ad]" />
              <button onClick={saveToDirectory} className="bg-[#3a5b5e] text-white p-3 rounded-xl font-black shadow-md hover:bg-[#2d4749]">
                {editingDirId ? <CheckCircle2 size={20}/> : <Plus size={20}/>}
              </button>
              {editingDirId && (
                <button onClick={() => { setEditingDirId(null); setDirName(""); setDirNick(""); }} className="bg-gray-200 text-gray-500 p-3 rounded-xl font-black shadow-md hover:bg-gray-300">
                  <X size={20}/>
                </button>
              )}
            </div>
            
            <button onClick={extractUsers} className="w-full bg-[#e0f2fe] text-[#0284c7] p-3 rounded-xl font-black text-[10px] uppercase tracking-widest mb-6 active:scale-95 transition-transform border border-blue-100 hover:bg-blue-100">
              Auto-Extract from Events
            </button>

            <div className="space-y-2">
              {directory.map(user => (
                <div key={user.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <div>
                    <p className="font-bold text-[#364d54] text-sm">{user.name}</p>
                    {user.nickname && <p className="text-[10px] text-[#A0AEC0] font-black uppercase tracking-widest">{user.nickname}</p>}
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => { setDirName(user.name); setDirNick(user.nickname); setEditingDirId(user.id); }} className="text-[#5fa4ad] hover:text-blue-500 p-2 rounded-full hover:bg-blue-50 transition-colors"><Edit2 size={16}/></button>
                    <button onClick={() => deleteFromDirectory(user.id)} className="text-gray-400 hover:text-red-500 p-2 rounded-full hover:bg-red-50 transition-colors"><Trash2 size={16}/></button>
                  </div>
                </div>
              ))}
              {directory.length === 0 && (
                <div className="text-center py-8 text-[#A0AEC0] font-bold text-sm">
                  No registered users.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}