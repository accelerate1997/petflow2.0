FROM node:22-slim AS base

# Install dependencies only when needed
FROM base AS deps
# Install openssl for Prisma
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json package-lock.json* ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Next.js telemetry is disabled
ENV NEXT_TELEMETRY_DISABLED 1

# Receive environment variables from Coolify
ARG DATABASE_URL
ENV DATABASE_URL=$DATABASE_URL

# Generate Prisma Client
RUN npx prisma generate

RUN NODE_OPTIONS="--max-old-space-size=4096" npm run build > build.log 2>&1 || (cat build.log && exit 1)

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy the built standalone artifacts
COPY --from=builder /app/public ./public

# Automatically leverage output traces to reduce image size
# Ensure you have 'output: "standalone"' in your next.config.mjs
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
