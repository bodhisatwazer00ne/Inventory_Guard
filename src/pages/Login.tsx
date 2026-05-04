import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/ui/button';
import { Receipt, Shield, User, Info } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Separator } from '../components/ui/separator';

export default function Login() {
  const { user, loginWithGoogle, loginAnonymously, loading } = useAuth();
  const [selectedRole, setSelectedRole] = useState<'ADMIN' | 'SALES'>('ADMIN');

  if (loading) return null;
  if (user) return <Navigate to="/dashboard" replace />;

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-950 p-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 rounded-xl bg-teal-600 flex items-center justify-center mb-4">
            <Receipt className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
            Welcome to InventoryGuard
          </h1>
          <p className="text-neutral-500 dark:text-neutral-400">
            The smart way to manage your shop's inventory and credit.
          </p>
        </div>

        <Card className="border-neutral-200 dark:border-neutral-800 shadow-xl overflow-hidden">
          <CardHeader className="text-center bg-white dark:bg-neutral-900/50 pb-8">
            <CardTitle>Sign In & Choose Your Role</CardTitle>
            <CardDescription className="max-w-xs mx-auto">
              Select your role first, then sign in using Google or try the demo accounts.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <div className="space-y-4">
              <label className="text-sm font-medium text-center block text-neutral-500 mb-2">I am signing in as:</label>
              <Tabs 
                value={selectedRole} 
                onValueChange={(val) => setSelectedRole(val as 'ADMIN' | 'SALES')}
                className="w-full"
              >
                <TabsList className="grid w-full grid-cols-2 h-12">
                  <TabsTrigger value="ADMIN" className="flex items-center gap-2">
                    <Shield className="w-4 h-4" /> Admin
                  </TabsTrigger>
                  <TabsTrigger value="SALES" className="flex items-center gap-2">
                    <User className="w-4 h-4" /> Sales
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              
              <div className="p-3 bg-neutral-50 dark:bg-neutral-900/80 rounded-lg text-[10px] text-neutral-500 dark:text-neutral-400 flex items-start gap-2 border border-neutral-100 dark:border-neutral-800">
                <Info className="w-3 h-3 mt-0.5 text-teal-600 flex-shrink-0" />
                <p>
                  {selectedRole === 'ADMIN' 
                    ? 'ADMIN: Full access to everything. Manage inventory, view charts, and register new staff.' 
                    : 'SALES: Limited access. Can create bills and manage ledger entries, but cannot delete inventory.'}
                </p>
              </div>
            </div>

            <Button 
              className="w-full bg-white text-neutral-900 border-neutral-200 hover:bg-neutral-50 dark:bg-neutral-800 dark:text-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-700 h-12 shadow-sm"
              onClick={() => loginWithGoogle(selectedRole)}
              size="lg"
            >
              <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              </svg>
              Continue with Google
            </Button>

            <div className="relative flex items-center py-4">
              <Separator className="grow" />
              <span className="mx-4 text-[10px] text-neutral-400 font-medium uppercase tracking-widest">or sample access</span>
              <Separator className="grow" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button 
                variant="outline" 
                className="text-xs h-10 border-teal-100 hover:bg-teal-50 hover:text-teal-700 dark:border-teal-900/30"
                onClick={() => loginAnonymously('ADMIN')}
              >
                Demo Admin
              </Button>
              <Button 
                variant="outline" 
                className="text-xs h-10 border-neutral-200 hover:bg-neutral-50 dark:border-neutral-800"
                onClick={() => loginAnonymously('SALES')}
              >
                Demo Sales
              </Button>
            </div>
          </CardContent>
          <CardFooter className="bg-neutral-50 dark:bg-neutral-900/50 border-t border-neutral-100 dark:border-neutral-800">
            <p className="text-center text-[10px] text-neutral-500 w-full py-1">
              Demo accounts use temporary sessions. Data may be reset periodically.
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
