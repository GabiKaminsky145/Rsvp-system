const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const { getGuestName, getMaybeGuests, updateRSVP } = require("./db");
const fs = require("fs");

const waitingForPeople = {};

const client = new Client({
    authStrategy: new LocalAuth(),
});

client.on("qr", (qr) => {
    console.log("Scan the QR code below:");
    qrcode.generate(qr, { small: true });
});

client.on("ready", async () => {
    console.log("✅ Bot is ready!");

    const guestsToSend = await getMaybeGuests();
    const imagePath = "invitation.jpg"; // Make sure this image is in the same folder

    if (!fs.existsSync(imagePath)) {
        console.error("❌ Image file not found. Make sure 'invitation.jpg' exists.");
        return;
    }

    const media = MessageMedia.fromFilePath(imagePath);

    for (let phone of guestsToSend) {
        const chatId = phone + "@c.us";
        const guestName = await getGuestName(phone);
        const nameToUse = guestName ? guestName : "אורח";

        const message = `שלום, ${nameToUse}! בחר אחת מהאפשרויות:\n` +
            "1️⃣ מגיע/ה\n" +
            "2️⃣ לא מגיע/ה\n" +
            "3️⃣ אולי";

        // Send image first
        // await client.sendMessage(chatId, media, { caption: "💌 ההזמנה לחתונה שלנו!" });
        // console.log(`📸 Sent image to ${phone}`);

        // Send message after the image
        await client.sendMessage(chatId, message);
        console.log(`📨 Sent RSVP message to ${phone}`);
    }
});

client.on("message", async (msg) => {
    const userMessage = msg.body.trim();
    const senderId = msg.from.replace("@c.us", ""); // Extract phone number

    if (waitingForPeople[senderId]) {
        if (/^\d+$/.test(userMessage)) {
            const numberOfPeople = parseInt(userMessage, 10);
            await updateRSVP(senderId, "yes", numberOfPeople);
            await msg.reply(`תודה! נרשמתם ל-${numberOfPeople} איש/נשים.`);
            delete waitingForPeople[senderId];
        } else {
            await msg.reply("❌ זה לא נראה כמו מספר. אנא שלח מספר תקני.");
        }
        return;
    }

    if (userMessage === "התחלה") {
        await msg.reply(
            "שלום! בחר אחת מהאפשרויות:\n" +
            "1️⃣ מגיע/ה\n" +
            "2️⃣ לא מגיע/ה\n" +
            "3️⃣ אולי"
        );
    } else if (userMessage === "1") {
        await msg.reply("תודה על ההגעה!");
        await msg.reply("כמה אנשים תגיעו?");
        waitingForPeople[senderId] = true;
        await updateRSVP(senderId, "yes");
    } else if (userMessage === "2") {
        await msg.reply("חבל! נקווה שתוכל להגיע בפעם הבאה.");
        await updateRSVP(senderId, "no", 0);
    } else if (userMessage === "3") {
        await msg.reply("אשמח לעדכון בקרוב!");
        await updateRSVP(senderId, "maybe", 0);
    } else {
        await msg.reply("❌ לא הבנתי, שלח 'התחלה' כדי לראות את האפשרויות.");
    }
});

// Start the bot
client.initialize();
