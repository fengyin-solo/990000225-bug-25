<template>
  <div class="article-list-admin">
    <div class="page-header">
      <h2 class="page-title">文章管理</h2>
      <el-button type="primary" @click="goToCreate">
        新建文章
      </el-button>
    </div>
    
    <el-alert
      v-if="fetchError"
      type="error"
      show-icon
      :closable="false"
      class="status-alert"
      :title="fetchError"
    />

    <el-card>
      <el-table :data="articles" v-loading="loading" style="width: 100%">
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="title" label="标题" min-width="200" />
        <el-table-column prop="tags" label="标签" width="250">
          <template #default="{ row }">
            <el-tag v-for="tag in row.tags" :key="tag" size="small" class="tag-cell">
              {{ tag }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="150">
          <template #default="{ row }">
            {{ formatDate(row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link @click="editArticle(row.id)">
              编辑
            </el-button>
            <el-button type="danger" link @click="deleteArticle(row)">
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      
      <Pagination
        v-model="currentPage"
        :total="pagination.total"
        :page-size="pagination.limit"
        @change="handlePageChange"
      />
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import api from '../../api'
import Pagination from '../../components/Pagination.vue'

const router = useRouter()

const articles = ref([])
const loading = ref(false)
const fetchError = ref('')
const currentPage = ref(1)
const pagination = ref({
  total: 0,
  page: 1,
  limit: 10,
  totalPages: 0
})
let fetchSequence = 0

onMounted(() => {
  fetchArticles()
  window.addEventListener('pageshow', handlePageShow)
})

onBeforeUnmount(() => {
  window.removeEventListener('pageshow', handlePageShow)
})

function handlePageShow(event) {
  if (event.persisted) {
    currentPage.value = 1
    fetchArticles()
  }
}

async function fetchArticles() {
  const sequence = ++fetchSequence
  loading.value = true
  fetchError.value = ''
  try {
    const response = await api.get('/articles', {
      params: { page: currentPage.value, limit: pagination.value.limit }
    })
    if (sequence === fetchSequence) {
      articles.value = response.data.articles
      pagination.value = response.data.pagination
    }
  } catch (error) {
    if (sequence === fetchSequence) {
      console.error('Failed to fetch articles:', error)
      fetchError.value = '获取文章列表失败，页面仍显示上一次成功获取的内容。可稍后重试。'
    }
  } finally {
    if (sequence === fetchSequence) {
      loading.value = false
    }
  }
}

function handlePageChange(page) {
  currentPage.value = page
  fetchArticles()
}

function goToCreate() {
  router.push('/admin/articles/new')
}

function editArticle(id) {
  router.push(`/admin/articles/${id}/edit`)
}

async function deleteArticle(article) {
  try {
    await ElMessageBox.confirm(
      `确定要删除文章「${article.title}」吗？`,
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    await api.delete(`/articles/${article.id}`)
    ElMessage.success('文章已删除')
    fetchArticles()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('Failed to delete article:', error)
      ElMessage.error('删除文章失败')
    }
  }
}

function formatDate(dateStr) {
  const date = new Date(dateStr)
  return date.toLocaleDateString('zh-CN')
}
</script>

<style scoped>
.article-list-admin {
  padding-top: 20px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.status-alert {
  margin-bottom: 16px;
}

.page-title {
  font-size: 24px;
  color: #303133;
  margin: 0;
}

.tag-cell {
  margin-right: 4px;
}
</style>
