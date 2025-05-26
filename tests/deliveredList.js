const fs = require('fs');
const qrcode = require('qrcode-terminal');
const { Client, LocalAuth } = require('whatsapp-web.js');

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox']
    }
});

client.on('qr', (qr) => {
    console.log('Scan this QR code:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', async () => {
    console.log('Client is ready! Fetching chats...');

    const chats = await client.getChats();
    const phoneNumbers = [];

    const now = Date.now();
    const sixHoursInMs = 6 * 60 * 60 * 1000;

    for (const chat of chats) {
        if (chat.id._serialized.endsWith('@c.us')) {
            const messages = await chat.fetchMessages({ limit: 1 }); // Get last message
            if (messages.length > 0) {
                const lastMsg = messages[0];
                const msgTime = lastMsg.timestamp * 1000; // Convert to ms
                if ((now - msgTime) <= sixHoursInMs) {
                    phoneNumbers.push(chat.id.user);
                }
            }
        }
    }

    if (phoneNumbers.length === 0) {
        console.log('⚠️ No active chats in the last 6 hours.');
    } else {
        phoneNumbers.forEach(phone => console.log(phone));
        fs.writeFileSync('whatsapp_recent_phone_numbers.txt', phoneNumbers.join('\n'));
        console.log(`✅ Saved ${phoneNumbers.length} phone numbers to whatsapp_recent_phone_numbers.txt`);
    }

    client.destroy();
});

client.initialize();
