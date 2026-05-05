import React, { useEffect, useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../hooks/useAuth';
import { 
  Package, 
  AlertTriangle, 
  TrendingUp,
  IndianRupee,
  ShoppingCart,
  CheckCircle2,
  FileText,
  PackageCheck
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Product, Customer, Order, PaymentRecord } from '../types';
import { handleFirestoreError, OperationType } from '../firebase/utils';
import { format } from 'date-fns';
import { generatePdfReport } from '../lib/pdfGenerator';

export default function Dashboard() {
  const { user, profile } = useAuth();
  const shopId = profile?.shopId;
  const [dateFilter, setDateFilter] = useState<'today' | 'custom'>('today');
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  
  const [stats, setStats] = useState({
    totalSales: 0,
    totalCreditSales: 0,
    duesPaid: 0,
    outstandingCredit: 0,
    lowStock: 0,
    totalUnits: 0,
    totalProductTypes: 0
  });

  const [dateStats, setDateStats] = useState({
    totalSalesAmount: 0,
    itemsSold: 0,
    purchasingCustomers: [] as any[],
    payingCustomers: [] as any[],
  });

  const [loading, setLoading] = useState(true);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);

  const [allOrdersData, setAllOrdersData] = useState<Order[]>([]);
  const [allPaymentsData, setAllPaymentsData] = useState<PaymentRecord[]>([]);

  const downloadSalesDuesReport = () => {
    const headers = ['Customer Name', 'Total Sales (Period)', 'Total Paid (Period)', 'Current Total Dues'];
    
    const filteredOrders = allOrdersData.filter(o => o.createdAt >= startDate && o.createdAt <= (endDate + 'T23:59:59'));
    const filteredPayments = allPaymentsData.filter(p => p.timestamp >= startDate && p.timestamp <= (endDate + 'T23:59:59'));

    const data = allCustomers.map(cust => {
      const salesInPeriod = filteredOrders
        .filter(o => o.customerId === cust.id)
        .reduce((acc, o) => acc + o.totalAmount, 0);
      
      const paidInPeriod = filteredPayments
        .filter(p => p.customerId === cust.id)
        .reduce((acc, p) => acc + p.amount, 0);

      return [
        cust.name,
        `Rs. ${(salesInPeriod || 0).toLocaleString()}`,
        `Rs. ${(paidInPeriod || 0).toLocaleString()}`,
        `Rs. ${(cust.totalDue || 0).toLocaleString()}`
      ];
    });
    
    generatePdfReport({
      title: `${profile?.shopName || 'Shop'} - Sales & Dues Summary (${startDate === endDate ? startDate : `${startDate} to ${endDate}`})`,
      headers,
      data,
      filename: `sales-dues-summary-${startDate}-to-${endDate}`
    });
  };

  const downloadInventoryReport = () => {
    const headers = ['Product Name', 'SKU', 'Sold in Period', 'Stock Left', 'Price'];
    const filteredOrders = allOrdersData.filter(o => o.createdAt >= startDate && o.createdAt <= (endDate + 'T23:59:59'));

    const data = allProducts.map(p => {
      const soldInPeriod = filteredOrders
        .flatMap(o => o.items)
        .filter(item => item.productId === p.id)
        .reduce((acc, item) => acc + item.quantity, 0);

      return [
        p.name,
        p.sku || '-',
        soldInPeriod.toString(),
        p.quantity.toString(),
        `Rs. ${p.price.toFixed(2)}`
      ];
    });

    generatePdfReport({
      title: `${profile?.shopName || 'Shop'} - Stock & Sales Report (${startDate === endDate ? startDate : `${startDate} to ${endDate}`})`,
      headers,
      data,
      filename: `inventory-sales-report-${startDate}-to-${endDate}`
    });
  };

  useEffect(() => {
    if (dateFilter === 'today') {
      const today = format(new Date(), 'yyyy-MM-dd');
      setStartDate(today);
      setEndDate(today);
    }
  }, [dateFilter]);

  useEffect(() => {
    async function fetchAllData() {
      if (!shopId) {
        setLoading(false);
        return;
      }
      setLoading(true);

      try {
        const [productSnap, customerSnap, orderSnapTotal, paymentSnapTotal] = await Promise.all([
          getDocs(query(collection(db, 'products'), where('shopId', '==', shopId))),
          getDocs(query(collection(db, 'customers'), where('shopId', '==', shopId))),
          getDocs(query(collection(db, 'orders'), where('shopId', '==', shopId))),
          getDocs(query(collection(db, 'payments'), where('shopId', '==', shopId)))
        ]);

        const products = productSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
        const customers = customerSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer));
        const allOrders = orderSnapTotal.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
        const allPayments = paymentSnapTotal.docs.map(doc => ({ id: doc.id, ...doc.data() } as PaymentRecord));
        
        setAllProducts(products);
        setAllCustomers(customers);
        setAllOrdersData(allOrders);
        setAllPaymentsData(allPayments);

        // --- FILTER FOR DATE RANGE ---
        const filteredOrders = allOrders.filter(o => o.createdAt >= startDate && o.createdAt <= (endDate + 'T23:59:59'));
        const filteredPayments = allPayments.filter(p => p.timestamp >= startDate && p.timestamp <= (endDate + 'T23:59:59'));

        const totalSalesInRange = filteredOrders.reduce((acc, o) => acc + o.totalAmount, 0);
        const creditSalesInRange = filteredOrders.filter(o => o.paymentStatus === 'PAY_LATER').reduce((acc, o) => acc + o.totalAmount, 0);
        const duesPaidInRange = filteredPayments.filter(p => p.type === 'DUES_PAYMENT').reduce((acc, p) => acc + p.amount, 0);
        
        // Dues Remaining is always the CURRENT ground truth for the shop
        const currentOutstanding = customers.reduce((acc, c) => acc + (c.totalDue || 0), 0);

        setStats({
          totalSales: totalSalesInRange,
          totalCreditSales: creditSalesInRange,
          duesPaid: duesPaidInRange,
          outstandingCredit: currentOutstanding,
          lowStock: products.filter(p => p.quantity <= (p.lowStockThreshold || 5)).length,
          totalUnits: products.reduce((acc, p) => acc + p.quantity, 0),
          totalProductTypes: productSnap.size
        });

        const itemsSoldInRange = filteredOrders.reduce((acc, o) => acc + (o.items || []).reduce((sum, i) => sum + i.quantity, 0), 0);
        const uniquePurchasingIds = Array.from(new Set(filteredOrders.map(o => o.customerId)));
        const purchasingCustomersList = customers.filter(c => uniquePurchasingIds.includes(c.id));
        const uniquePayingIds = Array.from(new Set(filteredPayments.map(p => p.customerId)));
        const payingCustomersList = customers.filter(c => uniquePayingIds.includes(c.id)).map(c => {
          const totalPaid = filteredPayments.filter(p => p.customerId === c.id).reduce((sum, p) => sum + p.amount, 0);
          return { ...c, dailyPaid: totalPaid };
        });

        setDateStats({
          totalSalesAmount: totalSalesInRange,
          itemsSold: itemsSoldInRange,
          purchasingCustomers: purchasingCustomersList,
          payingCustomers: payingCustomersList,
        });

      } catch (error) {
        handleFirestoreError(error, OperationType.GET, 'dashboard-summary');
      } finally {
        setLoading(false);
      }
    }

    fetchAllData();
  }, [shopId, startDate, endDate]);

  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
    </div>
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900 tracking-tight">Dashboard Overview</h1>
          <p className="text-neutral-500 mt-1">Status: {dateFilter === 'today' ? 'Today\'s Summary' : `From ${startDate} To ${endDate}`}</p>
        </div>
      </div>

      {/* Date-Picker & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-5 rounded-2xl shadow-sm border border-neutral-100">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-teal-600" />
            Performance Insights
          </h2>
          <p className="text-sm text-neutral-500">Summary matching your selected time range.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-4">
          {/* Quick Filter Toggle */}
          <div className="flex bg-neutral-100 p-1.5 rounded-xl border border-neutral-200/50">
            <Button 
              variant="ghost" 
              size="sm" 
              className={`h-9 px-4 rounded-lg text-sm font-semibold transition-all ${dateFilter === 'today' ? 'bg-white shadow-sm text-teal-600' : 'text-neutral-500'}`}
              onClick={() => setDateFilter('today')}
            >
              Today
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              className={`h-9 px-4 rounded-lg text-sm font-semibold transition-all ${dateFilter === 'custom' ? 'bg-white shadow-sm text-teal-600' : 'text-neutral-500'}`}
              onClick={() => setDateFilter('custom')}
            >
              Custom Range
            </Button>
          </div>

          {/* Date Picker Inputs (Always visible/editable in custom mode) */}
          <div className={`flex flex-wrap items-center gap-2 transition-opacity ${dateFilter === 'today' ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
            <div className="flex items-center gap-2 bg-neutral-50 px-3 py-2 rounded-lg border border-neutral-200">
              <span className="text-[10px] font-bold text-neutral-400 uppercase">From</span>
              <Input 
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="border-none p-0 h-auto focus-visible:ring-0 bg-transparent text-sm w-[125px] font-medium"
              />
            </div>
            <div className="flex items-center gap-2 bg-neutral-50 px-3 py-2 rounded-lg border border-neutral-200">
              <span className="text-[10px] font-bold text-neutral-400 uppercase">To</span>
              <Input 
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="border-none p-0 h-auto focus-visible:ring-0 bg-transparent text-sm w-[125px] font-medium"
              />
            </div>
          </div>

          <div className="h-8 w-px bg-neutral-200 hidden lg:block"></div>

          {/* PDF Downloads */}
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="h-10 text-teal-600 hover:text-teal-700 hover:bg-teal-50 border-teal-200 gap-2 px-3 lg:px-4"
              onClick={downloadSalesDuesReport}
            >
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">Sales & Dues Report</span>
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="h-10 text-blue-600 hover:text-blue-700 hover:bg-blue-50 border-blue-200 gap-2 px-3 lg:px-4"
              onClick={downloadInventoryReport}
            >
              <PackageCheck className="w-4 h-4" />
              <span className="hidden sm:inline">Stock Status Report</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Date-Specific Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <Card className="border-none shadow-sm bg-teal-600 text-white">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-teal-100 uppercase tracking-wider">
                  Total Sales ({startDate === endDate ? format(new Date(startDate), 'dd MMM') : `${format(new Date(startDate), 'dd MMM')} - ${format(new Date(endDate), 'dd MMM')}`})
                </p>
                <h3 className="text-2xl font-bold mt-1">₹{(dateStats.totalSalesAmount || 0).toLocaleString()}</h3>
              </div>
              <div className="p-3 bg-white/20 rounded-xl">
                <IndianRupee className="w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-blue-600 text-white">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-blue-100 uppercase tracking-wider">Items Sold Today</p>
                <h3 className="text-2xl font-bold mt-1">{dateStats.itemsSold} Products</h3>
              </div>
              <div className="p-3 bg-white/20 rounded-xl">
                <ShoppingCart className="w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white border border-neutral-100">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Total In Stock</p>
                <div className="flex flex-col">
                  <h3 className="text-2xl font-bold mt-1 text-neutral-900">{stats.totalProductTypes || 0} Types</h3>
                  <p className="text-xs text-neutral-400 font-medium">{(stats.totalUnits || 0).toLocaleString()} total units</p>
                </div>
              </div>
              <div className="p-3 bg-neutral-100 rounded-xl">
                <Package className="w-6 h-6 text-neutral-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white border border-neutral-100">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Low Stock Alerts</p>
                <h3 className={`text-2xl font-bold mt-1 ${stats.lowStock > 0 ? 'text-amber-600' : 'text-teal-600'}`}>
                  {stats.lowStock} Items
                </h3>
              </div>
              <div className="p-3 bg-amber-50 rounded-xl">
                <AlertTriangle className="w-6 h-6 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Customer Activity for the day */}
        <Card className="lg:col-span-1 border-none shadow-sm bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-neutral-500">Customer Activity</CardTitle>
            <CardDescription>
              {startDate === endDate 
                ? format(new Date(startDate), 'dd MMM yyyy') 
                : `${format(new Date(startDate), 'dd MMM')} - ${format(new Date(endDate), 'dd MMM')}`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <p className="text-xs font-bold text-blue-600 flex items-center gap-1">
                <ShoppingCart className="w-3 h-3" /> PURCHASED ({dateStats.purchasingCustomers.length})
              </p>
              {dateStats.purchasingCustomers.length === 0 ? (
                <p className="text-xs text-neutral-400 italic">No purchases today</p>
              ) : (
                <div className="space-y-2">
                  {dateStats.purchasingCustomers.map(c => (
                    <div key={c.id} className="flex items-center gap-2 text-xs">
                      <div className="w-6 h-6 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                        {c.name.charAt(0)}
                      </div>
                      <span className="font-medium truncate">{c.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-3 pt-4 border-t border-neutral-50">
              <p className="text-xs font-bold text-teal-600 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> PAID DUES ({dateStats.payingCustomers.length})
              </p>
              {dateStats.payingCustomers.length === 0 ? (
                <p className="text-xs text-neutral-400 italic">No payments today</p>
              ) : (
                <div className="space-y-2">
                  {dateStats.payingCustomers.map(c => (
                    <div key={c.id} className="flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-teal-50 text-teal-600 flex items-center justify-center font-bold">
                          {c.name.charAt(0)}
                        </div>
                        <span className="font-medium truncate">{c.name}</span>
                      </div>
                      <span className="font-bold text-teal-600">₹{(c.dailyPaid || 0).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Shop Credit Health Summary */}
        <Card className="lg:col-span-2 border-none shadow-sm bg-white border border-neutral-100">
          <CardHeader>
            <CardTitle className="text-lg">Business Overview</CardTitle>
            <CardDescription>Performance for {dateFilter === 'today' ? 'Today' : 'selected range'}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-blue-50 border border-blue-100">
                <p className="text-xs font-bold text-blue-600 uppercase mb-1">Total Sales</p>
                <p className="text-2xl font-bold text-blue-900">₹{(stats.totalSales || 0).toLocaleString()}</p>
                <p className="text-[10px] text-blue-400 mt-1">{dateFilter === 'today' ? 'Today\'s' : 'Range'} sales total</p>
              </div>
              <div className="p-4 rounded-xl bg-teal-50 border border-teal-100">
                <p className="text-xs font-bold text-teal-600 uppercase mb-1">Total Credit Sales</p>
                <p className="text-2xl font-bold text-teal-900">₹{(stats.totalCreditSales || 0).toLocaleString()}</p>
                <p className="text-[10px] text-teal-400 mt-1">Amount sold on credit</p>
              </div>
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-100">
                <p className="text-xs font-bold text-amber-600 uppercase mb-1">Dues Paid</p>
                <p className="text-2xl font-bold text-amber-900">₹{(stats.duesPaid || 0).toLocaleString()}</p>
                <p className="text-[10px] text-amber-400 mt-1">Debt recovered in period</p>
              </div>
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-100 shadow-sm border-2">
                <p className="text-xs font-bold text-rose-600 uppercase mb-1">Dues Remaining</p>
                <p className="text-2xl font-bold text-rose-900">₹{(stats.outstandingCredit || 0).toLocaleString()}</p>
                <p className="text-[10px] text-rose-400 mt-1">Current total outstanding debt</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
