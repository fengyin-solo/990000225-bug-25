<template>
  <div class="article-editor">
    <div class="page-header">
      <h2 class="page-title">{{ pageTitle }}</h2>
      <el-space>
        <el-button @click="goBack">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSave">
          保存
        </el-button>
      </el-space>
    </div>

    <el-alert
      v-if="loadError"
      type="error"
      show-icon
      :closable="false"
      class="status-alert"
    >
      <template #title>
        {{ loadError }}
        <el-button type="primary" link :loading="loading" @click="initializeEditor">
          重试
        </el-button>
      </template>
    </el-alert>

    <el-alert
      v-if="saveError"
      type="error"
      show-icon
      :closable="false"
      class="status-alert"
      :title="saveError"
    />

    <el-alert
      v-if="localDraft"
      type="warning"
      show-icon
      :closable="false"
      class="status-alert"
    >
      <template #title>
        {{ draftAlertTitle }}
      </template>
      <div class="draft-actions">
        <span>最后一次有效草稿保存于 {{ formatDraftTime(localDraft.savedAt) }}</span>
        <el-space>
          <el-button
            v-if="!isCurrentDraftSameAsStored"
            size="small"
            @click="restoreLastDraft"
          >
            恢复最后一次有效草稿
          </el-button>
          <el-button size="small" @click="discardDraft">
            {{ isEdit ? '放弃草稿并使用线上版本' : '放弃草稿' }}
          </el-button>
        </el-space>
      </div>
    </el-alert>

    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-width="80px"
      v-loading="loading"
    >
      <el-form-item label="标题" prop="title">
        <el-input v-model="form.title" placeholder="请输入文章标题" size="large" />
      </el-form-item>

      <el-form-item label="摘要" prop="summary">
        <el-input
          v-model="form.summary"
          type="textarea"
          :rows="3"
          placeholder="请输入文章摘要"
        />
      </el-form-item>

      <el-form-item label="标签" prop="tags">
        <el-input
          v-model="form.tagsInput"
          placeholder="请输入标签，用逗号分隔"
        />
      </el-form-item>

      <el-form-item label="正文" prop="body">
        <el-tabs v-model="activeTab">
          <el-tab-pane label="编辑" name="edit">
            <el-input
              v-model="form.body"
              type="textarea"
              :rows="20"
              placeholder="请输入 Markdown 格式的文章正文"
              class="markdown-editor"
            />
          </el-tab-pane>
          <el-tab-pane label="预览" name="preview">
            <div class="preview-content" v-html="renderedContent"></div>
          </el-tab-pane>
        </el-tabs>
      </el-form-item>
    </el-form>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import api from '../../api'
import { renderMarkdown } from '../../utils/markdown'
import {
  clearDraft,
  isValidDraft,
  loadDraft,
  parseTags,
  saveDraft,
  tagsToInput
} from '../../utils/articleDraft'

const route = useRoute()
const router = useRouter()

const formRef = ref(null)
const loading = ref(false)
const saving = ref(false)
const activeTab = ref('edit')
const baseline = ref(null)
const localDraft = ref(null)
const loadError = ref('')
const saveError = ref('')
const initialized = ref(false)

let initSequence = 0
let draftTimer = null
let savedSuccessfully = false

const isEdit = computed(() => Boolean(route.params.id))
const articleId = computed(() => route.params.id || 'new')
const pageTitle = computed(() => isEdit.value ? '编辑文章' : '新建文章')

function createEmptyForm() {
  return {
    title: '',
    body: '',
    summary: '',
    tagsInput: ''
  }
}

const form = reactive(createEmptyForm())

const rules = {
  title: [
    { required: true, message: '请输入文章标题', trigger: 'blur' }
  ],
  body: [
    { required: true, message: '请输入文章正文', trigger: 'blur' }
  ]
}

const renderedContent = computed(() => {
  return renderMarkdown(form.body) || '<p>暂无内容</p>'
})

const draftIsStale = computed(() => {
  return Boolean(
    isEdit.value &&
      localDraft.value?.baseUpdatedAt &&
      baseline.value?.updated_at &&
      localDraft.value.baseUpdatedAt !== baseline.value.updated_at
  )
})

const draftAlertTitle = computed(() => {
  if (saveError.value) {
    return '保存失败，当前内容已作为本地草稿保留'
  }
  if (draftIsStale.value) {
    return '线上内容已更新，当前保留的是本地草稿'
  }
  return '已恢复本地草稿，内容尚未成功保存到线上'
})

const isCurrentDraftSameAsStored = computed(() => {
  if (!localDraft.value) return true
  return isSameFormData(form, localDraft.value)
})

watch(() => route.path, initializeEditor, { immediate: true })

watch(form, () => {
  if (!initialized.value) return
  saveError.value = ''
  clearTimeout(draftTimer)
  draftTimer = setTimeout(persistCurrentDraft, 300)
}, { deep: true })

onBeforeUnmount(() => {
  clearTimeout(draftTimer)
  if (!savedSuccessfully) {
    persistCurrentDraft()
  }
})

