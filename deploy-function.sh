#!/bin/bash

# Deploy Firebase Functions only
cd "$(dirname "$0")"
echo "Deploying Firebase Function..."
npx firebase-tools deploy --only functions:printReceipt

echo "Firebase function deployment complete!"