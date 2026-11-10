import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';
import Components from 'unplugin-vue-components/vite';
import { VantResolver } from '@vant/auto-import-resolver';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const startUrl = env.VITE_APP_START_URL || '/charge/';
  const scope = env.VITE_APP_SCOPE || startUrl;

  return {
    base: './',
    build: {
      assetsInlineLimit(file) {
        const path = file.replace(/\\/g, '/');
        if (path.includes('/category-icons/') || path.includes('/profile-avatars/')) return false;
      }
    },
    plugins: [
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
          globIgnores: ['icons/splash-*'],
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
