"""Lightdash models"""

from pydantic import BaseModel


class LightdashChart(BaseModel):
    """
    Lightdash chart model
    """

    name: str
    organizationUuid: str  # noqa: N815
    uuid: str
    description: str | None = None
    projectUuid: str  # noqa: N815
    spaceUuid: str  # noqa: N815
    pinnedListUuid: str | None = None  # noqa: N815
    spaceName: str  # noqa: N815
    chartType: str | None = None  # noqa: N815
    chartKind: str | None = None  # noqa: N815
    dashboardUuid: str | None = None  # noqa: N815
    dashboardName: str | None = None  # noqa: N815


class LightdashDashboard(BaseModel):
    organizationUuid: str  # noqa: N815
    name: str
    description: str | None = None
    uuid: str
    projectUuid: str  # noqa: N815
    updatedAt: str  # noqa: N815
    spaceUuid: str  # noqa: N815
    spaceName: str | None = None  # noqa: N815
    views: float
    firstViewedAt: str  # noqa: N815
    pinnedListUuid: str | None = None  # noqa: N815
    pinnedListOrder: float | None = None  # noqa: N815
    charts: list[LightdashChart] | None = None


class LightdashSpace(BaseModel):
    organizationUuid: str  # noqa: N815
    projectUuid: str  # noqa: N815
    uuid: str
    name: str
    isPrivate: bool  # noqa: N815
    parentSpaceUuid: str | None = None  # noqa: N815


class LightdashChartList(BaseModel):
    charts: list[LightdashChart] | None = None


class LightdashDashboardList(BaseModel):
    dashboards: list[LightdashDashboard] | None = None
