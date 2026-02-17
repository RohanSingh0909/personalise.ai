/**
 * LinkedIn Agent — Full Automation Script
 * 
 * Flow:
 *   1. Opens VISIBLE Chromium (persistent profile)
 *   2. Scrapes trending topics from Google Trends (no login needed)
 *   3. Navigates to LinkedIn
 *   4. If logged in → auto-posts content based on trends
 *   5. If NOT logged in → waits for user to log in, then posts
 * 
 * Actions:
 *   run_agent       — Full flow: Google scrape → LinkedIn post
 *   scrape_only     — Just scrape Google Trends, return data
 *   post_only       — Just post provided content to LinkedIn
 * 
 * Input  (stdin JSON):
 *   { "action": "run_agent|scrape_only|post_only", "userDataDir": "...", "content"?: "..." }
 * 
 * Output (stdout JSON):
 *   { "success": true, "data": ... } | { "success": false, "error": "..." }
 */

const puppeteer = require('puppeteer');
const fs = require('fs');

// ── Stdin / Stdout helpers ─────────────────────────────────────────────

async function readStdin() {
    return new Promise((resolve, reject) => {
        let data = '';
        process.stdin.setEncoding('utf8');
        process.stdin.on('data', chunk => { data += chunk; });
        process.stdin.on('end', () => {
            try { resolve(JSON.parse(data)); }
            catch (e) { reject(new Error('Invalid JSON input: ' + e.message)); }
        });
        process.stdin.on('error', reject);
    });
}

function output(result) {
    process.stdout.write(JSON.stringify(result) + '\n');
}

function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

// ── Step 1: Scrape trends from Google ──────────────────────────────────

async function scrapeGoogleTrends(page) {
    console.error('[DEBUG] Navigating to Google Trends...');
    try {
        await page.goto('https://trends.google.com/trending?geo=IN&hours=24', {
            waitUntil: 'domcontentloaded',
            timeout: 30000
        });
    } catch (e) {
        console.error(`[DEBUG] Google Trends navigation warning: ${e.message}. Attempting to proceed anyway.`);
    }

    await sleep(4000);

    let trends = await page.evaluate(() => {
        const items = [];

        // Google Trends "Trending Now" cards / rows
        const trendRows = document.querySelectorAll('[class*="feed-item"], [class*="trending"], tr, [role="row"]');
        trendRows.forEach(row => {
            const titleEl = row.querySelector('a, [class*="title"], .mZ3RIc, span');
            const title = titleEl?.innerText?.trim();
            if (title && title.length > 3 && title.length < 200 && !items.find(i => i.title === title)) {
                items.push({
                    title,
                    source: 'Google Trends',
                    type: 'trending'
                });
            }
        });

        return items.slice(0, 20);
    });

    // If Google Trends didn't yield results, try Google News
    console.error('[DEBUG] Google Trends empty, trying Google News...');
    try {
        await page.goto('https://news.google.com/topstories?hl=en-IN&gl=IN&ceid=IN:en', {
            waitUntil: 'domcontentloaded',
            timeout: 30000
        });
    } catch (e) {
        console.error(`[DEBUG] Google News navigation warning: ${e.message}`);
    }

    await sleep(3000);

    const newsItems = await page.evaluate(() => {
        const items = [];
        const articles = document.querySelectorAll('article, c-wiz article, [class*="IBr9hb"], [class*="IFHyqb"]');
        articles.forEach(article => {
            const titleEl = article.querySelector('a[class*="gPFEn"], h3, h4, a');
            const sourceEl = article.querySelector('[class*="vr1PYe"], [data-n-tid], .wEwyrc');
            const title = titleEl?.innerText?.trim();
            const source = sourceEl?.innerText?.trim() || 'Google News';
            if (title && title.length > 5 && title.length < 250 && !items.find(i => i.title === title)) {
                items.push({ title, source, type: 'news' });
            }
        });
        return items.slice(0, 15);
    });

    trends = [...trends, ...newsItems];

    // Final fallback: Google search for "trending topics today"
    if (trends.length < 3) {
        console.error('[DEBUG] Trends still low, trying Google search fallback...');
        try {
            await page.goto('https://www.google.com/search?q=trending+topics+today+linkedin', {
                waitUntil: 'domcontentloaded',
                timeout: 20000
            });
        } catch (e) {
            console.error(`[DEBUG] Google Search navigation warning: ${e.message}`);
        }

        await sleep(2000);

        const searchItems = await page.evaluate(() => {
            const items = [];
            const headings = document.querySelectorAll('h3');
            headings.forEach(h => {
                const title = h.innerText?.trim();
                if (title && title.length > 10 && title.length < 200) {
                    items.push({ title, source: 'Google Search', type: 'search' });
                }
            });
            return items.slice(0, 10);
        });

        trends = [...trends, ...searchItems];
    }

    return trends;
}

