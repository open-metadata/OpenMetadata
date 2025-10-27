#!/bin/bash
# Restart Next.js dev server with clean cache

echo "🔄 Restarting Next.js dev server..."

# Stop any running dev servers
pkill -f "next dev" || echo "No running dev server found"

# Clear Next.js cache
echo "🧹 Clearing Next.js cache..."
rm -rf .next
rm -rf node_modules/.cache

# Wait a moment
sleep 2

echo "✨ Starting fresh dev server..."
echo ""
echo "The async params error should now be fixed!"
echo ""
echo "Run this command in a terminal:"
echo "  cd thirdeye-ui && npm run dev"
echo ""

