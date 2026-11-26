import dotenv from 'dotenv'
import { z } from 'zod'

dotenv.config({ quiet: true })

const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3333),
  HOST: z.string().default('localhost'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('production'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  CORS_ORIGINS: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z
      .string()
      .default('http://localhost:3000,http://localhost:3002,http://localhost:5173')
      .transform((str) =>
        str
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      ),
  ),
})

const _parsed = envSchema.safeParse(process.env)

if (!_parsed.success) {
  process.stderr.write(
    `Invalid environment variables:\n${z.prettifyError(_parsed.error)}\n`,
  )
  process.exit(1)
}

export const env = _parsed.data
export type Env = z.infer<typeof envSchema>
