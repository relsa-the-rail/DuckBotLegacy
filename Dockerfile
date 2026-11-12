FROM node:22-alpine
LABEL org.opencontainers.image.source="https://github.com/dead0duck/duckbot"

WORKDIR /home/container/app

# Install dependencies first so this layer is cached across source-only changes.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

CMD ["node", "index.js"]
