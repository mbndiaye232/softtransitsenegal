# ── Étape 1 : build Vite ──
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# VITE_API_URL = /api → nginx proxifie vers le backend
ENV VITE_API_URL=/api

RUN npm run build

# ── Étape 2 : servir avec Nginx ──
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
