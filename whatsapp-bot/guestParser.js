const xlsx = require('xlsx');
const { Client } = require('pg');

// Load Excel file
const workbook = xlsx.readFile('מוזמנים חתונה.xlsx');
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];

// Parse Excel data
const data = xlsx.utils.sheet_to_json(sheet);

// Normalize phone number and map fields
const normalizePhone = (phone) => {
  const digits = String(phone).replace(/\D/g, ''); // remove non-digit characters
  return '972' + digits;
};

const transformed = data.map(row => ({
  guestname: row["שם המוזמן"] || '',
  attendees: parseInt(row["מספר מוזמנים"] || '0'),
  phone: normalizePhone(row["מספר פל'"] || ''),
  category: row["קירבה"] || '',
  status: 'not_responded',
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
      await client.query(
        `INSERT INTO rsvp (phone, guestname, status, attendees, category, waiting_for_people)
         VALUES ($1, $2, $3, $4, $5, FALSE)
         ON CONFLICT (phone) DO UPDATE SET
           guestname = EXCLUDED.guestname,
           status = EXCLUDED.status,
           attendees = EXCLUDED.attendees,
           category = EXCLUDED.category;`,
        [
          row.phone,
          row.guestname,
          row.status,
          row.attendees,
          row.category,
        ]
      );
    }

    console.log("Data inserted (or updated) successfully into rsvp.");
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await client.end();
  }
})();
