<template>
  <div class="article-editor">
    <div class="page-header">
      <h2 class="page-title">{{ isEdit ? '编辑文章' : '新建文章' }}</h2>
      <el-space>
        <el-button @click="goBack">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSave">
          保存
        </el-button>
      </el-space>
    </div>

    <el-alert
      v-if="saveError"
      :title="saveError"
      type="error"
      show-icon
      :closable="false"
      class="editor-alert"
    />

    <el-alert
      v-if="loadError"
      :title="loadError"
      type="error"
      show-icon
      :closable="false"
      class="editor-alert"
    />

    <el-alert
      v-if="draftRestored"
      type="warning"
      show-icon
      :closable="false"
      class="editor-alert"
    >
      <template #title>
        <div class="draft-alert">
          <span>
            已恢复本地草稿{{ draftSavedAt ? `，最近保存于 ${formatDraftTime(draftSavedAt)}` : '' }}
          </span>
          <el-button type="warning" link @click="discardDraft">
            放弃草稿
          </el-button>
        </div>
      </template>
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
import { ref, reactive, computed, watch, onMounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import api from '../../api'
import { renderMarkdown } from '../../utils/markdown'
import {
  articleToForm,
  clearDraft,
  createEmptyForm,
  formatDraftTime,
  getValidDraft,
  isSameForm,
  parseTagsInput,
  saveDraft
} from '../../utils/draft'

const route = useRoute()
const router = useRouter()

const formRef = ref(null)
const loading = ref(false)
const saving = ref(false)
const initializing = ref(false)
const activeTab = ref('edit')
const draftRestored = ref(false)
const draftSavedAt = ref('')
const loadError = ref('')
const saveError = ref('')
const baseline = ref(null)

const isEdit = computed(() => !!route.params.id)

const form = reactive(createEmptyForm())

const rules = {
  title: [
    { required: true, message: '请输入文章标题', trigger: 'blur' }
  ],
  body: [
    { required: true, message: '请输入文章正文', trigger: 'blur' }
  ]
}

const renderedContent = computed(() => renderMarkdown(form.body))

watch(form, () => {
  if (initializing.value || loading.value || saving.value) return

  const currentForm = { ...form }
  const hasValidDraft =
    currentForm.title.trim().length > 0 && currentForm.body.trim().length > 0

  if (!hasValidDraft) return

  if (baseline.value && isSameForm(currentForm, baseline.value)) {
    clearDraft(route.params.id)
    draftRestored.value = false
    draftSavedAt.value = ''
    return
  }

  const savedDraft = saveDraft(route.params.id, currentForm)
  if (savedDraft) {
    draftSavedAt.value = savedDraft.savedAt
  }
}, { deep: true })

onMounted(() => {
  initializeEditor()
})

async function initializeEditor() {
  initializing.value = true
  loading.value = isEdit.value
  loadError.value = ''
  saveError.value = ''
  draftRestored.value = false
  draftSavedAt.value = ''
  Object.assign(form, createEmptyForm())

  try {
    if (!isEdit.value) {
      baseline.value = createEmptyForm()
      const draft = getValidDraft()
      if (draft) {
        restoreDraft(draft)
      }
      return
    }

    const response = await api.get(`/articles/${route.params.id}`)
    const article = response.data
    const serverForm = articleToForm(article)
    baseline.value = serverForm
    Object.assign(form, serverForm)

    const draft = getValidDraft(route.params.id)
    if (draft && !isSameForm(draft, serverForm)) {
      restoreDraft(draft)
    } else if (draft) {
      clearDraft(route.params.id)
    }
  } catch (error) {
    console.error('Failed to fetch article:', error)
    const draft = getValidDraft(route.params.id)

    if (draft) {
      baseline.value = null
      Object.assign(form, articleToForm(draft))
      restoreDraft(draft)
      loadError.value = '获取线上文章失败，当前显示的是本地保存的草稿'
    } else {
      ElMessage.error('获取文章失败')
      router.replace('/admin/articles')
    }
  } finally {
    loading.value = false
    await nextTick()
    initializing.value = false
  }
}

function restoreDraft(draft) {
  Object.assign(form, articleToForm(draft))
  draftRestored.value = true
  draftSavedAt.value = draft.savedAt
}

function persistCurrentDraft() {
  if (!form.title.trim() || !form.body.trim()) return null
  const savedDraft = saveDraft(route.params.id, form)
  if (savedDraft) {
    draftSavedAt.value = savedDraft.savedAt
  }
  return savedDraft
}

async function handleSave() {
  if (!formRef.value || saving.value) return

  saveError.value = ''

  try {
    await formRef.value.validate()
  } catch {
    return
  }

  if (saving.value) return
  saving.value = true
  persistCurrentDraft()

  try {
    const tags = parseTagsInput(form.tagsInput)
    const articleData = {
      title: form.title,
      body: form.body,
      summary: form.summary,
      tags
    }

    if (isEdit.value) {
      await api.put(`/articles/${route.params.id}`, articleData)
      ElMessage.success('文章已更新')
    } else {
      await api.post('/articles', articleData)
      ElMessage.success('文章已创建')
    }

    clearDraft(route.params.id)
    router.replace('/admin/articles')
  } catch (error) {
    console.error('Failed to save article:', error)
    persistCurrentDraft()
    saveError.value = error.response?.data?.error || '保存文章失败，已保留本地草稿，可重试保存'
    ElMessage.error(saveError.value)
  } finally {
    saving.value = false
  }
}

function discardDraft() {
  clearDraft(route.params.id)
  draftRestored.value = false
  draftSavedAt.value = ''

  if (baseline.value) {
    Object.assign(form, baseline.value)
    return
  }

  router.replace('/admin/articles')
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

.editor-alert {
  margin-bottom: 16px;
}

.draft-alert {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
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
