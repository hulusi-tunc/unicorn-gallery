#!/bin/bash
# Make sure the built .app carries a signature macOS will accept.
#
# Electrobun leaves the bundle unsigned: the only signature is the linker's
# ad-hoc one on the inner Mach-O, so `codesign -dvv` reports
# `Sealed Resources=none` and `Info.plist=not bound`. macOS reads a bundle
# whose signature claims resources it cannot find as CORRUPT, and tells the
# user the app "is damaged and can't be opened" — which reads as a broken
# download rather than an unsigned app, and `xattr -d com.apple.quarantine`
# does not fix it because the quarantine flag was never the problem.
#
# Signing the whole bundle ad-hoc costs nothing and downgrades that hard stop
# to the ordinary "unidentified developer" warning, which a recipient can get
# past via System Settings → Privacy & Security → Open Anyway.
#
# A real Developer ID signature is still the right answer for distribution —
# this only runs when the bundle is not already validly signed, so configuring
# one in .env.build takes precedence and is left alone.

set -euo pipefail

APP="${1:-}"
if [ -z "$APP" ] || [ ! -d "$APP" ]; then
  echo "ensure-signed: no app bundle at '${APP}'" >&2
  exit 1
fi

if codesign --verify --deep --strict "$APP" 2>/dev/null; then
  echo "ensure-signed: '$APP' is already validly signed — left alone."
  exit 0
fi

echo "ensure-signed: signing '$APP' ad-hoc (it was not signed as a bundle)."
codesign --force --deep --sign - "$APP"
codesign --verify --deep --strict "$APP"
echo "ensure-signed: done — $(codesign -dvv "$APP" 2>&1 | grep -m1 'Identifier=')"