// ── Step 2: Check LinkedIn login & wait if needed ──────────────────────

async function ensureLinkedInLogin(page) {
    console.error('[DEBUG] Checking LinkedIn login status...');
    try {
        await page.goto('https://www.linkedin.com/feed/', {
            waitUntil: 'domcontentloaded',
            timeout: 30000
        });
    } catch (e) {
        const url = page.url();
        if (url.includes('linkedin.com/feed')) {
            console.error('[DEBUG] LinkedIn feed navigation timeout, but we are on the feed. Continuing...');
        } else {
            console.error(`[DEBUG] LinkedIn navigation error: ${e.message}`);
            // If it's a timeout but we are on some LinkedIn page, don't crash yet
            if (!url.includes('linkedin.com')) throw e;
        }
    }

    await sleep(3000);

    let url = page.url();
    let isLoggedIn = url.includes('/feed') && !url.includes('/login') && !url.includes('/authwall');

    if (isLoggedIn) {
        return true;
    }

    // Not logged in — navigate to login page and wait
    if (!url.includes('/login')) {
        console.error('[DEBUG] Not logged in, redirecting to login page...');
        try {
            await page.goto('https://www.linkedin.com/login', {
                waitUntil: 'domcontentloaded',
                timeout: 30000
            });
        } catch (e) { }
    }

    console.error('[DEBUG] Waiting for user to log in (check Chromium window)...');

    // Wait for user to log in (poll every 3 seconds, timeout after 5 minutes)
    const maxWait = 5 * 60 * 1000; // 5 minutes
    const startTime = Date.now();

    while (Date.now() - startTime < maxWait) {
        await sleep(3000);
        url = page.url();
        if (url.includes('/feed') && !url.includes('/login') && !url.includes('/authwall')) {
            return true; // User logged in!
        }
    }

    return false; // Timed out
}

// ── Step 3: Post content to LinkedIn ───────────────────────────────────

