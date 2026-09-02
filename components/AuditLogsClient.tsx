'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  History,
  Users,
  Search,
  Filter,
  Calendar,
  DollarSign,
  HandCoins,
  ArrowRightLeft,
  CheckCircle2,
  Clock,
  UserCheck,
  Building2,
  Plus,
  Edit2,
  Trash2,
  X,
  Loader2,
  RefreshCw,
  ShoppingBag,
  Receipt,
  FileText,
  AlertCircle,
  Eye,
  Check,
  ChevronDown,
  ArrowUpRight,
  ArrowDownLeft,
  Sparkles,
  ShieldCheck,
  Layers,
  Wallet,
  Coins,
  Printer,
  CreditCard,
  Phone,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';
import CustomDatePicker from '@/components/CustomDatePicker';
import Pagination from '@/components/Pagination';
import { db } from '@/lib/firebase';
import { toast } from '@/context/ToastContext';
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  query,
  orderBy,
} from 'firebase/firestore';
import type { EmployeeRecord } from '@/components/EmployeesClient';

export interface HandoverRecipient {
  id: string;
  name: string;
  role?: string;
  phone?: string;
  status?: 'Active' | 'Inactive';
  createdAt?: any;
}

export interface CashHandoverRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeRole?: string;
  recipientId?: string;
  recipientName: string;
  recipientPhone?: string;
  recipientRole?: string;
  amount: number;
  date: string; // 'YYYY-MM-DD'
  purpose?: string;
  notes?: string;
  createdAt?: any;
}

export interface UnifiedAuditItem {
  id: string;
  action: string;
  actionType: 'order_created' | 'payment_received' | 'cash_handover' | 'order_updated' | 'status_changed' | 'walk_in_sale' | 'b2b_order';
  description: string;
  employeeId: string;
  employeeName: string;
  employeeRole?: string;
  employeeCode?: string;
  date: string; // 'YYYY-MM-DD'
  timeStr?: string;
  timestamp: number;
  orderId?: string;
  orderCode?: string;
  customerName?: string;
  customerPhone?: string;
  totalOrderAmount?: number;
  amount: number;
  cashAmount: number; // positive = collected, negative = handed over, 0 = non-cash
  paymentMode?: string;
  recipientName?: string;
  recipientRole?: string;
  notes?: string;
}

