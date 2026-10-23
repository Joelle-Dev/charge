import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';
import AutoImport from 'unplugin-auto-import/vite';
import Components from 'unplugin-vue-components/vite';
import { VantResolver } from '@vant/auto-import-resolver';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const startUrl = env.VITE_APP_START_URL || '/charge/';
  const scope = env.VITE_APP_SCOPE || startUrl;

  return {
    base: './',
    plugins: [
      vue(),
      AutoImport({
        resolvers: [VantResolver()],
        dts: false
      }),
      Components({
        resolvers: [VantResolver()],
        dts: false
      }),
      VitePWA({
        registerType: 'prompt',
        manifest: {
          name: '守财小果 · 语音记账',
          short_name: '守财小果',
          description: '守财小果，说一句就记上。按阶段归类的轻量语音记账应用。',
          lang: 'zh-CN',
          theme_color: '#faf5ec',
          background_color: '#faf5ec',
          display: 'standalone',
          orientation: 'portrait',
          start_url: startUrl,
          scope,
          categories: ['finance', 'productivity', 'lifestyle'],
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
