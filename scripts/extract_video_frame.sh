#!/usr/bin/env bash
# Extract a single still frame from a YouTube video for slide annotation.
# Shared across all lectures — not specific to any one lecture's code/
# folder, hence living in the repo-root scripts/ directory.
#
# Requires: yt-dlp (project dependency, run via `uv run`), ffmpeg (system
# binary, preinstalled in the dev container — see .devcontainer/Dockerfile).
#
# Usage (run from anywhere in the repo; uv locates pyproject.toml itself):
#   scripts/extract_video_frame.sh <youtube-url> <timestamp> <output-file>
#
# Example:
#   scripts/extract_video_frame.sh \
#     "https://www.youtube.com/watch?v=bjYVOcS0qd8" \
#     00:01:23.5 \
#     lectures/01-introduction/media/video_frame.png

set -euo pipefail

URL="${1:?Usage: extract_video_frame.sh <youtube-url> <timestamp> <output-file>}"
TIMESTAMP="${2:?timestamp required, e.g. 00:01:23.5}"
OUT="${3:?output file required, e.g. ../media/video_frame.png}"

STREAM_URL=$(uv run yt-dlp -f "bestvideo[ext=mp4]" -g "$URL")

ffmpeg -y -ss "$TIMESTAMP" -i "$STREAM_URL" -frames:v 1 -update 1 -q:v 2 "$OUT"

echo "Saved frame at $TIMESTAMP to $OUT"
