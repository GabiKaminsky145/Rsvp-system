const { Pool } = require("pg");

const pool = new Pool({
    user: "postgres",
    host: "localhost",
    database: "GuestsStatus",
    password: "dchuji123",
    port: 5432,
});

// Get all guests with their category, RSVP status, and number of attendees
const getAllRSVPs = async () => {
    try {
        const res = await pool.query("SELECT guestname, status, category, attendees FROM rsvp");
        return res.rows;
    } catch (err) {
        console.error("❌ Error fetching RSVP data:", err);
        return [];
    }
};

// Get guest name by phone
const getGuestName = async (phone) => {
    try {
        const res = await pool.query("SELECT guestname FROM rsvp WHERE phone = $1", [phone]);
        return res.rows.length > 0 ? res.rows[0].guestname : null;
    } catch (err) {
        console.error("❌ Error fetching guest name:", err);
        return null;
    }
};

// Get guests with "maybe" status
const getMaybeGuests = async () => {
    try {
        const res = await pool.query("SELECT phone FROM rsvp WHERE status = 'maybe'");
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
            "INSERT INTO rsvp (phone, status, attendees, category) VALUES ($1, $2, $3, $4) " +
            "ON CONFLICT (phone) DO UPDATE SET status = EXCLUDED.status, attendees = EXCLUDED.attendees, category = EXCLUDED.category",
            [phone, status, attendees, category]
        );
        console.log(`✅ Updated RSVP for ${phone} - Status: ${status}, Attendees: ${attendees}, Category: ${category}`);
    } catch (err) {
        console.error("❌ Error updating RSVP:", err);
    }
};

module.exports = { getAllRSVPs, getGuestName, getMaybeGuests, updateRSVP };
module.exports = pool; // ✅ Ensure pool is properly exported
