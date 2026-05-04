import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { db } from '../firebase/config';
import { collection, query, where, onSnapshot, orderBy, getDocs } from 'firebase/firestore';
import { Order, PaymentRecord, Customer } from '../types';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '../components/ui/table';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Search, Receipt, Calendar, CreditCard } from 'lucide-react';
import { format } from 'date-fns';

export default function OrderHistory() {
  const { profile } = useAuth();
  const shopId = profile?.shopId;
  const [items, setItems] = useState<any[]>([]); // Merged Orders and Payments
  const [customers, setCustomers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  useEffect(() => {
    if (!shopId) return;

    // Fetch Customers first to resolve names for payments
    const fetchCustomers = async () => {
      const cSnap = await getDocs(query(collection(db, 'customers'), where('shopId', '==', shopId)));
      const maps: Record<string, string> = {};
      cSnap.docs.forEach(d => {
        maps[d.id] = d.data().name;
      });
      setCustomers(maps);
    };

    fetchCustomers();

    const qOrders = query(collection(db, 'orders'), where('shopId', '==', shopId));
    const qPayments = query(collection(db, 'payments'), where('shopId', '==', shopId));

    const unsubOrders = onSnapshot(qOrders, (snap) => {
      const orders = snap.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data(), 
        _type: 'ORDER', 
        date: (doc.data() as any).createdAt 
      }));
      updateItems(orders, 'ORDER');
    });

    const unsubPayments = onSnapshot(qPayments, (snap) => {
      const payments = snap.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data(), 
        _type: 'PAYMENT', 
        date: (doc.data() as any).timestamp 
      }));
      updateItems(payments, 'PAYMENT');
    });

    const updateItems = (newBatch: any[], type: 'ORDER' | 'PAYMENT') => {
      setItems(prev => {
        const filtered = prev.filter(i => i._type !== type);
        const combined = [...filtered, ...newBatch].sort((a, b) => b.date.localeCompare(a.date));
        return combined;
      });
      setLoading(false);
    };

    return () => {
      unsubOrders();
      unsubPayments();
    };
  }, [shopId]);

  const filteredItems = items.filter(item => {
    const customerName = item.customerName || customers[item.customerId] || 'Unknown Customer';
    const matchesSearch = customerName.toLowerCase().includes(search.toLowerCase()) || item.id.toLowerCase().includes(search.toLowerCase());
    const matchesStartDate = !startDate || item.date >= startDate;
    const matchesEndDate = !endDate || item.date <= (endDate + 'T23:59:59');
    return matchesSearch && matchesStartDate && matchesEndDate;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50 flex items-center gap-2">
            <Receipt className="w-8 h-8 text-teal-600" />
            Order History
          </h1>
          <p className="text-neutral-500 dark:text-neutral-400 mt-2">View and track all past sales transactions.</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2 flex-1 max-w-sm bg-white dark:bg-neutral-900 border rounded-lg px-3 py-2">
          <Search className="w-4 h-4 text-neutral-400" />
          <Input 
            placeholder="Search orders or customers..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="border-none p-0 focus-visible:ring-0 h-auto"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-neutral-900 border rounded-lg px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-neutral-400 uppercase">From</span>
            <Input 
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="border-none p-0 focus-visible:ring-0 h-auto text-xs w-[120px] dark:bg-transparent"
            />
          </div>
          <div className="h-4 w-px bg-neutral-200 hidden md:block"></div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-neutral-400 uppercase">To</span>
            <Input 
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="border-none p-0 focus-visible:ring-0 h-auto text-xs w-[120px] dark:bg-transparent"
            />
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-neutral-50/50">
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Action / Status</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={4} className="text-center py-8">Loading history...</TableCell></TableRow>
            ) : filteredItems.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center py-8">No records found.</TableCell></TableRow>
            ) : filteredItems.map((item) => (
              <TableRow key={item.id} className="hover:bg-neutral-50/50 transition-colors">
                <TableCell>
                  <div className="flex items-center gap-2 text-sm text-neutral-600">
                    <Calendar className="w-3 h-3" />
                    {format(new Date(item.date), 'MMM d, h:mm a')}
                  </div>
                </TableCell>
                <TableCell className="font-medium text-neutral-900">
                  {item.customerName || customers[item.customerId] || 'Customer'}
                </TableCell>
                <TableCell>
                  {item._type === 'ORDER' ? (
                    <Badge variant={item.paymentStatus === 'PAID' ? 'secondary' : 'outline'} className={
                      item.paymentStatus === 'PAID' 
                      ? "bg-teal-50 text-teal-700 border-teal-100 font-medium" 
                      : "bg-amber-50 text-amber-700 border-amber-100 font-medium"
                    }>
                      {item.paymentStatus === 'PAID' ? 'SALE COMPLETED' : 'CREDIT PURCHASE'}
                    </Badge>
                  ) : (
                    <Badge className="bg-blue-50 text-blue-700 border-blue-100 font-medium flex items-center gap-1 w-fit">
                      <CreditCard className="w-3 h-3" /> DUES PAID
                    </Badge>
                  )}
                </TableCell>
                <TableCell className={`text-right font-bold ${item._type === 'PAYMENT' ? 'text-blue-600' : 'text-neutral-900'}`}>
                  {item._type === 'PAYMENT' ? '+' : ''} ₹{(item.totalAmount || item.amount).toFixed(2)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
