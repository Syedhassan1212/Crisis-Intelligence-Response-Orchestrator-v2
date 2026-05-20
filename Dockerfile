FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy codebase
COPY . .

# NEXT_PUBLIC vars must be available at build time for Next.js to inline them
ENV NEXT_PUBLIC_SUPABASE_URL=https://gbschepxsnjiygrdmhnm.supabase.co
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdic2NoZXB4c25qaXlncmRtaG5tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5MTg3MDIsImV4cCI6MjA5NDQ5NDcwMn0.E8NTXivtR9w6oAF9WGbySrchquhoGsAAAPkDFIdDQYU
ENV NEXT_PUBLIC_WS_URL=wss://webrtc-5kl0.onrender.com
ENV NEXT_PUBLIC_GOOGLE_MAPS_KEY=AIzaSyCsP1Nw8zrBu8i24mSvi8WvcgGhfwkHGI0
ENV NEXT_PUBLIC_LIVEKIT_URL=wss://ciro-vbgkzcr4.livekit.cloud
ENV NEXT_PUBLIC_SOCIAL_API=https://social-media-post-cquv.onrender.com

# Disable telemetry and build next app
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Runner stage
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Copy output files from builder
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.ts ./

EXPOSE 3000

# Start next dev or production start
CMD ["npm", "start"]
