# ─── BUILD & DEVELOPMENT STAGE ───────────────────────────────────
FROM node:20-alpine AS development

WORKDIR /app

# Copy dependency specifications
COPY package*.json ./

# Install dependencies (including devDependencies)
RUN npm install

# Copy source code
COPY . .

# Expose Vite dev server port
EXPOSE 5173

# Bind to 0.0.0.0 so Vite exposes it to the host
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]


# ─── BUILD FOR PRODUCTION STAGE ──────────────────────────────────
FROM development AS builder

# Build the SPA
RUN npm run build


# ─── PRODUCTION STAGE ────────────────────────────────────────────
FROM nginx:alpine AS production

# Copy custom Nginx configuration for SPA routing fallback
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy static assets from the builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

RUN addgroup -g 1001 -S appgroup && adduser -u 1001 -S appuser -G appgroup && \
    chown -R appuser:appgroup /usr/share/nginx/html /var/cache/nginx /var/run
USER appuser

CMD ["nginx", "-g", "daemon off;"]
