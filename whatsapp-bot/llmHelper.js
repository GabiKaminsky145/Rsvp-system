const fetch = require("node-fetch");

async function classifyUserResponseHebrew(message) {
    const prompt = `
אתה מקבל הודעה מחתן או אורח בעברית, שמטרתה היא תשובה להזמנה לחתונה.
המטרה שלך היא להבין האם המשתמש מתכוון ל:
- "כן"
- "לא"
- "אולי"

תתייחס גם לשגיאות כתיב קלות (כמו "מגיא", "לאא", או "אווליי") ותנסה להבין את הכוונה.
אל תסביר, רק תחזיר תשובה אחת מתוך שלושת האפשרויות: כן / לא / אולי.

הודעת האורח: "${message}"

תשובתך:
    `.trim();

    const response = await fetch("http://localhost:11434/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            model: "mistral",
            prompt: prompt,
            stream: false
        })
    });

    const data = await response.json();
    const raw = data.response.trim();

    if (raw.includes("כן")) return "yes";
    if (raw.includes("לא")) return "no";
    if (raw.includes("אולי")) return "maybe";

    return null;
}

module.exports = { classifyUserResponseHebrew };