async function postToLinkedIn(page, content) {
    // Make sure we're on the feed
    const url = page.url();
    if (!url.includes('/feed')) {
        console.error('[DEBUG] Navigating to feed for posting...');
        try {
            await page.goto('https://www.linkedin.com/feed/', {
                waitUntil: 'domcontentloaded',
                timeout: 30000
            });
        } catch (e) {
            if (!page.url().includes('linkedin.com/feed')) throw e;
        }
        await sleep(3000);
    }

    // Click "Start a post" button
    const startPostSelectors = [
        '.share-box-feed-entry__trigger', // Standard feed trigger
        'button.artdeco-button--muted.share-box-feed-entry__trigger',
        '.share-box-feed-entry__closed-share-box button',
        'button[class*="share-box"]',
        '#ember31', // Common ID but can change
        'div.share-box-feed-entry__trigger',
        '[aria-label="Start a post"]',
        '[data-control-name="share.post"]',
    ];

    let clicked = false;
    for (const selector of startPostSelectors) {
        try {
            const el = await page.waitForSelector(selector, { timeout: 3000 });
            if (el) {
                console.error(`[DEBUG] Clicking start post button: ${selector}`);
                await el.click();
                clicked = true;
                break;
            }
        } catch { continue; }
    }

    if (!clicked) {
        console.error('[DEBUG] Falling back to text-based search for "Start a post" button');
        // Fallback: click any button with "Start a post" text, excluding search
        await page.evaluate(() => {
            const buttons = [...document.querySelectorAll('button, div[role="button"], span')];
            const btn = buttons.find(b => {
                const text = b.innerText?.toLowerCase() || '';
                const aria = b.getAttribute('aria-label')?.toLowerCase() || '';
                const title = b.getAttribute('title')?.toLowerCase() || '';
                return (text.includes('start a post') || aria.includes('start a post') || title.includes('start a post')) &&
                    !b.closest('.search-global-typeahead') &&
                    !b.closest('#global-nav-search');
            });
            if (btn) {
                btn.click();
            }
        });
        // Check if it worked
        await sleep(2000);
        const hasDialog = await page.evaluate(() => !!document.querySelector('.share-box-feed-entry__container, [role="dialog"]'));
        if (hasDialog) clicked = true;
    }

    // Wait for the share box to appear
    try {
        await page.waitForSelector('.share-box-feed-entry__container, [role="dialog"]', { timeout: 5000 });
    } catch {
        // Even if the container wasn't found, we'll try to find the editor
    }

    await sleep(2000);

    // Type in the editor — prioritizing the Quill editor specifically used for posting
    const editorSelectors = [
        '.ql-editor[contenteditable="true"]',
        '.share-box-feed-entry__container .ql-editor',
        '[role="dialog"] .ql-editor',
        '.ql-editor',
        // Very fallback: only if inside a dialog/sharebox
        '[role="dialog"] [role="textbox"][contenteditable="true"]',
        '.share-box-feed-entry__container [role="textbox"]'
    ];

    let typed = false;
    for (const selector of editorSelectors) {
        try {
            const el = await page.waitForSelector(selector, { timeout: 5000 });
            if (el) {
                // Check if it's the search bar (safety)
                const isSearch = await page.evaluate((sel) => {
                    const e = document.querySelector(sel);
                    return !!e?.closest('.search-global-typeahead') || !!e?.closest('#global-nav-search');
                }, selector);

                if (isSearch) continue;

                await el.click();
                await sleep(500);

                // Clear if needed (optional)
                // await page.keyboard.down('Control'); await page.keyboard.press('A'); await page.keyboard.up('Control'); await page.keyboard.press('Backspace');

                await page.type(selector, content, { delay: 20 });
                typed = true;
                break;
            }
        } catch { continue; }
    }

    if (!typed) {
        throw new Error('Could not find LinkedIn post editor. The UI may have changed or the "Start a post" box did not open.');
    }

    await sleep(2000);

    // Click "Post" button
    const postBtnSelectors = [
        'button.share-actions__primary-action',
        'button.artdeco-button--primary.share-box_actions__post-button',
        'button[data-control-name="share.post"]',
        '.share-box_actions button.artdeco-button--primary',
    ];

    let posted = false;
    for (const selector of postBtnSelectors) {
        try {
            const el = await page.waitForSelector(selector, { timeout: 3000 });
            if (el && !(await el.evaluate(b => b.disabled))) {
                await el.click();
                posted = true;
                break;
            }
        } catch { continue; }
    }

    if (!posted) {
        // Fallback: find primary button with "Post" text inside the dialog
        const result = await page.evaluate(() => {
            const dialog = document.querySelector('.share-box-feed-entry__container, [role="dialog"]');
            if (!dialog) return false;

            const buttons = [...dialog.querySelectorAll('button')];
            const postBtn = buttons.find(b => {
                const text = b.innerText?.trim().toLowerCase();
                return (text === 'post' || text === 'publish') && !b.disabled;
            });

            if (postBtn) {
                postBtn.click();
                return true;
            }
            return false;
        });
        posted = result;
    }

    if (!posted) {
        throw new Error('Typed the post but could not click the "Post" button. You may need to click it manually.');
    }

    await sleep(4000);
    return { message: 'Post submitted successfully!' };
}

// ── Build post content from trends ─────────────────────────────────────

