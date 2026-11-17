# 守财小果

说一句就记上的轻量语音记账 PWA。猫猫角色叫「果冻」，按账本整理支出，数据只保存在本机浏览器。

在线访问：https://joelle-dev.github.io/charge/

## 功能

- **账本**：书本式书架，新建 / 切换 / 合并 / 归档 / 删除，可设预算；长按卡片改名或改预算，卡片显示预算进度
- **记账**：按天分组的全展开时间轴、每日账单、按月查看、手动补记
- **批量记**：输入、粘贴或直接说一段话，一次解析多笔，逐笔校对后入账；支持连续语音
- **查明细**：关键词、金额范围、分类与多账本范围搜索，展示命中笔数与合计
- **看账**：按周 / 月 / 年查看支出折线图与分类排行
- **小票**：按月生成消费小票，含类别明细、足迹日历与本月之最
- **果冻**：猫粮罐预算、情绪与称号、成就徽章、可分享的账本小结图
- **其他**：分类管理（含图标）、个人资料（昵称与头像，可裁切）、完整备份 / 导入 / CSV 导出、深浅色主题
- **PWA**：添加到主屏幕、离线缓存、iOS 启动图

## 技术栈

Vue 3 + Vant 4 + Vue Router + Vite 5 + vite-plugin-pwa，数据使用 IndexedDB。

## 本地开发

```bash
npm install
npm run dev
npm test     # 单元测试
npm run stress   # 数据压测，可用 STRESS_TOTAL 等环境变量调整规模
```

## 构建与部署

```bash
npm run build:docs   # 输出 dist/ 并复制到 docs/
```

GitHub Pages 使用分支部署：Branch `main`，Folder `/docs`。也可改用 `.github/workflows/deploy.yml`（Actions 部署）。每次 push / PR 由 `.github/workflows/ci.yml` 跑测试与构建。

部署到别的地址或仓库名时，构建前设置环境变量：

```bash
VITE_APP_START_URL=/仓库名/ VITE_APP_SCOPE=/仓库名/ \
VITE_APP_PUBLIC_URL=https://你的地址/ npm run build:docs
```

**iOS 图标与启动图**：启动图由 `scripts/make_icons.sh` 从 `design/cat-avatar.png` 生成（iPhone + iPad 共 14 个尺寸），构建时按内容哈希加 `?v=`，换图后冷启动即生效。主屏幕图标受 iOS 限制无法原地更新，换图标需删掉旧图标重新添加，操作前先导出备份。

## 数据与隐私

账目、账本与分类只存在本机 IndexedDB，不会上传。语音识别由浏览器与系统提供，是否上传音频取决于浏览器实现。
