import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')

function resolveOutputDir() {
  const arg = process.argv
    .slice(2)
    .find((item) => item.startsWith('--output-dir='))
  const cliValue = arg ? arg.slice('--output-dir='.length).trim() : ''
  const envValue = (process.env.SEO_OUTPUT_DIR || '').trim()
  const requestedDir = cliValue || envValue || 'dist'

  return path.isAbsolute(requestedDir)
    ? requestedDir
    : path.resolve(projectRoot, requestedDir)
}

async function loadDotEnvFile(envPath) {
  try {
    const content = await fs.readFile(envPath, 'utf8')
    for (const rawLine of content.split('\n')) {
      const line = rawLine.trim()
      if (!line || line.startsWith('#')) continue
      const idx = line.indexOf('=')
      if (idx === -1) continue
      const key = line.slice(0, idx).trim()
      const value = line.slice(idx + 1).trim()
      if (!process.env[key]) {
        process.env[key] = value
      }
    }
  } catch {
    // Optional file: silently skip if missing.
  }
}

function normalizeBaseUrl(rawUrl) {
  const fallback = 'https://bedtrip.fr'
  const input = (rawUrl || fallback).trim()
  try {
    const normalized = new URL(input).toString()
    return normalized.endsWith('/') ? normalized.slice(0, -1) : normalized
  } catch {
    return fallback
  }
}

async function loadOptionalArrayExport(modulePath, exportName) {
  try {
    const module = await import(modulePath)
    const value = module?.[exportName]
    return Array.isArray(value) ? value : []
  } catch (error) {
    if (error?.code === 'ERR_MODULE_NOT_FOUND') {
      return []
    }
    throw error
  }
}

function buildSitemapXml(baseUrl, blogPosts = []) {
  const staticPaths = [
    '/',
    '/blog',
    '/contact',
    '/mentions-legales',
    '/politique-de-confidentialite',
    '/conditions',
  ]
  const blogPaths = blogPosts
    .map((post) => `/blog/${post?.slug || ''}`)
    .filter((routePath) => routePath !== '/blog/')
  const allPaths = [...new Set([...staticPaths, ...blogPaths])]
  const lastmod = new Date().toISOString()

  const urls = allPaths
    .map((routePath) => {
      const loc = `${baseUrl}${routePath}`
      return [
        '  <url>',
        `    <loc>${loc}</loc>`,
        `    <lastmod>${lastmod}</lastmod>`,
        '    <changefreq>weekly</changefreq>',
        routePath === '/' ? '    <priority>1.0</priority>' : '    <priority>0.8</priority>',
        '  </url>',
      ].join('\n')
    })
    .join('\n')

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    urls,
    '</urlset>',
    '',
  ].join('\n')
}

function buildRobotsTxt(baseUrl) {
  return [
    'User-agent: *',
    'Allow: /',
    `Sitemap: ${baseUrl}/sitemap.xml`,
    '',
  ].join('\n')
}

async function main() {
  await loadDotEnvFile(path.join(projectRoot, '.env'))
  await loadDotEnvFile(path.resolve(projectRoot, '..', '.env'))
  const outputDir = resolveOutputDir()
  const blogPosts = await loadOptionalArrayExport(
    '../src/data/blogPosts.js',
    'BLOG_POSTS',
  )

  const baseUrl = normalizeBaseUrl(
    process.env.BEDTRIP_SITE_URL ||
      process.env.FRONT_BASE_URL ||
      process.env.VITE_SITE_URL,
  )

  const sitemapXml = buildSitemapXml(baseUrl, blogPosts)
  const robotsTxt = buildRobotsTxt(baseUrl)

  await fs.mkdir(outputDir, { recursive: true })
  await fs.writeFile(path.join(outputDir, 'sitemap.xml'), sitemapXml, 'utf8')
  await fs.writeFile(path.join(outputDir, 'robots.txt'), robotsTxt, 'utf8')

  console.log(
    `[seo] Generated sitemap and robots for ${baseUrl} in ${path.relative(
      projectRoot,
      outputDir,
    )}`,
  )
}

main().catch((error) => {
  console.error('[seo] Failed to generate SEO assets:', error)
  process.exit(1)
})
