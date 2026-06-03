const { XMLParser } = require('fast-xml-parser');
const fs = require('fs');

const RSS_URL = 'http://inibroker.com/rss-feed-263557395681.xml';
const MAX_ITEMS = 50;
const YEARS_BACK = 2;

function extractImage(html) {
    if (!html) return null;
    const m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
    return m ? m[1] : null;
}

async function main() {
    console.log(`Fetching RSS: ${RSS_URL}`);
    const res = await fetch(RSS_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();

    const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '@_',
        removeNSPrefix: true
    });
    const data = parser.parse(xml);

    const channel = data.rss?.channel;
    if (!channel) throw new Error('RSS не содержит channel');

    let items = channel.item || [];
    if (!Array.isArray(items)) items = [items];
    console.log(`Total items in RSS: ${items.length}`);

    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - YEARS_BACK);

    const news = items.map(i => ({
        title: i.title || '',
        link: i.link || '',
        description: i.description || '',
        pubDate: i.pubDate || '',
        image: i.enclosure?.['@_url'] || extractImage(i.description)
    })).filter(i => {
        if (!i.pubDate) return true;
        const d = new Date(i.pubDate);
        return !isNaN(d.getTime()) && d >= cutoff;
    }).slice(0, MAX_ITEMS);

    fs.writeFileSync('news.json', JSON.stringify(news, null, 2));
    console.log(`✅ Saved ${news.length} items (filtered from ${items.length})`);
}

main().catch(e => {
    console.error('❌', e);
    process.exit(1);
});
