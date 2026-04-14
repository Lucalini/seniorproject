/**
 * One-time parser for SLO Municipal Code PDF.
 *
 * Usage:
 *   cd scripts && npm install
 *   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... npx tsx parse-municipal-code.ts ../path/to/code.pdf
 *
 * With --dry-run it prints JSON without touching Supabase.
 */

import fs from 'node:fs'
import pdf from 'pdf-parse'
import { createClient } from '@supabase/supabase-js'

// ── Types ────────────────────────────────────────────────────────────────────

interface CodeNode {
  id?: string
  parent_id: string | null
  node_type: 'title' | 'chapter' | 'section'
  number: string
  heading: string
  body: string | null
  sort_order: number
}

// ── PDF → clean lines ────────────────────────────────────────────────────────

const NOISE_PATTERNS = [
  /Your Selections \| San Luis Obispo Municipal Code\s*Page \d+ of \d+/,
  /^-- \d+ of \d+ --$/,
  /^The San Luis Obispo Municipal Code is current through/,
  /^Disclaimer:/,
  /^Hosted by General Code/,
  /^City Website:/,
  /^City Telephone:/,
]

function isNoise(line: string): boolean {
  const t = line.trim()
  if (!t) return true
  return NOISE_PATTERNS.some(re => re.test(t))
}

/** Strip inline footer fragments that pdf-parse sometimes merges into content lines */
function stripInlineNoise(text: string): string {
  return text.replace(/Your Selections \| San Luis Obispo Municipal Code\s*Page \d+ of \d+/g, '')
}

// ── Structure detection regexes ──────────────────────────────────────────────

const RE_TITLE = /^Title (\d+)$/
const RE_CHAPTER = /^Chapter (\d+\.\d+)$/
const RE_SECTION = /^(\d+\.\d+\.\d+)\s+(.+)/
// Table-of-contents entries: bare section numbers like "1.04.010"
const RE_TOC_NUMBER = /^\d+\.\d+\.\d+$/
// Bare chapter numbers at start of title blocks like "1.04"
const RE_BARE_CHAPTER_NUM = /^\d+\.\d+$/
// "Sections:" or "Chapters:" header in TOC blocks
const RE_TOC_HEADER = /^(Sections|Chapters):$/

// ── Parsing ──────────────────────────────────────────────────────────────────

function parse(text: string): CodeNode[] {
  const rawLines = text.split('\n')
  const lines = rawLines.filter(l => !isNoise(l)).map(l => l.trim())

  const nodes: CodeNode[] = []
  let titleId = ''
  let chapterId = ''
  let sortCounter = 0

  // We'll do a state-machine pass over the cleaned lines.
  let i = 0
  while (i < lines.length) {
    const line = lines[i]

    // ── Title ──
    const titleMatch = line.match(RE_TITLE)
    if (titleMatch) {
      const num = titleMatch[1]
      // Next non-empty line is the heading (ALL CAPS)
      let heading = ''
      let j = i + 1
      while (j < lines.length && !lines[j].trim()) j++
      if (j < lines.length) heading = lines[j]

      titleId = `title-${num}`
      nodes.push({
        id: titleId,
        parent_id: null,
        node_type: 'title',
        number: num,
        heading,
        body: null,
        sort_order: sortCounter++,
      })
      // Skip the heading line and any "Chapters:" + chapter name TOC lines
      i = j + 1
      // Skip TOC block (chapter names, "Chapters:", bare chapter numbers)
      while (i < lines.length) {
        const peek = lines[i]
        if (RE_CHAPTER.test(peek) || RE_TITLE.test(peek) || RE_SECTION.test(peek)) break
        i++
      }
      continue
    }

    // ── Chapter ──
    const chapterMatch = line.match(RE_CHAPTER)
    if (chapterMatch) {
      const num = chapterMatch[1]
      let heading = ''
      let j = i + 1
      while (j < lines.length && !lines[j].trim()) j++
      if (j < lines.length) heading = lines[j]

      // Determine parent title from chapter number prefix
      const titleNum = num.split('.')[0]
      const parentId = `title-${titleNum}`

      chapterId = `chapter-${num}`
      nodes.push({
        id: chapterId,
        parent_id: parentId,
        node_type: 'chapter',
        number: num,
        heading,
        body: null,
        sort_order: sortCounter++,
      })
      i = j + 1
      // Skip the "Sections:" TOC block
      while (i < lines.length) {
        const peek = lines[i]
        if (RE_CHAPTER.test(peek) || RE_TITLE.test(peek) || RE_SECTION.test(peek)) break
        if (RE_TOC_NUMBER.test(peek) || RE_TOC_HEADER.test(peek) || RE_BARE_CHAPTER_NUM.test(peek)) {
          i++
          continue
        }
        // Could be a section title in the TOC — skip if next structural element hasn't appeared
        // Heuristic: if this line doesn't start with a digit pattern that looks like a section, skip it
        if (!RE_SECTION.test(peek) && !RE_CHAPTER.test(peek) && !RE_TITLE.test(peek)) {
          i++
          continue
        }
        break
      }
      continue
    }

    // ── Section ──
    const sectionMatch = line.match(RE_SECTION)
    if (sectionMatch) {
      const num = sectionMatch[1]
      const heading = sectionMatch[2].replace(/\.$/, '').trim()

      // Determine parent chapter from section number (e.g., "1.04" from "1.04.010")
      const parts = num.split('.')
      const chapNum = `${parts[0]}.${parts[1]}`
      const parentId = `chapter-${chapNum}`

      // Collect body text until the next structural element
      const bodyLines: string[] = []
      let j = i + 1
      while (j < lines.length) {
        const peek = lines[j]
        if (RE_SECTION.test(peek) || RE_CHAPTER.test(peek) || RE_TITLE.test(peek)) break
        // Skip bare section numbers and TOC headers that sometimes appear between sections
        if (RE_TOC_NUMBER.test(peek) || RE_TOC_HEADER.test(peek) || RE_BARE_CHAPTER_NUM.test(peek)) break
        bodyLines.push(peek)
        j++
      }

      const body = stripInlineNoise(bodyLines.join('\n')).trim() || null

      nodes.push({
        id: `section-${num}`,
        parent_id: parentId,
        node_type: 'section',
        number: num,
        heading,
        body,
        sort_order: sortCounter++,
      })
      i = j
      continue
    }

    // Skip TOC entries and other non-structural lines
    i++
  }

  return nodes
}

