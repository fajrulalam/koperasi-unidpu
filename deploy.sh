#!/bin/bash

# Set the working directory
cd /Users/fajmac/Downloads/koperasi-unipdu/koperasi-unipdu

# Deploy Firebase Functions first
echo "Deploying Firebase Functions..."
echo "This may take a minute or two..."
firebase deploy --only functions:printReceipt

# Build the React app
echo "Building React app for production..."
npm run build

# Deploy to Firebase Hosting
echo "Deploying to Firebase Hosting..."
firebase deploy --only hosting

echo "Deployment complete! Your updated app and functions are now live."