function buildPostFromTrends(trends) {
    if (trends.length === 0) {
        return "🔍 Staying informed and keeping up with the latest industry trends!\n\nWhat topics are you following today?\n\n#Trends #StayInformed #LinkedIn";
    }

    const topTrends = trends.slice(0, 5);
    const trendLines = topTrends.map((t, i) => `${i + 1}. ${t.title}`).join('\n');

    const intros = [
        "🔥 Here's what's trending today:",
        "📊 Top trending topics right now:",
        "🚀 Today's hottest trends you should know about:",
        "💡 What everyone's talking about today:",
    ];
    const intro = intros[Math.floor(Math.random() * intros.length)];

    const outros = [
        "\n\nWhich of these trends interests you the most? Drop a comment! 👇",
        "\n\nStay ahead of the curve — what are your thoughts? 💬",
        "\n\nWhat's your take on these developments? Let's discuss! 🤔",
    ];
    const outro = outros[Math.floor(Math.random() * outros.length)];

    return `${intro}\n\n${trendLines}${outro}\n\n#TrendingNow #DailyTrends #StayInformed #LinkedIn`;
}

// ── Main ───────────────────────────────────────────────────────────────

(async () => {
    let browser;
    try {
        const input = await readStdin();
        const { action, userDataDir, content } = input;

        if (!userDataDir) {
            output({ success: false, error: 'Missing userDataDir parameter.' });
            process.exit(1);
        }

        // Ensure profile directory exists
        if (!fs.existsSync(userDataDir)) {
            fs.mkdirSync(userDataDir, { recursive: true });
        }

        // Launch VISIBLE browser with persistent profile
        browser = await puppeteer.launch({
            headless: false,
            userDataDir: userDataDir,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-blink-features=AutomationControlled',
                '--disable-infobars',
                '--start-maximized',
            ],
            defaultViewport: null,
        });

        const pages = await browser.pages();
        const page = pages[0] || await browser.newPage();

        // Anti-detection
        await page.setUserAgent(
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        );
        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => false });
        });

        if (action === 'run_agent') {
            // ═══════════════════════════════════════════════════════
            // FULL FLOW: Google Scrape → LinkedIn Post
            // ═══════════════════════════════════════════════════════

            // Step 1: Scrape Google Trends
            const trends = await scrapeGoogleTrends(page);

            // Step 2: Build post content from trends
            const postContent = content || buildPostFromTrends(trends);

            // Step 3: Go to LinkedIn (wait for login if needed)
            const loggedIn = await ensureLinkedInLogin(page);

            if (!loggedIn) {
                output({
                    success: false,
                    error: 'LinkedIn login timed out after 5 minutes. Please try again.',
                    data: { trends, postContent }
                });
            } else {
                // Step 4: Post to LinkedIn
                await sleep(2000);
                const result = await postToLinkedIn(page, postContent);

                output({
                    success: true,
                    data: {
                        trends,
                        postContent,
                        postResult: result.message,
                        message: `Scraped ${trends.length} trends and posted to LinkedIn!`
                    }
                });
            }

        } else if (action === 'scrape_only') {
            // ═══════════════════════════════════════════════════════
            // SCRAPE ONLY: Just get trends from Google
            // ═══════════════════════════════════════════════════════
            const trends = await scrapeGoogleTrends(page);
            output({ success: true, data: trends });

        } else if (action === 'post_only') {
            // ═══════════════════════════════════════════════════════
            // POST ONLY: Post provided content to LinkedIn
            // ═══════════════════════════════════════════════════════
            if (!content) {
                output({ success: false, error: 'Missing "content" for post_only action.' });
            } else {
                const loggedIn = await ensureLinkedInLogin(page);
                if (!loggedIn) {
                    output({ success: false, error: 'LinkedIn login timed out.' });
                } else {
                    await sleep(2000);
                    const result = await postToLinkedIn(page, content);
                    output({ success: true, data: result });
                }
            }

        } else {
            output({ success: false, error: `Unknown action: "${action}"` });
        }

        // Give a moment for everything to settle, then close
        await sleep(2000);
        await browser.close();

    } catch (err) {
        output({ success: false, error: err.message || String(err) });
        if (browser) {
            try { await browser.close(); } catch { }
        }
    }
    process.exit(0);
})();
