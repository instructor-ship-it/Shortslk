#!/bin/bash

# TC Work Zone Locator - Version Consistency Checker
# Run with: bun run version-check

set -e

echo "🔍 Checking version consistency..."
echo ""

# Function to extract current version from different file types
get_version() {
  local file="$1"
  local version=""
  
  if [[ "$file" == *.tsx ]]; then
    # For TSX files, look for version in header display or APP_VERSION constant
    version=$(grep -oE 'RC [0-9]+\.[0-9]+\.?[0-9]*' "$file" | head -1)
  elif [[ "$file" == "PROJECT_CONTEXT.md" ]]; then
    # For PROJECT_CONTEXT.md, look for "Current Version:"
    version=$(grep "Current Version:" "$file" | grep -oE 'RC [0-9]+\.[0-9]+\.?[0-9]*')
  elif [[ "$file" == "worklog.md" ]]; then
    # For worklog.md, look for "Current Version:"
    version=$(grep "Current Version:" "$file" | grep -oE 'RC [0-9]+\.[0-9]+\.?[0-9]*')
  elif [[ "$file" == "README.md" ]]; then
    # For README.md, look for "(Current)" marker in version history
    version=$(grep "(Current)" "$file" | grep -oE 'RC [0-9]+\.[0-9]+\.?[0-9]*' | head -1)
  elif [[ "$file" == "RC1_Test_Checklist.md" ]]; then
    # For test checklist, look for version in title
    version=$(grep -oE 'RC [0-9]+\.[0-9]+\.?[0-9]*' "$file" | head -1)
  fi
  
  echo "$version"
}

# Files to check
FILES=(
  "src/app/page.tsx"
  "src/app/drive/page.tsx"
  "src/app/overrides/page.tsx"
  "PROJECT_CONTEXT.md"
  "README.md"
  "worklog.md"
  "RC1_Test_Checklist.md"
)

# Collect versions
declare -A VERSIONS

for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    version=$(get_version "$file")
    if [ -n "$version" ]; then
      VERSIONS["$file"]="$version"
    else
      VERSIONS["$file"]="(not found)"
    fi
  fi
done

# Display results
echo "📋 Current version by file:"
echo "─────────────────────────────────────────"
for file in "${FILES[@]}"; do
  printf "  %-30s %s\n" "$file" "${VERSIONS[$file]}"
done
echo ""

# Check for unique versions
FOUND_VERSIONS=()
for v in "${VERSIONS[@]}"; do
  if [[ "$v" != "(not found)" ]]; then
    FOUND_VERSIONS+=("$v")
  fi
done

UNIQUE_VERSIONS=$(printf '%s\n' "${FOUND_VERSIONS[@]}" | sort -u)
VERSION_COUNT=$(echo "$UNIQUE_VERSIONS" | wc -l)

if [ "$VERSION_COUNT" -eq 1 ]; then
  echo "✅ All versions match: $UNIQUE_VERSIONS"
  exit 0
else
  echo "⚠️  VERSION MISMATCH DETECTED!"
  echo "   Found $VERSION_COUNT different versions:"
  echo "$UNIQUE_VERSIONS" | while read -r v; do
    echo "   - $v"
  done
  echo ""
  echo "   Please update documentation files to match the code version."
  exit 1
fi
