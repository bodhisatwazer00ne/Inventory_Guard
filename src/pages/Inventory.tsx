import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { handleFirestoreError, OperationType } from '../firebase/utils';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../contexts/LanguageContext';
import { 
  Package, 
  Plus, 
  Search, 
  MoreVertical, 
  Pencil, 
  Trash2, 
  Filter,
  CheckCircle2,
  AlertCircle,
  Calendar
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '../components/ui/dropdown-menu';
import { Product } from '../types';
import { toast } from 'sonner';

export default function Inventory() {
  const { t } = useLanguage();
  const { user, profile } = useAuth();
  const isAdmin = profile?.role === 'ADMIN';
  const shopId = profile?.shopId;
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    category: '',
    price: 0,
    quantity: 0,
    lowStockThreshold: 5
  });

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    if (!shopId) return;

    const q = query(
      collection(db, 'products'),
      where('shopId', '==', shopId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const productList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Product[];
      setProducts(productList);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'products');
    });

    return unsubscribe;
  }, [shopId]);

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || 
      p.sku?.toLowerCase().includes(search.toLowerCase()) ||
      p.category?.toLowerCase().includes(search.toLowerCase());
    const matchesStartDate = !startDate || (p.updatedAt && p.updatedAt >= startDate);
    const matchesEndDate = !endDate || (p.updatedAt && p.updatedAt <= (endDate + 'T23:59:59'));
    return matchesSearch && matchesStartDate && matchesEndDate;
  });

  const handleCreateOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      if (formData.price < 0) {
        toast.error("Price cannot be negative");
        return;
      }
      if (formData.quantity < 0) {
        toast.error("Quantity cannot be negative");
        return;
      }
      if (formData.lowStockThreshold < 0) {
        toast.error("Low stock threshold cannot be negative");
        return;
      }

      const data = {
        ...formData,
        shopId: shopId,
        updatedAt: new Date().toISOString()
      };

      if (editingProduct) {
        await updateDoc(doc(db, 'products', editingProduct.id), data);
        toast.success("Product updated successfully");
      } else {
        await addDoc(collection(db, 'products'), {
          ...data,
          createdAt: new Date().toISOString()
        });
        toast.success("Product added to inventory");
      }

      setIsAddDialogOpen(false);
      setEditingProduct(null);
      setFormData({ name: '', sku: '', category: '', price: 0, quantity: 0, lowStockThreshold: 5 });
    } catch (error) {
      toast.error("Failed to save product");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this product?")) return;
    try {
      await deleteDoc(doc(db, 'products', id));
      toast.success("Product removed from inventory");
    } catch (error) {
      toast.error("Failed to delete product");
    }
  };

  const openEditDialog = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      sku: product.sku || '',
      category: product.category || '',
      price: product.price,
      quantity: product.quantity,
      lowStockThreshold: product.lowStockThreshold || 5
    });
    setIsAddDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <Input 
            placeholder={t('search_placeholder')} 
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-3 bg-white border rounded-lg px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-neutral-400 uppercase">From</span>
            <Input 
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="border-none p-0 focus-visible:ring-0 h-auto text-xs w-[120px] bg-transparent"
            />
          </div>
          <div className="h-4 w-px bg-neutral-200 hidden md:block"></div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-neutral-400 uppercase">To</span>
            <Input 
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="border-none p-0 focus-visible:ring-0 h-auto text-xs w-[120px] bg-transparent"
            />
          </div>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          {isAdmin && (
            <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
              setIsAddDialogOpen(open);
              if (!open) {
                setEditingProduct(null);
                setFormData({ name: '', sku: '', category: '', price: 0, quantity: 0, lowStockThreshold: 5 });
              }
            }}>
              <DialogTrigger 
                render={
                  <Button className="bg-teal-600 hover:bg-teal-700">
                    <Plus className="w-4 h-4 mr-2" />
                    {t('add_product')}
                  </Button>
                }
              />
              <DialogContent className="sm:max-w-[425px]">
                <form onSubmit={handleCreateOrUpdate}>
                  <DialogHeader>
                    <DialogTitle>{editingProduct ? t('edit_product') : t('add_product')}</DialogTitle>
                    <DialogDescription>
                      Fill in the details for your inventory item.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="name">{t('product_name')}</Label>
                      <Input 
                        id="name" 
                        required 
                        value={formData.name}
                        onChange={e => setFormData({...formData, name: e.target.value})}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="sku">{t('sku')}</Label>
                        <Input 
                          id="sku" 
                          value={formData.sku}
                          onChange={e => setFormData({...formData, sku: e.target.value})}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="category">{t('category')}</Label>
                        <Input 
                          id="category" 
                          value={formData.category}
                          onChange={e => setFormData({...formData, category: e.target.value})}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="price">{t('price')} (₹)</Label>
                        <Input 
                          id="price" 
                          type="number" 
                          step="0.01" 
                          required 
                          value={formData.price}
                          onChange={e => setFormData({...formData, price: parseFloat(e.target.value)})}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="quantity">{t('quantity')}</Label>
                        <Input 
                          id="quantity" 
                          type="number" 
                          required 
                          value={formData.quantity}
                          onChange={e => setFormData({...formData, quantity: parseInt(e.target.value)})}
                        />
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="threshold">{t('threshold')}</Label>
                      <Input 
                        id="threshold" 
                        type="number" 
                        value={formData.lowStockThreshold}
                        onChange={e => setFormData({...formData, lowStockThreshold: parseInt(e.target.value)})}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="submit" className="w-full bg-teal-600 hover:bg-teal-700 font-semibold">
                      {editingProduct ? t('edit_product') : t('add_product')}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden overflow-x-auto">
        <div className="min-w-[800px] lg:min-w-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-neutral-50/50">
                <TableHead className="w-[300px]">Product</TableHead>
                <TableHead>{t('category')}</TableHead>
                <TableHead>{t('price')}</TableHead>
                <TableHead>{t('quantity')}</TableHead>
                <TableHead>{t('status')}</TableHead>
                <TableHead className="text-right">{t('actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-neutral-500">
                    {search ? 'No products match your search' : 'Your inventory is empty'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredProducts.map((product) => {
                  const isLowStock = product.quantity <= (product.lowStockThreshold || 5);
                  const isOutOfStock = product.quantity <= 0;
                  
                  return (
                    <TableRow key={product.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-neutral-900">{product.name}</span>
                          <span className="text-xs text-neutral-500 font-mono uppercase">{product.sku || 'No SKU'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-normal whitespace-nowrap">
                          {product.category || 'Uncategorized'}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">₹{product.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className={`font-semibold ${isLowStock ? 'text-amber-600' : 'text-neutral-900'}`}>
                            {product.quantity}
                          </span>
                          {isAdmin && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-6 w-6 text-teal-600 hover:bg-teal-50"
                              onClick={() => {
                                const amountStr = prompt(`Adjustment for ${product.name} (use negative for deduction):`);
                                if (amountStr !== null) {
                                  const amount = parseInt(amountStr);
                                  if (isNaN(amount)) {
                                    toast.error("Invalid number entered");
                                    return;
                                  }
                                  if (product.quantity + amount < 0) {
                                    toast.error("Adjusted quantity cannot be negative");
                                    return;
                                  }
                                  updateDoc(doc(db, 'products', product.id), {
                                    quantity: product.quantity + amount,
                                    updatedAt: new Date().toISOString()
                                  });
                                  toast.success(`${amount >= 0 ? 'Added' : 'Subtracted'} ${Math.abs(amount)} ${amount >= 0 ? 'to' : 'from'} ${product.name}`);
                                }
                              }}
                            >
                              <Plus className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {isOutOfStock ? (
                          <div className="flex items-center gap-1.5 text-rose-600 whitespace-nowrap">
                            <AlertCircle className="w-4 h-4" />
                            <span className="text-xs font-medium">{t('out_of_stock')}</span>
                          </div>
                        ) : isLowStock ? (
                          <div className="flex items-center gap-1.5 text-amber-600 whitespace-nowrap">
                            <AlertCircle className="w-4 h-4" />
                            <span className="text-xs font-medium">{t('low_stock')}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-teal-600 whitespace-nowrap">
                            <CheckCircle2 className="w-4 h-4" />
                            <span className="text-xs font-medium">{t('healthy')}</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {isAdmin ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger 
                              render={
                                <Button variant="ghost" size="icon">
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              }
                            />
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEditDialog(product)}>
                                <Pencil className="w-4 h-4 mr-2" /> Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-rose-600" onClick={() => handleDelete(product.id)}>
                                <Trash2 className="w-4 h-4 mr-2" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : (
                          <Badge variant="secondary" className="bg-neutral-100 text-neutral-500 font-normal">View Only</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
