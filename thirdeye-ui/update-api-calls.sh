#!/bin/bash

# Script to update thirdeye-ui API calls to use OpenMetadata proxy
# This script updates the frontend to call OpenMetadata instead of direct thirdeye-py

echo "Updating thirdeye-ui API calls to use OpenMetadata proxy..."

# Update thirdeyeClient.ts
if [ -f "src/lib/thirdeyeClient.ts" ]; then
    echo "Updating thirdeyeClient.ts..."
    
    # Backup original file
    cp src/lib/thirdeyeClient.ts src/lib/thirdeyeClient.ts.backup
    
    # Update base URL to use OpenMetadata proxy
    sed -i 's|http://localhost:8586/api/v1/thirdeye|/api/v1/thirdeye|g' src/lib/thirdeyeClient.ts
    
    echo "✅ Updated thirdeyeClient.ts"
    echo "📁 Backup saved as thirdeyeClient.ts.backup"
else
    echo "❌ thirdeyeClient.ts not found"
fi

# Update any other files that might have direct API calls
echo "Searching for other direct API calls..."

# Find files with direct thirdeye API calls
grep -r "localhost:8586" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | while read line; do
    file=$(echo "$line" | cut -d: -f1)
    echo "Found direct API call in: $file"
    echo "Please update manually: $line"
done

# Update environment variables if they exist
if [ -f ".env.local" ]; then
    echo "Updating .env.local..."
    sed -i 's|THIRDEYE_BACKEND_URL=http://localhost:8586|THIRDEYE_BACKEND_URL=/api/v1/thirdeye|g' .env.local
    echo "✅ Updated .env.local"
fi

if [ -f ".env" ]; then
    echo "Updating .env..."
    sed -i 's|THIRDEYE_BACKEND_URL=http://localhost:8586|THIRDEYE_BACKEND_URL=/api/v1/thirdeye|g' .env
    echo "✅ Updated .env"
fi

echo ""
echo "🎉 Frontend API calls updated!"
echo ""
echo "Next steps:"
echo "1. Start OpenMetadata server with ThirdEye configuration"
echo "2. Ensure ThirdEye Python service is running on port 8586"
echo "3. Test the integration:"
echo "   - OpenMetadata: http://localhost:8585"
echo "   - ThirdEye proxy: http://localhost:8585/api/v1/thirdeye/health"
echo "   - Frontend: http://localhost:3000"
echo ""
echo "Configuration example:"
echo "Add to openmetadata.yaml:"
echo "thirdEyeConfiguration:"
echo "  enabled: true"
echo "  host: localhost"
echo "  port: 8586"
echo "  basePath: /api/v1/thirdeye"
