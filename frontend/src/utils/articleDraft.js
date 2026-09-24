const DRAFT_KEY_PREFIX = 'blog_article_draft:'

export function getDraftKey(articleId = 'new') {
  return `${DRAFT_KEY_PREFIX}${articleId}`
}

export function loadDraft(articleId = 'new') {
  try {
    const raw = localStorage.getItem(getDraftKey(articleId))
    if (!raw) return null

    const draft = JSON.parse(raw)
    if (!isValidDraft(draft)) return null
    return {
      title: String(draft.title),
      body: String(draft.body),
      summary: draft.summary ? String(draft.summary) : '',
      tagsInput: draft.tagsInput ? String(draft.tagsInput) : '',
      savedAt: draft.savedAt ? String(draft.savedAt) : '',
      baseUpdatedAt: draft.baseUpdatedAt ? String(draft.baseUpdatedAt) : null
    }
  } catch {
    return null
  }
}

export function saveDraft(articleId, draft) {
  if (!articleId || !isValidDraft(draft)) return null

  const storedDraft = {
    title: draft.title,
    body: draft.body,
    summary: draft.summary || '',
    tagsInput: draft.tagsInput || '',
    savedAt: new Date().toISOString(),
    baseUpdatedAt: draft.baseUpdatedAt || null
  }

  localStorage.setItem(getDraftKey(articleId), JSON.stringify(storedDraft))
  return storedDraft
}

export function clearDraft(articleId = 'new') {
  localStorage.removeItem(getDraftKey(articleId))
}

export function isValidDraft(draft) {
  return Boolean(
    draft &&
      typeof draft === 'object' &&
      draft.title &&
      String(draft.title).trim() &&
      draft.body &&
      String(draft.body).trim()
  )
}

export function parseTags(tagsInput = '') {
  return String(tagsInput)
    .split(',')
    .map(tag => tag.trim())
    .filter(Boolean)
}

export function tagsToInput(tags = []) {
  return Array.isArray(tags) ? tags.join(', ') : ''
}
