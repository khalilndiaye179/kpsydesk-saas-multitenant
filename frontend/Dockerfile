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

# Configuration Nginx pour un utilisateur non-root
RUN rm -rf /usr/share/nginx/html/* && \
    mkdir -p /var/cache/nginx /var/run /var/log/nginx && \
    chown -R nginx:nginx /usr/share/nginx/html /var/cache/nginx /var/run /var/log/nginx /etc/nginx/conf.d

# Copy custom Nginx configuration for SPA routing fallback
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy static assets from the builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Modification des permissions des fichiers copiés
RUN chown -R nginx:nginx /usr/share/nginx/html

USER nginx

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
