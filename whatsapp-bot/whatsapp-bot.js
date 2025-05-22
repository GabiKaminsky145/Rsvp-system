const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const { getGuestName, getMaybeGuests, getNotRespondedGuests, updateRSVP, logUndeliveredMessage, getCategory, setWaitingForPeople } = require("../shared/db");
const fs = require("fs");

const waitingForPeople = {};
const userResponses = {};

const title = "Gabriel and Ortal's Wedding";
const startDate = "20250604T163000Z"; // 2025-06-15 16:00 UTC
const endDate = "20250604T230000Z";   // 2025-06-15 21:00 UTC
const details = "You're invited to our wedding! 🎉";
const location = "Basico Hall, Nes Ziona";

const calendarLink = "https://www.google.com/calendar/render?action=TEMPLATE"
    + "&text=" + encodeURIComponent(title)
    + "&dates=" + startDate + "/" + endDate
    + "&details=" + encodeURIComponent(details)
    + "&location=" + encodeURIComponent(location);

// Generate invite message
const generateInviteMessage = (guestName) => {
    const nameToUse = guestName ? guestName : "אורח";
    return `שלום, ${nameToUse}\n` +
        " הוזמנתם לחתונה של גבריאל קמינסקי ואורטל אמיני שתערך באולם באסיקו נס ציונה בתאריך 04.06.25💍\n" +
        "בחר אחת מהאפשרויות והקלד מספר (לדוגמא: הקלד ושלח 1 )\n" +
        "1️⃣ מגיע/ה\n" +
        "2️⃣ לא מגיע/ה\n" +
        "3️⃣ אולי";
};

const media = MessageMedia.fromFilePath("./wedding invitation.png");

const sendMessageWithDelay = async (chatId, guestName, category, delay) => {
    try {
        const isRegistered = await client.isRegisteredUser(chatId);
        if (!isRegistered) {
            console.warn(`⚠️ ${chatId} is not a registered WhatsApp user.`);
            await logUndeliveredMessage(chatId.replace("@c.us", ""), guestName, category);
            return;
        }

        await client.sendMessage(chatId, media, {
            caption: generateInviteMessage(guestName)
        });

        console.log(`📨 Sent RSVP message to ${chatId}`);
    } catch (err) {
        console.error(`❌ Failed to send message to ${chatId}: ${err.message}`);
        await logUndeliveredMessage(chatId.replace("@c.us", ""), guestName, category);
    }
};

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const sendMessagesToGuests = async (guests) => {
    const delayBetweenMessages = 3000;

    for (let phone of guests) {
        const chatId = phone + "@c.us";
        const guestName = await getGuestName(phone);
        const category = await getCategory(phone);

        // Delay before checking if the number is registered
        await delay(1000);

        await sendMessageWithDelay(chatId, guestName, category, delayBetweenMessages);

        await delay(delayBetweenMessages);
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

    if (userResponses[senderId] && userMessage !== 'התחלה') {
        await client.sendMessage(msg.from, "⛔ כבר שלחת תשובה. אם ברצונך לשנות את בחירתך, שלח 'התחלה' כדי לבחור מחדש.");
        return;
    }

    if (userMessage === "התחלה") {
        await client.sendMessage(msg.from, generateInviteMessage(guestName, senderId));
        delete waitingForPeople[senderId];
        await setWaitingForPeople(senderId, false);
        delete userResponses[senderId];
        return;
    }

    if (waitingForPeople[senderId]) {
        if (/^\d+$/.test(userMessage)) {
            const numberOfPeople = parseInt(userMessage, 10);
            if (numberOfPeople <= 0 || numberOfPeople > 7) {
                await client.sendMessage(msg.from, "❌ מספר אנשים לא תקין. אנא שלח מספר בין 1 ל-7.");
                return;
            }
            await updateRSVP(senderId, "yes", numberOfPeople);
            await setWaitingForPeople(senderId, false);
            delete waitingForPeople[senderId];
            userResponses[senderId] = "yes";
            await client.sendMessage(msg.from,
                `תודה רבה על הרישום!✅ \nנשמח שתחגגו איתנו 🎉\n` +
                `\n ניתן להוסיף את החתונה ליומן שלך:📅 ${calendarLink}` +
                `\n\n במידה וישנו עדכון או שינוי\nבאפשרותכם לשנות את בחירתכם ע"י שליחת ההודעה 'התחלה'🔄`);
        } else {
            await client.sendMessage(msg.from, "❌ זה לא נראה כמו מספר. אנא שלח מספר תקני.");
        }
        return;
    }

    if (userMessage === "1" || userMessage === "כן" || userMessage === "מגיע") {
        await client.sendMessage(msg.from, "כמה תגיעו? (רשום מספר)");
        waitingForPeople[senderId] = true;
        await setWaitingForPeople(senderId, true);
    } else if (userMessage === "2" || userMessage === "לא"|| userMessage ==="לא מגיע") {
        await updateRSVP(senderId, "no");
        userResponses[senderId] = "no";
        await setWaitingForPeople(senderId, false);
        await client.sendMessage(msg.from, "תודה על המענה!" +
            "\n באפשרותכם לשנות את בחירתכם ע\"י שליחת ההודעה 'התחלה'");
    } else if (userMessage === "3" || userMessage === "אולי") {
        await updateRSVP(senderId, "maybe");
        userResponses[senderId] = "maybe";
        await setWaitingForPeople(senderId, false);
        await client.sendMessage(msg.from, "תודה על התשובה!🤔" +
            "\nבאפשרותכם לשנות את בחירתכם ע\"י שליחת ההודעה 'התחלה'🔄");
    } else {
        await client.sendMessage(msg.from, "אפשרות לא קיימת❌\n\n" +
            "🔹 *בחר אחת מהאפשרויות וענה במספר (לדוגמא: השב 1 )*\n" +
            "1️⃣ מגיע/ה\n" +
            "2️⃣ לא מגיע/ה\n" +
            "3️⃣ אולי");
    }
});

client.initialize();
