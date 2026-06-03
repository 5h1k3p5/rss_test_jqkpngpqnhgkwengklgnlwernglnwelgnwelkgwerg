const { XMLParser } = require('fast-xml-parser');
const fs = require('fs');

const RSS_URL = 'https://ria.ru/export/rss2/archive/index.xml';
const MAX_ITEMS = 50;
const YEARS_BACK = 2;

function extractImage(html) {
    if (!html) return null;
    const m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
    return m ? m[1] : null;
}

async function main() {
    console.log('Fetching RSS from:', RSS_URL);
    const res = await fetch(RSS_URL, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const xml = await res.text();
    console.log('RSS downloaded, length:', xml.length);

    // Профессиональный парсер XML
    const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '@_',
        textNodeName: '#text',
        isArray: (name) => ['item'].includes(name) // Гарантируем, что item всегда массив
    });

    const data = parser.parse(xml);
    const channel = data?.rss?.channel;
    
    if (!channel) {
        console.error('Invalid RSS structure');
        throw new Error('RSS does not contain a channel');
    }

    let items = channel.item || [];
    console.log('✅ Successfully parsed items:', items.length);

    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - YEARS_BACK);

    const news = items.map(i => {
        // Безопасное извлечение текста (иногда парсер отдаёт объект, иногда строку)
        let desc = typeof i.description === 'string' ? i.description : (i.description?.['#text'] || '');
        let link = typeof i.link === 'string' ? i.link : (i.link?.['#text'] || '');
        let title = typeof i.title === 'string' ? i.title : (i.title?.['#text'] || '');

        return {
            title: title,
            link: link,
            description: desc,
            pubDate: i.pubDate || '',
            image: (i.enclosure && i.enclosure['@_url']) || extractImage(desc)
        };
    }).filter(i => {
        if (!i.pubDate) return true;
        const d = new Date(i.pubDate);
        return !isNaN(d.getTime()) && d >= cutoff;
    }).slice(0, MAX_ITEMS);

    console.log('After filter (last ' + YEARS_BACK + ' years):', news.length);
    if (news.length === 0 && items.length > 0) {
        console.log('WARNING: All items were filtered out! Sample pubDate:', items[0].pubDate);
    }

    fs.writeFileSync('news.json', JSON.stringify(news, null, 2));
    console.log('✅ news.json created successfully with', news.length, 'items.');
}

main().catch(e => {
    console.error('❌ ERROR:', e);
    process.exit(1);
});
