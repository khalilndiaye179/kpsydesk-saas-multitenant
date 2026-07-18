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

# ============================================================
# Stage 5 : Production finale
# ============================================================
FROM base AS production
ENV NODE_ENV=production

# Création d'un utilisateur non-root dédié
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY package*.json ./
COPY prisma ./prisma/
RUN npm install --only=production && npx prisma generate && npm cache clean --force
COPY --from=builder /app/dist ./dist

# Modification des permissions pour le nouvel utilisateur
RUN chown -R appuser:appgroup /app

USER appuser

EXPOSE 3000
CMD ["sh", "-c", "npx prisma db push && node dist/main.js"]
