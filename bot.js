// O'quv markazi uchun Telegram bot (ota-onalar uchun)
// Funksiyalar:
//  - /start bosilganda foydalanuvchi profilini yuboradi
//  - Pastki menyu: Fikr bildirish | Farzandim | Murojaatlarim | Bog'lanish
//  - Ota-ona matn yoki OVOZLI (golosovoy) xabar yubora oladi -> admin/markazga forward qilinadi

require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID; // markaz administratorining chat ID'si

if (!BOT_TOKEN) {
  console.error('XATOLIK: .env faylida BOT_TOKEN ko\'rsatilmagan!');
  process.exit(1);
}
if (!ADMIN_CHAT_ID) {
  console.warn('OGOHLANTIRISH: ADMIN_CHAT_ID sozlanmagan. Xabarlar hech qayerga forward qilinmaydi.');
}

const bot = new Telegraf(BOT_TOKEN);

// ---------- Pastki menyu (reply keyboard) ----------
const mainMenu = Markup.keyboard([
  ['💬 Fikr bildirish', '👪 Farzandim'],
  ['📋 Murojaatlarim', '📞 Bog\'lanish'],
]).resize();

// ---------- Foydalanuvchi holatini saqlash (oddiy xotira, DB emas) ----------
// userId -> { state: 'feedback' | 'appeal' | 'child_name' | 'child_class', data: {} }
const sessions = new Map();

function setState(userId, state, data = {}) {
  sessions.set(userId, { state, data });
}
function getSession(userId) {
  return sessions.get(userId) || { state: null, data: {} };
}
function clearState(userId) {
  sessions.delete(userId);
}

// ---------- Farzand ma'lumotlarini saqlash (userId -> { childName, childClass }) ----------
const childrenData = new Map();

// ---------- Murojaatlar tarixini saqlash (userId -> [{ date, type, text }]) ----------
const appealsData = new Map();

