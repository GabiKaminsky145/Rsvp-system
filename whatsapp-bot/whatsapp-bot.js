const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const {
    getGuestName,
    getMaybeGuests,
    getNotRespondedGuests,
    updateRSVP,
    logUndeliveredMessage,
    getCategory,
    setWaitingForPeople
} = require("../shared/db");
const { classifyUserResponseHebrew } = require("./llmHelper");
const fs = require("fs");

// Calendar invite details
const title = "Gabriel and Ortal's Wedding";
const startDate = "20250604T163000Z";
const endDate = "20250604T230000Z";
const details = "You're invited to our wedding! 🎉";
const location = "Basico Hall, Nes Ziona";
const calendarLink = "https://www.google.com/calendar/render?action=TEMPLATE"
    + "&text=" + encodeURIComponent(title)
    + "&dates=" + startDate + "/" + endDate
    + "&details=" + encodeURIComponent(details)
    + "&location=" + encodeURIComponent(location);

// Media and message
const media = MessageMedia.fromFilePath("./wedding invitation.png");
const generateInviteMessage = (guestName) => {
    const name = guestName || "אורח";
    return `שלום, ${name}\n` +
        "הוזמנתם לחתונה של גבריאל קמינסקי ואורטל אמיני שתערך באולם באסיקו נס ציונה בתאריך 04.06.25 💍\n" +
        "בחר אחת מהאפשרויות והקלד מספר (לדוגמא: הקלד ושלח 1):\n" +
        "1️⃣ מגיע/ה\n" +
        "2️⃣ לא מגיע/ה\n" +
        "3️⃣ אולי";
};

// Delays
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
let countDeliveredMessages = 0;

// Store user states
const waitingForPeople = {};
const userResponses = {};

// Init client
const client = new Client({
    authStrategy: new LocalAuth(),
});

client.on("qr", (qr) => {
    console.log("📱 Scan the QR code:");
    qrcode.generate(qr, { small: true });
});

client.on("ready", async () => {
    console.log("✅ Bot is ready!");
    const guests = await getMaybeGuests();
    await sendMessagesToGuests(guests);
});

const sendMessagesToGuests = async (guests) => {
    const delayBetweenMessages = 3000;
    for (let phone of guests) {
        const chatId = phone + "@c.us";
        const guestName = await getGuestName(phone);
        const category = await getCategory(phone);
        await delay(1000);
        await sendMessageWithDelay(chatId, guestName, category);
        await delay(delayBetweenMessages);
    }
    console.log("Number of guests to send messages to:", countDeliveredMessages);
};

const sendMessageWithDelay = async (chatId, guestName, category) => {
    try {
        const isRegistered = await client.isRegisteredUser(chatId);
        if (!isRegistered) {
            console.warn(`⚠️ ${chatId} is not a registered WhatsApp user.`);
            await logUndeliveredMessage(chatId.replace("@c.us", ""), guestName, category);
            return;
        }
        countDeliveredMessages++;
        await client.sendMessage(chatId, media, {
            caption: generateInviteMessage(guestName)
        });
        console.log(`📨 Sent RSVP message to ${chatId}`);
    } catch (err) {
        console.error(`❌ Failed to send message to ${chatId}: ${err.message}`);
        countDeliveredMessages--;
        await logUndeliveredMessage(chatId.replace("@c.us", ""), guestName, category);
    }
};

client.on("message", async (msg) => {
    const userMessage = msg.body.trim();
    const senderId = msg.from.replace("@c.us", "");
    const guestName = await getGuestName(senderId);

    // Block repeated responses
    if (userResponses[senderId] && userMessage !== 'התחלה') {
        await client.sendMessage(msg.from, "⛔ כבר שלחת תשובה. שלח 'התחלה' כדי לשנות את בחירתך.");
        return;
    }

    // Reset flow
    if (userMessage === "התחלה") {
        await client.sendMessage(msg.from, generateInviteMessage(guestName));
        delete waitingForPeople[senderId];
        delete userResponses[senderId];
        await setWaitingForPeople(senderId, false);
        return;
    }

    // Handle number of attendees
    if (waitingForPeople[senderId]) {
        if (/^\d+$/.test(userMessage)) {
            const num = parseInt(userMessage, 10);
            if (num <= 0 || num > 7) {
                await client.sendMessage(msg.from, "❌ מספר לא תקין. אנא שלח מספר בין 1 ל-7.");
                return;
            }
            await updateRSVP(senderId, "yes", num);
            delete waitingForPeople[senderId];
            userResponses[senderId] = "yes";
            await setWaitingForPeople(senderId, false);
            await client.sendMessage(msg.from,
                `✅ תודה על הרישום!\nנשמח לראותכם 🎉\n` +
                `📅 ניתן להוסיף ליומן: ${calendarLink}` +
                `\n\nלשינוי עתידי, שלח 'התחלה' 🔄`);
        } else {
            await client.sendMessage(msg.from, "❌ זה לא נראה כמו מספר תקני. אנא נסה שוב.");
        }
        return;
    }

    // Handle standard replies
    if (["1", "כן", "מגיע"].includes(userMessage)) {
        await client.sendMessage(msg.from, "כמה תגיעו? (רשום מספר)");
        waitingForPeople[senderId] = true;
        await setWaitingForPeople(senderId, true);
        return;
    } else if (["2", "לא", "לא מגיע"].includes(userMessage)) {
        await updateRSVP(senderId, "no");
        userResponses[senderId] = "no";
        await setWaitingForPeople(senderId, false);
        await client.sendMessage(msg.from, "❌ חבל שלא תוכלו להגיע. ניתן לשנות את הבחירה על ידי שליחת 'התחלה'");
        return;
    } else if (["3", "אולי"].includes(userMessage)) {
        await updateRSVP(senderId, "maybe");
        userResponses[senderId] = "maybe";
        await setWaitingForPeople(senderId, false);
        await client.sendMessage(msg.from, "🤔 נרשמת כאולי. ניתן לעדכן את הבחירה על ידי שליחת 'התחלה'🔄");
        return;
    }

    // LLM fallback for typos or unclear responses
    try {
        const llmIntent = await classifyUserResponseHebrew(userMessage);
        if (llmIntent === "yes") {
            await client.sendMessage(msg.from, "כמה תגיעו? (רשום מספר)");
            waitingForPeople[senderId] = true;
            await setWaitingForPeople(senderId, true);
        } else if (llmIntent === "no") {
            await updateRSVP(senderId, "no");
            userResponses[senderId] = "no";
            await setWaitingForPeople(senderId, false);
            await client.sendMessage(msg.from, "❌ חבל שלא תוכלו להגיע. ניתן לשנות את הבחירה על ידי שליחת 'התחלה'");
        } else if (llmIntent === "maybe") {
            await updateRSVP(senderId, "maybe");
            userResponses[senderId] = "maybe";
            await setWaitingForPeople(senderId, false);
            await client.sendMessage(msg.from, "🤔 נרשמת כאולי. ניתן לעדכן את הבחירה על ידי שליחת 'התחלה'🔄");
        } else {
            await client.sendMessage(msg.from, "❌ לא הצלחתי להבין את התשובה.\nבחר מספר:\n1️⃣ מגיע/ה\n2️⃣ לא מגיע/ה\n3️⃣ אולי");
        }
    } catch (err) {
        console.error("LLM Error:", err.message);
        await client.sendMessage(msg.from, "⚠️ לא ניתן להבין את ההודעה כעת. נסה שוב או שלח 'התחלה'.");
    }
});

client.initialize();
