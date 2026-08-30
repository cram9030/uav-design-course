FROM mcr.microsoft.com/devcontainers/python:1-3.12-bookworm

ARG QUARTO_VERSION=1.6.42

# The base image ships a preconfigured (and currently broken/unsigned)
# yarn apt source that we don't need and don't want apt-get update to
# fail on, so drop it before touching apt.
RUN rm -f /etc/apt/sources.list.d/yarn.list /etc/apt/sources.list.d/yarn.sources

# Quarto CLI (reveal.js slide rendering)
RUN curl -fsSL -o /tmp/quarto.deb \
        "https://github.com/quarto-dev/quarto-cli/releases/download/v${QUARTO_VERSION}/quarto-${QUARTO_VERSION}-linux-amd64.deb" \
    && apt-get update \
    && apt-get install -y --no-install-recommends /tmp/quarto.deb \
    && rm -rf /tmp/quarto.deb /var/lib/apt/lists/*

# uv (Python package/venv manager used instead of pip)
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /usr/local/bin/

ENV UV_LINK_MODE=copy