const getTodayDateStr = () => {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export default function AuditLogsClient() {
  // ── 1. Subscriptions Data State ─────────────────────────────────────────────
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [walkInSales, setWalkInSales] = useState<any[]>([]);
  const [cashHandovers, setCashHandovers] = useState<CashHandoverRecord[]>([]);
  const [recipients, setRecipients] = useState<HandoverRecipient[]>([]);
  const [customAuditLogs, setCustomAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // ── 2. Filters & Selection State ───────────────────────────────────────────
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('All');
  const [selectedDate, setSelectedDate] = useState<string>(getTodayDateStr());
  const [searchQuery, setSearchQuery] = useState('');
  const [activityCategory, setActivityCategory] = useState<'All' | 'Cash' | 'Orders' | 'Handovers' | 'Payments'>('All');
  const [currentPage, setCurrentPage] = useState(1);

  // ── 3. Modals State ────────────────────────────────────────────────────────
  // A. Record Cash Handover Modal
  const [isHandoverModalOpen, setIsHandoverModalOpen] = useState(false);
  const [handoverEmployeeId, setHandoverEmployeeId] = useState<string>('');
  const [handoverRecipientName, setHandoverRecipientName] = useState<string>('');
  const [handoverAmount, setHandoverAmount] = useState<string>('');
  const [handoverDate, setHandoverDate] = useState<string>(getTodayDateStr());
  const [handoverPurpose, setHandoverPurpose] = useState<string>('Daily Cash Settlement');
  const [handoverNotes, setHandoverNotes] = useState<string>('');
  const [isSavingHandover, setIsSavingHandover] = useState(false);

  // B. Manage Handover Recipients Modal
  const [isRecipientsModalOpen, setIsRecipientsModalOpen] = useState(false);
  const [recipientName, setRecipientName] = useState('');
  const [recipientRole, setRecipientRole] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [editingRecipient, setEditingRecipient] = useState<HandoverRecipient | null>(null);
  const [isSavingRecipient, setIsSavingRecipient] = useState(false);
  const [deletingRecipient, setDeletingRecipient] = useState<HandoverRecipient | null>(null);

  // C. View Audit Item Details Modal
  const [viewingAuditItem, setViewingAuditItem] = useState<UnifiedAuditItem | null>(null);

  // ── 4. Firestore Subscriptions ─────────────────────────────────────────────
  useEffect(() => {
    // 1. Employees
    const unsubEmployees = onSnapshot(collection(db, 'employees'), (snapshot) => {
      const docs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as EmployeeRecord[];
      setEmployees(docs);
    });

    // 2. Orders (Regular & B2B)
    const unsubOrders = onSnapshot(collection(db, 'orders'), (snapshot) => {
      const docs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setOrders(docs);
    });

    // 3. Walk-in sales
    const unsubWalkIn = onSnapshot(collection(db, 'walk_in_sales'), (snapshot) => {
      const docs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setWalkInSales(docs);
    });

    // 4. Cash Handovers
    const unsubHandovers = onSnapshot(collection(db, 'cash_handovers'), (snapshot) => {
      const docs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as CashHandoverRecord[];
      setCashHandovers(docs);
    });

    // 5. Handover Recipients (People list)
    const unsubRecipients = onSnapshot(collection(db, 'handover_recipients'), (snapshot) => {
      const docs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as HandoverRecipient[];
      setRecipients(docs);
    });

    // 6. Custom Audit Logs
    const unsubAudit = onSnapshot(collection(db, 'audit_logs'), (snapshot) => {
      const docs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setCustomAuditLogs(docs);
      setLoading(false);
    });

    return () => {
      unsubEmployees();
      unsubOrders();
      unsubWalkIn();
      unsubHandovers();
      unsubRecipients();
      unsubAudit();
    };
  }, []);

  // ── 5. Unified Audit Log Compilation ───────────────────────────────────────
  const allAuditItems: UnifiedAuditItem[] = useMemo(() => {
    const list: UnifiedAuditItem[] = [];

    // Helper map for employee details
    const empMap = new Map<string, EmployeeRecord>();
    employees.forEach((emp) => {
      empMap.set(emp.id, emp);
      if (emp.name) empMap.set(emp.name.toLowerCase().trim(), emp);
    });

    // A. Extract from Orders collection
    orders.forEach((order) => {
      const createdDate = order.orderDate || (order.createdAt?.toDate ? order.createdAt.toDate().toISOString().split('T')[0] : getTodayDateStr());
      const ts = order.createdAt?.toMillis ? order.createdAt.toMillis() : new Date(createdDate).getTime();
      const timeStr = order.createdAt?.toDate ? order.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
      
      const creatorName = order.createdBy || order.staffName || 'System Admin';
      const creatorId = order.createdById || '';
      const matchedEmp = empMap.get(creatorId) || empMap.get(creatorName.toLowerCase().trim());
      const empRole = order.creatorRole || matchedEmp?.department || 'Staff';
      const empCode = matchedEmp?.empId || '';

      const isB2B = order.orderType === 'Wholesaler B2B' || order.wholesalerId;
      const orderCode = order.orderCode || order.orderId || (isB2B ? 'B2B-Order' : 'ORD');
      const custName = order.customerName || order.wholesalerName || 'Customer';
      const custPhone = order.customerMobile || order.wholesalerMobile || order.phone || '';

      // Check payments in order
      const payments = order.payments && Array.isArray(order.payments) ? order.payments : [];
      let totalCashReceivedOnOrder = 0;
      let totalNonCashReceived = 0;

      if (payments.length > 0) {
        payments.forEach((p: any, pIdx: number) => {
          const pAmount = parseFloat(p.amount) || 0;
          const pMode = p.mode || 'Cash';
          const isCash = pMode === 'Cash';
          const pDate = p.paidAt ? p.paidAt.split('T')[0] : createdDate;
          const pTs = p.paidAt ? new Date(p.paidAt).getTime() : ts + pIdx * 1000;
          const pTime = p.paidAt ? new Date(p.paidAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : timeStr;

          if (isCash) totalCashReceivedOnOrder += pAmount;
          else totalNonCashReceived += pAmount;

          list.push({
            id: `order-pay-${order.id}-${pIdx}`,
            action: isCash ? 'Advance Cash Payment Collected' : `Payment Collected (${pMode})`,
            actionType: 'payment_received',
            description: `Payment received for ${orderCode} (${custName})`,
            employeeId: creatorId || matchedEmp?.id || 'unknown',
            employeeName: creatorName,
            employeeRole: empRole,
            employeeCode: empCode,
            date: pDate,
            timeStr: pTime,
            timestamp: pTs,
            orderId: order.id,
            orderCode: orderCode,
            customerName: custName,
            customerPhone: custPhone,
            totalOrderAmount: order.totalAmount || order.grandTotal || 0,
            amount: pAmount,
            cashAmount: isCash ? pAmount : 0,
            paymentMode: pMode,
            notes: p.note || `Received ₹${pAmount} via ${pMode}`,
          });
        });
      } else {
        // Single received amount at order creation
        const recvAmount = parseFloat(order.receivedAmount) || 0;
        const pMode = order.paymentMode || 'Cash';
        const isCash = pMode === 'Cash';

        if (recvAmount > 0) {
          if (isCash) totalCashReceivedOnOrder += recvAmount;
          else totalNonCashReceived += recvAmount;

          list.push({
            id: `order-init-pay-${order.id}`,
            action: isCash ? 'Advance Cash Payment Collected' : `Payment Collected (${pMode})`,
            actionType: 'payment_received',
            description: `Initial payment at order booking for ${orderCode} (${custName})`,
            employeeId: creatorId || matchedEmp?.id || 'unknown',
            employeeName: creatorName,
            employeeRole: empRole,
            employeeCode: empCode,
            date: createdDate,
            timeStr: timeStr,
            timestamp: ts + 100,
            orderId: order.id,
            orderCode: orderCode,
            customerName: custName,
            customerPhone: custPhone,
            totalOrderAmount: order.totalAmount || order.grandTotal || 0,
            amount: recvAmount,
            cashAmount: isCash ? recvAmount : 0,
            paymentMode: pMode,
            notes: `Initial advance payment received ₹${recvAmount} via ${pMode}`,
          });
        }
      }

      // Order Created Event
      list.push({
        id: `order-create-${order.id}`,
        action: isB2B ? 'B2B Wholesaler Order Created' : 'New Customer Order Created',
        actionType: isB2B ? 'b2b_order' : 'order_created',
        description: `Created order ${orderCode} for ${custName} • Total ₹${order.totalAmount || order.grandTotal || 0} (${order.items?.length || 0} items)`,
        employeeId: creatorId || matchedEmp?.id || 'unknown',
        employeeName: creatorName,
        employeeRole: empRole,
        employeeCode: empCode,
        date: createdDate,
        timeStr: timeStr,
        timestamp: ts,
        orderId: order.id,
        orderCode: orderCode,
        customerName: custName,
        customerPhone: custPhone,
        totalOrderAmount: order.totalAmount || order.grandTotal || 0,
        amount: order.totalAmount || order.grandTotal || 0,
        cashAmount: 0, // already recorded under payment
        paymentMode: order.paymentMode || 'N/A',
        notes: `Order Status: ${order.orderStatus || order.status || 'Created'}`,
      });
    });

    // B. Extract from Walk-in Sales
    walkInSales.forEach((sale) => {
      const createdDate = sale.date || (sale.createdAt?.toDate ? sale.createdAt.toDate().toISOString().split('T')[0] : getTodayDateStr());
      const ts = sale.createdAt?.toMillis ? sale.createdAt.toMillis() : new Date(createdDate).getTime();
      const timeStr = sale.createdAt?.toDate ? sale.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
      
      const cashierName = sale.cashierName || sale.createdBy || 'Counter Cashier';
      const cashierId = sale.cashierId || '';
      const matchedEmp = empMap.get(cashierId) || empMap.get(cashierName.toLowerCase().trim());
      const empRole = matchedEmp?.department || 'Cashier';
      const empCode = matchedEmp?.empId || '';

      const isCash = sale.paymentMode === 'Cash';
      const saleAmount = parseFloat(sale.totalAmount || sale.amount) || 0;

      list.push({
        id: `walkin-${sale.id}`,
        action: 'Walk-In POS Bill Created',
        actionType: 'walk_in_sale',
        description: `Direct walk-in counter checkout #${sale.billNumber || sale.id.slice(-5)} • ₹${saleAmount} via ${sale.paymentMode || 'Cash'}`,
        employeeId: cashierId || matchedEmp?.id || 'unknown',
        employeeName: cashierName,
        employeeRole: empRole,
        employeeCode: empCode,
        date: createdDate,
        timeStr: timeStr,
        timestamp: ts,
        orderId: sale.id,
        orderCode: sale.billNumber || `POS-${sale.id.slice(-4)}`,
        customerName: sale.customerName || 'Walk-In Customer',
        customerPhone: sale.customerPhone || '',
        totalOrderAmount: saleAmount,
        amount: saleAmount,
        cashAmount: isCash ? saleAmount : 0,
        paymentMode: sale.paymentMode || 'Cash',
        notes: `Items: ${sale.items?.length || 1}`,
      });
    });

    // C. Extract from Cash Handovers
    cashHandovers.forEach((ho) => {
      const hoDate = ho.date || (ho.createdAt?.toDate ? ho.createdAt.toDate().toISOString().split('T')[0] : getTodayDateStr());
      const ts = ho.createdAt?.toMillis ? ho.createdAt.toMillis() : new Date(hoDate).getTime();
      const timeStr = ho.createdAt?.toDate ? ho.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

      const matchedEmp = empMap.get(ho.employeeId) || empMap.get(ho.employeeName.toLowerCase().trim());
      const empRole = ho.employeeRole || matchedEmp?.department || 'Staff';
      const empCode = matchedEmp?.empId || '';
      const hoAmt = parseFloat(String(ho.amount)) || 0;

      list.push({
        id: `handover-${ho.id}`,
        action: 'Cash Handed Over',
        actionType: 'cash_handover',
        description: `Handed over ₹${hoAmt.toLocaleString('en-IN')} cash to ${ho.recipientName} (${ho.recipientRole || 'Receiver'})`,
        employeeId: ho.employeeId || matchedEmp?.id || 'unknown',
        employeeName: ho.employeeName,
        employeeRole: empRole,
        employeeCode: empCode,
        date: hoDate,
        timeStr: timeStr,
        timestamp: ts,
        amount: hoAmt,
        cashAmount: -hoAmt, // Negative cash impact on hand!
        paymentMode: 'Cash',
        recipientName: ho.recipientName,
        recipientRole: ho.recipientRole,
        notes: ho.notes || ho.purpose || 'Cash settlement handover',
      });
    });

    // D. Extract from Custom Audit Logs
    customAuditLogs.forEach((log) => {
      const logDate = log.date || (log.createdAt?.toDate ? log.createdAt.toDate().toISOString().split('T')[0] : getTodayDateStr());
      const ts = log.createdAt?.toMillis ? log.createdAt.toMillis() : new Date(logDate).getTime();
      const timeStr = log.createdAt?.toDate ? log.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

      list.push({
        id: `custom-audit-${log.id}`,
        action: log.action || 'Audit Event',
        actionType: log.actionType || 'general',
        description: log.description || 'System operation recorded',
        employeeId: log.employeeId || 'unknown',
        employeeName: log.employeeName || 'Staff',
        employeeRole: log.employeeRole || 'Staff',
        employeeCode: log.employeeCode || '',
        date: logDate,
        timeStr: timeStr,
        timestamp: ts,
        orderId: log.orderId,
        orderCode: log.orderCode,
        customerName: log.customerName,
        customerPhone: log.customerPhone,
        totalOrderAmount: log.totalOrderAmount || 0,
        amount: log.amount || 0,
        cashAmount: log.cashAmount || 0,
        paymentMode: log.paymentMode,
        recipientName: log.recipientName,
        recipientRole: log.recipientRole,
        notes: log.notes,
      });
    });

    // Sort descending by timestamp
    return list.sort((a, b) => b.timestamp - a.timestamp);
  }, [orders, walkInSales, cashHandovers, customAuditLogs, employees]);

  // ── 6. Metrics & Filtered Audit Feed ───────────────────────────────────────
  const selectedEmployeeObj = useMemo(() => {
    if (selectedEmployeeId === 'All') return null;
    return employees.find((e) => e.id === selectedEmployeeId) || null;
  }, [employees, selectedEmployeeId]);

  // Filtered List based on Employee, Date, Category, and Search
  const filteredAuditItems = useMemo(() => {
    return allAuditItems.filter((item) => {
      // Employee filter
      const matchEmp =
        selectedEmployeeId === 'All' ||
        item.employeeId === selectedEmployeeId ||
        (selectedEmployeeObj && item.employeeName.toLowerCase().includes(selectedEmployeeObj.name.toLowerCase()));

      // Date filter
      const matchDate = !selectedDate || item.date === selectedDate;

      // Category filter
      let matchCat = true;
      if (activityCategory === 'Cash') {
        matchCat = item.cashAmount !== 0 || item.paymentMode === 'Cash' || item.actionType === 'cash_handover';
      } else if (activityCategory === 'Orders') {
        matchCat = item.actionType === 'order_created' || item.actionType === 'b2b_order' || item.actionType === 'walk_in_sale';
      } else if (activityCategory === 'Handovers') {
        matchCat = item.actionType === 'cash_handover';
      } else if (activityCategory === 'Payments') {
        matchCat = item.actionType === 'payment_received';
      }

      // Search query
      const q = searchQuery.toLowerCase().trim();
      const matchQuery =
        !q ||
        item.action.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.employeeName.toLowerCase().includes(q) ||
        (item.orderCode && item.orderCode.toLowerCase().includes(q)) ||
        (item.customerName && item.customerName.toLowerCase().includes(q)) ||
        (item.recipientName && item.recipientName.toLowerCase().includes(q)) ||
        (item.notes && item.notes.toLowerCase().includes(q));

      return matchEmp && matchDate && matchCat && matchQuery;
    });
  }, [allAuditItems, selectedEmployeeId, selectedEmployeeObj, selectedDate, activityCategory, searchQuery]);

  // Financial KPI Metrics Calculation (For Current Selection & Date)
  const financialMetrics = useMemo(() => {
    // For cash calculation, consider all actions for the selected employee and date
    const relevantItems = allAuditItems.filter((item) => {
      const matchEmp =
        selectedEmployeeId === 'All' ||
        item.employeeId === selectedEmployeeId ||
        (selectedEmployeeObj && item.employeeName.toLowerCase().includes(selectedEmployeeObj.name.toLowerCase()));
      const matchDate = !selectedDate || item.date === selectedDate;
      return matchEmp && matchDate;
    });

    let totalCashReceived = 0;
    let totalCashHandedOver = 0;
    let totalUpiReceived = 0;

    relevantItems.forEach((item) => {
      if (item.actionType === 'cash_handover') {
        totalCashHandedOver += Math.abs(item.cashAmount);
      } else if (item.cashAmount > 0) {
        totalCashReceived += item.cashAmount;
      }

      if (item.actionType === 'payment_received' && item.paymentMode !== 'Cash') {
        totalUpiReceived += item.amount;
      }
    });

    const cashInHand = Math.max(0, totalCashReceived - totalCashHandedOver);

    return {
      totalCashReceived,
      totalCashHandedOver,
      cashInHand,
      totalUpiReceived,
      totalActivities: relevantItems.length,
    };
  }, [allAuditItems, selectedEmployeeId, selectedEmployeeObj, selectedDate]);

  // Paginated View
  const paginatedAuditItems = useMemo(() => {
    return filteredAuditItems.slice((currentPage - 1) * 40, currentPage * 40);
  }, [filteredAuditItems, currentPage]);

  // ── 7. Save Cash Handover Handler ──────────────────────────────────────────
  const handleOpenHandoverModal = (empId?: string) => {
    const targetEmpId = empId || (selectedEmployeeId !== 'All' ? selectedEmployeeId : (employees[0]?.id || ''));
    setHandoverEmployeeId(targetEmpId);
    setHandoverDate(selectedDate || getTodayDateStr());
    
    // Default amount to current cash in hand if available
    const emp = employees.find((e) => e.id === targetEmpId);
    if (emp && financialMetrics.cashInHand > 0 && selectedEmployeeId === targetEmpId) {
      setHandoverAmount(String(financialMetrics.cashInHand));
    } else {
      setHandoverAmount('');
    }

    if (recipients.length > 0) {
      setHandoverRecipientName(recipients[0].name);
    } else {
      setHandoverRecipientName('');
    }

    setHandoverNotes('');
    setIsHandoverModalOpen(true);
  };

  const handleSaveCashHandover = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountVal = parseFloat(handoverAmount);
    if (!amountVal || amountVal <= 0) {
      toast.warning('Invalid Amount', 'Please enter a valid cash handover amount.');
      return;
    }

    if (!handoverRecipientName.trim()) {
      toast.warning('Recipient Required', 'Please select or enter the person receiving the cash.');
      return;
    }

    const emp = employees.find((e) => e.id === handoverEmployeeId) || {
      id: handoverEmployeeId,
      name: selectedEmployeeObj?.name || 'Staff',
      department: 'Staff',
    };

    const targetRecipient = recipients.find(
      (r) => r.name.toLowerCase() === handoverRecipientName.toLowerCase().trim()
    );

    try {
      setIsSavingHandover(true);
      await addDoc(collection(db, 'cash_handovers'), {
        employeeId: emp.id,
        employeeName: emp.name,
        employeeRole: emp.department || 'Staff',
        recipientId: targetRecipient?.id || '',
        recipientName: handoverRecipientName.trim(),
        recipientRole: targetRecipient?.role || 'Receiver',
        recipientPhone: targetRecipient?.phone || '',
        amount: amountVal,
        date: handoverDate || getTodayDateStr(),
        purpose: handoverPurpose,
        notes: handoverNotes,
        createdAt: serverTimestamp(),
      });

      // Also ensure recipient is in the recipients master list if not already present
      if (!targetRecipient && handoverRecipientName.trim()) {
        await addDoc(collection(db, 'handover_recipients'), {
          name: handoverRecipientName.trim(),
          role: 'Receiver',
          status: 'Active',
          createdAt: serverTimestamp(),
        });
      }

      toast.success(
        'Cash Handover Recorded',
        `₹${amountVal.toLocaleString('en-IN')} handed over to ${handoverRecipientName} successfully.`
      );
      setIsHandoverModalOpen(false);
    } catch (err: any) {
      console.error('Failed to save cash handover:', err);
      toast.error('Handover Failed', err?.message || 'Failed to record cash handover.');
    } finally {
      setIsSavingHandover(false);
    }
  };

  // ── 8. Handover Recipients Master Handlers ──────────────────────────────────
  const handleSaveRecipient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientName.trim()) {
      toast.warning('Name Required', 'Please enter handover person name.');
      return;
    }

    try {
      setIsSavingRecipient(true);
      if (editingRecipient) {
        await updateDoc(doc(db, 'handover_recipients', editingRecipient.id), {
          name: recipientName.trim(),
          role: recipientRole.trim() || 'Receiver',
          phone: recipientPhone.trim(),
          updatedAt: serverTimestamp(),
        });
        toast.success('Recipient Updated', `${recipientName} updated successfully.`);
      } else {
        await addDoc(collection(db, 'handover_recipients'), {
          name: recipientName.trim(),
          role: recipientRole.trim() || 'Store Manager',
          phone: recipientPhone.trim(),
          status: 'Active',
          createdAt: serverTimestamp(),
        });
        toast.success('Recipient Added', `${recipientName} added to handover persons list.`);
      }

      setRecipientName('');
      setRecipientRole('');
      setRecipientPhone('');
      setEditingRecipient(null);
    } catch (err: any) {
      console.error('Failed to save recipient:', err);
      toast.error('Save Failed', err?.message || 'Failed to save recipient.');
    } finally {
      setIsSavingRecipient(false);
    }
  };

  const handleDeleteRecipient = async () => {
    if (!deletingRecipient) return;
    try {
      await deleteDoc(doc(db, 'handover_recipients', deletingRecipient.id));
      toast.success('Recipient Removed', `${deletingRecipient.name} removed from list.`);
      setDeletingRecipient(null);
    } catch (err: any) {
      console.error('Failed to delete recipient:', err);
      toast.error('Delete Failed', err?.message || 'Failed to remove recipient.');
    }
  };

  return (
    <div className="w-full flex flex-col gap-4 text-slate-800 font-sans pb-12">
      {/* ── Page Header Title Bar ────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-200">
            <History size={20} />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Audit Logs &amp; Cash Handover
            </h1>
            <p className="text-xs text-slate-500">
              Track employee actions, daily cash collections, and handover settlements date-wise
            </p>
          </div>
        </div>

        {/* Top Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsRecipientsModalOpen(true)}
            className="h-8 px-3 text-xs font-semibold rounded-lg bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 shadow-2xs inline-flex items-center gap-1.5 cursor-pointer transition-colors"
            title="Manage authorized cash handover recipients"
          >
            <Users size={14} className="text-slate-500" />
            <span>Handover Persons ({recipients.length})</span>
          </button>

          <button
            onClick={() => handleOpenHandoverModal()}
            className="h-8 px-3.5 text-xs font-semibold rounded-lg bg-[#02626D] hover:bg-[#014d56] text-white shadow-2xs inline-flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <HandCoins size={14} />
            <span>Record Cash Handover</span>
          </button>
        </div>
      </div>

      {/* ── KPI Financial & Activity Metrics Bar ──────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* 1. Cash in Hand */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Cash In Hand {selectedEmployeeId !== 'All' ? `(${selectedEmployeeObj?.name?.split(' ')[0]})` : ''}
            </span>
            <div className={`p-2 rounded-lg ${financialMetrics.cashInHand > 0 ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
              <Wallet size={18} />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold font-mono text-slate-900">
              ₹{financialMetrics.cashInHand.toLocaleString('en-IN')}
            </div>
            <div className="flex items-center justify-between mt-1 text-[11px]">
              <span className="text-slate-400">
                {financialMetrics.cashInHand > 0 ? 'Pending handover' : 'All cash settled'}
              </span>
              {financialMetrics.cashInHand > 0 && (
                <button
                  onClick={() => handleOpenHandoverModal(selectedEmployeeId !== 'All' ? selectedEmployeeId : undefined)}
                  className="text-teal-700 font-bold hover:underline cursor-pointer flex items-center gap-0.5"
                >
                  <span>Handover</span>
                  <ArrowRightLeft size={10} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 2. Total Cash Received */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Cash Received (Orders &amp; POS)
            </span>
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
              <ArrowDownLeft size={18} />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold font-mono text-emerald-700">
              ₹{financialMetrics.totalCashReceived.toLocaleString('en-IN')}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              On {selectedDate || 'All Time'}
            </p>
          </div>
        </div>

        {/* 3. Total Cash Handed Over */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Cash Handed Over
            </span>
            <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
              <ArrowUpRight size={18} />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold font-mono text-indigo-700">
              ₹{financialMetrics.totalCashHandedOver.toLocaleString('en-IN')}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Settled to managers / owners
            </p>
          </div>
        </div>

        {/* 4. Total Logged Operations */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Total Operations Tracked
            </span>
            <div className="p-2 rounded-lg bg-slate-100 text-slate-600">
              <History size={18} />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold font-mono text-slate-900">
              {financialMetrics.totalActivities} Events
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              UPI/Card: ₹{financialMetrics.totalUpiReceived.toLocaleString('en-IN')}
            </p>
          </div>
        </div>
      </div>

      {/* ── Filter Bar: Employee Selector, Date Picker & Category Filter ──────── */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs flex flex-col gap-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* 1. Employee Selection Dropdown */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              Filter by Employee / Staff:
            </label>
            <select
              value={selectedEmployeeId}
              onChange={(e) => {
                setSelectedEmployeeId(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full h-8.5 px-2.5 bg-[#f7f7f8] focus:bg-white text-xs font-semibold rounded-lg border border-slate-300 text-slate-800 focus:outline-none focus:border-[#02626D]"
            >
              <option value="All">👥 All Employees &amp; Cashiers ({employees.length})</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} {emp.department ? `• ${emp.department}` : ''} {emp.empId ? `(${emp.empId})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* 2. Date Selection */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[11px] font-bold text-slate-600">
                Date Wise Filter:
              </label>
              {selectedDate && (
                <button
                  onClick={() => setSelectedDate('')}
                  className="text-[10px] text-teal-700 hover:underline font-semibold cursor-pointer"
                >
                  View All Dates
                </button>
              )}
            </div>
            <CustomDatePicker
              value={selectedDate}
              onChange={(d) => {
                setSelectedDate(d);
                setCurrentPage(1);
              }}
              allowAll={true}
              size="sm"
            />
          </div>

          {/* 3. Search Bar */}
          <div className="sm:col-span-2">
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              Search Activity / Order / Person:
            </label>
            <div className="relative w-full">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by order #, customer, handover person, note..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-9 pr-3 h-8.5 bg-[#f7f7f8] focus:bg-white text-xs rounded-lg border border-slate-300 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-slate-500 transition-all"
              />
            </div>
          </div>
        </div>

        {/* Category Pills & Quick Date Shortcuts */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] text-slate-500 font-semibold mr-1">Activity Type:</span>
            {(['All', 'Cash', 'Orders', 'Payments', 'Handovers'] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => {
                  setActivityCategory(cat);
                  setCurrentPage(1);
                }}
                className={`h-7 px-3 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  activityCategory === cat
                    ? 'bg-[#02626D] text-white shadow-2xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                }`}
              >
                {cat === 'All' ? 'All Activities' : cat === 'Cash' ? '💵 Cash Only' : cat}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <span>Quick:</span>
            <button
              onClick={() => setSelectedDate(getTodayDateStr())}
              className={`px-2 py-0.5 rounded text-[11px] font-semibold cursor-pointer ${
                selectedDate === getTodayDateStr() ? 'bg-teal-50 text-teal-800 border border-teal-200' : 'hover:bg-slate-100'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => {
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                setSelectedDate(yesterday.toISOString().split('T')[0]);
              }}
              className="px-2 py-0.5 rounded text-[11px] font-semibold hover:bg-slate-100 cursor-pointer"
            >
              Yesterday
            </button>
          </div>
        </div>
      </div>

      {/* ── Employee Active Cash Summary Banner (If Single Employee Selected) ── */}
      {selectedEmployeeObj && (
        <div className="bg-gradient-to-r from-teal-50/80 to-slate-50 border border-teal-200/80 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#02626D] text-white flex items-center justify-center font-bold text-sm shadow-2xs">
              {selectedEmployeeObj.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">{selectedEmployeeObj.name}</h3>
                <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-teal-100 text-teal-800 border border-teal-200">
                  {selectedEmployeeObj.department || 'Staff'}
                </span>
                {selectedEmployeeObj.empId && (
                  <span className="text-[10px] text-slate-500 font-mono">
                    ID: {selectedEmployeeObj.empId}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                Total Cash Received on Date: <strong className="font-mono text-emerald-700">₹{financialMetrics.totalCashReceived.toLocaleString('en-IN')}</strong> • Handed Over: <strong className="font-mono text-indigo-700">₹{financialMetrics.totalCashHandedOver.toLocaleString('en-IN')}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-slate-400">Current In-Hand Cash</span>
              <div className="text-lg font-bold font-mono text-slate-900">
                ₹{financialMetrics.cashInHand.toLocaleString('en-IN')}
              </div>
            </div>

            <button
              onClick={() => handleOpenHandoverModal(selectedEmployeeObj.id)}
              className="h-8.5 px-3.5 text-xs font-semibold rounded-lg bg-[#02626D] hover:bg-[#014d56] text-white shadow-2xs inline-flex items-center gap-1.5 cursor-pointer"
            >
              <HandCoins size={14} />
              <span>Handover Cash</span>
            </button>
          </div>
        </div>
      )}

      {/* ── Main Audit Logs Timeline & Table ─────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-slate-500" />
            Loading Audit Trail &amp; Cash History...
          </div>
        ) : filteredAuditItems.length === 0 ? (
          <div className="p-16 text-center text-slate-400 text-xs space-y-2">
            <History size={32} className="mx-auto text-slate-300 stroke-[1.5]" />
            <p className="font-semibold text-slate-600 text-sm">No activity records found</p>
            <p className="text-slate-400">Try changing the date, employee, or category filters above.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[950px]">
              <thead>
                <tr className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider bg-[#f7f7f8] border-b border-slate-200">
                  <th className="py-3 px-4">Date &amp; Time</th>
                  <th className="py-3 px-4">Employee / Staff</th>
                  <th className="py-3 px-4">Action / Event</th>
                  <th className="py-3 px-4">Details &amp; Reference</th>
                  <th className="py-3 px-4">Cash Impact</th>
                  <th className="py-3 px-4">Handover Recipient</th>
                  <th className="py-3 px-4 text-center">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {paginatedAuditItems.map((item) => {
                  const isCashHandover = item.actionType === 'cash_handover';
                  const isPositiveCash = item.cashAmount > 0;
                  const isNegativeCash = item.cashAmount < 0;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                      {/* Date & Time */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-semibold text-slate-900">{item.date}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{item.timeStr || '—'}</div>
                      </td>

                      {/* Employee */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-6.5 h-6.5 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-[11px]">
                            {item.employeeName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900">{item.employeeName}</p>
                            <p className="text-[10px] text-slate-400 font-mono">
                              {item.employeeRole || 'Staff'} {item.employeeCode ? `• ${item.employeeCode}` : ''}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Action / Event */}
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${
                            isCashHandover
                              ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                              : isPositiveCash
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : item.actionType === 'order_created' || item.actionType === 'b2b_order'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          {isCashHandover && <HandCoins size={11} />}
                          {isPositiveCash && <DollarSign size={11} />}
                          <span>{item.action}</span>
                        </span>
                      </td>

                      {/* Details & Reference */}
                      <td className="py-3 px-4 max-w-xs">
                        <p className="font-semibold text-slate-900 truncate">{item.description}</p>
                        {item.customerName && (
                          <p className="text-[10px] text-slate-400 font-mono truncate">
                            Customer: {item.customerName} {item.customerPhone ? `(${item.customerPhone})` : ''}
                          </p>
                        )}
                      </td>

                      {/* Cash Impact */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {isPositiveCash ? (
                          <div className="text-emerald-700 font-bold font-mono text-xs flex items-center gap-1">
                            <span>+ ₹{item.cashAmount.toLocaleString('en-IN')}</span>
                            <span className="text-[10px] text-emerald-600 font-sans font-semibold bg-emerald-50 px-1 rounded">
                              Cash in Hand
                            </span>
                          </div>
                        ) : isNegativeCash ? (
                          <div className="text-indigo-700 font-bold font-mono text-xs flex items-center gap-1">
                            <span>- ₹{Math.abs(item.cashAmount).toLocaleString('en-IN')}</span>
                            <span className="text-[10px] text-indigo-600 font-sans font-semibold bg-indigo-50 px-1 rounded">
                              Handed Over
                            </span>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 font-mono">
                            {item.paymentMode ? `${item.paymentMode} (₹${item.amount.toLocaleString('en-IN')})` : '—'}
                          </span>
                        )}
                      </td>

                      {/* Handover Recipient */}
                      <td className="py-3 px-4">
                        {item.recipientName ? (
                          <div>
                            <p className="font-bold text-slate-900 flex items-center gap-1">
                              <UserCheck size={12} className="text-teal-600" />
                              <span>{item.recipientName}</span>
                            </p>
                            <p className="text-[10px] text-slate-400 font-mono">
                              {item.recipientRole || 'Authorized Receiver'}
                            </p>
                          </div>
                        ) : (
                          <span className="text-slate-300 text-[11px]">—</span>
                        )}
                      </td>

                      {/* Action Details View */}
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => setViewingAuditItem(item)}
                          className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                          title="View Full Audit Details"
                        >
                          <Eye size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        <Pagination
          currentPage={currentPage}
          totalItems={filteredAuditItems.length}
          pageSize={40}
          onPageChange={setCurrentPage}
        />
      </div>

      {/* ── MODAL 1: Record Cash Handover ────────────────────────────────────── */}
      {isHandoverModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-200">
                  <HandCoins size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Record Cash Handover</h3>
                  <p className="text-xs text-slate-500">Handover collected physical cash to store manager or owner</p>
                </div>
              </div>
              <button
                onClick={() => setIsHandoverModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveCashHandover} className="space-y-3.5">
              {/* Employee Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Employee Handing Over Cash <span className="text-rose-500">*</span>:
                </label>
                <select
                  value={handoverEmployeeId}
                  onChange={(e) => {
                    setHandoverEmployeeId(e.target.value);
                  }}
                  className="w-full h-9 px-3 bg-white text-xs font-semibold rounded-lg border border-slate-300 text-slate-800 focus:outline-none focus:border-teal-700"
                >
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} {emp.department ? `(${emp.department})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Handover Amount */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Handover Cash Amount (₹) <span className="text-rose-500">*</span>:
                  </label>
                  {financialMetrics.cashInHand > 0 && (
                    <span className="text-[11px] text-slate-500 font-mono">
                      In-hand balance: <strong className="text-teal-800 font-bold">₹{financialMetrics.cashInHand}</strong>
                    </span>
                  )}
                </div>

                <input
                  type="number"
                  min="1"
                  step="1"
                  placeholder="Enter amount (e.g. 2500)"
                  value={handoverAmount}
                  onChange={(e) => setHandoverAmount(e.target.value)}
                  className="w-full h-9 px-3 bg-[#f7f7f8] focus:bg-white text-xs font-bold font-mono rounded-lg border border-slate-300 text-slate-900 focus:outline-none focus:border-teal-700"
                  required
                />

                {/* Quick Amount Shortcuts */}
                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                  {financialMetrics.cashInHand > 0 && (
                    <button
                      type="button"
                      onClick={() => setHandoverAmount(String(financialMetrics.cashInHand))}
                      className="px-2 py-0.5 rounded bg-teal-50 hover:bg-teal-100 text-teal-800 font-bold text-[10px] border border-teal-200 cursor-pointer"
                    >
                      Full Balance (₹{financialMetrics.cashInHand})
                    </button>
                  )}
                  {[500, 1000, 2000, 5000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setHandoverAmount(String(amt))}
                      className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold text-[10px] cursor-pointer"
                    >
                      ₹{amt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Recipient Person */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Handover To (Person Name) <span className="text-rose-500">*</span>:
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsHandoverModalOpen(false);
                      setIsRecipientsModalOpen(true);
                    }}
                    className="text-[11px] text-teal-700 hover:underline font-semibold cursor-pointer"
                  >
                    + Manage Persons List
                  </button>
                </div>

                <div className="space-y-1.5">
                  <select
                    value={handoverRecipientName}
                    onChange={(e) => setHandoverRecipientName(e.target.value)}
                    className="w-full h-9 px-3 bg-white text-xs font-semibold rounded-lg border border-slate-300 text-slate-800 focus:outline-none focus:border-teal-700"
                  >
                    <option value="">-- Choose Handover Person --</option>
                    {recipients.map((r) => (
                      <option key={r.id} value={r.name}>
                        {r.name} {r.role ? `• ${r.role}` : ''} {r.phone ? `(${r.phone})` : ''}
                      </option>
                    ))}
                  </select>

                  {/* Manual Write-in fallback */}
                  <input
                    type="text"
                    placeholder="Or type recipient person name directly..."
                    value={handoverRecipientName}
                    onChange={(e) => setHandoverRecipientName(e.target.value)}
                    className="w-full h-8 px-3 bg-[#f7f7f8] focus:bg-white text-xs rounded-lg border border-slate-200 text-slate-800 placeholder-slate-400"
                  />
                </div>
              </div>

              {/* Date & Purpose */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Handover Date:
                  </label>
                  <CustomDatePicker
                    value={handoverDate}
                    onChange={setHandoverDate}
                    allowAll={false}
                    size="sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Purpose / Type:
                  </label>
                  <select
                    value={handoverPurpose}
                    onChange={(e) => setHandoverPurpose(e.target.value)}
                    className="w-full h-8.5 px-3 bg-white text-xs rounded-lg border border-slate-300 text-slate-800 font-semibold focus:outline-none"
                  >
                    <option value="Daily Cash Settlement">Daily Cash Settlement</option>
                    <option value="Mid-Day Safe Deposit">Mid-Day Safe Deposit</option>
                    <option value="Counter Closing Handover">Counter Closing Handover</option>
                    <option value="Owner Cash Withdrawal">Owner Cash Withdrawal</option>
                    <option value="Store Expense Handover">Store Expense Handover</option>
                  </select>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Remarks / Notes:
                </label>
                <input
                  type="text"
                  placeholder="Optional verification note..."
                  value={handoverNotes}
                  onChange={(e) => setHandoverNotes(e.target.value)}
                  className="w-full h-8.5 px-3 bg-[#f7f7f8] focus:bg-white text-xs rounded-lg border border-slate-300 text-slate-800 placeholder-slate-400"
                />
              </div>

              {/* Form Actions */}
              <div className="border-t border-slate-100 pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsHandoverModalOpen(false)}
                  className="h-8 px-3 text-xs font-semibold rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingHandover}
                  className="h-8 px-4 text-xs font-semibold rounded-lg bg-[#02626D] hover:bg-[#014d56] text-white shadow-2xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSavingHandover ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                  <span>Save Cash Handover</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 2: Manage Handover Recipients / People Master ──────────────── */}
      {isRecipientsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-xl p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center border border-indigo-200">
                    <Users size={18} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      Cash Handover Persons Master List
                    </h3>
                    <p className="text-xs text-slate-500">
                      Add and manage authorized people who receive cash handovers from staff
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setIsRecipientsModalOpen(false);
                    setEditingRecipient(null);
                    setRecipientName('');
                    setRecipientRole('');
                    setRecipientPhone('');
                  }}
                  className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Add / Edit Form */}
              <form onSubmit={handleSaveRecipient} className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3 mb-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">
                    {editingRecipient ? `Edit Handover Person: ${editingRecipient.name}` : '+ Add New Handover Person'}
                  </span>
                  {editingRecipient && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingRecipient(null);
                        setRecipientName('');
                        setRecipientRole('');
                        setRecipientPhone('');
                      }}
                      className="text-[11px] text-slate-500 hover:underline cursor-pointer"
                    >
                      Cancel Edit
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">
                      Full Name <span className="text-rose-500">*</span>:
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Ramesh Babu"
                      value={recipientName}
                      onChange={(e) => setRecipientName(e.target.value)}
                      className="w-full h-8 px-2.5 bg-white text-xs font-semibold rounded-lg border border-slate-300 text-slate-900 focus:outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">
                      Designation / Role:
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Store Owner / Manager"
                      value={recipientRole}
                      onChange={(e) => setRecipientRole(e.target.value)}
                      className="w-full h-8 px-2.5 bg-white text-xs rounded-lg border border-slate-300 text-slate-900 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">
                      Phone Number:
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 9876543210"
                      value={recipientPhone}
                      onChange={(e) => setRecipientPhone(e.target.value)}
                      className="w-full h-8 px-2.5 bg-white text-xs rounded-lg border border-slate-300 text-slate-900 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    disabled={isSavingRecipient}
                    className="h-7 px-3.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs cursor-pointer flex items-center gap-1"
                  >
                    {isSavingRecipient ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                    <span>{editingRecipient ? 'Update Person' : 'Add Person'}</span>
                  </button>
                </div>
              </form>

              {/* Handover Persons Table */}
              <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
                {recipients.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs">
                    No handover recipients registered yet. Add a person using the form above.
                  </div>
                ) : (
                  recipients.map((rec) => (
                    <div key={rec.id} className="p-3 flex items-center justify-between gap-3 text-xs hover:bg-slate-50/70 transition-colors">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-xs">
                          {rec.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{rec.name}</p>
                          <p className="text-[10px] text-slate-500 font-mono">
                            {rec.role || 'Receiver'} {rec.phone ? `• ${rec.phone}` : ''}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingRecipient(rec);
                            setRecipientName(rec.name);
                            setRecipientRole(rec.role || '');
                            setRecipientPhone(rec.phone || '');
                          }}
                          className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                          title="Edit Person"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingRecipient(rec)}
                          className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title="Delete Person"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="border-t border-slate-100 pt-3 flex justify-end">
              <button
                type="button"
                onClick={() => setIsRecipientsModalOpen(false)}
                className="h-8 px-4 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL 3: Delete Recipient Confirmation ───────────────────────────── */}
      {deletingRecipient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-100 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-red-50 text-red-500 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-slate-900">Remove Handover Person</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Remove <strong className="text-slate-800">{deletingRecipient.name}</strong> from the authorized handover list?
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeletingRecipient(null)}
                className="h-8 px-3 rounded-lg text-xs font-semibold text-slate-600 border border-slate-200 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteRecipient}
                className="h-8 px-3.5 rounded-lg text-xs font-semibold bg-red-600 hover:bg-red-700 text-white shadow-2xs cursor-pointer"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL 4: View Audit Item Details ─────────────────────────────────── */}
      {viewingAuditItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">{viewingAuditItem.action}</h3>
                <p className="text-xs text-slate-500 font-mono">
                  {viewingAuditItem.date} • {viewingAuditItem.timeStr || 'Recorded'}
                </p>
              </div>
              <button
                onClick={() => setViewingAuditItem(null)}
                className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">Performed By:</span>
                  <span className="font-bold text-slate-900">{viewingAuditItem.employeeName} ({viewingAuditItem.employeeRole || 'Staff'})</span>
                </div>
                {viewingAuditItem.orderCode && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Order Reference:</span>
                    <span className="font-mono font-bold text-indigo-700">{viewingAuditItem.orderCode}</span>
                  </div>
                )}
                {viewingAuditItem.customerName && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Customer:</span>
                    <span className="font-semibold text-slate-900">{viewingAuditItem.customerName}</span>
                  </div>
                )}
              </div>

              {/* Financial Breakdown */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5 font-mono">
                {viewingAuditItem.totalOrderAmount ? (
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-sans">Total Order Value:</span>
                    <span className="font-bold text-slate-900">₹{viewingAuditItem.totalOrderAmount}</span>
                  </div>
                ) : null}
                {viewingAuditItem.amount ? (
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-sans">Transaction Amount:</span>
                    <span className="font-bold text-slate-900">₹{viewingAuditItem.amount}</span>
                  </div>
                ) : null}
                {viewingAuditItem.cashAmount !== 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-sans">Cash Impact:</span>
                    <span className={`font-bold ${viewingAuditItem.cashAmount > 0 ? 'text-emerald-700' : 'text-indigo-700'}`}>
                      {viewingAuditItem.cashAmount > 0 ? `+ ₹${viewingAuditItem.cashAmount} (In Hand)` : `- ₹${Math.abs(viewingAuditItem.cashAmount)} (Handed Over)`}
                    </span>
                  </div>
                )}
                {viewingAuditItem.recipientName && (
                  <div className="flex justify-between pt-1 border-t border-slate-200">
                    <span className="text-slate-500 font-sans">Handed Over To:</span>
                    <span className="font-bold text-teal-800">{viewingAuditItem.recipientName} ({viewingAuditItem.recipientRole || 'Receiver'})</span>
                  </div>
                )}
              </div>

              {/* Description & Notes */}
              <div className="space-y-1">
                <span className="text-slate-500 font-bold text-[11px]">Description:</span>
                <p className="text-slate-800 bg-white p-2.5 rounded-lg border border-slate-200 leading-relaxed">
                  {viewingAuditItem.description}
                </p>
                {viewingAuditItem.notes && (
                  <p className="text-[11px] text-slate-500 italic mt-1">
                    Note: {viewingAuditItem.notes}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end pt-2 border-t border-slate-100">
              <button
                onClick={() => setViewingAuditItem(null)}
                className="w-full h-8 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
