# B站粉丝追踪

每小时监控 B站 UP主 粉丝数量，以图表形式展示趋势变化。

## 使用方法

### 1. 配置 UP主 列表

编辑 `config.json`：

```json
{
  "up主": [
    { "uid": "360697277", "name": "XDC城北徐公" },
    { "uid": "79577853", "name": "智能路障" },
    { "uid": "316568752", "name": "马督工" }
  ]
}
```

### 2. 启用 GitHub Pages

仓库 Settings → Pages → Source: **Deploy from a branch** → Branch: `main`, folder: `/docs`

### 3. 触发首次采集

仓库 Actions → B站粉丝追踪 → **Run workflow**

约 1 分钟后访问 `https://你的用户名.github.io/bili_fans_tracker/` 即可查看。

之后每小时自动更新。

## 技术栈

- GitHub Actions（定时采集）
- GitHub Pages（静态托管）
- Chart.js（图表展示）
- Bilibili 公开 API（无需 Key）
