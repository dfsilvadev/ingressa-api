import fastify from 'fastify'

import { env } from '@/utils/config/env'

export const app = fastify({
  logger: env.NODE_ENV !== 'test',
})

app.get('/health', async () => {
  return {
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  }
})
