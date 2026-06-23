const fs = require('fs');

const config = JSON.parse(fs.readFileSync('config.json', 'utf-8'));

async function fetchCard(uid) {
  const url = `https://api.bilibili.com/x/web-interface/card?mid=${uid}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const json = await res.json();
  if (json.code !== 0) throw new Error(json.message || 'Card API error');
  const card = json.data.card;
  return {
    name: card.name,
    face: card.face,
    sign: card.sign,
    level: card.level_info.current_level,
    archive_count: json.data.archive_count,
    like_num: json.data.like_num,
    following: card.attention,
    official_title: card.Official ? card.Official.title : '',
    updated: new Date().toISOString()
  };
}

async function fetchFans(uid) {
  const url = `https://api.bilibili.com/x/relation/stat?vmid=${uid}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const json = await res.json();
  if (json.code !== 0) throw new Error(json.message || 'API error');
  return json.data.follower;
}

async function main() {
  const now = new Date().toISOString();
  if (!fs.existsSync('data')) fs.mkdirSync('data');

  for (const uid of config.uids) {
    const filePath = `data/${uid}.json`;
    let fileData = { meta: null, records: [] };
    
    if (fs.existsSync(filePath)) {
      fileData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }

    // 1. 按需刷新 Meta (24小时)
    if (!fileData.meta || new Date() - new Date(fileData.meta.updated) > 24 * 60 * 60 * 1000) {
      console.log(`刷新 ${uid} 元数据...`);
      try {
        fileData.meta = await fetchCard(uid);
      } catch (err) {
        console.error(`FAIL Meta ${uid}: ${err.message}`);
      }
    }

    // 2. 采集粉丝数
    try {
      const fans = await fetchFans(uid);
      const last = fileData.records[fileData.records.length - 1];
      if (last && last.time.slice(0, 13) === now.slice(0, 13)) {
        console.log(`SKIP ${uid}: 已采集`);
      } else {
        fileData.records.push({ time: now, fans });
        fs.writeFileSync(filePath, JSON.stringify(fileData, null, 2));
        console.log(`OK ${uid}: ${fans}`);
      }
    } catch (err) {
      console.error(`FAIL Fans ${uid}: ${err.message}`);
    }
  }
}

main();
