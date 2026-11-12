<template>
  <SheetFrame v-model:show="show" title="果冻的使用说明">
    <p class="sheet-intro">从记一笔到打包账本，果冻把常用操作都写在这里啦。</p>

    <div class="help-list">
      <section v-for="(item, index) in sections" :key="item.title" class="help-item">
        <span class="help-index">{{ String(index + 1).padStart(2, '0') }}</span>
        <div class="help-copy">
          <h3>{{ item.title }}</h3>
          <p v-for="line in item.lines" :key="line">{{ line }}</p>
        </div>
      </section>
    </div>

    <p class="sheet-note">还有问题？可以先打包一份账本，把操作步骤和遇到的情况记下来，再告诉果冻。</p>
    <p class="sheet-note">分类图标来自 Lucide（ISC），头像图标来自 Twemoji（CC-BY 4.0）。</p>
  </SheetFrame>
</template>

<script setup>
import SheetFrame from './SheetFrame.vue';

const show = defineModel('show', { type: Boolean, default: false });

const sections = [
  {
    title: '记一笔',
    lines: [
      '点底部「记账」回到记账屏，再下拉顶部的「下拉记一笔」。',
      '首页、记账、批量记可以左右滑动切换。',
      '填好金额、分类、备注和日期，果冻就记下啦。'
    ]
  },
  {
    title: '一次记多笔',
    lines: [
      '在记账页点左上角的批量记，或向右滑一屏，把好几笔花销说成一段话或写成一段话。',
      '点「让果冻看看」后逐笔核对，再「都记上」。'
    ]
  },
  {
    title: '语音记多笔',
    lines: [
      '在批量记里点麦克风说给果冻听。需要 HTTPS、麦克风权限和网络。',
      '可以连着说好几笔，说完再点一下；识别结果可以自己改后再都记上。'
    ]
  },
  {
    title: '账本与备份',
    lines: [
      '账目只住在当前设备的浏览器里，不会上传。',
      '设置 → 账本与备份可以把全部账本打包；搬新家前先打包，再在新设备导入。'
    ]
  },
  {
    title: '主屏幕图标',
    lines: [
      'iOS 换图标后，要先删掉旧图标，再从 Safari 重新「添加到主屏幕」。',
      '删图标前记得先打包账本，别让果冻的数据走丢啦。'
    ]
  },
  {
    title: '常见问题',
    lines: [
      '语音没反应：看看网络和麦克风权限，或者换成 Chrome / Edge。',
      '语音听不准：先在「果冻听到的话」里改好，再点「看看记成什么样」。',
      '数据不见了：清除浏览器网站数据会把账本一起清掉，记得常常打包。'
    ]
  }
];
</script>
