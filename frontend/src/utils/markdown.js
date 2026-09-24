import { Marked } from 'marked'

const marked = new Marked({
  gfm: true,
  breaks: true
})

export function renderMarkdown(content) {
  if (!content || !content.trim()) {
    return '<p>暂无内容</p>'
  }

  return marked.parse(content)
}
