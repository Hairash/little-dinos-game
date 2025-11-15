# How to run

## Backend
1. Create virtual environment

1. Install Requirements

1. Set up all the local variables
    ```
    set -a
    source <(cat .env.local | sed -E 's/^([^#]*=.*)$/export \1/' | grep -v '^#' | grep -v '^$')
    set +a
    ```

1. Run server  
`daphne -b 0.0.0.0 -p 8008 server.asgi:application`

