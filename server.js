const express = require("express");
const cors = require("cors");
const { getAllRSVPs } = require("./db-demo");

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

// API to get RSVP data with attendees count
app.get("/rsvp", async (req, res) => {
    try {
        const rsvpData = await getAllRSVPs();

        // Group data by RSVP status and calculate total attendees
        const groupedData = { yes: { guests: [], total: 0 }, no: { guests: [], total: 0 }, maybe: { guests: [], total: 0 } };

        rsvpData.forEach(guest => {
            const statusGroup = groupedData[guest.status];
            statusGroup.guests.push(guest);
            statusGroup.total += guest.attendees; // Sum attendees
        });

        res.json(groupedData);
    } catch (error) {
        res.status(500).json({ error: "Internal server error" });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});
