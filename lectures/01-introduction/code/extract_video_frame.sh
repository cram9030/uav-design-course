#!/usr/bin/env bash
# Extract a single still frame from a YouTube video for slide annotation.
#
# Requires: yt-dlp, ffmpeg
#   pip install yt-dlp
#   apt-get install ffmpeg   (or: brew install ffmpeg)
#
# Usage:
#   ./extract_video_frame.sh <youtube-url> <timestamp> <output-file>
#
# Example:
#   ./extract_video_frame.sh \
#     "https://www.youtube.com/watch?v=bjYVOcS0qd8" \
#     00:01:23.5 \
#     ../media/video_frame.png

set -euo pipefail

URL="${1:?Usage: extract_video_frame.sh <youtube-url> <timestamp> <output-file>}"
TIMESTAMP="${2:?timestamp required, e.g. 00:01:23.5}"
OUT="${3:?output file required, e.g. ../media/video_frame.png}"

STREAM_URL=$(yt-dlp -f "bestvideo[ext=mp4]" -g "$URL")

ffmpeg -y -ss "$TIMESTAMP" -i "$STREAM_URL" -frames:v 1 -q:v 2 "$OUT"

echo "Saved frame at $TIMESTAMP to $OUT"
