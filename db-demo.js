const { Pool } = require("pg");

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

// Get all guests with their category, RSVP status, and number of attendees
const getAllRSVPs = async () => {
    try {
        const res = await pool.query("SELECT guestname, status, category, attendees FROM demo");
        return res.rows;
    } catch (err) {
        console.error("❌ Error fetching RSVP data:", err);
        return [];
    }
};

// Get guest name by phone
const getGuestName = async (phone) => {
    try {
        const res = await pool.query("SELECT guestname FROM demo WHERE phone = $1", [phone]);
        return res.rows.length > 0 ? res.rows[0].guestname : null;
    } catch (err) {
        console.error("❌ Error fetching guest name:", err);
        return null;
    }
};

// Get guests with "maybe" status
const getMaybeGuests = async () => {
    try {
        const res = await pool.query("SELECT phone FROM demo WHERE status = 'maybe'");
        return res.rows.map(row => row.phone);
    } catch (err) {
        console.error("❌ Error fetching maybe guests:", err);
        return [];
    }
};

// Update RSVP status and attendees
const updateRSVP = async (phone, status, attendees = 0, category = "Unknown") => {
    try {
        await pool.query(
            "INSERT INTO demo (phone, status, attendees, category) VALUES ($1, $2, $3, $4) " +
            "ON CONFLICT (phone) DO UPDATE SET status = EXCLUDED.status, attendees = EXCLUDED.attendees, category = EXCLUDED.category",
            [phone, status, attendees, category]
        );
        console.log(`✅ Updated RSVP for ${phone} - Status: ${status}, Attendees: ${attendees}, Category: ${category}`);
    } catch (err) {
        console.error("❌ Error updating RSVP:", err);
    }
};

// Log undelivered WhatsApp messages
const logUndeliveredMessage = async (phone, guestname, category) => {
    try {
        await pool.query(
            "INSERT INTO undelivered_messages (phone, guestname, category) VALUES ($1, $2, $3) " +
            "ON CONFLICT (phone) DO NOTHING",
            [phone, guestname, category]
        );
        console.log(`❌ Logged undelivered message for ${phone}`);
    } catch (err) {
        console.error("❌ Error logging undelivered message:", err);
    }
};

// Get all guests who didn't receive a WhatsApp message
const getUndeliveredMessages = async () => {
    try {
        const res = await pool.query("SELECT * FROM undelivered_messages");
        return res.rows;
    } catch (err) {
        console.error("❌ Error fetching undelivered messages:", err);
        return [];
    }
};

module.exports = { getAllRSVPs, getGuestName, getMaybeGuests, updateRSVP };
// module.exports = pool;
