const { Telegraf } = require('telegraf');
const axios = require('axios');
const Redis = require('ioredis');

const bot = new Telegraf(process.env.BOT_TOKEN);

// 🚀 Connect to New Vercel Redis Database
const redis = new Redis(process.env.STORAGE_REDIS_URL);

// 🛡️ ANTI-BAN ENGINE
const proAxios = axios.create({
    timeout: 7000, 
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/json'
    }
});

// 🧠 SMART URL FORMATTER
const formatUrl = (inputUrl) => {
    if (!inputUrl) return null;
    if (!inputUrl.startsWith('http://') && !inputUrl.startsWith('https://')) {
        return `https://${inputUrl}`;
    }
    return inputUrl;
};

// ==========================================
// 🤖 TELEGRAM COMMANDS
// ==========================================

bot.command('prouptime', async (ctx) => {
    const rawUrl = ctx.message.text.split(' ')[1];
    const url = formatUrl(rawUrl);

    if (!url) return ctx.reply('⚠️ Format: `/prouptime site.com`', { parse_mode: 'Markdown' });
    
    const start = Date.now();
    ctx.reply(`⚡ Stealth Scanning: ${url}...`);
    try {
        const res = await proAxios.get(url);
        ctx.reply(`✅ **AWAKE!**\n⏱️ Speed: ${Date.now() - start}ms\n📊 Status: ${res.status}\n🛡️ Protected Ping`, { parse_mode: 'Markdown' });
    } catch (error) {
        ctx.reply(`❌ **DOWN or SLEEPING!**\n⚠️ Error: ${error.message}`);
    }
});

bot.command('add', async (ctx) => {
    const args = ctx.message.text.split(' ');
    const rawUrl = args[1];
    const seconds = parseInt(args[2]);
    const url = formatUrl(rawUrl);

    if (!url || !seconds) {
        return ctx.reply('⚠️ Format: `/add site.com 60`', { parse_mode: 'Markdown' });
    }

    let targetsData = await redis.get('uptime_targets');
    let targets = targetsData ? JSON.parse(targetsData) : [];
    
    const existingIndex = targets.findIndex(t => t.url === url);
    if (existingIndex !== -1) {
        targets[existingIndex].interval = seconds; 
        await redis.set('uptime_targets', JSON.stringify(targets));
        return ctx.reply(`✅ Updated! ${url} -> ${seconds}s.`);
    }

    targets.push({ url, interval: seconds, lastPing: 0 });
    await redis.set('uptime_targets', JSON.stringify(targets));
    ctx.reply(`🔥 Max Power Engaged!\n✅ Added: ${url}\n⏱️ Interval: ${seconds}s.`);
});

bot.command('remove', async (ctx) => {
    const rawUrl = ctx.message.text.split(' ')[1];
    const url = formatUrl(rawUrl);

    if (!url) return ctx.reply('⚠️ Format: `/remove site.com`', { parse_mode: 'Markdown' });

    let targetsData = await redis.get('uptime_targets');
    let targets = targetsData ? JSON.parse(targetsData) : [];
    const filteredTargets = targets.filter(t => t.url !== url);

    if (targets.length === filteredTargets.length) {
        return ctx.reply(`❌ Yeh URL list mein nahi hai. Check using /list`);
    }

    await redis.set('uptime_targets', JSON.stringify(filteredTargets));
    ctx.reply(`🗑️ Removed: ${url}`);
});

bot.command('list', async (ctx) => {
    let targetsData = await redis.get('uptime_targets');
    let targets = targetsData ? JSON.parse(targetsData) : [];
    if (targets.length === 0) return ctx.reply('📂 List khali hai bro.');

    let msg = `📋 **Active Protected Targets:**\n\n`;
    targets.forEach((t, index) => {
        msg += `${index + 1}. ${t.url} (${t.interval}s)\n`;
    });
    ctx.reply(msg, { parse_mode: 'Markdown' });
});

// ==========================================
// 🛡️ THE "FULLY HARD" ANTI-BAN WAKE ENGINE
// ==========================================
module.exports = async (req, res) => {
    try {
        if (req.method === 'POST') {
            await bot.handleUpdate(req.body);
            return res.status(200).send('Webhook OK');
        }

        if (req.method === 'GET' && req.query.cron === 'wake') {
            let targetsData = await redis.get('uptime_targets');
            let targets = targetsData ? JSON.parse(targetsData) : [];
            const now = Math.floor(Date.now() / 1000); 
            let updated = false;
            
            const pingTasks = [];

            for (let t of targets) {
                if (now - t.lastPing >= t.interval) {
                    pingTasks.push(proAxios.get(t.url).catch(() => {})); 
                    t.lastPing = now;
                    updated = true;
                }
            }

            if (pingTasks.length > 0) {
                await Promise.allSettled(pingTasks);
            }

            if (updated) {
                await redis.set('uptime_targets', JSON.stringify(targets));
            }

            return res.status(200).send('Anti-Ban Cron Executed. Systems Awake.');
        }

        res.status(200).send('Professional Uptime Bot Live! 🚀');
    } catch (error) {
        console.error('System Error:', error);
        res.status(500).send('Error Details: ' + error.message);
    }
};
