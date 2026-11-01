// Unit tests without extra dependencies: Vite (already a dev dependency) loads every src/**/*.test.ts through its
// SSR module loader, so the '@/…' alias, TypeScript and extension-less imports work exactly as in the app. The
// tests themselves use node:test / node:assert; node prints the report and sets the exit code.
// Usage: pnpm test   (or: node scripts/run-tests.mjs [filter])
import { readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const root = fileURLToPath(new URL('..', import.meta.url))
const filter = process.argv[2] ?? ''

function collect(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name)
    if (e.isDirectory()) return collect(p)
    return e.name.endsWith('.test.ts') ? [p] : []
  })
}

const files = collect(join(root, 'src')).filter((f) => f.includes(filter))
if (!files.length) {
  console.error(`run-tests: no src/**/*.test.ts files${filter ? ` matching "${filter}"` : ''}`)
  process.exit(1)
}

const server = await createServer({
  root,
  logLevel: 'error',
  appType: 'custom',
  server: { middlewareMode: true, hmr: false, watch: null },
})
try {
  // Registering the tests is enough; node:test runs them once the modules are loaded.
  for (const f of files) await server.ssrLoadModule('/' + relative(root, f).replaceAll('\\', '/'))
} finally {
  await server.close()
}
