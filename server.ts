import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { Resend } from 'resend';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.post('/api/reminders', async (req, res) => {
    const { customerName, email, dueAmount } = req.body;
    
    if (!process.env.RESEND_API_KEY) {
      console.warn("RESEND_API_KEY is missing. Reminder simulated.");
      return res.status(200).json({ status: 'simulated', message: 'Reminder simulated' });
    }

    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from: 'InventoryGuard <onboarding@resend.dev>',
        to: email || 'bodhisatwa.zeroone@gmail.com', // Fallback for demo
        subject: `Payment Reminder: ${customerName}`,
        html: `
          <div style="font-family: sans-serif; padding: 20px; color: #333;">
            <h2 style="color: #0d9488;">Payment Reminder</h2>
            <p>Hello <strong>${customerName}</strong>,</p>
            <p>This is a friendly reminder that you have an outstanding balance of <strong>$${dueAmount.toLocaleString()}</strong> at our shop.</p>
            <p>Please visit us at your earliest convenience to settle the amount.</p>
            <hr style="border: 1px solid #eee; margin: 20px 0;" />
            <p style="font-size: 12px; color: #666;">Sent via InventoryGuard</p>
          </div>
        `
      });
      res.json({ status: 'ok', message: 'Email sent' });
    } catch (error) {
      console.error("Error sending email:", error);
      res.status(500).json({ error: 'Failed to send email' });
    }
  });

  // Vite middleware
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
