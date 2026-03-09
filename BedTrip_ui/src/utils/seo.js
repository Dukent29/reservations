function upsertMeta(selector, attributes, content) {
  if (typeof document === 'undefined') return
  let meta = document.head.querySelector(selector)
  if (!meta) {
    meta = document.createElement('meta')
    Object.entries(attributes).forEach(([key, value]) => {
      meta.setAttribute(key, value)
    })
    document.head.appendChild(meta)
  }
  meta.setAttribute('content', content)
}

function upsertCanonical(url) {
  if (typeof document === 'undefined') return
  let link = document.head.querySelector('link[rel="canonical"]')
  if (!link) {
    link = document.createElement('link')
    link.setAttribute('rel', 'canonical')
    document.head.appendChild(link)
  }
  link.setAttribute('href', url)
}

function setJsonLd(id, payload) {
  if (typeof document === 'undefined') return
  let script = document.head.querySelector(`script[data-seo-id="${id}"]`)
  if (!script) {
    script = document.createElement('script')
    script.type = 'application/ld+json'
    script.setAttribute('data-seo-id', id)
    document.head.appendChild(script)
  }
  script.textContent = JSON.stringify(payload)
}

export function removeJsonLd(id) {
  if (typeof document === 'undefined') return
  const script = document.head.querySelector(`script[data-seo-id="${id}"]`)
  if (script?.parentNode) {
    script.parentNode.removeChild(script)
  }
}

export function setPageSeo({
  title,
  description,
  keywords,
  canonical,
  robots,
  type = 'website',
  jsonLd,
  jsonLdId,
}) {
  if (typeof document === 'undefined') return

  if (title) {
    document.title = title
    upsertMeta('meta[property="og:title"]', { property: 'og:title' }, title)
    upsertMeta('meta[name="twitter:title"]', { name: 'twitter:title' }, title)
  }

  if (description) {
    upsertMeta('meta[name="description"]', { name: 'description' }, description)
    upsertMeta('meta[property="og:description"]', { property: 'og:description' }, description)
    upsertMeta('meta[name="twitter:description"]', { name: 'twitter:description' }, description)
  }

  if (keywords) {
    upsertMeta('meta[name="keywords"]', { name: 'keywords' }, keywords)
  }

  if (robots) {
    upsertMeta('meta[name="robots"]', { name: 'robots' }, robots)
  }

  upsertMeta('meta[property="og:type"]', { property: 'og:type' }, type)
  upsertMeta('meta[name="twitter:card"]', { name: 'twitter:card' }, 'summary_large_image')

  if (canonical) {
    upsertCanonical(canonical)
    upsertMeta('meta[property="og:url"]', { property: 'og:url' }, canonical)
  }

  if (jsonLd && jsonLdId) {
    setJsonLd(jsonLdId, jsonLd)
  }
}

export function absoluteUrl(path = '/') {
  if (typeof window === 'undefined') return path
  return new URL(path, window.location.origin).toString()
}
