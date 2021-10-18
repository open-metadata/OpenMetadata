from django.contrib import admin
from django.urls import path

from .views import detail_page, list_page

urlpatterns = [
    path("admin/", admin.site.urls),
    path("", list_page),
    path("dataset/<str:fqn>/", detail_page, name="dataset"),
]
handler404 = "metadata_server.openmetadata.views.page_not_found_view"
