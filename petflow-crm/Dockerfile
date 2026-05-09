FROM node:22-slim

# Install dependencies needed for Prisma
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Disable Next.js telemetry
ENV NEXT_TELEMETRY_DISABLED 1

# Copy everything
COPY . .

# Install dependencies
RUN npm install

# Generate Prisma client
RUN npx prisma generate

# Build the app
RUN npm run build > build.log 2>&1 || (cat build.log && exit 1)

# Expose port
EXPOSE 3000

# Start the app
CMD ["npm", "start"]
