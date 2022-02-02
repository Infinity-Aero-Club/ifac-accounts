import redis, { OverloadedCommand } from "redis"
import { promisify } from "util"

const rclient = redis.createClient({ host: process.env.REDISHOST ?? "redis" })
rclient.on("error", function(error) {
  console.error(error)
})

export default rclient

export const getAsync: (key: string) => Promise<string | null> = promisify(rclient.get).bind(rclient)
export const setAsync: (key: string, value: string) => Promise<any> = promisify(rclient.set).bind(rclient)
export const setexAsync: (key: string, seconds: number, value: string) => Promise<any> = promisify(rclient.setex).bind(rclient)
export const hgetAsync: (key: string, field: string) => Promise<string> = promisify(rclient.hget).bind(rclient)
export const hexistsAsync: (key: string, field: string) => Promise<number> = promisify(rclient.hexists).bind(rclient)
export const sismemberAsync: (key: string, member: string) => Promise<number> = promisify(rclient.sismember).bind(rclient)
export const smembersAsync: (key: string) => Promise<string[]> = promisify(rclient.smembers).bind(rclient)
export const existsAsync: OverloadedCommand<string, number, Promise<number>> = promisify(rclient.exists).bind(rclient)
export const hsetAsync: (key: string, field: string, value: string) => Promise<any> = promisify(rclient.hset).bind(rclient) as any
export const hdelAsync: (key: string, field: string) => Promise<any> = promisify(rclient.hdel).bind(rclient)
export const saddAsync: (key: string, ...members: string[]) => Promise<any> = promisify(rclient.sadd).bind(rclient)
export const sremAsync: (key: string, member: string) => Promise<any> = promisify(rclient.srem).bind(rclient)
export const delAsync: (key: string) => Promise<any> = promisify(rclient.del).bind(rclient)
export const keysAsync: (pattern: string) => Promise<string[]> = promisify(rclient.keys).bind(rclient)