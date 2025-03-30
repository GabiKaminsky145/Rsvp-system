const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const { getGuestName, getMaybeGuests, updateRSVP, logUndeliveredMessage, getCategory } = require("./db");
const fs = require("fs");

const waitingForPeople = {};
const wazeLink = "https://www.waze.com/ul/hsv8tx653k";

// Generate invite message
const generateInviteMessage = (guestName) => {
    const nameToUse = guestName ? guestName : "אורח";
    return `שלום, ${nameToUse}\n` +
        " הוזמנתם לחתונה של גבריאל ואורטל שתערך באולם באסיקו נס ציונה בתאריך 04.06.25💍\n" +
        "בחר אחת מהאפשרויות וענה במספר (לדוגמא: השב 1 )\n" +
        "1️⃣ מגיע/ה\n" +
        "2️⃣ לא מגיע/ה\n" +
        "3️⃣ אולי";
};

// Function to send a message with delay
const sendMessageWithDelay = async (chatId, guestName, category, delay) => {
    try {
        await client.sendMessage(chatId, generateInviteMessage(guestName));
        console.log(`📨 Sent RSVP message to ${chatId}`);
    } catch (err) {
        console.error(`❌ Failed to send message to ${chatId}: ${err.message}`);
        await logUndeliveredMessage(chatId.replace("@c.us", ""), guestName, category);
    }
};

// Function to send messages with rate limiting
const sendMessagesToGuests = async (guests) => {
    const delayBetweenMessages = 3000; // 3-second delay

    for (let phone of guests) {
        const chatId = phone + "@c.us";
        const guestName = await getGuestName(phone);
        const category = await getCategory(phone);

        await sendMessageWithDelay(chatId, guestName, category, delayBetweenMessages);
        await new Promise(resolve => setTimeout(resolve, delayBetweenMessages)); // Delay before next message
    }
};

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
    await sendMessagesToGuests(guestsToSend);
});

client.on("message", async (msg) => {
    const userMessage = msg.body.trim();
    const senderId = msg.from.replace("@c.us", "");
    const guestName = await getGuestName(senderId);

    if (waitingForPeople[senderId]) {
        if (/^\d+$/.test(userMessage)) {
            const numberOfPeople = parseInt(userMessage, 10);
            await updateRSVP(senderId, "yes", numberOfPeople);
            await msg.reply(`תודה רבה על הרישום!✅ \nנשמח שתחגגו איתנו 🎉\n מצורף לינק לוויז לדרך הגעה:📍\n${wazeLink}`);
            delete waitingForPeople[senderId];
        } else {
            await msg.reply("❌ זה לא נראה כמו מספר. אנא שלח מספר תקני.");
        }
        return;
    }

    if (userMessage === "התחלה") {
        await msg.reply(generateInviteMessage(guestName));
    } else if (userMessage === "1") {
        await msg.reply("נשמח לראותכם איתנו!🎊\nכמה תגיעו? (רשום מספר)");
        waitingForPeople[senderId] = true;
    } else if (userMessage === "2") {
        await updateRSVP(senderId, "no");
        await msg.reply("היינו שמחים לראותכם, אבל תודה לכם!😢" + 
            "\n באפשרותכם לשנות את בחירתכם ע\"י שליחת ההודעה 'התחלה'");
    } else if (userMessage === "3") {
        await updateRSVP(senderId, "maybe");
        await msg.reply("תודה על התשובה!🤔 " + 
            "\nבאפשרותכם לשנות את בחירתכם ע\"י שליחת ההודעה 'התחלה'🔄");
    } else {
        await msg.reply("❌ לא הבנתי, שלח 'התחלה' כדי לראות את האפשרויות.");
    }
});

// Start the bot
client.initialize();
