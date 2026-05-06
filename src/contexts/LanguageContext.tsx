import React, { createContext, useContext, useState, useEffect } from 'react';

type Language = 'en' | 'mr';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const translations = {
  en: {
    // Navigation
    dashboard: 'Dashboard',
    inventory: 'Inventory',
    billing: 'New Bill',
    customers: 'Customers',
    ledger: 'Ledger',
    orders: 'Orders',
    settings: 'Settings',
    logout: 'Log Out',
    
    // Login
    welcome_back: 'Welcome Back',
    owner: 'Owner',
    salesperson: 'Salesperson',
    register_shop: 'Register Your Shop',
    demo_owner: 'Demo Owner',
    demo_sales: 'Demo Salesperson',
    
    // Dashboard
    dashboard_overview: 'Dashboard Overview',
    total_sales: 'Total Sales',
    low_stock: 'Low Stock',
    pending_dues: 'Pending Dues',
    recent_orders: 'Recent Orders',
    performance_insights: 'Performance Insights',
    summary_range: 'Summary matching your selected time range',
    today: 'Today',
    custom_range: 'Custom Range',
    items_sold: 'Items Sold',
    total_in_stock: 'Total In Stock',
    low_stock_alerts: 'Low Stock Alerts',
    customer_activity: 'Customer Activity',
    business_overview: 'Business Overview',
    dues_remaining: 'Dues Remaining',
    dues_paid: 'Dues Paid',
    total_credit_sales: 'Total Credit Sales',
    
    // Inventory
    inventory_title: 'Inventory',
    add_product: 'Add Product',
    edit_product: 'Edit Product',
    product_name: 'Product Name',
    stock: 'Stock',
    price: 'Price',
    category: 'Category',
    sku: 'SKU',
    quantity: 'Quantity',
    threshold: 'Threshold',
    status: 'Status',
    actions: 'Actions',
    out_of_stock: 'Out of Stock',
    low_stock: 'Low Stock',
    healthy: 'Healthy',
    search_placeholder: 'Search products, SKU, category...',
    
    // Billing
    create_bill: 'Create New Bill',
    select_customer: 'Select Customer',
    add_to_bill: 'Add to Bill',
    total_amount: 'Total Amount',
    generate_invoice: 'Generate Invoice',
    
    // Settings
    profile_settings: 'Profile Settings',
    shop_name: 'Shop Name',
    switch_role: 'Switch Role',
    danger_zone: 'Danger Zone',
    reset_data: 'Reset Data',
  },
  mr: {
    // Navigation
    dashboard: 'डेशबोर्ड',
    inventory: 'मालसाठा (इन्व्हेंटरी)',
    billing: 'नवीन बिल',
    customers: 'ग्राहक',
    ledger: 'खातेवही (लेजर)',
    orders: 'ऑर्डऱ्स',
    settings: 'सेटिंग्स',
    logout: 'बाहेर पडा (लॉग आऊट)',
    
    // Login
    welcome_back: 'पुन्हा स्वागत आहे',
    owner: 'मालक',
    salesperson: 'विक्रेता',
    register_shop: 'तुमच्या दुकानाची नोंदणी करा',
    demo_owner: 'डेमो मालक',
    demo_sales: 'डेमो विक्रेता',
    
    // Dashboard
    dashboard_overview: 'डॅशबोर्ड विहंगावलोकन',
    total_sales: 'एकूण विक्री',
    low_stock: 'कमी स्टॉक',
    pending_dues: 'प्रलंबित येणे',
    recent_orders: 'अलीकडील ऑर्डऱ्स',
    performance_insights: 'कामगिरीची माहिती',
    summary_range: 'तुमच्या निवडलेल्या कालावधीचा सारांश',
    today: 'आज',
    custom_range: 'निवडक कालावधी',
    items_sold: 'विकलेले पदार्थ',
    total_in_stock: 'एकूण उपलब्ध स्टॉक',
    low_stock_alerts: 'कमी स्टॉक अलर्ट',
    customer_activity: 'ग्राहक क्रियाकलाप',
    business_overview: 'व्यवसाय विहंगावलोकन',
    dues_remaining: 'बाकी येणे',
    dues_paid: 'दिलेले कर्ज',
    total_credit_sales: 'एकूण उधारी विक्री',
    
    // Inventory
    inventory_title: 'मालसाठा (इन्व्हेंटरी)',
    add_product: 'उत्पादन जोडा',
    edit_product: 'उत्पादन दुरुस्त करा',
    product_name: 'उत्पादनाचे नाव',
    stock: 'स्टॉक',
    price: 'किंमत',
    category: 'वर्ग (कॅटेगरी)',
    sku: 'एसकेयू (SKU)',
    quantity: 'प्रमाण',
    threshold: 'मर्यादा (थ्रेशोल्ड)',
    status: 'स्थिती',
    actions: 'कृती',
    out_of_stock: 'स्टॉक संपला',
    low_stock: 'स्टॉक कमी आहे',
    healthy: 'पुरेसा स्टॉक',
    search_placeholder: 'उत्पादने, SKU, श्रेणी शोधा...',
    
    // Billing
    create_bill: 'नवीन बिल तयार करा',
    select_customer: 'ग्राहक निवडा',
    add_to_bill: 'बिलात जोडा',
    total_amount: 'एकूण रक्कम',
    generate_invoice: 'इनव्हॉइस तयार करा',
    
    // Settings
    profile_settings: 'प्रोफाइल सेटिंग्स',
    shop_name: 'दुकानाचे नाव',
    switch_role: 'भूमिका बदला',
    danger_zone: 'धोकादायक क्षेत्र',
    reset_data: 'सर्व डेटा हटवा',
  }
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem('app-language');
    return (saved as Language) || 'en';
  });

  useEffect(() => {
    localStorage.setItem('app-language', language);
    document.documentElement.lang = language;
  }, [language]);

  const t = (key: string) => {
    return (translations[language] as any)[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
