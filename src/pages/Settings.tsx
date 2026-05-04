import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { db } from '../firebase/config';
import { collection, query, where, getDocs, writeBatch, doc, updateDoc } from 'firebase/firestore';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';
import { Shield, User, Store, LogOut, Trash2, AlertTriangle } from 'lucide-react';
import { auth } from '../firebase/config';
import { signOut } from 'firebase/auth';

export default function Settings() {
  const { user, profile } = useAuth();
  const [shopName, setShopName] = useState(profile?.shopName || '');
  const [loading, setLoading] = useState(false);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setLoading(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        shopName: shopName
      });
      toast.success('Profile updated successfully');
    } catch (error) {
      toast.error('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const toggleRole = async () => {
    if (!user || !profile) return;
    
    const newRole = profile.role === 'ADMIN' ? 'SALES' : 'ADMIN';
    setLoading(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        role: newRole
      });
      toast.success(`Role switched to ${newRole}. The page will refresh shortly.`);
      // Minor delay to let the toast show before the auth hook updates or user manually refreshes
    } catch (error) {
      toast.error('Failed to switch role');
    } finally {
      setLoading(false);
    }
  };

  const handleResetData = async () => {
    const shopId = profile?.shopId || (user?.isAnonymous ? 'demo-shop-v1' : null);
    if (!shopId) return;
    
    const confirm = window.confirm("Are you absolutely sure? This will delete ALL products, customers, orders, and payment records for your shop. This action CANNOT be undone.");
    if (!confirm) return;

    setLoading(true);
    try {
      const collections = ['products', 'customers', 'orders', 'payments', 'ledgerEntries'];
      
      for (const collName of collections) {
        const q = query(collection(db, collName), where('shopId', '==', shopId));
        const snap = await getDocs(q);
        
        let batch = writeBatch(db);
        let count = 0;
        
        for (const d of snap.docs) {
          batch.delete(d.ref);
          count++;
          // Firestore batches have a limit of 500 operations
          if (count >= 400) {
            await batch.commit();
            batch = writeBatch(db);
            count = 0;
          }
        }
        
        if (count > 0) {
          await batch.commit();
        }
      }

      toast.success('All shop data has been cleared.');
    } catch (error) {
      console.error("Reset error:", error);
      toast.error('Failed to clear data');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 p-4 md:p-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">Account Settings</h1>
        <p className="text-neutral-500 dark:text-neutral-400 mt-2">Manage your shop profile and account permissions.</p>
      </div>

      <div className="grid gap-6">
        <Card className="border-neutral-200 dark:border-neutral-800 shadow-sm overflow-hidden">
          <CardHeader className="bg-neutral-50/50 dark:bg-neutral-900/50 border-b border-neutral-200 dark:border-neutral-800">
            <div className="flex items-center gap-2">
              <Store className="w-5 h-5 text-teal-600" />
              <CardTitle>Shop Profile</CardTitle>
            </div>
            <CardDescription>Update your business information shown on bills.</CardDescription>
          </CardHeader>
          <form onSubmit={handleUpdateProfile}>
            <CardContent className="space-y-4 pt-6">
              <div className="space-y-2">
                <Label htmlFor="shopName">Business Name</Label>
                <Input 
                  id="shopName" 
                  value={shopName} 
                  onChange={e => setShopName(e.target.value)}
                  placeholder="InventoryGuard Mart"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input 
                  id="email" 
                  value={user?.email || ''} 
                  disabled 
                  className="bg-neutral-50 dark:bg-neutral-900 text-neutral-500"
                />
                <p className="text-[10px] text-neutral-400">Email is managed via your Google Account.</p>
              </div>
            </CardContent>
            <CardFooter className="bg-neutral-50/30 dark:bg-neutral-900/10 border-t border-neutral-200 dark:border-neutral-800 py-3">
              <Button type="submit" disabled={loading} className="bg-teal-600 hover:bg-teal-700">
                {loading ? 'Saving...' : 'Save Changes'}
              </Button>
            </CardFooter>
          </form>
        </Card>

        <Card className="border-neutral-200 dark:border-neutral-800 shadow-sm overflow-hidden border-teal-200 dark:border-teal-900/50">
          <CardHeader className="bg-teal-50/50 dark:bg-teal-950/20 border-b border-teal-100 dark:border-teal-900/30">
            <div className="flex items-center gap-2 text-teal-700 dark:text-teal-400">
              <Shield className="w-5 h-5" />
              <CardTitle className="text-teal-900 dark:text-teal-100">Role & Permissions</CardTitle>
            </div>
            <CardDescription className="text-teal-700/70 dark:text-teal-500/70">Switch between Admin and Sales roles for testing purposes.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between p-4 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl">
              <div className="space-y-1">
                <p className="font-semibold text-neutral-900 dark:text-neutral-50">Current Role: {profile?.role}</p>
                <p className="text-sm text-neutral-500">
                  {profile?.role === 'ADMIN' 
                    ? 'Admins can manage inventory, customers, and view all reports.' 
                    : 'Sales staff can create bills and manage ledger entries only.'}
                </p>
              </div>
              <Button 
                variant="outline" 
                onClick={toggleRole} 
                disabled={loading}
                className="border-teal-200 text-teal-700 hover:bg-teal-50"
              >
                Switch to {profile?.role === 'ADMIN' ? 'Sales' : 'Admin'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-rose-200 dark:border-rose-900 shadow-sm overflow-hidden border-2">
          <CardHeader className="bg-rose-50 dark:bg-rose-950/20 border-b border-rose-100 dark:border-rose-900/30">
            <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400">
              <AlertTriangle className="w-5 h-5" />
              <CardTitle>Danger Zone</CardTitle>
            </div>
            <CardDescription className="text-rose-600">Permanently delete all business records.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between p-4 bg-rose-50/30 dark:bg-rose-900/10 border border-rose-100 dark:border-rose-800 rounded-xl">
              <div className="space-y-1">
                <p className="font-semibold text-rose-900 dark:text-rose-50">Reset All Shop Data</p>
                <p className="text-sm text-rose-600/80">
                  Deletes all products, customers, transactions, and ledger entries. 
                  Your account profile and shop name will be kept.
                </p>
              </div>
              <Button 
                variant="destructive" 
                onClick={handleResetData} 
                disabled={loading}
                className="bg-rose-600 hover:bg-rose-700"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Reset Data
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="pt-4 flex justify-end">
          <Button 
            variant="ghost" 
            className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
            onClick={() => signOut(auth)}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </div>
    </div>
  );
}
