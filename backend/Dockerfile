# backend/Dockerfile
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app
RUN apt-get update && apt-get install -y build-essential && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install -r requirements.txt

COPY . ./

# collect static (if you serve admin/static via whitenoise)
RUN python manage.py collectstatic --noinput

# Expose port used by Fly (internal)
EXPOSE 8080

# Daphne serves ASGI
CMD ["daphne", "-b", "0.0.0.0", "-p", "8080", "server.asgi:application"]
