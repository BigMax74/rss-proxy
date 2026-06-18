const https = require('https');
const fs = require('fs');
const path = require('path');

const FEEDS = [
  {
    url: 'https://feeds.acast.com/public/shows/isles-aux-enfants',
    output: 'public/isles-aux-enfants.json',
  },
  {
    url: 'https://feeds.acast.com/public/shows/metzstories',
    output: 'public/metzstories.json',
  },
];

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
      }
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchUrl(res.headers.location).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function getTagText(item, tag) {
  const regex = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([^<]*)<\\/${tag}>`, 'i');
  const match = item.match(regex);
  return match ? (match[1] || match[2] || '').trim() : '';
}

function getAttr(item, tag, attr) {
  const regex = new RegExp(`<${tag}[^>]*${attr}="([^"]*)"`, 'i');
  const match = item.match(regex);
  return match ? match[1].trim() : '';
}

function stripHtml(html) {
  return html.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim().slice(0, 200);
}

function parseXML(xml) {
  const channelImg =
    (xml.match(/<itunes:image[^>]*href="([^"]+)"/) || [])[1] ||
    (xml.match(/<image>[\s\S]*?<url>([^<]+)<\/url>/) || [])[1] ||
    '';

  const channelTitle = getTagText(xml, 'title');

  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  const items = [];
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const item = match[1];

    const image =
      (item.match(/<itunes:image[^>]*href="([^"]+)"/) || [])[1] ||
      channelImg ||
      '';

    items.push({
      title: getTagText(item, 'title'),
      description: stripHtml(getTagText(item, 'description') || getTagText(item, 'itunes:summary') || ''),
      pubDate: getTagText(item, 'pubDate'),
      link: getTagText(item, 'link'),
      duration: getTagText(item, 'itunes:duration'),
      image,
      audio: getAttr(item, 'enclosure', 'url'),
    });
  }

  return { channelTitle, channelImage: channelImg, items };
}

async function main() {
  for (const feed of FEEDS) {
    try {
      console.log(`Fetching ${feed.url}...`);
      const xml = await fetchUrl(feed.url);
      const data = parseXML(xml);
      const outPath = path.resolve(feed.output);
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(outPath, JSON.stringify(data, null, 2));
      console.log(`✓ ${feed.output} — ${data.items.length} épisodes`);
    } catch (err) {
      console.error(`✗ Erreur pour ${feed.url}:`, err.message);
      process.exit(1);
    }
  }
}

main();
