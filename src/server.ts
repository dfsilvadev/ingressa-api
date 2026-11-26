import { app } from '@/app'
import { env } from '@/utils/config/env'

app
  .listen({ port: env.PORT, host: env.HOST })
  .then(() => app.log.info(`Server running at http://${env.HOST}:${env.PORT}`))

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => {
    app.log.info(`Received ${signal}, shutting down...`)
    await app.close()
    process.exit(0)
  })
}
