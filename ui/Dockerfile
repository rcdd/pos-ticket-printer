# Stage 1
FROM node:18 AS build-stage

WORKDIR /ui
COPY package.json .
COPY src/ ./src
COPY public/ ./public

RUN npm install

ARG REACT_APP_API_BASE_URL
ENV REACT_APP_API_BASE_URL=$REACT_APP_API_BASE_URL

RUN npm run build

# Stage 2
FROM nginx:1.27.0-alpine

COPY --from=build-stage /ui/build /usr/share/nginx/html
EXPOSE $REACT_DOCKER_PORT

CMD nginx -g 'daemon off;'
