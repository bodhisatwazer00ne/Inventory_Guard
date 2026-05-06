import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, doc, updateDoc, writeBatch, increment, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../hooks/useAuth';
import { 
  Search, 
  Trash2, 
  Plus, 
  Minus, 
  UserPlus, 
  CreditCard,
  Check,
  ChevronRight,
  ShoppingCart,
  X,
  Package,
  IndianRupee,
  Activity
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Separator } from '../components/ui/separator';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '../components/ui/select';
import { Product, Customer, OrderItem } from '../types';
import { handleFirestoreError, OperationType } from '../firebase/utils';
import { useLanguage } from '../contexts/LanguageContext';
import { toast } from 'sonner';
import { ScrollArea } from '../components/ui/scroll-area';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from '../components/ui/dialog';
import { Label } from '../components/ui/label';

export default function Billing() {
  const { t } = useLanguage();
  const { user, profile } = useAuth();
  const isAdmin = profile?.role === 'ADMIN';
  const shopId = profile?.shopId;
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [paymentStatus, setPaymentStatus] = useState<'PAID' | 'PAY_LATER'>('PAID');
  const [isCustomerDialogOpen, setIsCustomerDialogOpen] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', email: '' });
  const [searchProduct, setSearchProduct] = useState('');
  const [isManualMode, setIsManualMode] = useState(false);
  const [manualAmount, setManualAmount] = useState('');

  useEffect(() => {
    if (!shopId) return;

    // Real-time products to handle stock consistency
    const qProd = query(collection(db, 'products'), where('shopId', '==', shopId));
    const unsubscribeProd = onSnapshot(qProd, (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'billing-products-stream');
    });

    // Fetched customers
    async function fetchCustomers() {
      try {
        const cSnap = await getDocs(query(collection(db, 'customers'), where('shopId', '==', shopId)));
        setCustomers(cSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer)));
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, 'billing-customers');
      }
    }
    fetchCustomers();

    return () => unsubscribeProd();
  }, [shopId]);

  const getAvailableQuantity = (product: Product) => {
    if (product.id.startsWith('manual-')) return 999;
    const itemInCart = cart.find(item => item.productId === product.id);
    return product.quantity - (itemInCart?.quantity || 0);
  };

  const addToCart = (product: Product) => {
    const available = getAvailableQuantity(product);
    
    if (available <= 0) {
      toast.error("Item out of stock");
      return;
    }

    setCart(prev => {
      const existing = prev.find(item => item.productId === product.id);
      if (existing) {
        return prev.map(item => 
          item.productId === product.id 
            ? { ...item, quantity: item.quantity + 1, total: (item.quantity + 1) * item.price }
            : item
        );
      }
      return [...prev, {
        productId: product.id,
        name: product.name,
        quantity: 1,
        price: product.price,
        total: product.price
      }];
    });
  };

  const updateCartQuantity = (productId: string, delta: number) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    setCart(prev => prev.map(item => {
      if (item.productId === productId) {
        const newQty = Math.max(1, item.quantity + delta);
        if (delta > 0 && newQty > product.quantity) {
          toast.error("Stock limit reached");
          return item;
        }
        return { ...item, quantity: newQty, total: newQty * item.price };
      }
      return item;
    }));
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.productId !== productId));
  };

  const totalAmount = cart.reduce((acc, item) => acc + item.total, 0);

  const handleCheckout = async () => {
    if (!user) return;
    if (cart.length === 0) {
      toast.error("Cart is empty");
      return;
    }
    if (!selectedCustomerId) {
      toast.error("Please select a customer");
      return;
    }

    if (selectedCustomerId === 'walk-in' && paymentStatus === 'PAY_LATER') {
      toast.error("Cannot record credit for walk-in customer");
      return;
    }

    const batch = writeBatch(db);
    const createdAt = new Date().toISOString();

    try {
      // 1. Create Order
      const orderRef = doc(collection(db, 'orders'));
      const customer = customers.find(c => c.id === selectedCustomerId);
      const isWalkIn = selectedCustomerId === 'walk-in';
      
      const orderData = {
        shopId,
        customerId: selectedCustomerId,
        customerName: isWalkIn ? 'Walk-in Customer' : (customer?.name || 'Unknown'),
        items: cart,
        totalAmount,
        paymentStatus,
        createdAt
      };
      batch.set(orderRef, orderData);

      // Update customer total lifetime spent
      if (!isWalkIn) {
        const customerRef = doc(db, 'customers', selectedCustomerId);
        batch.update(customerRef, {
          totalSpent: increment(totalAmount)
        });
      }

      // 2. Update Inventory
      cart.forEach(item => {
        if (item.productId.startsWith('manual-')) return;
        const productRef = doc(db, 'products', item.productId);
        batch.update(productRef, {
          quantity: increment(-item.quantity),
          updatedAt: createdAt
        });
      });

      // 3. Handle Ledger (if Pay Later) or Payment (if Paid)
      if (paymentStatus === 'PAY_LATER' && !isWalkIn) {
        const ledgerRef = doc(collection(db, 'ledgerEntries'));
        batch.set(ledgerRef, {
          shopId,
          customerId: selectedCustomerId,
          orderId: orderRef.id,
          totalAmount,
          paidAmount: 0,
          dueAmount: totalAmount,
          status: 'UNPAID',
          createdAt,
          updatedAt: createdAt
        });

        // Update customer total due
        const customerRef = doc(db, 'customers', selectedCustomerId);
        batch.update(customerRef, {
          totalDue: increment(totalAmount)
        });
      } else {
        // Record payment for immediate cash sales so it shows in history
        const paymentRef = doc(collection(db, 'payments'));
        batch.set(paymentRef, {
          shopId,
          customerId: selectedCustomerId,
          amount: totalAmount,
          timestamp: createdAt,
          type: 'CASH_SALE',
          orderId: orderRef.id
        });
      }

      await batch.commit();
      toast.success(paymentStatus === 'PAY_LATER' ? "Credit order created" : "Sale completed");
      setCart([]);
      setSelectedCustomerId('');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'checkout-batch');
      toast.error("Transaction failed");
    }
  };

  const createCustomer = async () => {
    if (!shopId || !newCustomer.name) return;
    const customerNumber = `CUST-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    try {
      const docRef = await addDoc(collection(db, 'customers'), {
        shopId: shopId,
        customerNumber,
        ...newCustomer,
        totalDue: 0,
        createdAt: new Date().toISOString()
      });
      const createdCustomer = { id: docRef.id, customerNumber, ...newCustomer, shopId: shopId, totalDue: 0, createdAt: new Date().toISOString() } as Customer;
      setCustomers([...customers, createdCustomer]);
      setSelectedCustomerId(docRef.id);
      setIsCustomerDialogOpen(false);
      setNewCustomer({ name: '', phone: '', email: '' });
      toast.success("Customer created");
    } catch (error) {
      toast.error("Failed to create customer");
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchProduct.toLowerCase()) ||
    p.sku?.toLowerCase().includes(searchProduct.toLowerCase())
  );

  return (
    <div className="flex flex-col xl:flex-row gap-6 h-full min-h-0">
      {/* Left: Selection Area */}
      <div className="flex-1 min-w-0 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex bg-neutral-100 p-1 rounded-xl w-full sm:w-auto">
            <button 
              onClick={() => setIsManualMode(false)}
              className={`flex-1 sm:flex-none px-6 py-2 rounded-lg text-sm font-semibold transition-all ${!isManualMode ? 'bg-white shadow-sm text-teal-600' : 'text-neutral-500'}`}
            >
              Inventory
            </button>
            <button 
              onClick={() => setIsManualMode(true)}
              className={`flex-1 sm:flex-none px-6 py-2 rounded-lg text-sm font-semibold transition-all ${isManualMode ? 'bg-white shadow-sm text-blue-600' : 'text-neutral-500'}`}
            >
              Manual
            </button>
          </div>
        </div>

        {!isManualMode ? (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <Input 
                  placeholder="Search items..." 
                  className="pl-10 h-10"
                  value={searchProduct}
                  onChange={e => setSearchProduct(e.target.value)}
                />
              </div>
              <div className="hidden sm:flex items-center gap-2">
                <Badge variant="outline" className="h-10 px-4 rounded-lg bg-white flex items-center gap-2 whitespace-nowrap">
                  <Package className="w-4 h-4" />
                  {products.length} Products
                </Badge>
              </div>
            </div>

            <ScrollArea className="h-[400px] xl:h-[calc(100vh-220px)] pr-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {filteredProducts.map(product => (
                  <Card 
                    key={product.id} 
                    className={`relative transition-all ${getAvailableQuantity(product) <= 0 ? 'opacity-50 cursor-not-allowed grayscale' : 'cursor-pointer hover:ring-2 hover:ring-teal-500/50 shadow-sm'}`}
                    onClick={() => getAvailableQuantity(product) > 0 ? addToCart(product) : toast.error("Item out of stock")}
                  >
                    {getAvailableQuantity(product) <= 0 && (
                      <div className="absolute inset-0 z-10 flex items-center justify-center">
                        <Badge variant="destructive" className="py-1 px-3 text-xs font-bold uppercase tracking-wider shadow-md">
                          Out of Stock
                        </Badge>
                      </div>
                    )}
                    <CardContent className="p-3 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-neutral-100 flex items-center justify-center flex-shrink-0">
                        <Package className="w-5 h-5 text-neutral-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-sm text-neutral-900 truncate">{product.name}</h4>
                        <div className="flex items-center justify-between mt-0.5">
                          <p className="text-sm font-bold text-teal-600">₹{product.price.toFixed(2)}</p>
                          <p className={`text-[10px] font-medium ${getAvailableQuantity(product) <= (product.lowStockThreshold || 5) ? 'text-amber-600' : 'text-neutral-400'}`}>
                            Stk: {getAvailableQuantity(product)}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </div>
        ) : (
          <div className="h-[400px] xl:h-[calc(100vh-220px)] flex items-center justify-center bg-white rounded-xl border border-neutral-100">
            <div className="w-full max-w-sm p-6 space-y-6">
              <div className="text-center">
                <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center mx-auto mb-4">
                  <IndianRupee className="w-6 h-6" />
                </div>
                <CardTitle className="text-xl font-bold">Quick Billing</CardTitle>
                <CardDescription>Enter a custom amount to bill directly</CardDescription>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm text-neutral-500">Amount (₹)</Label>
                  <Input 
                    type="number" 
                    placeholder="0.00" 
                    className="text-3xl font-bold h-16 text-center bg-neutral-50 border-2 focus-visible:ring-blue-500"
                    value={manualAmount}
                    onChange={e => setManualAmount(e.target.value)}
                    autoFocus
                  />
                </div>
                <Button 
                  className="w-full h-12 font-bold bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/20 group"
                  disabled={!manualAmount || parseFloat(manualAmount) <= 0}
                  onClick={() => {
                    const amount = parseFloat(manualAmount);
                    const manualItem: Product = {
                      id: `manual-${Date.now()}`,
                      name: `Direct Sale Amount`,
                      price: amount,
                      quantity: 1,
                      shopId: shopId || '',
                      sku: 'DIRECT',
                      category: 'Quick Sale',
                      createdAt: new Date().toISOString(),
                      updatedAt: new Date().toISOString()
                    };
                    addToCart(manualItem);
                    setManualAmount('');
                    setIsManualMode(false);
                    toast.success(`₹${amount} added to bill`);
                  }}
                >
                  Add to Bill
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Right: Checkout & Cart */}
      <div className="w-full xl:w-[400px] flex-shrink-0">
        <Card className="border-none shadow-lg bg-white flex flex-col h-full xl:sticky xl:top-8 max-h-[calc(100vh-120px)]">
          <CardHeader className="py-4">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <ShoppingCart className="w-5 h-5" />
                Current Bill
              </CardTitle>
              {cart.length > 0 && (
                <Button variant="ghost" size="sm" onClick={() => setCart([])} className="text-rose-500 text-xs h-8">
                  Clear
                </Button>
              )}
            </div>
          </CardHeader>

          <CardContent className="flex-1 flex flex-col min-h-0 space-y-4 px-4 pb-4">
            {/* Customer Selection */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Customer</Label>
                <Dialog open={isCustomerDialogOpen} onOpenChange={setIsCustomerDialogOpen}>
                  <DialogTrigger 
                    render={
                      <Button variant="link" className="h-auto p-0 text-teal-600 text-xs font-semibold">
                        <UserPlus className="w-3 h-3 mr-1" />
                        Add New
                      </Button>
                    }
                  />
                  <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Quick Customer Add</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label>Customer Name</Label>
                          <Input value={newCustomer.name} onChange={e => setNewCustomer({...newCustomer, name: e.target.value})} placeholder="John Doe" />
                        </div>
                        <div className="space-y-2">
                          <Label>Phone Number</Label>
                          <Input value={newCustomer.phone} onChange={e => setNewCustomer({...newCustomer, phone: e.target.value})} placeholder="+1 234..." />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button onClick={createCustomer} className="w-full bg-teal-600">Save Customer</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
              </div>
              <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select or search customer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="walk-in" className="font-bold text-blue-600">Walk-in Customer</SelectItem>
                  {customers.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name} ({c.phone || 'No phone'})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* Cart Items */}
            <ScrollArea className="flex-1 max-h-[300px] -mx-1 px-1">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-neutral-400">
                  <ShoppingCart className="w-12 h-12 mb-2 opacity-20" />
                  <p>Cart is empty</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {cart.map((item) => (
                    <div key={item.productId} className="flex items-center justify-between group">
                      <div className="flex-1 min-w-0 pr-4">
                        <h5 className="text-sm font-semibold text-neutral-900 truncate">{item.name}</h5>
                        <p className="text-xs text-neutral-500">₹{item.price.toFixed(2)} × {item.quantity}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center border border-neutral-200 rounded-lg overflow-hidden h-8">
                          <button 
                            className="px-2 hover:bg-neutral-100 transition-colors"
                            onClick={() => updateCartQuantity(item.productId, -1)}
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-8 text-center text-xs font-bold border-x border-neutral-200">
                            {item.quantity}
                          </span>
                          <button 
                            className="px-2 hover:bg-neutral-100 transition-colors"
                            onClick={() => updateCartQuantity(item.productId, 1)}
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-neutral-400 hover:text-rose-600 transition-colors"
                          onClick={() => removeFromCart(item.productId)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>

            <Separator />

            {/* Payment Type */}
            <div className="space-y-4">
              <div className="flex items-center justify-between text-sm font-semibold">
                <span>Payment Mode</span>
                <div className="flex p-1 bg-neutral-100 rounded-lg">
                  <button 
                    onClick={() => setPaymentStatus('PAID')}
                    className={`px-4 py-1.5 rounded-md text-xs transition-all ${paymentStatus === 'PAID' ? 'bg-white shadow-sm text-teal-600' : 'text-neutral-500'}`}
                  >
                    Paid Now
                  </button>
                  <button 
                    onClick={() => setPaymentStatus('PAY_LATER')}
                    className={`px-4 py-1.5 rounded-md text-xs transition-all ${paymentStatus === 'PAY_LATER' ? 'bg-white shadow-sm text-rose-600' : 'text-neutral-500'}`}
                  >
                    Pay Later
                  </button>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-neutral-500">Subtotal</span>
                  <span className="font-medium">₹{totalAmount.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-lg font-bold text-neutral-900">
                  <span>Grand Total</span>
                  <span className="text-teal-600">₹{totalAmount.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </CardContent>

          <CardFooter className="pt-2">
            <Button 
              className={`w-full py-6 font-bold text-lg ${paymentStatus === 'PAID' ? 'bg-teal-600 hover:bg-teal-700' : 'bg-rose-600 hover:bg-rose-700'}`}
              disabled={cart.length === 0 || !selectedCustomerId}
              onClick={handleCheckout}
            >
              {paymentStatus === 'PAID' ? 'Confirm & Print' : 'Record as Credit'}
              <ChevronRight className="w-5 h-5 ml-2" />
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
