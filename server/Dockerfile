# Сервер синхронизации «Штаба гильдии»: сборка в Rust-образе, запуск в тонком Debian.
FROM rust:1.97-bookworm AS build
WORKDIR /app
COPY Cargo.toml Cargo.lock ./
COPY src ./src
COPY migrations ./migrations
RUN cargo build --release --locked

FROM debian:bookworm-slim
RUN useradd --system --uid 10001 guild
COPY --from=build /app/target/release/guild-sync /usr/local/bin/guild-sync
USER guild
ENV BIND_ADDR=0.0.0.0:8080
EXPOSE 8080
CMD ["guild-sync"]
