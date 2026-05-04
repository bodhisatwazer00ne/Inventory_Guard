import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, addDoc, writeBatch, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../hooks/useAuth';
import { 
  Search, 
  Send, 
  Clock, 
  CheckCircle2, 
  DollarSign, 
  History, 
  ChevronRight,
  Filter,
  CreditCard
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { LedgerEntry, Customer } from '../types';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';

export default function Ledger() {
  const { user, profile } = useAuth();
  const shopId = profile?.shopId;
  const [ledgers, setLedgers] = useState<LedgerEntry[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedLedger, setSelectedLedger] = useState<LedgerEntry | null>(null);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    if (!shopId) return;

    const qLedger = query(collection(db, 'ledgerEntries'), where('shopId', '==', shopId), orderBy('createdAt', 'desc'));
    const qCustomer = query(collection(db, 'customers'), where('shopId', '==', shopId));

    const unsubLedger = onSnapshot(qLedger, (snap) => {
      setLedgers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as LedgerEntry)));
    }, (error) => {
      console.error("Ledger snapshot error:", error);
      // Fallback: try without orderBy if it's an index issue
      const qFallback = query(collection(db, 'ledgerEntries'), where('shopId', '==', shopId));
      onSnapshot(qFallback, (snap) => {
        const sorted = snap.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as LedgerEntry))
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        setLedgers(sorted);
      });
    });

    const unsubCustomer = onSnapshot(qCustomer, (snap) => {
      setCustomers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer)));
      setLoading(false);
    }, (err) => console.error("Customer snapshot error:", err));

    return () => {
      unsubLedger();
      unsubCustomer();
    };
  }, [shopId]);

  const recordPayment = async () => {
    if (!selectedLedger || !shopId || paymentAmount <= 0) return;

    try {
      const batch = writeBatch(db);
      const now = new Date().toISOString();
      const newPaidAmount = selectedLedger.paidAmount + paymentAmount;
      const newDueAmount = selectedLedger.totalAmount - newPaidAmount;
      const newStatus = newDueAmount <= 0 ? 'PAID' : (newPaidAmount > 0 ? 'PARTIAL' : 'UNPAID');

      // Update Ledger
      const ledgerRef = doc(db, 'ledgerEntries', selectedLedger.id);
      batch.update(ledgerRef, {
        paidAmount: newPaidAmount,
        dueAmount: newDueAmount,
        status: newStatus,
        updatedAt: now
      });

      // Update Customer total due
      const customerRef = doc(db, 'customers', selectedLedger.customerId);
      const customer = customers.find(c => c.id === selectedLedger.customerId);
      if (customer) {
        batch.update(customerRef, {
          totalDue: Math.max(0, customer.totalDue - paymentAmount)
        });
      }

      // Record Payment
      const paymentRef = doc(collection(db, 'payments'));
      batch.set(paymentRef, {
        shopId,
        ledgerId: selectedLedger.id,
        customerId: selectedLedger.customerId,
        amount: paymentAmount,
        timestamp: now,
        type: 'DUES_PAYMENT'
      });

      await batch.commit();
      toast.success("Payment recorded successfully");
      setSelectedLedger(null);
      setPaymentAmount(0);
    } catch (error) {
      toast.error("Failed to record payment");
    }
  };

  const sendReminder = async (customerId: string) => {
    const customer = customers.find(c => c.id === customerId);
    if (!customer) return;

    try {
      // Logic for sending reminder (will connect to backend API later)
      const response = await fetch('/api/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          customerId, 
          customerName: customer.name,
          email: customer.email,
          dueAmount: customer.totalDue 
        })
      });

      if (response.ok) {
        // Update last reminder sent
        await updateDoc(doc(db, 'customers', customerId), {
          lastReminderSentAt: new Date().toISOString()
        });
        toast.success(`Reminder sent to ${customer.name}`);
      } else {
        toast.error("Reminder failed (Check API keys)");
      }
    } catch (error) {
      toast.error("Could not send reminder");
    }
  };

  const getCustomerName = (id: string) => customers.find(c => c.id === id)?.name || 'Loading...';

  const filteredLedgers = ledgers.filter(l => {
    const nameMatch = getCustomerName(l.customerId).toLowerCase().includes(search.toLowerCase()) ||
      l.orderId.toLowerCase().includes(search.toLowerCase());
    const startDateMatch = !startDate || l.createdAt >= startDate;
    const endDateMatch = !endDate || l.createdAt <= (endDate + 'T23:59:59');
    return nameMatch && startDateMatch && endDateMatch;
  });

  return (
    <div className="space-y-6">
       <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <Input 
            placeholder="Search by customer or order..." 
            className="pl-10 h-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        
        <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-neutral-900 border rounded-lg px-3 py-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-neutral-400 uppercase">From</span>
            <Input 
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="border-none p-0 focus-visible:ring-0 h-auto text-xs w-[110px] dark:bg-transparent"
            />
          </div>
          <div className="h-4 w-px bg-neutral-200 hidden md:block"></div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-neutral-400 uppercase">To</span>
            <Input 
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="border-none p-0 focus-visible:ring-0 h-auto text-xs w-[110px] dark:bg-transparent"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="flex items-center gap-2 h-10" onClick={() => toast.info("Bulk reminders coming soon")}>
            <Send className="w-4 h-4" />
            Send Reminders
          </Button>
        </div>
      </div>

      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead>Order Info</TableHead>
              <TableHead>Total Bill</TableHead>
              <TableHead>Paid</TableHead>
              <TableHead>Remaining</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredLedgers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-neutral-500">
                  No credit records found
                </TableCell>
              </TableRow>
            ) : (
              filteredLedgers.map((ledger) => (
                <TableRow key={ledger.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-semibold">{getCustomerName(ledger.customerId)}</span>
                      <span className="text-xs text-neutral-500">
                        {new Date(ledger.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-mono text-[10px]">
                      #{ledger.orderId?.substring(0, 8) || 'N/A'}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">₹{(ledger.totalAmount || 0).toLocaleString()}</TableCell>
                  <TableCell className="text-teal-600 font-medium">₹{(ledger.paidAmount || 0).toLocaleString()}</TableCell>
                  <TableCell className="text-rose-600 font-bold">₹{(ledger.dueAmount || 0).toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge className={
                      ledger.status === 'PAID' ? 'bg-teal-100 text-teal-700' : 
                      ledger.status === 'PARTIAL' ? 'bg-blue-100 text-blue-700' : 'bg-rose-100 text-rose-700'
                    }>
                      {ledger.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Dialog open={selectedLedger?.id === ledger.id} onOpenChange={(open) => !open && setSelectedLedger(null)}>
                        <DialogTrigger 
                          render={
                            <Button variant="ghost" size="sm" onClick={() => setSelectedLedger(ledger)}>
                              Record Payment
                            </Button>
                          }
                        />
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Record Payment for {getCustomerName(ledger.customerId)}</DialogTitle>
                            <DialogDescription>
                              Enter the amount paid by the customer. Remaining: ₹{ledger.dueAmount || 0}
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="space-y-2">
                              <Label>Amount Received (₹)</Label>
                              <Input 
                                type="number" 
                                value={paymentAmount} 
                                onChange={e => setPaymentAmount(parseFloat(e.target.value))} 
                                max={ledger.dueAmount}
                              />
                            </div>
                          </div>
                          <DialogFooter>
                            <Button onClick={recordPayment} className="w-full bg-teal-600">Update Ledger</Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                      
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="text-teal-600 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                        onClick={() => sendReminder(ledger.customerId)}
                      >
                        <Send className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
