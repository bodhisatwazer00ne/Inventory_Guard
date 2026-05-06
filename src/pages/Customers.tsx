import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, doc, deleteDoc, updateDoc, addDoc, getDocs, orderBy, writeBatch, increment } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../hooks/useAuth';
import { 
  Users, 
  Search, 
  MoreVertical, 
  Mail, 
  Phone, 
  MapPin, 
  ExternalLink,
  History,
  Send,
  Plus,
  UserPlus,
  CreditCard,
  Calendar,
  ChevronRight,
  ArrowDownCircle,
  ArrowUpCircle,
  Receipt,
  FileDown
} from 'lucide-react';
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
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Customer, Order, LedgerEntry } from '../types';
import { handleFirestoreError, OperationType } from '../firebase/utils';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { generateBillPdf, generateCustomerHistoryPdf } from '../lib/pdfGenerator';

export default function Customers() {
  const { user, profile } = useAuth();
  const isAdmin = profile?.role === 'ADMIN';
  const shopId = profile?.shopId;
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', email: '', phone: '', address: '' });

  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [customerOrders, setCustomerOrders] = useState<Order[]>([]);
  const [customerPayments, setCustomerPayments] = useState<any[]>([]);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Date range for history report
  const [reportDateRange, setReportDateRange] = useState({
    start: format(new Date(), 'yyyy-MM-01'), // Start of current month
    end: format(new Date(), 'yyyy-MM-dd')
  });
  const [reportType, setReportType] = useState<'today' | 'range'>('today');

  useEffect(() => {
    if (!shopId) return;
    const q = query(
      collection(db, 'customers'),
      where('shopId', '==', shopId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setCustomers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer)));
      setLoading(false);
    });

    return unsubscribe;
  }, [shopId]);

  const handleCreate = async () => {
    if (!shopId || !newCustomer.name) return;
    const customerNumber = `CUST-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    try {
      const docRef = doc(db, 'users', user.uid);
      await addDoc(collection(db, 'customers'), {
        shopId: shopId,
        customerNumber,
        ...newCustomer,
        totalDue: 0,
        createdAt: new Date().toISOString()
      });
      setIsAddDialogOpen(false);
      setNewCustomer({ name: '', email: '', phone: '', address: '' });
      toast.success('Customer added successfully');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'customers');
      toast.error('Failed to add customer');
    }
  };

  const openHistory = async (customer: Customer) => {
    setSelectedCustomer(customer);
    setIsHistoryOpen(true);
    setHistoryLoading(true);
    
    try {
      // Fetch orders for this customer
      const qOrders = query(
        collection(db, 'orders'),
        where('shopId', '==', shopId),
        where('customerId', '==', customer.id)
      );
      
      // Fetch payments for this customer
      const qPayments = query(
        collection(db, 'payments'),
        where('shopId', '==', shopId),
        where('customerId', '==', customer.id)
      );

      const [orderSnap, paymentSnap] = await Promise.all([
        getDocs(qOrders),
        getDocs(qPayments)
      ]);

      console.log(`Fetched ${orderSnap.size} orders and ${paymentSnap.size} payments for customer ${customer.id}`);

      const fetchedOrders = orderSnap.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Order))
        .sort((a, b) => ((b.createdAt || '') as string).localeCompare((a.createdAt || '') as string));
      
      const fetchedPayments = paymentSnap.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as any))
        .sort((a, b) => ((b.timestamp || '') as string).localeCompare((a.timestamp || '') as string));

      setCustomerOrders(fetchedOrders);
      setCustomerPayments(fetchedPayments);
    } catch (error) {
      console.error("Error fetching history:", error);
      toast.error("Failed to load customer history");
    } finally {
      setHistoryLoading(false);
    }
  };

  const handlePayment = async () => {
    if (!selectedCustomer || paymentAmount <= 0 || !shopId) return;

    if (paymentAmount > (selectedCustomer.totalDue || 0)) {
      toast.error(`Payment amount (₹${paymentAmount}) cannot exceed total due (₹${selectedCustomer.totalDue})`);
      return;
    }
    
    try {
      const batch = writeBatch(db);
      const now = new Date().toISOString();
      
      // 1. Fetch pending ledger entries to settle them
      const qLedger = query(
        collection(db, 'ledgerEntries'),
        where('shopId', '==', shopId),
        where('customerId', '==', selectedCustomer.id),
        where('status', 'in', ['UNPAID', 'PARTIAL'])
      );
      
      const ledgerSnap = await getDocs(qLedger);
      const pendingEntries = ledgerSnap.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as LedgerEntry))
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

      let remainingPayment = paymentAmount;

      // Distribute payment across pending ledger entries
      for (const entry of pendingEntries) {
        if (remainingPayment <= 0) break;
        
        const amountToApply = Math.min(entry.dueAmount, remainingPayment);
        const newPaidAmount = entry.paidAmount + amountToApply;
        const newDueAmount = entry.dueAmount - amountToApply;
        const newStatus = newDueAmount <= 0 ? 'PAID' : 'PARTIAL';

        const entryRef = doc(db, 'ledgerEntries', entry.id);
        batch.update(entryRef, {
          paidAmount: newPaidAmount,
          dueAmount: newDueAmount,
          status: newStatus,
          updatedAt: now
        });

        // Also update the source order to PAID if fully settled
        if (newStatus === 'PAID' && entry.orderId) {
          const orderRef = doc(db, 'orders', entry.orderId);
          batch.update(orderRef, { paymentStatus: 'PAID' });
        }

        remainingPayment -= amountToApply;
      }

      // 2. Create a generic payment record
      const paymentRef = doc(collection(db, 'payments'));
      batch.set(paymentRef, {
        shopId: shopId,
        customerId: selectedCustomer.id,
        amount: paymentAmount,
        timestamp: now,
        type: 'DUES_PAYMENT',
        note: remainingPayment > 0 ? `Unallocated excess: ${remainingPayment}` : ''
      });

      // 3. Update customer totalDue
      const customerRef = doc(db, 'customers', selectedCustomer.id);
      batch.update(customerRef, {
        totalDue: increment(-paymentAmount)
      });

      await batch.commit();
      toast.success('Payment recorded and records updated');
      setIsPaymentOpen(false);
      setPaymentAmount(0);
      setIsHistoryOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'multi-collection-payment-batch');
      toast.error('Failed to record payment');
    }
  };

  const handleDownloadReport = () => {
    if (!selectedCustomer) return;

    let filteredOrders = customerOrders;
    let filteredPayments = customerPayments;

    const start = reportType === 'today' ? new Date().setHours(0, 0, 0, 0) : new Date(reportDateRange.start).setHours(0, 0, 0, 0);
    const end = reportType === 'today' ? new Date().setHours(23, 59, 59, 999) : new Date(reportDateRange.end).setHours(23, 59, 59, 999);

    filteredOrders = customerOrders.filter(o => {
      const date = new Date(o.createdAt).getTime();
      return date >= start && date <= end;
    });

    filteredPayments = customerPayments.filter(p => {
      const date = new Date(p.timestamp).getTime();
      return date >= start && date <= end;
    });

    generateCustomerHistoryPdf(
      selectedCustomer,
      profile?.shopName || 'Shop',
      filteredOrders,
      filteredPayments,
      {
        start: format(new Date(start), 'dd MMM yyyy'),
        end: format(new Date(end), 'dd MMM yyyy')
      }
    );
  };

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.customerNumber?.toLowerCase().includes(search.toLowerCase()) ||
    c.phone?.includes(search) ||
    c.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <Input 
            placeholder="Search by name, ID, or phone..." 
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger 
            render={
              <Button className="bg-teal-600 hover:bg-teal-700">
                <UserPlus className="w-4 h-4 mr-2" />
                Add Customer
              </Button>
            }
          />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Customer</DialogTitle>
              <DialogDescription>Register a new customer to your shop.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input value={newCustomer.name} onChange={e => setNewCustomer({...newCustomer, name: e.target.value})} placeholder="Jane Smith" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input value={newCustomer.phone} onChange={e => setNewCustomer({...newCustomer, phone: e.target.value})} placeholder="+91..." />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input value={newCustomer.email} onChange={e => setNewCustomer({...newCustomer, email: e.target.value})} placeholder="jane@example.com" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Address</Label>
                <Input value={newCustomer.address} onChange={e => setNewCustomer({...newCustomer, address: e.target.value})} placeholder="123 Street, City" />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleCreate} className="w-full bg-teal-600">Create Customer</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCustomers.length === 0 ? (
          <div className="col-span-full text-center py-20 text-neutral-500">
            <Users className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p>No customers found</p>
          </div>
        ) : (
          filteredCustomers.map((customer) => (
            <Card key={customer.id} className="border-none shadow-sm hover:shadow-md transition-all group overflow-hidden">
              <CardHeader className="flex flex-row items-center gap-4 pb-4">
                <Avatar className="w-12 h-12 border border-neutral-100">
                  <AvatarFallback className="bg-teal-50 text-teal-700 font-bold">
                    {customer.name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <CardTitle 
                    className="text-lg truncate cursor-pointer hover:text-teal-600 flex items-center gap-2"
                    onClick={() => openHistory(customer)}
                  >
                    {customer.name}
                    <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </CardTitle>
                  <p className="text-[10px] font-mono text-neutral-400 mt-0.5">{customer.customerNumber}</p>
                  <CardDescription className="truncate">Joined {new Date(customer.createdAt).toLocaleDateString()}</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  {customer.email && (
                    <div className="flex items-center gap-3 text-sm text-neutral-600">
                      <Mail className="w-4 h-4" />
                      <span className="truncate">{customer.email}</span>
                    </div>
                  )}
                  {customer.phone && (
                    <div className="flex items-center gap-3 text-sm text-neutral-600">
                      <Phone className="w-4 h-4" />
                      <span>{customer.phone}</span>
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-neutral-100 flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-xs text-neutral-500 uppercase tracking-wider font-semibold">Total Due</span>
                    <span className={`text-xl font-bold ${(customer.totalDue || 0) > 0 ? 'text-rose-600' : 'text-teal-600'}`}>
                      ₹{(customer.totalDue || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    {customer.totalDue > 0 && (
                      <Button 
                        variant="secondary" 
                        size="sm" 
                        className="h-8 bg-rose-50 text-rose-600 hover:bg-rose-100 border-rose-100"
                        onClick={() => {
                          setSelectedCustomer(customer);
                          setPaymentAmount(customer.totalDue);
                          setIsPaymentOpen(true);
                        }}
                      >
                        <CreditCard className="w-3 h-3 mr-1.5" />
                        Pay Due
                      </Button>
                    )}
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 text-neutral-500"
                      onClick={() => openHistory(customer)}
                    >
                      <History className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Customer History Dialog */}
      <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-5 h-5 text-teal-600" />
              {selectedCustomer?.name}'s History
            </DialogTitle>
            <DialogDescription>
              Orders and transaction records. Total outstanding: ₹{(selectedCustomer?.totalDue || 0).toLocaleString()}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-6">
            <div className="flex flex-col sm:flex-row items-end gap-4 p-4 bg-neutral-50 rounded-xl">
              <div className="flex-1 space-y-2">
                <Label className="text-xs text-neutral-500 uppercase tracking-wider font-semibold">Report Period</Label>
                <div className="flex gap-2">
                  <Button 
                    variant={reportType === 'today' ? 'default' : 'outline'} 
                    size="sm"
                    className={reportType === 'today' ? 'bg-teal-600' : ''}
                    onClick={() => setReportType('today')}
                  >
                    Today
                  </Button>
                  <Button 
                    variant={reportType === 'range' ? 'default' : 'outline'} 
                    size="sm"
                    className={reportType === 'range' ? 'bg-teal-600' : ''}
                    onClick={() => setReportType('range')}
                  >
                    Custom Range
                  </Button>
                </div>
              </div>

              {reportType === 'range' && (
                <>
                  <div className="space-y-2">
                    <Label className="text-xs">From</Label>
                    <Input 
                      type="date" 
                      className="h-9 w-[140px]" 
                      value={reportDateRange.start}
                      onChange={e => setReportDateRange(prev => ({ ...prev, start: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">To</Label>
                    <Input 
                      type="date" 
                      className="h-9 w-[140px]"
                      value={reportDateRange.end}
                      onChange={e => setReportDateRange(prev => ({ ...prev, end: e.target.value }))}
                    />
                  </div>
                </>
              )}

              <Button 
                onClick={handleDownloadReport} 
                className="bg-neutral-900 hover:bg-neutral-800 text-white"
                disabled={historyLoading}
              >
                <FileDown className="w-4 h-4 mr-2" />
                Download PDF
              </Button>
            </div>

            {historyLoading ? (
              <div className="py-12 text-center text-neutral-500">Loading history...</div>
            ) : (
              <>
                <div>
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-blue-600" /> Recent Orders / Bills
                  </h3>
                  <div className="border rounded-lg overflow-hidden overflow-x-auto">
                    <div className="min-w-[550px] sm:min-w-0">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-neutral-50">
                            <TableHead>Date</TableHead>
                            <TableHead>Items</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                            <TableHead className="w-[40px]"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {customerOrders.length === 0 ? (
                            <TableRow><TableCell colSpan={5} className="text-center py-4 text-neutral-500">No orders found</TableCell></TableRow>
                          ) : (
                            customerOrders.map(order => (
                              <TableRow key={order.id}>
                                <TableCell className="text-xs whitespace-nowrap">{format(new Date(order.createdAt), 'dd MMM yy')}</TableCell>
                                <TableCell className="max-w-[150px] sm:max-w-[200px] truncate text-xs">
                                  {order.items.map(i => i.name).join(', ')}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className={`text-[10px] ${order.paymentStatus === 'PAID' ? 'bg-teal-50 text-teal-700 border-teal-100' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>
                                    {order.paymentStatus}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right font-medium text-xs whitespace-nowrap">₹{(order.totalAmount || 0).toLocaleString()}</TableCell>
                                <TableCell>
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-7 w-7 text-neutral-400 hover:text-teal-600"
                                    title="Download Receipt"
                                    onClick={() => generateBillPdf(order, selectedCustomer, profile?.shopName || 'Shop')}
                                  >
                                    <FileDown className="w-3.5 h-3.5" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-rose-600" /> Payment History (Dues Paid)
                  </h3>
                  <div className="border rounded-lg overflow-hidden overflow-x-auto">
                    <div className="min-w-[450px] sm:min-w-0">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-neutral-50">
                            <TableHead>Date</TableHead>
                            <TableHead>Amount Paid</TableHead>
                            <TableHead>Type</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {customerPayments.length === 0 ? (
                            <TableRow><TableCell colSpan={3} className="text-center py-4 text-neutral-500">No payment history</TableCell></TableRow>
                          ) : (
                            customerPayments.map(payment => (
                              <TableRow key={payment.id}>
                                <TableCell className="text-xs whitespace-nowrap">{payment.timestamp ? format(new Date(payment.timestamp), 'dd MMM yy HH:mm') : 'N/A'}</TableCell>
                                <TableCell className="text-teal-600 font-bold text-xs whitespace-nowrap">₹{(payment.amount || 0).toLocaleString()}</TableCell>
                                <TableCell className="text-xs text-neutral-500 whitespace-nowrap">{payment.type?.replace('_', ' ') || 'Payment'}</TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
          <DialogFooter className="flex justify-between items-center sm:justify-between">
            <Button variant="ghost" onClick={() => setIsHistoryOpen(false)}>Close</Button>
            {selectedCustomer && selectedCustomer.totalDue > 0 && (
              <Button className="bg-teal-600" onClick={() => setIsPaymentOpen(true)}>
                Record Payment
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record Payment Dialog */}
      <Dialog open={isPaymentOpen} onOpenChange={setIsPaymentOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>Settle outstanding dues for {selectedCustomer?.name}</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label>Payment Amount (₹)</Label>
              <Input 
                type="number" 
                value={paymentAmount} 
                onChange={e => setPaymentAmount(parseFloat(e.target.value))}
                className="text-lg font-bold"
              />
              <p className="text-xs text-neutral-500">
                Current outstanding: ₹{(selectedCustomer?.totalDue || 0).toLocaleString()}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPaymentOpen(false)}>Cancel</Button>
            <Button className="bg-teal-600" onClick={handlePayment}>Confirm Payment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
