"""
URL configuration for server project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""

from django.contrib import admin
from django.urls import path

import game.views as views
import server.auth as auth

urlpatterns = [
    path("admin/", admin.site.urls),
    path("", views.index, name="index"),
    path("auth/signup/", auth.signup, name="signup"),  # POST
    path("auth/signin/", auth.signin, name="signin"),  # POST
    path("auth/signout/", auth.signout, name="signout"),  # POST
    path("auth/whoami/", auth.whoami, name="whoami"),  # GET
    path("games/", views.create_game, name="create-game"),  # POST
    path("games/active/", views.get_active_games, name="get-active-games"),  # GET
    path("games/<str:game_code>/join/", views.join_game, name="join-game"),  # POST
    path("games/<str:game_code>/leave/", views.leave_game, name="leave-game"),  # POST
    path("games/<str:game_code>/start/", views.start_game, name="start-game"),  # POST
    path("games/<str:game_code>/", views.get_game, name="get-game"),  # GET
    # Saved-map CRUD for multiplayer. Listing returns full documents so the
    # picker can render previews without a separate fetch-by-name round trip.
    path("saved-maps/", views.list_saved_maps, name="list-saved-maps"),  # GET
    path("saved-maps/<str:name>/", views.delete_saved_map, name="delete-saved-map"),  # DELETE
]
