# Tiny, auditable webhook receiver — built from Alpine's own package repo
# (not a random third-party Docker Hub image) since this container gets
# access to the host's Docker socket to redeploy the demo stack.
FROM alpine:3.20
RUN apk add --no-cache webhook docker-cli docker-cli-compose git bash

COPY hooks.json /etc/webhook/hooks.json
COPY deploy.sh /scripts/deploy.sh
RUN chmod +x /scripts/deploy.sh

EXPOSE 9000
ENTRYPOINT ["webhook", "-hooks=/etc/webhook/hooks.json", "-verbose", "-hotreload"]
