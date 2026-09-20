FROM node:24.20.0-alpine3.24 AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY contracts/package.json contracts/package.json
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN npm ci --workspace @car-tracker/frontend --include-workspace-root

COPY tsconfig.base.json ./
COPY contracts contracts
COPY frontend frontend
RUN npm run build --workspace @car-tracker/frontend

FROM nginx:1.30.5-alpine-slim AS runtime
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html
EXPOSE 80
