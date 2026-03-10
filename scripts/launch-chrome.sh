#!/bin/bash
# Chrome을 CDP 디버깅 모드로 실행
# 이미 Notion에 로그인된 상태에서 실행하세요

open -a "Google Chrome" --args \
  --remote-debugging-port=9222 \
  --no-first-run \
  --no-default-browser-check

echo "✅ Chrome이 디버깅 모드로 실행됐습니다 (port: 9222)"
echo "👉 Notion(notion.so)에 로그인 후, notion-sync.js를 실행하세요"
