#!/bin/bash

# Build and deploy hosting
cd "$(dirname "$0")"

echo "Building React app..."
npm run build

echo "Deploying to Firebase Hosting..."
npx firebase-tools deploy --only hosting

echo "Firebase hosting deployment complete!"