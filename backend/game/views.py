import secrets
from django.http import JsonResponse
from .models import Game, GamePlayer

def create_game(request):
    game_code = secrets.token_hex(4)
    # Initialize with turn=0 (not None) for consistency
    g = Game.objects.create(game_code=game_code, state={"turn": 0, "board": [], "moves": []})
    # Optionally add the requester as player 1 if authenticated
    if request.user.is_authenticated:
        GamePlayer.objects.create(game=g, player=request.user, order=0)
        g.turn_player = request.user
        g.save(update_fields=["turn_player"])
    return JsonResponse({"gameCode": game_code})
