# 💌 RSVP System via WhatsApp + LLM (Hebrew Support)

A full-stack WhatsApp bot to manage wedding RSVPs — complete with typo-tolerant Hebrew understanding using a local LLM via [Ollama](https://ollama.com).  
Built for Gabriel & Ortal’s wedding 🎉

---

## ✨ Features

- ✅ Sends RSVP invitations with media over WhatsApp  
- ✅ Interprets Hebrew replies (even with typos!) using a local LLM (`mistral` or `gemma`)  
- ✅ Records responses in PostgreSQL (`yes` / `no` / `maybe`)  
- ✅ Asks for number of attendees if response is "yes"  
- ✅ Automatically retries guests who haven’t responded  
- ✅ Runs 24/7 on a GCP VM using `pm2`  

---

## 📸 Demo

Coming soon — sample screenshots of guest interaction

---

## 🧱 Project Structure

```bash
Rsvp-system/
├── index.js               # Main WhatsApp bot logic
├── llmHelper.js           # LLM intent classification (via Ollama)
├── shared/
│   └── db.js              # Database helper functions
├── wedding invitation.png # Media sent to guests
├── package.json
└── README.md
```

---

## ⚙️ Requirements

- Node.js 16+
- PostgreSQL database
- A WhatsApp number to use with [whatsapp-web.js](https://github.com/pedroslopez/whatsapp-web.js)
- A Linux VM (tested on GCP e2-standard-2)
- [Ollama](https://ollama.com) installed on the server (supports mistral/gemma/llama3)
- `pm2` for background services

---

## 🚀 Getting Started

### 1. Clone the Project

```bash
git clone https://github.com/GabiKaminsky145/Rsvp-system.git
cd Rsvp-system
npm install
```

### 2. Configure PostgreSQL

Set up your tables and credentials in `shared/db.js`.

You should have tables like:

```sql
CREATE TABLE guests (...);
CREATE TABLE rsvps (...);
```

### 3. Install and Run Ollama (LLM)

#### Install Ollama:

```bash
curl -fsSL https://ollama.com/install.sh | sh
```

#### Download a model (e.g., mistral):

```bash
ollama pull mistral
```

#### Start the model:

```bash
ollama run mistral
```

> Ollama listens on `http://localhost:11434`

### 4. Start the Bot with PM2

Install PM2 if you haven’t:

```bash
npm install -g pm2
```

Start both services:

```bash
pm2 start "ollama run mistral" --name ollama-llm
pm2 start index.js --name rsvp-bot
pm2 save
pm2 startup
```

Then follow the instructions to enable auto-start on boot.

---

## 💬 How It Works

1. The bot sends RSVP WhatsApp messages to all guests.
2. Guests can reply with
   - `1`, `מגיע`, `כן` → interpreted as "Yes"
   - `2`, `לא מגיע`, `לא` → interpreted as "No"
   - `3`, `אולי` → interpreted as "Maybe"
   - Or typoed text like `מגיא`, `אוולייי` → LLM will try to classify
3. If the answer is "yes", the bot will ask how many are coming.
4. All responses are saved in your database.

---

## 🛠 Testing LLM Manually

You can test your model like this:

```bash
curl -X POST http://localhost:11434/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "model": "mistral",
    "prompt": "הודעת האורח: \"מגיא\"\nתשובתך:"
  }'
```

Expected Output:
```text
כן
```

---

## 🧠 Tips & Notes

- Make sure `ollama` is always running (use PM2!)
- You can switch the model to `gemma` or `llama3` in `llmHelper.js`
- If a guest replies again, they must type `"התחלה"` to reset their response

---

## 🧪 Example Conversation

```text
Guest: מגיא  
Bot: כמה תגיעו?  
Guest: 3  
Bot: תודה רבה! 📅 אפשר להוסיף את החתונה ליומן שלך...
```
---

## 🧑‍💻 Author

Built by [Gabi Kaminsky](https://github.com/GabiKaminsky145)

