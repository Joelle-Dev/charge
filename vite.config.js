import { defineConfig, loadEnv } from 'vite';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import vue from '@vitejs/plugin-vue';
import Components from 'unplugin-vue-components/vite';
import { VantResolver } from '@vant/auto-import-resolver';
import { VitePWA } from 'vite-plugin-pwa';

// iOS 只在启动时按 URL 取启动图，URL 不变就一直用旧的。
// 用启动图内容哈希做版本号，图片一换 URL 就变，无需重建主屏幕图标。
function splashVersion() {
  try {
    const dir = join(process.cwd(), 'public', 'icons');
    const files = readdirSync(dir).filter((name) => name.startsWith('splash-')).sort();
    if (!files.length) return '0';
    const hash = createHash('sha256');
    for (const name of files) hash.update(readFileSync(join(dir, name)));
    return hash.digest('hex').slice(0, 10);
  } catch (err) {
    return '0';
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const startUrl = env.VITE_APP_START_URL || '/charge/';
  const scope = env.VITE_APP_SCOPE || startUrl;
  const publicUrl = (env.VITE_APP_PUBLIC_URL || 'https://joelle-dev.github.io/charge/')
    .replace(/\/?$/, '/');
  const iconVersion = splashVersion();

  return {
    base: './',
    define: {
      __APP_BUILD_TIME__: JSON.stringify(new Date().toISOString())
    },
    build: {
      assetsInlineLimit(file) {
        const path = file.replace(/\\/g, '/');
        if (path.includes('/category-icons/') || path.includes('/profile-avatars/')) return false;
      }
    },
    plugins: [
      {
        name: 'app-public-url',
        transformIndexHtml(html) {
          return html
            .replaceAll('__APP_PUBLIC_URL__', publicUrl)
            .replaceAll('__APP_ICON_VERSION__', iconVersion);
        }
      },
      vue(),
      Components({
        resolvers: [VantResolver()],
        dts: false
      }),
      VitePWA({
        registerType: 'prompt',
        manifest: {
          name: '守财小果 · 语音记账',
          short_name: '守财小果',
          description: '守财小果，果冻陪你一句一句记小账。按阶段归类的轻量语音记账应用。',
          lang: 'zh-CN',
          theme_color: '#faf5ec',
          background_color: '#faf5ec',
          display: 'standalone',
          orientation: 'portrait',
          start_url: startUrl,
          scope,
          categories: ['finance', 'productivity', 'lifestyle'],
          shortcuts: [
            {
              name: '说给果冻听',
              short_name: '说一笔',
              description: '打开批量记，直接说给果冻听',
              url: `${startUrl}?action=voice`,
              icons: [{ src: './icons/icon-192.png', sizes: '192x192', type: 'image/png' }]
            },
            {
              name: '记一笔',
              short_name: '记一笔',
              description: '打开记账页，记下一笔小账',
              url: `${startUrl}?action=manual`,
              icons: [{ src: './icons/icon-192.png', sizes: '192x192', type: 'image/png' }]
            },
            {
              name: '花过的钱',
              short_name: '看账本',
              description: '翻翻花过的钱和明细',
              url: `${startUrl}#/records`,
              icons: [{ src: './icons/icon-192.png', sizes: '192x192', type: 'image/png' }]
            }
          ],
          icons: [
            {
              src: './icons/icon-192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any'
            },
            {
              src: './icons/icon-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any'
            },
            {
              src: './icons/icon-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable'
            }
          ]
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,png,jpg,jpeg,svg,ico,json,webmanifest}'],
          globIgnores: ['icons/splash-*', 'icons/og-image.png'],
          cleanupOutdatedCaches: true
        }
      })
    ],
    server: {
      port: 5173,
      open: false
    }
  };
});
