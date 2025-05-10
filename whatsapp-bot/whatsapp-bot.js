const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const { getGuestName, getMaybeGuests, updateRSVP, logUndeliveredMessage, getCategory, setWaitingForPeople } = require("../shared/db");
const fs = require("fs");

const waitingForPeople = {};
const userResponses = {};
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

const sendMessageWithDelay = async (chatId, guestName, category, delay) => {
    try {
        await client.sendMessage(chatId, generateInviteMessage(guestName));
        console.log(`📨 Sent RSVP message to ${chatId}`);
    } catch (err) {
        console.error(`❌ Failed to send message to ${chatId}: ${err.message}`);
        await logUndeliveredMessage(chatId.replace("@c.us", ""), guestName, category);
    }
};

const sendMessagesToGuests = async (guests) => {
    const delayBetweenMessages = 3000;

    for (let phone of guests) {
        const chatId = phone + "@c.us";
        const guestName = await getGuestName(phone);
        const category = await getCategory(phone);

        await sendMessageWithDelay(chatId, guestName, category, delayBetweenMessages);
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
                `תודה רבה על הרישום!✅ \nנשמח שתחגגו איתנו 🎉\n מצורף לינק לוויז לדרך הגעה:📍\n${wazeLink}` +
                `\n ניתן להוסיף את החתונה ליומן שלך:📅 ${calendarLink}` +
                `\n\n במידה וישנו עדכון או שינוי\nבאפשרותכם לשנות את בחירתכם ע"י שליחת ההודעה 'התחלה'🔄`);
        } else {
            await client.sendMessage(msg.from, "❌ זה לא נראה כמו מספר. אנא שלח מספר תקני.");
        }
        return;
    }

    if (userMessage === "1" || userMessage === "כן" || userMessage === "מגיע") {
        await client.sendMessage(msg.from, "נשמח לראותכם איתנו!🎊\nכמה תגיעו? (רשום מספר)");
        waitingForPeople[senderId] = true;
        await setWaitingForPeople(senderId, true);
    } else if (userMessage === "2" || userMessage === "לא") {
        await updateRSVP(senderId, "no");
        userResponses[senderId] = "no";
        await setWaitingForPeople(senderId, false);
        await client.sendMessage(msg.from, "היינו שמחים לראותכם, אבל תודה לכם!😢" +
            "\n באפשרותכם לשנות את בחירתכם ע\"י שליחת ההודעה 'התחלה'");
    } else if (userMessage === "3" || userMessage === "אולי") {
        await updateRSVP(senderId, "maybe");
        userResponses[senderId] = "maybe";
        await setWaitingForPeople(senderId, false);
        await client.sendMessage(msg.from, "תודה על התשובה!🤔 " +
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
