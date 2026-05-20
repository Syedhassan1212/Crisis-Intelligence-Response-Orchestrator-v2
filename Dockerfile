FROM node:20-alpine AS builder
WORKDIR /app

ARG NEXT_PUBLIC_SUPABASE_URL=https://gbschepxsnjiygrdmhnm.supabase.co
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdic2NoZXB4c25qaXlncmRtaG5tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5MTg3MDIsImV4cCI6MjA5NDQ5NDcwMn0.E8NTXivtR9w6oAF9WGbySrchquhoGsAAAPkDFIdDQYU
ARG NEXT_PUBLIC_WS_URL=wss://webrtc-5kl0.onrender.com
ARG NEXT_PUBLIC_GOOGLE_MAPS_KEY=AIzaSyCsP1Nw8zrBu8i24mSvi8WvcgGhfwkHGI0
ARG NEXT_PUBLIC_LIVEKIT_URL=wss://ciro-vbgkzcr4.livekit.cloud
ARG NEXT_PUBLIC_SOCIAL_API=https://social-media-post-cquv.onrender.com

ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL
ENV NEXT_PUBLIC_GOOGLE_MAPS_KEY=$NEXT_PUBLIC_GOOGLE_MAPS_KEY
ENV NEXT_PUBLIC_LIVEKIT_URL=$NEXT_PUBLIC_LIVEKIT_URL
ENV NEXT_PUBLIC_SOCIAL_API=$NEXT_PUBLIC_SOCIAL_API

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy codebase
COPY . .

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
