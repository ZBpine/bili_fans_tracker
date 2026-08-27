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

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
let lastVideoRequestAt = 0;

async function fetchVideos(uid, page) {
  const params = new URLSearchParams({
    mid: uid,
    keywords: '',
    orderby: 'pubdate',
    pn: String(page),
    ps: '10',
    web_location: '333.999'
  });
  const url = `https://api.bilibili.com/x/series/recArchivesByKeywords?${params}`;
  let lastError;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const timeSinceLastRequest = Date.now() - lastVideoRequestAt;
    if (timeSinceLastRequest < 900) await wait(900 - timeSinceLastRequest);
    lastVideoRequestAt = Date.now();

    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          Accept: 'application/json, text/plain, */*',
          'Accept-Language': 'zh-CN,zh;q=0.9',
          Referer: `https://space.bilibili.com/${uid}/video`
        }
      });
      const body = await res.text();
      let json;
      try {
        json = JSON.parse(body);
      } catch {
        throw new Error(`Video API returned non-JSON (HTTP ${res.status})`);
      }
      if (json.code !== 0) throw new Error(json.message || `Video API error (${json.code})`);
      return (json.data && json.data.archives) || [];
    } catch (err) {
      lastError = err;
      if (attempt < 3) await wait(attempt * 1000);
    }
  }

  throw lastError;
}

function toTrackedVideo(video, recordedAt) {
  return {
    aid: video.aid,
    bvid: video.bvid,
    ctime: video.ctime,
    pubdate: video.pubdate,
    duration: video.duration,
    pic: video.pic,
    title: video.title,
    recorded_at: recordedAt
  };
}

async function syncVideos(uid, fileData, now) {
  const videos = Array.isArray(fileData.videos) ? fileData.videos : [];
  const knownBvids = new Set(videos.map(video => video.bvid).filter(Boolean));
  const trackingStart = fileData.records[0]
    ? new Date(fileData.records[0].time).getTime()
    : new Date(now).getTime();
  const isInitialSync = videos.length === 0;
  let page = 1;
  let added = 0;

  while (true) {
    const archives = await fetchVideos(uid, page);
    if (archives.length === 0) break;

    const containsKnownVideo = archives.some(video => knownBvids.has(video.bvid));
    for (const archive of archives) {
      if (!archive.bvid || knownBvids.has(archive.bvid)) continue;
      videos.push(toTrackedVideo(archive, now));
      knownBvids.add(archive.bvid);
      added += 1;
    }

    // The first run only needs to reach the beginning of fan tracking. Keeping
    // the rest of this page is intentional, so no exact boundary split is needed.
    const reachesTrackingStart = archives.some(video => Number(video.pubdate) * 1000 < trackingStart);
    if ((!isInitialSync && containsKnownVideo) || (isInitialSync && reachesTrackingStart)) break;
    if (archives.length < 10) break;
    page += 1;
  }

  fileData.videos = videos.sort((a, b) => Number(b.pubdate) - Number(a.pubdate));
  return added;
}

async function main() {
  const now = new Date().toISOString();
  if (!fs.existsSync('docs/data')) fs.mkdirSync('docs/data', { recursive: true });

  for (const uid of config.uids) {
    const filePath = `docs/data/${uid}.json`;
    let fileData = { meta: null, records: [] };
    let changed = false;
    
    if (fs.existsSync(filePath)) {
      fileData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }

    // 1. 每 24 小时一起刷新用户资料与视频投稿
    const refreshProfileDue = !fileData.meta || new Date() - new Date(fileData.meta.updated) > 24 * 60 * 60 * 1000;
    if (refreshProfileDue) {
      console.log(`刷新 ${uid} 元数据...`);
      try {
        fileData.meta = await fetchCard(uid);
        changed = true;
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
        changed = true;
        console.log(`OK ${uid}: ${fans}`);
      }
    } catch (err) {
      console.error(`FAIL Fans ${uid}: ${err.message}`);
    }

    if (refreshProfileDue) {
      console.log(`同步 ${uid} 视频投稿...`);
      try {
        const added = await syncVideos(uid, fileData, now);
        changed = true;
        console.log(`OK Videos ${uid}: +${added}`);
      } catch (err) {
        console.error(`FAIL Videos ${uid}: ${err.message}`);
      }
    }

    if (changed) fs.writeFileSync(filePath, JSON.stringify(fileData, null, 2));
  }
}

main();
