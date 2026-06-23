const fs = require('fs');

const config = JSON.parse(fs.readFileSync('config.json', 'utf-8'));

async function fetchFans(uid) {
  const url = `https://api.bilibili.com/x/relation/stat?vmid=${uid}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
  });
  const json = await res.json();
  if (json.code !== 0) throw new Error(json.message || 'API error');
  return json.data.follower;
}

async function main() {
  const now = new Date().toISOString();
  if (!fs.existsSync('data')) fs.mkdirSync('data');

  let hasNewData = false;

  for (const up of config.up主) {
    try {
      const fans = await fetchFans(up.uid);
      const filePath = `data/${up.uid}.json`;
      let records = [];
      if (fs.existsSync(filePath)) {
        records = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      }
      const last = records[records.length - 1];
      if (last && last.time.slice(0, 13) === now.slice(0, 13)) {
        console.log(`SKIP ${up.name}: 本小时内已采集`);
        continue;
      }
      records.push({ time: now, fans });
      fs.writeFileSync(filePath, JSON.stringify(records, null, 2));
      hasNewData = true;
      console.log(`OK ${up.name}: ${fans}`);
    } catch (err) {
      console.error(`FAIL ${up.name}: ${err.message}`);
    }
  }

  if (!hasNewData) {
    console.log('无需更新');
  }
}

main();
