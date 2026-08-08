#!/bin/bash
# Builds the React frontend and copies it into backend/static_frontend
# so the single Flask app (backend/app.py) can serve it directly.
# Run this before deploying to Azure — see DEPLOYMENT.md.
set -e

echo "Installing frontend dependencies..."
cd frontend
npm ci

echo "Building frontend for production..."
npm run build

echo "Copying build output into backend/static_frontend..."
rm -rf ../backend/static_frontend
mkdir -p ../backend/static_frontend
cp -r dist/* ../backend/static_frontend/

echo "Done. backend/static_frontend now contains the production build."