function addAppeal(userId, type, text) {
  const list = appealsData.get(userId) || [];
  const date = new Date().toLocaleString('uz-UZ', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
  list.push({ date, type, text });
  appealsData.set(userId, list);
}

// ---------- Yordamchi funksiyalar ----------
function buildProfileText(user) {
  const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ');
  let text = `👤 <b>Sizning profilingiz</b>\n\n`;
  text += `🆔 ID: <code>${user.id}</code>\n`;
  text += `📛 Ism: ${fullName || '—'}\n`;
  text += `🔗 Username: ${user.username ? '@' + user.username : '—'}\n`;
  text += `🌐 Til kodi: ${user.language_code || '—'}\n`;
  return text;
}

function userTag(user) {
  const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ');
  const uname = user.username ? '@' + user.username : '(username yo\'q)';
  const child = childrenData.get(user.id);

  let tag = `${fullName} ${uname} [ID: ${user.id}]`;
  if (child) {
    tag += `\n👶 ${child.childName} ning ota-onasi (${child.childClass} guruhidagi)`;
  }
  return tag;
}

async function notifyAdmin(ctx, label, extraText = '') {
  if (!ADMIN_CHAT_ID) return;
  const header = `${label}\n👤 Yuboruvchi: ${userTag(ctx.from)}${extraText ? '\n\n' + extraText : ''}`;
  try {
    await ctx.telegram.sendMessage(ADMIN_CHAT_ID, header);
  } catch (err) {
    console.error('Adminga xabar yuborishda xatolik:', err.message);
  }
}

async function forwardToAdmin(ctx) {
  if (!ADMIN_CHAT_ID) return;
  try {
    await ctx.forwardMessage(ADMIN_CHAT_ID, ctx.chat.id, ctx.message.message_id);
  } catch (err) {
    console.error('Xabarni forward qilishda xatolik:', err.message);
  }
}

// ---------- Guruh tanlash tugmalari ----------
const groupOptions = Markup.inlineKeyboard([
  [
    Markup.button.callback('💻 IT', 'group_IT'),
    Markup.button.callback('🇬🇧 Ingliz tili', 'group_Ingliz_tili'),
  ],
  [
    Markup.button.callback('🇷🇺 Rus tili', 'group_Rus_tili'),
    Markup.button.callback('🇸🇦 Arab tili', 'group_Arab_tili'),
  ],
]);

function groupLabelFromCallback(data) {
  const map = {
    group_IT: '💻 IT',
    group_Ingliz_tili: '🇬🇧 Ingliz tili',
    group_Rus_tili: '🇷🇺 Rus tili',
    group_Arab_tili: '🇸🇦 Arab tili',
  };
  return map[data] || data;
}

async function askChildName(ctx) {
  setState(ctx.from.id, 'child_name');
  await ctx.reply('👪 Siz qaysi o\'quvchining ota-onasisiz?\n\nBolaning to\'liq ismini kiriting (masalan: Aliyev Sardor):');
}

// ---------- /start: profil yuborish + menyuni ko'rsatish ----------
bot.start(async (ctx) => {
  clearState(ctx.from.id);
  const user = ctx.from;
  const profileText = buildProfileText(user);

  try {
    const photos = await ctx.telegram.getUserProfilePhotos(user.id, 0, 1);
    if (photos.total_count > 0) {
      const fileId = photos.photos[0][photos.photos[0].length - 1].file_id;
      await ctx.replyWithPhoto(fileId, { caption: profileText, parse_mode: 'HTML' });
    } else {
      await ctx.replyWithHTML(profileText);
    }
  } catch (err) {
    console.error('Profil rasmini olishda xatolik:', err.message);
    await ctx.replyWithHTML(profileText);
  }

  await ctx.reply(
    `Assalomu alaykum, ${user.first_name || 'hurmatli ota-ona'}! 👋\n\n` +
    `O'quv markazimiz botiga xush kelibsiz.`,
    mainMenu
  );

  await notifyAdmin(ctx, '🆕 Yangi foydalanuvchi botga kirdi:');

  const existing = childrenData.get(user.id);
  if (existing) {
    // Ro'yxatdan avval o'tgan bo'lsa, qayta so'ramaymiz
    await ctx.reply(
      `👪 Siz ${existing.childName} (${existing.childClass}) ning ota-onasi sifatida ro'yxatdan o'tgansiz.\n\n` +
      `Istalgan vaqtda matn yoki 🎙 ovozli xabar yuborishingiz ham mumkin.`
    );
  } else {
    await askChildName(ctx);
  }
});

// ---------- Menyu tugmalari ----------

// 💬 Fikr bildirish
bot.hears('💬 Fikr bildirish', async (ctx) => {
  setState(ctx.from.id, 'feedback');
  await ctx.reply(
    '⭐ Ta\'lim sifatini baholang:',
    Markup.inlineKeyboard([
      [
        Markup.button.callback('⭐ 1', 'rate_1'),
        Markup.button.callback('⭐⭐ 2', 'rate_2'),
        Markup.button.callback('⭐⭐⭐ 3', 'rate_3'),
      ],
      [
        Markup.button.callback('⭐⭐⭐⭐ 4', 'rate_4'),
        Markup.button.callback('⭐⭐⭐⭐⭐ 5', 'rate_5'),
      ],
    ])
  );
});

// Yulduzcha baholash tugmalari (1 dan 5 gacha)
bot.action(/rate_(\d)/, async (ctx) => {
  const rating = ctx.match[1];
  await ctx.answerCbQuery(`Siz ${rating} ball qo'ydingiz`);

  // Tugmali xabarni "baholandi" holatiga o'zgartiramiz
  try {
    await ctx.editMessageText(`⭐ Ta'lim sifatini baholadingiz: ${'⭐'.repeat(Number(rating))} (${rating}/5)`);
  } catch (err) {
    // xabarni tahrirlab bo'lmasa, e'tiborsiz qoldiramiz
  }

  await notifyAdmin(ctx, `⭐ Yangi BAHO: ${rating}/5`);

  await ctx.reply(
    '💬 Xohlasangiz, fikringizni matn yoki 🎙 ovozli xabar sifatida ham qoldirishingiz mumkin.\n' +
    'Yoki menyudan boshqa bo\'limni tanlashingiz mumkin.',
    mainMenu
  );
  setState(ctx.from.id, 'feedback');
});

// 👪 Farzandim
bot.hears('👪 Farzandim', async (ctx) => {
  const existing = childrenData.get(ctx.from.id);

  if (existing) {
    // Ma'lumot avval kiritilgan bo'lsa, qayta so'ramaymiz - eslatib qo'yamiz
    clearState(ctx.from.id);
    await ctx.reply(
      `👪 Sizning farzandingiz ma'lumoti:\n\n` +
      `👤 Ism: ${existing.childName}\n` +
      `📚 Guruh: ${existing.childClass}\n\n` +
      `Agar ma'lumotni yangilamoqchi bo'lsangiz, quyidagi tugmani bosing.`,
      Markup.inlineKeyboard([
        Markup.button.callback('✏️ Ma\'lumotni yangilash', 'update_child'),
      ])
    );
  } else {
    await askChildName(ctx);
  }
});

// "Ma'lumotni yangilash" inline tugmasi bosilganda
bot.action('update_child', async (ctx) => {
  await ctx.answerCbQuery();
  await askChildName(ctx);
});

// 📋 Murojaatlarim
bot.hears('📋 Murojaatlarim', async (ctx) => {
  const list = appealsData.get(ctx.from.id) || [];

  if (list.length === 0) {
    await ctx.reply('📋 Sizda hali murojaatlar mavjud emas.');
  } else {
    let text = `📋 <b>Sizning murojaatlaringiz:</b>\n\n`;
    list.forEach((item, i) => {
      const preview = item.type === 'voice' ? '🎙 Ovozli xabar' : item.text;
      text += `${i + 1}. 🕐 ${item.date}\n${preview}\n\n`;
    });
    await ctx.replyWithHTML(text);
  }

  setState(ctx.from.id, 'appeal');
  await ctx.reply(
    '📋 Yangi murojaat yuborish uchun matn yoki 🎙 ovozli xabar yozing.\n' +
    'Masalan: to\'lov, dars jadvali, davomat va boshqa savollar bo\'yicha.'
  );
});

// 📞 Bog'lanish
bot.hears('📞 Bog\'lanish', async (ctx) => {
  clearState(ctx.from.id);
  await ctx.replyWithHTML(
    `📞 <b>Biz bilan bog'lanish</b>\n\n` +
    `☎️ Telefon: +998 77 108 25 52 , +998 99 980 04 75\n` +
    `📍 Manzil: Toshkent sh.,bektemir tumani  ko'chasi\n` +
    `🕐 Ish vaqti: Dushanba–Shanba, 09:00–18:00\n\n` +
    `Shuningdek, shu botga bevosita matn yoki ovozli xabar yuborishingiz mumkin.`
  );
});

// ---------- Bosqichma-bosqich holatlarni qayta ishlash (matn) ----------
bot.on('text', async (ctx, next) => {
  const session = getSession(ctx.from.id);
  const text = ctx.message.text;

  // Agar bu asosiy menyu tugmalaridan biri bo'lsa, bu handlerga tegishli emas
  const menuButtons = ['💬 Fikr bildirish', '👪 Farzandim', '📋 Murojaatlarim', '📞 Bog\'lanish'];
  if (menuButtons.includes(text)) return next();

  switch (session.state) {
    case 'feedback': {
      await notifyAdmin(ctx, '💬 Yangi FIKR-MULOHAZA (matn):', text);
      await ctx.reply('✅ Fikringiz uchun rahmat! Xabaringiz ma\'muriyatga yetkazildi.', mainMenu);
      clearState(ctx.from.id);
      break;
    }
    case 'appeal': {
      addAppeal(ctx.from.id, 'text', text);
      await notifyAdmin(ctx, '📋 Yangi MUROJAAT (matn):', text);
      await ctx.reply('✅ Murojaatingiz qabul qilindi. Tez orada javob beramiz.', mainMenu);
      clearState(ctx.from.id);
      break;
    }
    case 'child_name': {
      setState(ctx.from.id, 'child_group', { childName: text });
      await ctx.reply('📚 Farzandingiz qaysi guruhda o\'qiydi?', groupOptions);
      break;
    }
    default: {
      // Holat yo'q bo'lsa, umumiy xabar sifatida qabul qilamiz
      await notifyAdmin(ctx, '✉️ Yangi xabar (erkin matn):', text);
      await ctx.reply('Xabaringiz qabul qilindi. Kerak bo\'lsa, menyudan tegishli bo\'limni tanlang.', mainMenu);
    }
  }
});

// Guruh tanlash tugmalari (IT, Ingliz tili, Rus tili, Arab tili)
bot.action(/group_(.+)/, async (ctx) => {
  const session = getSession(ctx.from.id);
  if (session.state !== 'child_group') {
    await ctx.answerCbQuery();
    return;
  }

  const childName = session.data.childName;
  const childClass = groupLabelFromCallback(ctx.match[0]);

  childrenData.set(ctx.from.id, { childName, childClass });

  await ctx.answerCbQuery(`Tanlandi: ${childClass}`);
  try {
    await ctx.editMessageText(`📚 Tanlangan guruh: ${childClass}`);
  } catch (err) {
    // xabarni tahrirlab bo'lmasa, e'tiborsiz qoldiramiz
  }

  await notifyAdmin(
    ctx,
    '👪 FARZAND ma\'lumoti kiritildi/yangilandi:',
    `Ism: ${childName}\nGuruh: ${childClass}`
  );

  await ctx.reply(
    `✅ Ma'lumot saqlandi:\n👤 ${childName}\n📚 ${childClass}\n\nRahmat! Endi menyudan kerakli bo'limni tanlashingiz mumkin.`,
    mainMenu
  );
  clearState(ctx.from.id);
});

// ---------- Ovozli xabar (golosovoy) qabul qilish ----------
bot.on('voice', async (ctx) => {
  const session = getSession(ctx.from.id);

  let label = '🎙 Yangi OVOZLI xabar:';
  if (session.state === 'feedback') label = '🎙 Yangi OVOZLI FIKR-MULOHAZA:';
  if (session.state === 'appeal') {
    label = '🎙 Yangi OVOZLI MUROJAAT:';
    addAppeal(ctx.from.id, 'voice', null);
  }

  await notifyAdmin(ctx, label);
  await forwardToAdmin(ctx); // ovoz faylining o'zini ham forward qilamiz

  await ctx.reply('✅ Ovozli xabaringiz qabul qilindi va ma\'muriyatga yuborildi. Rahmat!', mainMenu);
  clearState(ctx.from.id);
});

// ---------- Dumaloq video (video_note) qabul qilish ----------
bot.on('video_note', async (ctx) => {
  const session = getSession(ctx.from.id);

  let label = '⭕ Yangi DUMALOQ VIDEO xabar:';
  if (session.state === 'feedback') label = '⭕ Yangi DUMALOQ VIDEO FIKR-MULOHAZA:';
  if (session.state === 'appeal') {
    label = '⭕ Yangi DUMALOQ VIDEO MUROJAAT:';
    addAppeal(ctx.from.id, 'video_note', null);
  }

  await notifyAdmin(ctx, label);
  await forwardToAdmin(ctx); // video faylining o'zini ham forward qilamiz

  await ctx.reply('✅ Video xabaringiz qabul qilindi va ma\'muriyatga yuborildi. Rahmat!', mainMenu);
  clearState(ctx.from.id);
});

// ---------- Xatoliklarni umumiy tutish ----------
bot.catch((err, ctx) => {
  console.error(`Xatolik yuz berdi (${ctx.updateType}):`, err);
});

bot.launch();
console.log('✅ Bot ishga tushdi...');

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));