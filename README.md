# Inventory Guard

Inventory Guard is a high-performance inventory and credit management system designed specifically for small to medium-sized retail businesses. It streamlines daily operations by integrating digital billing, real-time stock tracking, and automated customer credit ledgers into a single, intuitive interface.

## Core Features

### Intelligent Billing System
- Multi-product checkout with automated total calculation.
- Real-time inventory validation to prevent overselling.
- Flexible payment methods including cash and credit sales.

### Precision Inventory Management
- Centralized database for product tracking.
- Automated low-stock alerts and visual indicators.
- Quick-action stock adjustments with full history support.
- Category-based organization for rapid product identification.

### Comprehensive Customer Ledger
- Dedicated profiles for credit customers.
- Real-time tracking of total outstanding dues.
- Automated transaction history (purchases vs. payments).
- Integrated payment recording to settle balances incrementally.

### Business Insights Dashboard
- At-a-glance metrics for total products, active customers, and stock value.
- Visual alerts for critical stock levels.
- Recent activity logs for operational transparency.

## Technical Architecture

The application is built on a modern, serverless stack designed for responsiveness and reliability:

- **Frontend**: React 18 with Vite for a lightning-fast user experience.
- **Styling**: Tailwind CSS for a clean, professional, and responsive interface.
- **Real-time Backend**: Firebase Firestore for instant data synchronization across devices.
- **Security**: Robust Firebase Authentication and granular Firestore Security Rules (ABAC).
- **Animations**: Motion for smooth, purposeful transition effects.

## Usage Guide

### Getting Started
1. **Login**: Secure access via the shop owner's portal.
2. **Setup Shop**: Configure your shop name and details in the Settings tab.
3. **Add Products**: Populate your inventory with initial items, prices, and stock levels.

### Daily Operations
- **Selling**: Use the Billing tab to add products to a cart. Select a customer for credit sales or process as a cash guest.
- **Tracking Stock**: Monitor the Inventory tab. Low-stock items are highlighted automatically.
- **Managing Credit**: Visit the Customers tab to see who owes money and record payments as they come in.

## Installation and Setup

1. **Clone and Install**
   ```bash
   npm install
   ```

2. **Configuration**
   Ensure `firebase-applet-config.json` is correctly populated with your Firebase project credentials.

3. **Running in Development**
   ```bash
   npm run dev
   ```

4. **Production Build**
   ```bash
   npm run build
   ```
