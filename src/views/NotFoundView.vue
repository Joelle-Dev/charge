<template>
  <section class="not-found-page">
    <div class="not-found-card">
      <span class="not-found-code">404</span>
      <h1>页面走丢了</h1>
      <p>这个地址不存在，可能是链接写错了。</p>
      <div class="not-found-actions">
        <button class="primary-btn" type="button" @click="go('/')">返回首页</button>
        <button class="secondary-btn" type="button" @click="go('/records')">支出明细</button>
        <button class="secondary-btn" type="button" @click="go('/settings')">设置</button>
      </div>
      <p class="not-found-path">{{ route.fullPath }}</p>
    </div>
  </section>
</template>

<script setup>
import { useRoute, useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();

function go(path) {
  router.replace(path);
}
</script>
