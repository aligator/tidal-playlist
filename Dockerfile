FROM denoland/deno:2.7.1 AS build

WORKDIR /app

COPY deno.json deno.lock vite.config.ts ./
COPY web ./web
RUN deno task build

COPY server ./server
RUN deno cache --lock=deno.lock --frozen --node-modules-dir=auto server/main.ts

FROM denoland/deno:2.7.1

WORKDIR /app

ENV DENO_NO_UPDATE_CHECK=1
ENV DENO_DIR=/deno-dir

COPY --from=build /deno-dir /deno-dir
COPY --from=build /app/deno.json /app/deno.lock ./
COPY --from=build /app/server ./server
COPY --from=build /app/web/dist ./web/dist

USER deno
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD deno eval "const r = await fetch('http://localhost:8080/api/config'); if (!r.ok) Deno.exit(1);" || exit 1

CMD ["run", "--cached-only", "--frozen", "--allow-net", "--allow-read=web/dist", "--allow-env", "server/main.ts"]
