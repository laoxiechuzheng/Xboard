// Post-build guard for public/assets/admin-next.
// 1. No circular static imports between chunks: a cycle can run a chunk before a helper it
//    imports is initialized ("e is not a function" only in production builds).
// 2. No dev-only values baked into the bundle (see .env.development.local).
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = fileURLToPath(new URL('../../public/assets/admin-next/assets', import.meta.url))
const files = readdirSync(dir).filter((f) => f.endsWith('.js'))
const graph = new Map()
const problems = []
const importRe = /(?:^|[;}\n])\s*import\s*(?:[^'"`()]*?from\s*)?["'`]\.\/([^"'`]+\.js)["'`]/g

// Local dev env files hold the test instance's secure_path; it must not reach the build.
const devValues = []
for (const name of ['.env.local', '.env.development.local']) {
  const p = fileURLToPath(new URL(`../${name}`, import.meta.url))
  if (!existsSync(p)) continue
  const m = readFileSync(p, 'utf8').match(/^VITE_SECURE_PATH=(.+)$/m)
  if (m && m[1].trim().length >= 4) devValues.push(m[1].trim())
}

for (const f of files) {
  const src = readFileSync(join(dir, f), 'utf8')
  graph.set(f, [...src.matchAll(importRe)].map((m) => m[1]))
  for (const v of devValues) if (src.includes(v)) problems.push(`${f} contains VITE_SECURE_PATH`)
}

const state = new Map()
const stack = []
function visit(n) {
  state.set(n, 1)
  stack.push(n)
  for (const d of graph.get(n) ?? []) {
    if (state.get(d) === 1) problems.push(`circular chunk import: ${[...stack.slice(stack.indexOf(d)), d].join(' -> ')}`)
    else if (!state.has(d)) visit(d)
  }
  stack.pop()
  state.set(n, 2)
}
for (const f of files) if (!state.has(f)) visit(f)

if (problems.length) {
  console.error(problems.join('\n'))
  process.exit(1)
}
console.log(`check-chunks: ${files.length} chunks, no cycles`)
