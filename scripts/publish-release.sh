#!/usr/bin/env bash
# Publish only the reviewed source commit. Never stage files from a live installation.
set -Eeuo pipefail
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"
sha256sum -c SHA256SUMS
command -v gh >/dev/null || { echo 'GitHub CLI fehlt: pkg install gh'; exit 1; }
gh auth status >/dev/null 2>&1 || { echo 'Bitte zuerst: gh auth login --hostname github.com --git-protocol https --web'; exit 1; }
expected="$(python -c 'import json; print(json.load(open("release-manifest.json"))["commit"])')"
base="$(python -c 'import json; print(json.load(open("release-manifest.json"))["base"])')"
stage="$(mktemp -d "$HOME/.crowniq-publish-v1.3.0.XXXXXXXX")"
git clone --branch main "$ROOT/crowniq-v1.3.0.bundle" "$stage"
cd "$stage"
[[ "$(git rev-parse HEAD)" == "$expected" ]] || { echo 'Unerwarteter Commit'; exit 1; }
git remote set-url origin https://github.com/uhrensohn86/crowniq.git
git fetch origin main --tags
remote="$(git rev-parse FETCH_HEAD)"
[[ "$remote" == "$base" || "$remote" == "$expected" ]] || { echo 'GitHub main wurde zwischenzeitlich geändert. Kein Push; bitte prüfen.'; exit 1; }
[[ "$(git rev-parse 'v1.3.0^{commit}')" == "$expected" ]] || exit 1
git -c credential.helper= -c 'credential.helper=!gh auth git-credential' push --atomic origin HEAD:refs/heads/main refs/tags/v1.3.0
if gh release view v1.3.0 --repo uhrensohn86/crowniq >/dev/null 2>&1; then
  echo 'Release existiert bereits; wird nicht überschrieben.'
else
  gh release create v1.3.0 "$ROOT/crowniq-v1.3.0.zip" "$ROOT/SOURCE-SHA256SUMS" --repo uhrensohn86/crowniq --verify-tag --title 'Crowniq v1.3.0 — TGBC & UI' --notes-file "$ROOT/RELEASE-v1.3.0.md" --latest
fi
gh release view v1.3.0 --repo uhrensohn86/crowniq --json url --jq .url
printf 'Quellstand veröffentlicht. Temporärer Quellklon bleibt zur Kontrolle erhalten: %s\n' "$stage"
