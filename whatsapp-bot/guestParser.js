const xlsx = require('xlsx');
const { Client } = require('pg');

// Load Excel file
const workbook = xlsx.readFile('מוזמנים חתונה.xlsx');
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];

// Parse Excel data
const data = xlsx.utils.sheet_to_json(sheet);

// Normalize phone number
const normalizePhone = (phone) => {
  const digits = String(phone).replace(/\D/g, '');
  return digits.startsWith('972') ? digits : '972' + digits;
};

const transformed = data.map(row => ({
  guestname: row["שם המוזמן"] || '',
  attendees: parseInt(row["מספר מוזמנים"] || '0'),
  phone: normalizePhone(row["מספר פל'"] || ''),
  category: row["קירבה"] || '',
}));

// PostgreSQL client setup
const client = new Client({
  user: 'avnadmin',
  host: 'rsvp-rsvp.k.aivencloud.com',
  database: 'defaultdb',
  password: 'AVNS_pFMUXfqcvum6kzDDT3S',
  port: 20418,
  ssl: {
    rejectUnauthorized: false,
  },
});

(async () => {
  try {
    await client.connect();

    for (const row of transformed) {
      const { phone, guestname, attendees, category } = row;

      // Check if phone exists
      const phoneCheck = await client.query('SELECT * FROM rsvp WHERE phone = $1', [phone]);

      if (phoneCheck.rows.length > 0) {
        // Phone exists → update full info
        await client.query(
          `UPDATE rsvp SET guestname = $1, attendees = $2, category = $3 WHERE phone = $4`,
          [guestname, attendees, category, phone]
        );
      } else {
        // Phone doesn't exist → check by guest name
        const nameCheck = await client.query('SELECT * FROM rsvp WHERE guestname = $1', [guestname]);

        if (nameCheck.rows.length > 0) {
          // Guest name exists → update phone only
          await client.query(
            `UPDATE rsvp SET phone = $1 WHERE guestname = $2`,
            [phone, guestname]
          );
        } else {
          // Both phone and name are new → insert new record
          await client.query(
            `INSERT INTO rsvp (phone, guestname, status, attendees, category, waiting_for_people)
             VALUES ($1, $2, 'not_responded', $3, $4, FALSE)`,
            [phone, guestname, attendees, category]
          );
        }
      }
    }

    console.log("Data processing complete.");
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await client.end();
  }
})();
