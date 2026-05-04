import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

export const generatePdfReport = ({ title, headers, data, filename }: { 
  title: string, 
  headers: string[], 
  data: any[][], 
  filename: string 
}) => {
  try {
    const doc = new jsPDF();
    
    // Add title
    doc.setFontSize(18);
    doc.text(title, 14, 22);
    
    // Add timestamp
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 30);
    
    // Replace Rupee symbol as standard fonts don't support it
    const sanitizedData = data.map(row => 
      row.map(cell => typeof cell === 'string' ? cell.replace('₹', 'Rs. ') : cell)
    );

    autoTable(doc, {
      startY: 35,
      head: [headers],
      body: sanitizedData,
      theme: 'striped',
      headStyles: { fillColor: [13, 148, 136] }, // Teal-600
      styles: { fontSize: 9 },
      margin: { top: 35 }
    });
    
    doc.save(`${filename}.pdf`);
  } catch (error) {
    console.error("PDF Generation Error:", error);
    alert("Failed to generate PDF report. Please try again.");
  }
};

export const generateBillPdf = (order: any, customer: any, shopName: string) => {
  try {
    const doc = new jsPDF();
    
    // Shop Header
    doc.setFontSize(22);
    doc.setTextColor(13, 148, 136); // Teal-600
    doc.text(shopName, 105, 20, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text('Invoice / Bill', 105, 26, { align: 'center' });
    
    // Invoice Details
    doc.setTextColor(0);
    doc.setFontSize(10);
    doc.text(`Bill No: ${order.orderNumber || 'N/A'}`, 14, 45);
    doc.text(`Date: ${new Date(order.createdAt).toLocaleDateString()}`, 14, 50);
    doc.text(`Payment Status: ${order.paymentStatus || 'N/A'}`, 14, 55);
    
    // Customer Details
    doc.text('Bill To:', 140, 45);
    doc.setFont('helvetica', 'bold');
    doc.text(customer?.name || 'Walk-in Customer', 140, 50);
    doc.setFont('helvetica', 'normal');
    doc.text(customer?.phone || '', 140, 55);
    
    // Items Table
    const tableData = (order.items || []).map((item: any) => [
      item.name,
      item.quantity,
      `Rs. ${Number(item.price).toFixed(2)}`,
      `Rs. ${(Number(item.price) * Number(item.quantity)).toFixed(2)}`
    ]);
    
    autoTable(doc, {
      startY: 65,
      head: [['Item Name', 'Qty', 'Price', 'Total']],
      body: tableData,
      foot: [['', '', 'Grand Total', `Rs. ${Number(order.totalAmount).toFixed(2)}`]],
      theme: 'grid',
      headStyles: { fillColor: [13, 148, 136] },
      footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' }
    });
    
    doc.save(`bill-${order.orderNumber || 'order'}.pdf`);
  } catch (error) {
    console.error("PDF Generation Error (Bill):", error);
    alert("Failed to generate Bill PDF. Please try again.");
  }
};

export const generateCustomerHistoryPdf = (
  customer: any,
  shopName: string,
  orders: any[],
  payments: any[],
  dateRange: { start: string, end: string }
) => {
  try {
    const doc = new jsPDF();
    
    // Shop Header
    doc.setFontSize(22);
    doc.setTextColor(13, 148, 136); // Teal-600
    doc.text(shopName, 105, 20, { align: 'center' });
    
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text('Customer Transaction Report', 105, 30, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Period: ${dateRange.start} to ${dateRange.end}`, 105, 36, { align: 'center' });
    
    // Customer Info Card
    doc.setDrawColor(230, 230, 230);
    doc.setFillColor(250, 250, 250);
    doc.roundedRect(14, 45, 182, 30, 3, 3, 'FD');
    
    doc.setTextColor(0);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(customer.name, 20, 55);
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    doc.text(`ID: ${customer.customerNumber}`, 20, 60);
    doc.text(`Phone: ${customer.phone || 'N/A'}`, 20, 65);
    doc.text(`Email: ${customer.email || 'N/A'}`, 20, 70);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0);
    doc.text('Total Outstanding Due:', 140, 60);
    doc.setFontSize(14);
    doc.setTextColor(153, 27, 27); // Rose-800
    doc.text(`Rs. ${Number(customer.totalDue || 0).toLocaleString()}`, 140, 68);

    // Orders Section
    doc.setFontSize(12);
    doc.setTextColor(13, 148, 136);
    doc.text('Sales History / Bills', 14, 85);
    
    const orderHeaders = ['Date', 'Bill No', 'Items', 'Status', 'Total'];
    const orderData = orders.map(o => [
      new Date(o.createdAt).toLocaleDateString(),
      o.orderNumber || 'N/A',
      o.items.map((i: any) => i.name).join(', '),
      o.paymentStatus,
      `Rs. ${Number(o.totalAmount).toLocaleString()}`
    ]);

    autoTable(doc, {
      startY: 90,
      head: [orderHeaders],
      body: orderData,
      theme: 'striped',
      headStyles: { fillColor: [13, 148, 136] },
      styles: { fontSize: 8 },
      margin: { left: 14, right: 14 }
    });

    // Payments Section
    const finalY = (doc as any).lastAutoTable.finalY + 15;
    doc.setFontSize(12);
    doc.setTextColor(13, 148, 136);
    doc.text('Payment History (Dues Settled)', 14, finalY);

    const paymentHeaders = ['Date & Time', 'Type', 'Note', 'Amount Paid'];
    const paymentData = payments.map(p => [
      new Date(p.timestamp).toLocaleString(),
      p.type?.replace('_', ' ') || 'Payment',
      p.note || '-',
      `Rs. ${Number(p.amount).toLocaleString()}`
    ]);

    autoTable(doc, {
      startY: finalY + 5,
      head: [paymentHeaders],
      body: paymentData,
      theme: 'striped',
      headStyles: { fillColor: [20, 184, 166] }, // Teal-500
      styles: { fontSize: 8 },
      margin: { left: 14, right: 14 }
    });

    // Summary at the end
    const lastY = (doc as any).lastAutoTable.finalY + 15;
    const totalOrderValue = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    const totalPaymentValue = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Total Sales in Period: Rs. ${totalOrderValue.toLocaleString()}`, 140, lastY);
    doc.text(`Total Paid in Period: Rs. ${totalPaymentValue.toLocaleString()}`, 140, lastY + 6);
    
    doc.save(`customer-report-${customer.name.replace(/\s+/g, '-').toLowerCase()}-${format(new Date(), 'yyyyMMdd')}.pdf`);
  } catch (error) {
    console.error("PDF Generation Error (Customer Report):", error);
    alert("Failed to generate report PDF. Please try again.");
  }
};
