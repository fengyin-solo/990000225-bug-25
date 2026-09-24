<template>
  <div id="app">
    <Navbar />
    <main class="main-content">
      <router-view :key="$route.path" />
    </main>
  </div>
</template>

<script setup>
import Navbar from './components/Navbar.vue'
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
  background-color: #f5f7fa;
  color: #333;
  line-height: 1.6;
}

.main-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  min-height: calc(100vh - 60px);
}

a {
  color: #409eff;
  text-decoration: none;
}

a:hover {
  color: #66b1ff;
}
</style>
