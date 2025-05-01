#!/bin/bash

# Build and deploy hosting
cd /Users/fajmac/Downloads/koperasi-unipdu/koperasi-unipdu

echo "Building React app..."
npm run build

echo "Deploying to Firebase Hosting..."
firebase deploy --only hosting

echo "Firebase hosting deployment complete!"