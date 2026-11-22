#!/usr/bin/env bash
# Blocks a commit that would add an API key, token or env file.
# Runs automatically as the pre-commit hook (.githooks/pre-commit), installed by `npm install`.
# Bypass only for a proven false positive: git commit --no-verify (and tell the team why).
set -euo pipefail

PATTERNS=(
  'AIza[0-9A-Za-z_-]{30,}'                          # Google / Gemini API key
  'AQ\.[0-9A-Za-z_-]{30,}'                          # Google API key (newer format)
  'gsk_[0-9A-Za-z]{30,}'                            # Groq API key
  'sk-or-v1-[0-9a-f]{40,}'                          # OpenRouter API key
  'sk-(proj-|ant-)?[0-9A-Za-z_-]{30,}'              # OpenAI / Anthropic style keys
  'sb_(secret|publishable)_[0-9A-Za-z_-]{20,}'      # Supabase new-style keys
  'eyJ[0-9A-Za-z_-]{10,}\.eyJ[0-9A-Za-z_-]{10,}\.[0-9A-Za-z_-]{10,}'   # JWTs (Supabase anon/service_role)
  'vercel_[0-9A-Za-z]{20,}'                         # Vercel token
  'gh[pousr]_[0-9A-Za-z]{30,}'                      # GitHub token
  '(API_KEY|SERVICE_ROLE_KEY|ANON_KEY|CRON_SECRET|VERCEL_TOKEN)[[:space:]]*[=:][[:space:]]*["'"'"']?[0-9A-Za-z._-]{16,}'  # a secret assigned in code
)

fail=0

# 1. Env files must never be committed (except the empty template).
while IFS= read -r f; do
  case "$f" in
    .env.example|*/.env.example) ;;
    .env|.env.*|*/.env|*/.env.*) echo "BLOCKED: '$f' is an env file. Secrets live in Vercel and local .env.local only."; fail=1 ;;
  esac
done < <(git diff --cached --name-only --diff-filter=ACMR)

# 2. No key-shaped strings in any added line.
added=$(git diff --cached -U0 --diff-filter=ACMR -- . ':(exclude)package-lock.json' ':(exclude)scripts/check-secrets.sh' | grep -E '^\+[^+]' || true)
for p in "${PATTERNS[@]}"; do
  if hits=$(printf '%s\n' "$added" | grep -nE -- "$p"); then
    echo "BLOCKED: a line you're committing looks like a secret (pattern: $p):"
    printf '%s\n' "$hits" | sed -E 's/([A-Za-z0-9_.-]{6})[A-Za-z0-9_.-]{10,}/\1…[hidden]/g' | head -5
    fail=1
  fi
done

if [ "$fail" -ne 0 ]; then
  echo
  echo "Commit stopped. Put secrets in Vercel (Settings → Environment Variables) or your local .env.local, never in code."
  exit 1
fi
