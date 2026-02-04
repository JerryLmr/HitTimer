# HIIT 训练计时器（PWA）

一个无需构建工具的纯前端 HIIT 训练计时器，支持 iOS 安装到主屏幕、离线运行、动作编辑、回合控制与打卡统计。

## 功能
- 工作/休息/回合/回合休息计时
- 动作列表增删改、拖拽排序
- 模板保存/加载（本地）
- 打卡记录（本月/本年贡献图 + 记录列表 + 总时长）
- PWA 离线缓存（Service Worker）

## 本地运行
在项目目录启动一个本地服务器：
```powershell
python -m http.server 5173
```
浏览器打开：
```
http://localhost:5173
```

## 部署到 GitHub Pages
1. 推送到 GitHub 仓库。
2. 仓库设置 → **Pages** → 选择 `Deploy from a branch` → `main / root`。
3. 等待部署完成后，用生成的 `https://xxx.github.io/仓库名/` 访问。

## iOS 安装
1. Safari 打开 GitHub Pages 地址  
2. 分享 → **添加到主屏幕**

## 缓存更新说明
PWA 有缓存机制，更新代码后需要清缓存查看最新界面：
- DevTools → Application → Service Workers → Unregister  
- Application → Storage → Clear site data  
- 重新刷新

## 数据存储
所有设置与打卡记录保存在浏览器 `localStorage`，不会跨设备同步。

