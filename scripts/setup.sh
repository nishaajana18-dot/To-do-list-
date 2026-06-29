#!/usr/bin/env bash
set -euo pipefail

echo "=== AI Research Assistant - Setup ==="

echo "Creating Python virtual environment..."
python3 -m venv venv
source venv/bin/activate

echo "Installing dependencies..."
pip install --upgrade pip
pip install -e ".[dev,ml]"

echo "Creating .env from example..."
if [ ! -f .env ]; then
    cp .env.example .env
fi

echo "Starting Docker services..."
docker compose up -d db

echo "Waiting for database..."
until docker compose exec -T db pg_isready -U research -d research_assistant 2>/dev/null; do
    sleep 1
done

echo "Setup complete!"
echo ""
echo "Start the API:   uvicorn apps.api.src.main:app --reload"
echo "Start the UI:    streamlit run apps/web/src/app.py"
echo "Run tests:       pytest"
