# O'quv markazi Telegram boti (ota-onalar uchun)

Ota-onalar botga kirganda profili yuboriladi va ular quyidagi menyu orqali
markaz bilan aloqa qiladilar:

- 💬 **Fikr bildirish** — fikr-mulohaza (matn yoki ovozli xabar)
- 👪 **Farzandim** — farzand ismi va sinf/guruhini kiritish
- 📋 **Murojaatlarim** — savol/murojaat yuborish (matn yoki ovozli xabar)
- 📞 **Bog'lanish** — markaz telefon raqami, manzili, ish vaqti

Ota-ona istalgan vaqtda 🎙 **ovozli xabar (golosovoy)** yuborishi mumkin —
u avtomatik ravishda administratorga forward qilinadi.

## O'rnatish

1. Paketlarni o'rnating:

   ```bash
   npm install
   ```

2. [@BotFather](https://t.me/BotFather) orqali bot yarating va tokenni oling.

3. O'zingizning (yoki markaz administratorining) Telegram Chat ID'sini bilib
   oling — buning uchun [@userinfobot](https://t.me/userinfobot) ga `/start`
   yozing, u sizga ID raqamingizni beradi.

4. `.env.example` faylini `.env` ga nusxalang va to'ldiring:

   ```bash
   cp .env.example .env
   ```

   ```
   BOT_TOKEN=123456789:AAExampleTokenHere
   ADMIN_CHAT_ID=123456789
   ```

   > **Muhim:** Bot administratorga xabar yubora olishi uchun, administrator
   > avval botga `/start` bosgan bo'lishi kerak (Telegram botlari o'zi
   > birinchi bo'lib yozolmaydi).

## Ishga tushirish

```bash
npm start
```

## Qanday ishlaydi

- `/start` — foydalanuvchi profilini (ism, username, ID, rasm) qaytaradi va
  pastki menyuni ko'rsatadi.
- Har bir menyu tugmasi foydalanuvchi holatini (`state`) o'rnatadi — masalan,
  "Fikr bildirish" bosilgach, keyingi yuborilgan matn yoki ovozli xabar
  avtomatik ravishda fikr-mulohaza sifatida administratorga yuboriladi.
- "Farzandim" bo'limi ikki bosqichli: avval ism, keyin sinf/guruh so'raladi.
- 🎙 Ovozli xabarlar `bot.on('voice', ...)` orqali ushlanadi va
  `ctx.forwardMessage(...)` yordamida to'g'ridan-to'g'ri administratorga
  (ovoz fayli bilan birga) forward qilinadi.
- Foydalanuvchi holatlari xotirada (`Map`) saqlanadi — bot qayta ishga
  tushirilsa, holatlar tozalanadi (ma'lumotlar bazasi ishlatilmagan).

## Keyingi qadamlar (xohlasangiz)

- Ma'lumotlarni (farzand ma'lumotlari, murojaatlar) bazaga (masalan, SQLite
  yoki MongoDB) saqlash — hozircha faqat adminga forward qilinadi.
- Administrator bevosita botdan ota-onaga javob yozib yuborishi (reply
  funksiyasi).
- "Bog'lanish" bo'limidagi telefon/manzilni haqiqiy ma'lumot bilan almashtiring
  (`bot.js` faylidagi tegishli qatorlar).
- Guruhga qo'shilganda ham xabar yuborish.
