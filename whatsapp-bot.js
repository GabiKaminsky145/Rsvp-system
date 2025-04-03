const { Client, LocalAuth } = require("whatsapp-web.js");
const express = require("express");
const qrcode = require("qrcode-terminal");
const {
    getGuestName,
    getMaybeGuests,
    updateRSVP,
    logUndeliveredMessage,
    getCategory
} = require("./db");

const app = express();
const PORT = process.env.PORT || 3000;

const client = new Client({
    authStrategy: new LocalAuth(),
});

// Track user responses
const waitingForPeople = {};
const userResponses = {};

// Links for the event
const wazeLink = "https://www.waze.com/ul/hsv8tx653k";
const calendarLink = "https://calendar.google.com/calendar/u/0/r/eventedit?text=Wedding+of+Gabriel+and+Ortal&dates=20250604T163000Z/20250604T230000Z&details=Join+us+for+our+wedding!&location=Basico+Hall,+Nes+Ziona&pli=1";

// Generate invite message
const generateInviteMessage = (guestName) => {
    const nameToUse = guestName ? guestName : "אורח";
    return `שלום, ${nameToUse}\n` +
        " הוזמנתם לחתונה של גבריאל ואורטל שתערך באולם באסיקו נס ציונה בתאריך 04.06.25💍\n" +
        "בחר אחת מהאפשרויות והקלד מספר (לדוגמא: השב 1 )\n" +
        "1️⃣ מגיע/ה\n" +
        "2️⃣ לא מגיע/ה\n" +
        "3️⃣ אולי";
};

// Function to send messages
const sendMessagesToGuests = async (guests) => {
    for (let phone of guests) {
        const chatId = phone + "@c.us";
        const guestName = await getGuestName(phone);
        const category = await getCategory(phone);

        try {
            await client.sendMessage(chatId, generateInviteMessage(guestName));
            console.log(`📨 Sent RSVP message to ${chatId}`);
        } catch (err) {
            console.error(`❌ Failed to send message to ${chatId}: ${err.message}`);
            await logUndeliveredMessage(phone, guestName, category);
        }

        await new Promise(resolve => setTimeout(resolve, 3000)); // 3-second delay
    }
};

// WhatsApp bot initialization
client.on("qr", (qr) => {
    console.log("Scan the QR code below:");
    qrcode.generate(qr, { small: true });
});

client.on("ready", async () => {
    console.log("✅ Bot is ready!");

    const guestsToSend = await getMaybeGuests();
    await sendMessagesToGuests(guestsToSend);
});

client.on("message", async (msg) => {
    const userMessage = msg.body.trim();
    const senderId = msg.from.replace("@c.us", "");
    const guestName = await getGuestName(senderId);

    if (userResponses[senderId] && userMessage !== 'התחלה') {
        await msg.reply("⛔ כבר שלחת תשובה. אם ברצונך לשנות את בחירתך, שלח 'התחלה' כדי לבחור מחדש.");
        return;
    }

    if (userMessage === "התחלה") {
        await msg.reply(generateInviteMessage(guestName));
        delete waitingForPeople[senderId];
        delete userResponses[senderId];
        return;
    }

    if (waitingForPeople[senderId]) {
        if (/^\d+$/.test(userMessage)) {
            const numberOfPeople = parseInt(userMessage, 10);
            await updateRSVP(senderId, "yes", numberOfPeople);
            await msg.reply(`תודה רבה על הרישום!✅ \nנשמח שתחגגו איתנו 🎉\n מצורף לינק לוויז לדרך הגעה:📍\n${wazeLink}` +
                `\n ניתן להוסיף את החתונה ליומן שלך:📅 ${calendarLink}`);
            delete waitingForPeople[senderId];
            userResponses[senderId] = "yes";
        } else {
            await msg.reply("❌ זה לא נראה כמו מספר. אנא שלח מספר תקני.");
        }
        return;
    }

    if (userMessage === "1" || userMessage === "כן" || userMessage === "מגיע") {
        await msg.reply("נשמח לראותכם איתנו!🎊\nכמה תגיעו? (רשום מספר)");
        waitingForPeople[senderId] = true;
    } else if (userMessage === "2" || userMessage === "לא") {
        await updateRSVP(senderId, "no");
        await msg.reply("היינו שמחים לראותכם, אבל תודה לכם!😢\n באפשרותכם לשנות את בחירתכם ע\"י שליחת ההודעה 'התחלה'");
        userResponses[senderId] = "no";
    } else if (userMessage === "3" || userMessage === "אולי") {
        await updateRSVP(senderId, "maybe");
        await msg.reply("תודה על התשובה!🤔\nבאפשרותכם לשנות את בחירתכם ע\"י שליחת ההודעה 'התחלה'🔄");
        userResponses[senderId] = "maybe";
    } else {
        await msg.reply("אפשרות לא קיימת❌\n\n🔹 *בחר אחת מהאפשרויות וענה במספר (לדוגמא: השב 1 )*\n1️⃣ מגיע/ה\n2️⃣ לא מגיע/ה\n3️⃣ אולי");
    }
});

// Keep bot alive on Render
app.get("/", (req, res) => {
    res.send("WhatsApp RSVP Bot is running!");
});

app.listen(PORT, () => {
    console.log(`🌍 Server running on port ${PORT}`);
});

// Start the bot
client.initialize();
