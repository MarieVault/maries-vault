#!/bin/bash

# Marie's Vault Production Start Script
# Make sure .env file exists with required environment variables

cd /root/maries-vault-migration/maries-vault

# Check if .env file exists
if [ ! -f .env ]; then
    echo "Error: .env file not found!"
    echo "Create .env file with:"
    echo "DATABASE_URL=postgresql://username:password@localhost:5432/database"
    echo "OPENAI_API_KEY=your_openai_api_key"
    echo "JWT_SECRET=your_long_random_secret_key"
    echo "PORT=4000"
    echo "NODE_ENV=production"
    exit 1
fi

# Load environment variables from .env file
export $(cat .env | xargs)

# Build the application
echo "Building..."
npm run build

# Start the application (exec replaces bash so systemd can cleanly manage the process)
exec node dist/index.js