const xlsx = require("xlsx");
const pool = require("./db-demo"); // Import your db.js connection

// Read the Excel file
const workbook = xlsx.readFile("מוזמנים חתונה.xlsx"); // Update with correct file path
const sheetName = workbook.SheetNames[0]; // Get the first sheet
const sheet = workbook.Sheets[sheetName];

// Convert sheet data to JSON
const data = xlsx.utils.sheet_to_json(sheet, { defval: "" });

// Map columns to database fields
const guests = data.map((row) => ({
  guestname: row["שם המוזמן"] ? row["שם המוזמן"].toString().trim() : "",
  attendees: parseInt(row["מספר מוזמנים"], 10) || 0, // Default to 0 if empty
  phone: row["מספר פל'"] ? row["מספר פל'"].toString().trim() : "", // Ensure phone is a string
  category: row["קירבה"] ? row["קירבה"].toString().trim() : "", // Default to empty string
  status: "no", // Default status
}));

// Insert data into PostgreSQL
async function insertData() {
  try {
    for (const guest of guests) {
      // Skip empty rows
      if (!guest.guestname || !guest.phone) continue;

      await pool.query(
        `INSERT INTO demo (guestname, attendees, phone, category, status) 
         VALUES ($1, $2, $3, $4, $5)`,
        [guest.guestname, guest.attendees, guest.phone, guest.category, guest.status]
      );
    }
    console.log("✅ Data inserted successfully!");
  } catch (error) {
    console.error("❌ Error inserting data:", error);
  }
}

insertData();