// ── Supabase insertion ───────────────────────────────────────────────────────

async function insertIntoSupabase(nodes: CodeNode[]) {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY
  if (!url || !key) {
    console.error('Set SUPABASE_URL and SUPABASE_SERVICE_KEY env vars')
    process.exit(1)
  }

  const supabase = createClient(url, key)

  // Build a map of our synthetic IDs → real UUIDs
  const idMap = new Map<string, string>()

  // Insert in order: titles first, then chapters, then sections
  const titles = nodes.filter(n => n.node_type === 'title')
  const chapters = nodes.filter(n => n.node_type === 'chapter')
  const sections = nodes.filter(n => n.node_type === 'section')

  for (const batch of [titles, chapters, sections]) {
    for (const node of batch) {
      const parentUuid = node.parent_id ? idMap.get(node.parent_id) ?? null : null
      const { data, error } = await supabase
        .from('municipal_code_nodes')
        .insert({
          parent_id: parentUuid,
          node_type: node.node_type,
          number: node.number,
          heading: node.heading,
          body: node.body,
          sort_order: node.sort_order,
        })
        .select('id')
        .single()

      if (error) {
        console.error(`Failed to insert ${node.node_type} ${node.number}:`, error.message)
        continue
      }
      if (data && node.id) {
        idMap.set(node.id, data.id)
      }
      console.log(`  inserted ${node.node_type} ${node.number}`)
    }
  }

  console.log(`\nDone — inserted ${idMap.size} nodes.`)
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const pdfPath = args.find(a => !a.startsWith('--'))

  if (!pdfPath) {
    console.error('Usage: npx tsx parse-municipal-code.ts [--dry-run] <path-to-pdf>')
    process.exit(1)
  }

  console.log(`Reading ${pdfPath}...`)
  const buf = fs.readFileSync(pdfPath)
  const { text } = await pdf(buf)

  console.log(`Parsing...`)
  const nodes = parse(text)

  const titles = nodes.filter(n => n.node_type === 'title').length
  const chapters = nodes.filter(n => n.node_type === 'chapter').length
  const sections = nodes.filter(n => n.node_type === 'section').length
  console.log(`Found ${titles} titles, ${chapters} chapters, ${sections} sections (${nodes.length} total)`)

  if (dryRun) {
    const outPath = pdfPath.replace(/\.pdf$/i, '.json')
    fs.writeFileSync(outPath, JSON.stringify(nodes, null, 2))
    console.log(`Wrote ${outPath}`)
    return
  }

  await insertIntoSupabase(nodes)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
