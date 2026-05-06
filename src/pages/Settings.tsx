import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../contexts/LanguageContext';
import { db } from '../firebase/config';
import { collection, query, where, getDocs, writeBatch, doc, updateDoc } from 'firebase/firestore';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';
import { Shield, User, Store, LogOut, Trash2, AlertTriangle, RefreshCcw } from 'lucide-react';
import { auth } from '../firebase/config';
import { signOut } from 'firebase/auth';

export default function Settings() {
  const { t } = useLanguage();
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
    } catch (error) {
      toast.error('Failed to switch role');
    } finally {
      setLoading(false);
    }
  };

  const handleResetData = async () => {
    const shopId = profile?.shopId || user?.uid;
    
    if (!shopId) {
      console.error("No shopId found:", { profile, user });
      toast.error("Could not determine Shop ID. Please try logging out and back in.");
      return;
    }
    
    const confirmed = window.confirm("Are you ABSOLUTELY sure? This will PERMANENTLY delete all Products, Customers, Orders, Ledgers, and Payments for your shop. This action cannot be undone.");
    if (!confirmed) return;

    setLoading(true);
    const results: string[] = [];
    
    try {
      const collections = ['products', 'customers', 'orders', 'payments', 'ledgerEntries'];
      
      for (const collName of collections) {
        try {
          const q = query(collection(db, collName), where('shopId', '==', shopId));
          const snap = await getDocs(q);
          
          if (snap.empty) {
            results.push(`${collName}: 0`);
            continue;
          }

          let batch = writeBatch(db);
          let count = 0;
          let deletedInColl = 0;
          
          for (const d of snap.docs) {
            batch.delete(d.ref);
            count++;
            deletedInColl++;
            if (count >= 400) {
              await batch.commit();
              batch = writeBatch(db);
              count = 0;
            }
          }
          
          if (count > 0) {
            await batch.commit();
          }
          results.push(`${collName}: ${deletedInColl}`);
        } catch (err: any) {
          console.error(`Error clearing ${collName}:`, err);
          results.push(`${collName}: Error (${err.message})`);
        }
      }

      console.log("Reset Success! Summary:", results.join(', '));
      toast.success('Shop data has been reset successfully.');
      
      // Force refresh to clear cache
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error: any) {
      console.error("Reset Master error:", error);
      toast.error('Failed to clear data: ' + (error.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 p-4 md:p-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-neutral-900">Account Settings</h1>
        <p className="text-neutral-500 mt-2">Manage your shop profile and account permissions.</p>
      </div>

      <div className="grid gap-6">
        <Card className="border-neutral-200 shadow-sm overflow-hidden">
          <CardHeader className="bg-neutral-50/50 border-b border-neutral-200">
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
                  placeholder="Kapase Kirana Mart"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input 
                  id="email" 
                  value={user?.email || ''} 
                  disabled 
                  className="bg-neutral-50 text-neutral-500"
                />
                <p className="text-[10px] text-neutral-400">Email is managed via your Google Account.</p>
              </div>
            </CardContent>
            <CardFooter className="bg-neutral-50/30 border-t border-neutral-200 py-3">
              <Button type="submit" disabled={loading} className="bg-teal-600 hover:bg-teal-700">
                {loading ? 'Saving...' : 'Save Changes'}
              </Button>
            </CardFooter>
          </form>
        </Card>

        {profile?.role === 'ADMIN' && (
          <Card className="border-neutral-200 shadow-sm overflow-hidden border-teal-200">
            <CardHeader className="bg-teal-50/50 border-b border-teal-100">
              <div className="flex items-center gap-2 text-teal-700">
                <Shield className="w-5 h-5" />
                <CardTitle className="text-teal-900">Role & Permissions</CardTitle>
              </div>
              <CardDescription className="text-teal-700/70">Switch between Owner and Salesperson roles for testing purposes.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row items-center justify-between p-4 bg-white border border-neutral-200 rounded-xl gap-4">
                <div className="space-y-1 text-center sm:text-left">
                  <p className="font-semibold text-neutral-900">Current Role: {profile?.role === 'ADMIN' ? 'Owner' : 'Salesperson'}</p>
                  <p className="text-sm text-neutral-500">
                    {profile?.role === 'ADMIN' 
                      ? 'Owners can manage inventory, customers, and view all reports.' 
                      : 'Sales staff can create bills and manage ledger entries only.'}
                  </p>
                </div>
                <Button 
                  variant="outline" 
                  onClick={toggleRole} 
                  disabled={loading}
                  className="w-full sm:w-auto border-teal-200 text-teal-700 hover:bg-teal-50"
                >
                  Switch to {profile?.role === 'ADMIN' ? 'Salesperson' : 'Owner'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {profile?.role === 'ADMIN' && (
          <Card className="border-rose-200 shadow-sm overflow-hidden border-2">
            <CardHeader className="bg-rose-50 border-b border-rose-100">
              <div className="flex items-center gap-2 text-rose-700">
                <AlertTriangle className="w-5 h-5" />
                <CardTitle>Danger Zone</CardTitle>
              </div>
              <CardDescription className="text-rose-600">Permanently delete all business records.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row items-center justify-between p-4 bg-rose-50/30 border border-rose-100 rounded-xl gap-4">
                <div className="space-y-1 text-center sm:text-left">
                  <p className="font-semibold text-rose-900">Reset All Shop Data</p>
                  <p className="text-sm text-rose-600/80">
                    Deletes all products, customers, transactions, and ledger entries. 
                    Your account profile and shop name will be kept.
                  </p>
                </div>
                <Button 
                  variant="destructive" 
                  onClick={handleResetData} 
                  disabled={loading}
                  className="w-full sm:w-auto bg-rose-600 hover:bg-rose-700"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Reset Data
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

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
