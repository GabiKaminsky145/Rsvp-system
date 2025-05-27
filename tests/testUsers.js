const { getGuestName, getMaybeGuests, getNotRespondedGuests, updateRSVP, logUndeliveredMessage, getCategory, setWaitingForPeople } = require("../shared/db");
const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js");



const client = new Client({
    authStrategy: new LocalAuth(),
});

client.on("ready", async () => {
    console.log("✅ Bot is ready!");

    const guestsToSend = await getMaybeGuests();
    let count = 0;
    for (let guest of guestsToSend) {
        count++;
        let chatId = guest + "@c.us";
        const isRegistered = await client.isRegisteredUser(chatId);
        if (!isRegistered) {
            count--;
            let guestName = await getGuestName(guest);
            console.warn(`⚠️ ${guestName} is not a registered WhatsApp user.`);
        }
    }
    console.log("Number of guests to send messages to: ", count);
});


client.initialize();
