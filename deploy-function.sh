#!/bin/bash

# Deploy Firebase Functions only
cd /Users/fajmac/Downloads/koperasi-unipdu/koperasi-unipdu
echo "Deploying Firebase Function..."
firebase deploy --only functions:printReceipt

echo "Firebase function deployment complete!"