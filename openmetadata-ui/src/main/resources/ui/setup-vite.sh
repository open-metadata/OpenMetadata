#!/bin/bash
# Copyright 2025 Collate.
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
# http://www.apache.org/licenses/LICENSE-2.0
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

# Setup script for Vite migration
# This script installs the necessary dependencies for Vite

echo "🚀 Setting up Vite for OpenMetadata UI..."

# Check if yarn is available
if ! command -v yarn &> /dev/null; then
    echo "❌ Yarn is not installed. Please install yarn first."
    exit 1
fi

# Install Vite dependencies
echo "📦 Installing Vite dependencies..."
yarn add -D vite@^5.4.10 @vitejs/plugin-react@^4.3.4 vite-plugin-html@^3.2.2 vite-plugin-static-copy@^1.0.6 @svgr/rollup@^6.5.1

# Check if installation was successful
if [ $? -eq 0 ]; then
    echo "✅ Vite dependencies installed successfully!"
else
    echo "❌ Failed to install Vite dependencies"
    exit 1
fi

echo ""
echo "🎉 Vite setup complete!"
echo ""
echo "Next steps:"
echo "1. Run 'yarn start' to start the development server with Vite"
echo "2. Run 'yarn build' to build for production with Vite"
echo "3. Check README.md for detailed documentation"
echo ""
echo "For more information, check out the README.md file."
echo ""
echo "Happy coding! 🚀" 