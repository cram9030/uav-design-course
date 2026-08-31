FROM mcr.microsoft.com/devcontainers/python:1-3.12-bookworm

ARG QUARTO_VERSION=1.6.42

# The base image ships a preconfigured (and currently broken/unsigned)
# yarn apt source that we don't need and don't want apt-get update to
# fail on, so drop it before touching apt.
RUN rm -f /etc/apt/sources.list.d/yarn.list /etc/apt/sources.list.d/yarn.sources

# Quarto CLI (reveal.js slide rendering) + ffmpeg (video frame extraction,
# see lectures/*/code/extract_video_frame.sh; paired with the yt-dlp
# Python dependency in pyproject.toml, since ffmpeg is a system binary
# and can't be installed via uv)
RUN curl -fsSL -o /tmp/quarto.deb \
        "https://github.com/quarto-dev/quarto-cli/releases/download/v${QUARTO_VERSION}/quarto-${QUARTO_VERSION}-linux-amd64.deb" \
    && apt-get update \
    && apt-get install -y --no-install-recommends /tmp/quarto.deb ffmpeg \
    && rm -rf /tmp/quarto.deb /var/lib/apt/lists/*

# uv (Python package/venv manager used instead of pip)
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /usr/local/bin/

ENV UV_LINK_MODE=copy

# Pre-create ~/.claude owned by the vscode user before the claude-code-config
# named volume is first attached (see devcontainer.json). Docker populates a
# fresh named volume by copying whatever already exists at the mount path in
# the image; without this, the mount point gets created as root instead,
# leaving Claude Code unable to write transcripts or persist login. Mirrors
# the equivalent step in Anthropic's reference container:
# https://github.com/anthropics/claude-code/blob/main/.devcontainer/Dockerfile
RUN mkdir -p /home/vscode/.claude && chown -R vscode:vscode /home/vscode/.claude
