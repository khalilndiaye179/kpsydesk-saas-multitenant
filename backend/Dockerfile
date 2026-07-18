# ============================================================
# Stage 1 : Base commune
# ============================================================
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache openssl

# ============================================================
# Stage 2 : Dépendances
# ============================================================
FROM base AS deps
COPY package*.json ./
COPY prisma ./prisma/
RUN npm install
RUN npx prisma generate

# ============================================================
# Stage 3 : Développement (NestJS watch mode)
# ============================================================
FROM deps AS development
ENV NODE_ENV=development
COPY . .
EXPOSE 3000
# Commande pour pousser le schéma de base de données prisma et lancer le mode dev NestJS
CMD ["sh", "-c", "npx prisma db push && npm run start:dev"]

# ============================================================
# Stage 4 : Build de production
# ============================================================
FROM deps AS builder
COPY . .
RUN npm run build
RUN npx tsc prisma/seed.ts --outDir dist/prisma

# ============================================================
# Stage 5 : Production finale
# ============================================================
FROM base AS production
ENV NODE_ENV=production

COPY package*.json ./
COPY prisma ./prisma/
RUN npm install --only=production && npx prisma generate && npm cache clean --force
COPY --from=builder /app/dist ./dist

EXPOSE 3000
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
