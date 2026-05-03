# How to run

## Backend
1. Go to the directory  
`cd backend`

1. Create and activate virtual environment
    ```
    python -m venv venv
    source venv/bin/activate
    ```

1. Install Requirements  
`pip install -r requirements.txt`

1. Run migrations  
`python manage.py migrate`

1. Set up all the local variables
    ```
    set -a
    source <(cat .env.local | sed -E 's/^([^#]*=.*)$/export \1/' | grep -v '^#' | grep -v '^$')
    set +a
    ```

1. Run server  
`daphne -b 0.0.0.0 -p 8008 server.asgi:application`  
For local test run instead:  
`DJANGO_DEBUG=True daphne -b 0.0.0.0 -p 8008 server.asgi:application`

### Fast run
```
cd backend
source venv/bin/activate
DJANGO_DEBUG=True daphne -b 0.0.0.0 -p 8008 server.asgi:application
```

## Frontend
1. Go to the directory  
`cd frontend`

1. Install dependencies  
`npm i`

1. Run project  
`npm run dev`


# How to test

## Backend
1. Run linter
`ruff check . && black .`

1. Run tests
`pytest`


## Frontend
1. Run linter
`npm run lint`

1. Run tests
`npm run test`

# How to prepare new images

1. Run script `optimize-images` with the images as arguments  
`./optimize-images.sh all dino1.png dino2.png dino3.png`
