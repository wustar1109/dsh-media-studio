/**
 * Manual install for a profile the Electron app owns exclusively.
 *
 * Adds the package as a `link:` dependency, appends it to the profile's bundle
 * list, creates the same directory junction pnpm would, and backs up the three
 * manifests it changes. Idempotent: running it twice is a no-op.
 *
 * Usage: node install-into-profile.mjs <profileDir> <pluginDir>
 */
import fs from 'node:fs'
import path from 'node:path'

const profileDir = path.resolve(process.argv[2] ?? '')
const pluginDir = path.resolve(process.argv[3] ?? '')
const pkgName = JSON.parse(fs.readFileSync(path.join(pluginDir, 'package.json'), 'utf8')).name

if (!fs.existsSync(path.join(profileDir, 'package.json'))) throw new Error(`profile not found: ${profileDir}`)
if (!fs.existsSync(path.join(pluginDir, 'package.json'))) throw new Error(`plugin not found: ${pluginDir}`)

const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)
const backupDir = path.join(profileDir, `.manual-install-backup-${stamp}`)
fs.mkdirSync(backupDir, { recursive: true })
for (const file of ['package.json', 'cordis.patch.yml', 'pnpm-lock.yaml']) {
  const from = path.join(profileDir, file)
  if (fs.existsSync(from)) fs.copyFileSync(from, path.join(backupDir, file))
}

const manifestPath = path.join(profileDir, 'package.json')
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
manifest.dependencies = manifest.dependencies ?? {}
const spec = `link:${pluginDir.replace(/\\/g, '/')}`
const changed = []
if (manifest.dependencies[pkgName] !== spec) {
  manifest.dependencies[pkgName] = spec
  changed.push(`dependencies.${pkgName}`)
}
manifest.dsh = manifest.dsh ?? {}
manifest.dsh.profile = manifest.dsh.profile ?? {}
const bundles = Array.isArray(manifest.dsh.profile.bundles) ? manifest.dsh.profile.bundles : []
if (!bundles.includes(pkgName)) {
  bundles.push(pkgName)
  manifest.dsh.profile.bundles = bundles
  changed.push('dsh.profile.bundles')
}
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')

const linkPath = path.join(profileDir, 'node_modules', pkgName)
if (!fs.existsSync(linkPath)) {
  fs.mkdirSync(path.dirname(linkPath), { recursive: true })
  fs.symlinkSync(pluginDir, linkPath, 'junction')
  changed.push(`node_modules/${pkgName} (junction)`)
}

console.log(JSON.stringify({ ok: true, pkgName, spec, changed, backupDir, linkPath }, null, 2))
