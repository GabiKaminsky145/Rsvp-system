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

// Function to send message with a delay
const sendMessageWithDelay = async (chatId, message, delay) => {
    try {
        await client.sendMessage(chatId, message);
        console.log(`📨 Sent RSVP message to ${chatId}`);
    } catch (err) {
        console.error(`❌ Failed to send message to ${chatId}`);
    }
};

// Function to send messages with rate limiting
const sendMessagesToGuests = async (guests) => {
    const delayBetweenMessages = 3000; // Delay of 3 seconds (3000 milliseconds)

    for (let i = 0; i < guests.length; i++) {
        const guest = guests[i];
        const chatId = guest + "@c.us"; // Ensure the format is correct
        const guestName = await getGuestName(guest);
        const message = generateInviteMessage(guestName);

        await sendMessageWithDelay(chatId, message, delayBetweenMessages);

        // Adding a delay of 3 seconds before sending the next message
        await new Promise(resolve => setTimeout(resolve, delayBetweenMessages));
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
