FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
ARG VITE_API_URL=http://localhost:3001
ARG VITE_WS_URL=ws://localhost:3002
ARG VITE_AUTH_URL=http://localhost:3004
ARG VITE_ANALYTICS_URL=http://localhost:3006
ENV VITE_API_URL=$VITE_API_URL VITE_WS_URL=$VITE_WS_URL VITE_AUTH_URL=$VITE_AUTH_URL VITE_ANALYTICS_URL=$VITE_ANALYTICS_URL
RUN npm run build

FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
