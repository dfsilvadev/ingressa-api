import fastify from 'fastify'

import { env } from '@/utils/config/env'

import { version } from '../package.json'

export const app = fastify({
  logger: env.NODE_ENV !== 'test',
})

app.get('/health', async () => {
  return {
    status: 'ok',
    version,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  }
})
