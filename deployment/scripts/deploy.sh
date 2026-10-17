#!/bin/bash
set -e

git pull origin main

cd admin-backend
npm ci
npx prisma migrate deploy
cd ..

docker-compose -f docker-compose.yml -f deployment/docker-compose.prod.yml up -d --build
echo "Deploy complete"
