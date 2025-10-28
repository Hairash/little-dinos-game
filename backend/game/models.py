from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()


class Game(models.Model):
    # Business identifier used in URLs and API
    game_code = models.CharField(max_length=20, unique=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    state = models.JSONField(default=dict)  # canonical board state
    # Optional: store whose turn
    turn_player = models.ForeignKey(
        User, null=True, blank=True, on_delete=models.SET_NULL, related_name="games_they_play"
    )
    
    class Meta:
        ordering = ["-created_at"]
    
    def __str__(self):
        return f"Game {self.game_code}"


class GamePlayer(models.Model):
    """Links players to games with their turn order."""
    game = models.ForeignKey(Game, on_delete=models.CASCADE, related_name="players")
    player = models.ForeignKey(User, on_delete=models.CASCADE, related_name="game_memberships")
    order = models.PositiveSmallIntegerField(help_text="Turn order (0=first, 1=second, etc.)")

    class Meta:
        unique_together = [("game", "player")]
        ordering = ["game", "order"]
    
    def __str__(self):
        return f"{self.player} in Game {self.game.game_code} (order {self.order})"


class Move(models.Model):
    """Records every move with idempotency check via client_seq."""
    game = models.ForeignKey(Game, on_delete=models.CASCADE, related_name="move_history")
    player = models.ForeignKey(User, on_delete=models.CASCADE, related_name="moves")
    payload = models.JSONField(help_text="Move payload from client")
    client_seq = models.BigIntegerField(help_text="Client sequence number for idempotency")
    server_tick = models.BigIntegerField(help_text="Server timestamp in milliseconds")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [("game", "player", "client_seq")]
        indexes = [
            models.Index(fields=["game", "created_at"]),
        ]
        ordering = ["-created_at"]
    
    def __str__(self):
        return f"Move {self.client_seq} by {self.player} in Game {self.game.game_code}"
