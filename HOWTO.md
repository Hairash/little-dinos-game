# How to run

## Backend
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

## Frontend
1. Install dependencies  
`npm i`

1. Run project  
`npm run dev`
