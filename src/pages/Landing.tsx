import React from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Receipt, Shield, Users, BarChart3, ChevronRight, Package, CreditCard, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../contexts/LanguageContext';
import { LanguageSwitcher } from '../components/LanguageSwitcher';

export default function Landing() {
  const { user } = useAuth();
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-white font-sans selection:bg-teal-100 selection:text-teal-900">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-md border-b border-neutral-100">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center">
              <Receipt className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight text-neutral-900">
              Kapase Kirana
            </span>
          </div>
          <div className="flex items-center gap-4">
            <LanguageSwitcher />
            <div className="hidden sm:block h-6 w-px bg-neutral-100 mx-2" />
            <Link to="/login">
              <Button variant="ghost" className="text-neutral-600">Sign In</Button>
            </Link>
            <Link to="/login">
              <Button className="bg-teal-600 hover:bg-teal-700 text-white rounded-full px-6 shadow-lg shadow-teal-500/20 transition-all hover:scale-105 active:scale-95 text-xs sm:text-sm">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 md:pt-48 md:pb-32 px-6">
        <div className="max-w-7xl mx-auto text-center space-y-8">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50 text-teal-700 text-xs font-bold uppercase tracking-wider"
          >
            <Sparkles className="w-3 h-3" />
            New: Enhanced Credit Ledger System
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-5xl md:text-7xl font-extrabold tracking-tight text-neutral-900 max-w-4xl mx-auto leading-tight"
          >
            The Smarter Way to Manage Your <span className="text-teal-600">Shop Dues.</span>
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-lg md:text-xl text-neutral-500 max-w-2xl mx-auto leading-relaxed"
          >
            Stop losing money on forgotten credits. Kapase Kirana helps small business owners track stock, sales, and outstanding dues with zero effort.
          </motion.p>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4"
          >
            <Link to="/login">
              <Button size="lg" className="bg-teal-600 hover:bg-teal-700 text-white h-14 px-10 text-lg rounded-full shadow-xl shadow-teal-500/20 group">
                Register Your Shop
                <ChevronRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <Link to="/login">
              <Button size="lg" variant="outline" className="h-14 px-10 text-lg rounded-full border-neutral-200">
                View Live Demo
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Feature Grid */}
      <section className="py-20 bg-neutral-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-8 bg-white rounded-3xl border border-neutral-100 shadow-sm space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-teal-100 flex items-center justify-center text-teal-600">
                <Package className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold">Fast Inventory</h3>
              <p className="text-neutral-500 text-sm">Add products in seconds. Track low stock alerts and never run out of your best sellers.</p>
            </div>
            
            <div className="p-8 bg-white rounded-3xl border border-neutral-100 shadow-sm space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-100 flex items-center justify-center text-blue-600">
                <CreditCard className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold">Credit Ledger</h3>
              <p className="text-neutral-500 text-sm">Digital Ledger for 'Pay Later' customers. No more notebook entries or disputes.</p>
            </div>
            
            <div className="p-8 bg-white rounded-3xl border border-neutral-100 shadow-sm space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-600">
                <BarChart3 className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold">Daily Analytics</h3>
              <p className="text-neutral-500 text-sm">See your daily earnings, credit sales, and debt collection at a single glance.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-neutral-100">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-teal-600 flex items-center justify-center">
              <Receipt className="w-3 h-3 text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight">Kapase Kirana</span>
          </div>
          <p className="text-neutral-400 text-sm font-medium">
            Built for small retailers and local shops.
          </p>
          <div className="flex items-center gap-6">
             <Link to="/login" className="text-sm font-medium text-neutral-500 hover:text-teal-600 transition-colors">Admin Panel</Link>
             <Link to="/login" className="text-sm font-medium text-neutral-500 hover:text-teal-600 transition-colors">Contact Support</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
