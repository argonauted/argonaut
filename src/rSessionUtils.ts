import { v4 } from 'uuid'
import crc from 'crc'
import process from 'process'

//===================================
// utilities
//====================================

//from core/environment.ts
/**
 * Get value of process environment variable; returns empty string it not found.
 */
export function getenv(name: string): string {
  let value = process.env[name]
  return value ? value : ''
}

//from core/environment.ts
/**
 * Add given name=value to process environment.
 */
export function setenv(name: string, value: string) {
  process.env[name] = value
}

//from core/system.ts
export function localPeer(port: number) {
    // local peer used for named-pipe communication on Windows
    return `\\\\.\\pipe\\${port.toString()}-rsession`
}

//from core/system.ts
export function generateUuid(includeDashes = true) {
    let uuid = v4()
    if (!includeDashes) {
      uuid = uuid.replace(/-/g, '')
    }
    return uuid
  }

//from core/system.ts
export function generateShortenedUuid() {
    return crc.crc32(generateUuid(false)).toString(16)
}

const MAX_INT32 = Math.pow(2,31) - 1
const MIN_INT32 = -Math.pow(2,31)

export function getMessageId() {
    return MIN_INT32 + Math.random() * (MAX_INT32 - MIN_INT32)
}
