// Client-side generators for node secrets (Reality key pair, short id, obfs password, mieru pattern).
// No external dependency: X25519 is implemented with BigInt (RFC 7748); key generation is not timing sensitive here.

const P = 2n ** 255n - 19n
const A24 = 121665n

function mod(a: bigint): bigint {
  const r = a % P
  return r >= 0n ? r : r + P
}

function powMod(base: bigint, exp: bigint): bigint {
  let r = 1n
  let b = mod(base)
  let e = exp
  while (e > 0n) {
    if (e & 1n) r = mod(r * b)
    b = mod(b * b)
    e >>= 1n
  }
  return r
}

function decodeLE(bytes: Uint8Array): bigint {
  let n = 0n
  for (let i = bytes.length - 1; i >= 0; i--) n = (n << 8n) | BigInt(bytes[i])
  return n
}

function encodeLE(n: bigint): Uint8Array {
  const out = new Uint8Array(32)
  let v = n
  for (let i = 0; i < 32; i++) {
    out[i] = Number(v & 0xffn)
    v >>= 8n
  }
  return out
}

export function clampScalar(k: Uint8Array): Uint8Array {
  const c = new Uint8Array(k)
  c[0] &= 248
  c[31] &= 127
  c[31] |= 64
  return c
}

/** X25519 scalar multiplication; `scalar` is clamped internally. */
export function x25519(scalar: Uint8Array, u: Uint8Array): Uint8Array {
  const k = decodeLE(clampScalar(scalar))
  const uBytes = new Uint8Array(u)
  uBytes[31] &= 127
  const x1 = decodeLE(uBytes)
  let x2 = 1n
  let z2 = 0n
  let x3 = x1
  let z3 = 1n
  let swap = 0n
  for (let t = 254; t >= 0; t--) {
    const kt = (k >> BigInt(t)) & 1n
    swap ^= kt
    if (swap) {
      ;[x2, x3] = [x3, x2]
      ;[z2, z3] = [z3, z2]
    }
    swap = kt
    const a = mod(x2 + z2)
    const aa = mod(a * a)
    const b = mod(x2 - z2)
    const bb = mod(b * b)
    const e = mod(aa - bb)
    const c = mod(x3 + z3)
    const d = mod(x3 - z3)
    const da = mod(d * a)
    const cb = mod(c * b)
    x3 = mod((da + cb) * (da + cb))
    z3 = mod(x1 * mod((da - cb) * (da - cb)))
    x2 = mod(aa * bb)
    z2 = mod(e * mod(aa + A24 * e))
  }
  if (swap) {
    ;[x2, x3] = [x3, x2]
    ;[z2, z3] = [z3, z2]
  }
  return encodeLE(mod(x2 * powMod(z2, P - 2n)))
}

const BASE_POINT = (() => {
  const b = new Uint8Array(32)
  b[0] = 9
  return b
})()

export function base64UrlNoPad(bytes: Uint8Array): string {
  let bin = ''
  bytes.forEach((b) => (bin += String.fromCharCode(b)))
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function randomBytes(n: number): Uint8Array {
  const out = new Uint8Array(n)
  crypto.getRandomValues(out)
  return out
}

/** Xray-style Reality key pair: URL-safe base64 without padding (same as `xray x25519`). */
export function generateRealityKeyPair(): { privateKey: string; publicKey: string } {
  const priv = clampScalar(randomBytes(32))
  const pub = x25519(priv, BASE_POINT)
  return { privateKey: base64UrlNoPad(priv), publicKey: base64UrlNoPad(pub) }
}

/** Random hex short id; length is a random even number in 2..16. */
export function generateShortId(): string {
  const len = (1 + (randomBytes(1)[0] % 8)) * 2
  return Array.from(randomBytes(len / 2), (b) => b.toString(16).padStart(2, '0')).join('')
}

const ALNUM = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

export function generatePassword(length = 16): string {
  const bytes = randomBytes(length)
  return Array.from(bytes, (b) => ALNUM[b % ALNUM.length]).join('')
}

function randomInt(min: number, max: number): number {
  const v = new Uint32Array(1)
  crypto.getRandomValues(v)
  return min + (v[0] % (max - min + 1))
}

function varint(n: number): number[] {
  const out: number[] = []
  let v = n
  while (v > 0x7f) {
    out.push((v & 0x7f) | 0x80)
    v >>>= 7
  }
  out.push(v)
  return out
}

/** mieru traffic pattern (protobuf-encoded, base64), same algorithm as the official admin. */
export function generateMieruTrafficPattern(): string {
  const a = randomInt(100, 200)
  const b = randomInt(400, 600)
  const inner = [0x08, ...varint(a), 0x10, ...varint(b)]
  const outer = [0x0a, ...varint(inner.length), ...inner]
  return btoa(String.fromCharCode(...outer))
}
