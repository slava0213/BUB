FROM node:20-alpine
WORKDIR /app
COPY hitch-a-ride/server/package*.json ./
RUN npm install --omit=dev
COPY hitch-a-ride/server/ ./
COPY hitch-a-ride/client/ /client/
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
CMD ["npm", "start"]
