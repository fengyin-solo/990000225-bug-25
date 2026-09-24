import { marked } from 'marked'

marked.setOptions({
  breaks: true,
  gfm: true
})

export function renderMarkdown(markdown = '') {
  const content = String(markdown || '')
  if (!content.trim()) return ''
  return marked.parse(content, { async: false })
}
