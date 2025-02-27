require('dotenv').config();
const express = require('express');
const wppconnect = require('@wppconnect-team/wppconnect');
const path = require('path');
const cors = require('cors');
const fs = require('fs').promises;
const puppeteer = require('puppeteer');

const app = express();
app.use(express.json());
app.use(cors());

let client;

async function initializeWhatsApp() {
  try {
    const puppeteerArgs = {
      headless: 'new', // Use 'new' for latest Puppeteer headless mode
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--single-process', // Helps on low-memory servers like Render
      ],
      executablePath: process.env.CHROMIUM_PATH || puppeteer.executablePath(),
    };

    client = await wppconnect.create({
      session: 'rural-dung-cakes',
      autoClose: false,
      puppeteerOptions: puppeteerArgs,
    });
    console.log('WhatsApp client initialized successfully');
    const phoneNumber = await client.getWid();
    console.log('Authenticated WhatsApp number:', phoneNumber);
  } catch (error) {
    console.error('Failed to initialize WhatsApp client:', error);
  }
}

initializeWhatsApp();

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'Server running', whatsappReady: !!client });
});

app.post('/send-order', async (req, res) => {
  console.log('Received order request:', req.body);

  const { items, total, paymentMethod, user, fromNumber } = req.body;

  if (!client) {
    console.error('WhatsApp client not available');
    return res.status(500).json({ error: 'WhatsApp client not ready' });
  }

  const yourNumber = '919301680755@c.us';

  const message = `
Order Details:
Items:
${items.map((item) => `${item.name} x${item.quantity} (₹${item.price * item.quantity})`).join('\n')}
Total: ₹${total}
Payment: ${paymentMethod.toUpperCase()}
Customer: ${user.name}
Phone: ${user.phone}
Address: ${user.address}
From: ${fromNumber}
`.trim();

  try {
    console.log('Sending text message to:', yourNumber);
    await client.sendText(yourNumber, message);
    console.log('Text message sent successfully');

    for (const item of items) {
      const imagePath = path.join(__dirname, 'public', item.img);
      console.log('Attempting to send image from:', imagePath);

      try {
        await fs.access(imagePath);
        console.log(`Image file exists at: ${imagePath}`);
      } catch (error) {
        console.error(`Image not found at ${imagePath}:`, error);
        throw new Error(`Image file not found: ${item.img}`);
      }

      await client.sendImage(
        yourNumber,
        imagePath,
        `${item.name}.jpg`,
        `${item.name} x${item.quantity}`
      );
      console.log(`Image sent for ${item.name}`);
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error in send-order:', error.message, error.stack);
    res.status(500).json({ error: `Failed to send order: ${error.message}` });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});