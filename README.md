# 守财小果

一个说一句就记上的轻量语音记账 PWA。按阶段整理支出，数据只保存在本机浏览器，不需要安装原生 App。

在线访问：https://joelle-dev.github.io/charge/

## 功能

- 阶段管理：新建、切换、编辑、归档、删除，可选设置预算
- 语音记账：浏览器语音识别 + 中文金额/分类/备注/日期解析
- 连续语音：自动续听，停顿自动分隔多笔；无标点也能按金额拆分成多条
- 解析卡片确认：识别结果可修改后批量入账
- 手动补记：金额、分类、备注、日期、时间
- 分类统计：分类占比、预算剩余/超支
- 长列表体验：按天折叠、分类筛选、展开/收起全部、回到顶部
- 本地存储：IndexedDB，支持离线使用
- CSV 导出
- PWA：添加到主屏幕、图标、iOS 启动图、离线缓存

## 技术栈

Vue 3 + Vant 4 + Vue Router + Vite 5 + vite-plugin-pwa，数据存储使用 IndexedDB。

## 本地开发

```bash
npm install
npm run dev
```

测试：

```bash
npm test
```

## 构建与部署

```bash
npm run build:docs
```

构建结果会输出到 `dist/` 并复制到 `docs/`。

GitHub Pages 推荐配置：

- Source：Deploy from a branch
- Branch：`main`
- Folder：`/docs`

也可以使用 `.github/workflows/deploy.yml` 通过 GitHub Actions 部署，将 Pages Source 改为 GitHub Actions，并按需启用 push 触发。

默认 `start_url` / `scope` 为 `/charge/`。如果仓库名不是 `charge`，构建时传入：

```bash
VITE_APP_START_URL=/你的仓库名/ VITE_APP_SCOPE=/你的仓库名/ npm run build:docs
```

## 语音识别环境

语音识别需要 HTTPS 或 localhost。手机真机使用时请通过 GitHub Pages 等 HTTPS 地址访问。

## 数据与隐私

所有账目、阶段和分类都保存在当前设备的浏览器 IndexedDB 中，不会上传到服务器。语音识别由浏览器和系统服务提供，是否上传音频取决于浏览器实现。
