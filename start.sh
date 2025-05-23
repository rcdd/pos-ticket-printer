#!/bin/bash
set -e

echo "🧪 A verificar dependências..."

# Verifica se o Docker está instalado
if ! command -v docker &> /dev/null
then
    echo "❌ Docker não está instalado. Instala-o em https://www.docker.com/"
    exit 1
fi

# Verifica se o Docker Compose está disponível (com docker compose ou docker-compose)
if ! docker compose version &> /dev/null && ! docker-compose version &> /dev/null
then
    echo "❌ Docker Compose não está disponível. Certifica-te que tens Docker Desktop instalado e atualizado."
    exit 1
fi

# Verifica se o Node.js está instalado
if ! command -v node &> /dev/null
then
    echo "❌ Node.js não está instalado. Instala-o em https://nodejs.org/"
    exit 1
fi

# Verifica se o npm está instalado
if ! command -v npm &> /dev/null
then
    echo "❌ npm não está instalado. Normalmente vem com o Node.js"
    exit 1
fi

echo "🔧 A iniciar dependências Docker (FE e DB)..."
docker-compose up -d

echo "📦 A instalar dependências do backend..."
cd api/
npm install

echo "🚀 A iniciar o backend localmente..."
#npm run dev # ou npm start
NODE_ENV=production node server.js

echo "✅ Tudo pronto! FE e DB em Docker, backend local"