const DRAFT_KEY_PREFIX = 'blog_article_draft_'
export const NEW_ARTICLE_DRAFT_KEY = `${DRAFT_KEY_PREFIX}new`

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function normalizeDraft(draft) {
  if (!draft || typeof draft !== 'object') {
    return null
  }

  const title = typeof draft.title === 'string' ? draft.title : ''
  const body = typeof draft.body === 'string' ? draft.body : ''
  const summary = typeof draft.summary === 'string' ? draft.summary : ''
  const tagsInput = typeof draft.tagsInput === 'string' ? draft.tagsInput : ''

  if (!isNonEmptyString(title) || !isNonEmptyString(body)) {
    return null
  }

  return {
    title,
    body,
    summary,
    tagsInput,
    savedAt: typeof draft.savedAt === 'string' ? draft.savedAt : new Date().toISOString()
  }
}

export function getDraftKey(articleId) {
  return articleId ? `${DRAFT_KEY_PREFIX}${articleId}` : NEW_ARTICLE_DRAFT_KEY
}

export function getValidDraft(articleId) {
  try {
    const rawDraft = localStorage.getItem(getDraftKey(articleId))
    if (!rawDraft) return null

    return normalizeDraft(JSON.parse(rawDraft))
  } catch (error) {
    console.warn('Failed to read article draft:', error)
    return null
  }
}

export function saveDraft(articleId, form) {
  const draft = normalizeDraft(form)
  if (!draft) return null

  const draftToSave = {
    ...draft,
    savedAt: new Date().toISOString()
  }

  try {
    localStorage.setItem(getDraftKey(articleId), JSON.stringify(draftToSave))
    return draftToSave
  } catch (error) {
    console.warn('Failed to save article draft:', error)
    return null
  }
}

export function clearDraft(articleId) {
  try {
    localStorage.removeItem(getDraftKey(articleId))
  } catch (error) {
    console.warn('Failed to clear article draft:', error)
  }
}

export function parseTagsInput(tagsInput) {
  return [...new Set(
    tagsInput
      .split(',')
      .map(tag => tag.trim())
      .filter(Boolean)
  )]
}

function tagsToInput(tags) {
  if (Array.isArray(tags)) {
    return tags.join(', ')
  }
  return typeof tags === 'string' ? tags : ''
}

export function articleToForm(article) {
  return {
    title: article?.title || '',
    body: article?.body || '',
    summary: article?.summary || '',
    tagsInput: tagsToInput(article?.tags)
  }
}

export function createEmptyForm() {
  return articleToForm(null)
}

export function isSameForm(left, right) {
  if (!left || !right) return false

  const leftTags = parseTagsInput(left.tagsInput || '')
  const rightTags = parseTagsInput(right.tagsInput || '')
  const sameTags =
    leftTags.length === rightTags.length &&
    leftTags.every(tag => rightTags.includes(tag))

  return (
    left.title.trim() === right.title.trim() &&
    left.body.trim() === right.body.trim() &&
    (left.summary || '').trim() === (right.summary || '').trim() &&
    sameTags
  )
}

export function formatDraftTime(savedAt) {
  if (!savedAt) return ''
  return new Date(savedAt).toLocaleString('zh-CN')
}
