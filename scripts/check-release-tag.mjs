import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(scriptDir, '..')
const packageJsonPath = path.join(projectRoot, 'package.json')
const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'))
const expectedTag = `v${packageJson.version}`
const actualTag = process.argv[2] ?? process.env.GITHUB_REF_NAME ?? ''

if (!actualTag) {
  console.error('Release tag is missing. Pass it as an argument or set GITHUB_REF_NAME.')
  process.exit(1)
}

if (actualTag !== expectedTag) {
  console.error(`Release tag mismatch: expected ${expectedTag}, received ${actualTag}.`)
  process.exit(1)
}

console.log(`Release tag ${actualTag} matches package.json version ${packageJson.version}.`)
