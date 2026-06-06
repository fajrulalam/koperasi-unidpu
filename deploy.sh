#!/bin/bash

# Set the working directory
cd "$(dirname "$0")"

# Deploy Firebase Functions first
echo "Deploying Firebase Functions..."
echo "This may take a minute or two..."
npx firebase-tools deploy --only functions:printReceipt

# Build the React app
echo "Building React app for production..."
npm run build

# Deploy to Firebase Hosting
echo "Deploying to Firebase Hosting..."
npx firebase-tools deploy --only hosting

echo "Deployment complete! Your updated app and functions are now live."