async function initializeEditor() {
  const sequence = ++initSequence
  initialized.value = false
  savedSuccessfully = false
  loading.value = true
  loadError.value = ''
  saveError.value = ''
  baseline.value = null
  localDraft.value = null
  Object.assign(form, createEmptyForm())

  const storedDraft = loadDraft(articleId.value)

  if (!isEdit.value) {
    localDraft.value = storedDraft
    if (storedDraft) applyFormData(storedDraft)
    initialized.value = true
    loading.value = false
    return
  }

  if (storedDraft) applyFormData(storedDraft)

  try {
    const response = await api.get(`/articles/${articleId.value}`)
    if (sequence !== initSequence) return

    const article = response.data
    baseline.value = article

    if (storedDraft && isSameFormData(storedDraft, article)) {
      clearDraft(articleId.value)
      localDraft.value = null
      applyFormData(articleToFormData(article))
    } else if (storedDraft) {
      localDraft.value = storedDraft
      applyFormData(storedDraft)
    } else {
      applyFormData(articleToFormData(article))
    }
  } catch (error) {
    if (sequence !== initSequence) return

    console.error('Failed to fetch article:', error)
    loadError.value = '获取线上文章失败，可重试，也可以继续编辑本地草稿。'
    localDraft.value = storedDraft
    if (storedDraft) applyFormData(storedDraft)
  } finally {
    if (sequence === initSequence) {
      loading.value = false
      initialized.value = true
    }
  }
}

function persistCurrentDraft() {
  if (!initialized.value) return null

  if (isEdit.value && baseline.value && isSameFormData(form, baseline.value)) {
    clearDraft(articleId.value)
    localDraft.value = null
    return null
  }

  if (!isValidDraft(form)) {
    return localDraft.value
  }

  const stored = saveDraft(articleId.value, {
    ...form,
    baseUpdatedAt: baseline.value?.updated_at || localDraft.value?.baseUpdatedAt || null
  })
  localDraft.value = stored
  return stored
}

function buildArticleData() {
  return {
    title: form.title.trim(),
    body: form.body,
    summary: form.summary,
    tags: parseTags(form.tagsInput)
  }
}

async function handleSave() {
  if (saving.value) return

  try {
    await formRef.value?.validate()
  } catch {
    return
  }

  saving.value = true
  saveError.value = ''

  try {
    const articleData = buildArticleData()
    const response = isEdit.value
      ? await api.put(`/articles/${articleId.value}`, articleData)
      : await api.post('/articles', articleData)

    clearDraft(articleId.value)
    localDraft.value = null
    baseline.value = response.data
    savedSuccessfully = true
    ElMessage.success(isEdit.value ? '文章已更新' : '文章已创建')
    router.push('/admin/articles')
  } catch (error) {
    console.error('Failed to save article:', error)
    saveError.value = error.response?.data?.error || '保存文章失败，已保留当前有效草稿，可修改后重试。'
    localDraft.value = persistCurrentDraft()
    ElMessage.error('保存文章失败')
  } finally {
    saving.value = false
  }
}

async function discardDraft() {
  try {
    await ElMessageBox.confirm(
      '放弃本地草稿后，将无法恢复未保存内容。确定继续吗？',
      '放弃草稿',
      {
        confirmButtonText: '放弃',
        cancelButtonText: '继续编辑',
        type: 'warning'
      }
    )
  } catch {
    return
  }

  clearDraft(articleId.value)
  localDraft.value = null

  if (isEdit.value && baseline.value) {
    applyFormData(articleToFormData(baseline.value))
  } else {
    Object.assign(form, createEmptyForm())
  }
}

function restoreLastDraft() {
  if (!localDraft.value) return
  applyFormData(localDraft.value)
}

function applyFormData(data) {
  form.title = data.title || ''
  form.body = data.body || ''
  form.summary = data.summary || ''
  form.tagsInput = data.tagsInput ?? tagsToInput(data.tags)
}

function articleToFormData(article) {
  return {
    title: article.title,
    body: article.body,
    summary: article.summary || '',
    tagsInput: tagsToInput(article.tags)
  }
}

function isSameFormData(left, right) {
  return (
    (left.title || '') === (right.title || '') &&
    (left.body || '') === (right.body || '') &&
    (left.summary || '') === (right.summary || '') &&
    JSON.stringify(parseTags(left.tagsInput)) === JSON.stringify(parseTags(right.tagsInput || tagsToInput(right.tags)))
  )
}

function formatDraftTime(value) {
  if (!value) return ''
  return new Date(value).toLocaleString('zh-CN')
}

function goBack() {
  persistCurrentDraft()
  router.push('/admin/articles')
}
</script>

<style scoped>
.article-editor {
  padding-top: 20px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.page-title {
  font-size: 24px;
  color: #303133;
  margin: 0;
}

.status-alert {
  margin-bottom: 16px;
}

.draft-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.markdown-editor :deep(textarea) {
  font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
  font-size: 14px;
}

.preview-content {
  padding: 16px;
  background-color: #fff;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  min-height: 400px;
  max-height: 600px;
  overflow-y: auto;
}

.preview-content :deep(h1) {
  font-size: 24px;
  margin: 16px 0;
}

.preview-content :deep(h2) {
  font-size: 20px;
  margin: 14px 0;
}

.preview-content :deep(h3) {
  font-size: 18px;
  margin: 12px 0;
}

.preview-content :deep(pre) {
  background-color: #f5f7fa;
  padding: 12px;
  border-radius: 4px;
  overflow-x: auto;
}

.preview-content :deep(code) {
  font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
  font-size: 14px;
}

.preview-content :deep(p) {
  margin-bottom: 12px;
}
</style>
