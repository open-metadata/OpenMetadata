"""Lightdash models"""

from typing import List, Optional  # noqa: UP035

from pydantic import BaseModel


class LightdashChart(BaseModel):
    """
    Lightdash chart model
    """

    name: str
    organizationUuid: str  # noqa: N815
    uuid: str
    description: Optional[str] = None  # noqa: UP045
    projectUuid: str  # noqa: N815
    spaceUuid: str  # noqa: N815
    pinnedListUuid: Optional[str] = None  # noqa: N815, UP045
    spaceName: str  # noqa: N815
    chartType: Optional[str] = None  # noqa: N815, UP045
    chartKind: Optional[str] = None  # noqa: N815, UP045
    dashboardUuid: Optional[str] = None  # noqa: N815, UP045
    dashboardName: Optional[str] = None  # noqa: N815, UP045


class LightdashDashboard(BaseModel):
    organizationUuid: str  # noqa: N815
    name: str
    description: Optional[str] = None  # noqa: UP045
    uuid: str
    projectUuid: str  # noqa: N815
    updatedAt: str  # noqa: N815
    spaceUuid: str  # noqa: N815
    spaceName: Optional[str] = None  # noqa: N815, UP045
    views: float
    firstViewedAt: str  # noqa: N815
    pinnedListUuid: Optional[str] = None  # noqa: N815, UP045
    pinnedListOrder: Optional[float] = None  # noqa: N815, UP045
    charts: Optional[List[LightdashChart]] = None  # noqa: UP006, UP045


class LightdashSpace(BaseModel):
    organizationUuid: str  # noqa: N815
    projectUuid: str  # noqa: N815
    uuid: str
    name: str
    isPrivate: bool  # noqa: N815
    parentSpaceUuid: Optional[str] = None  # noqa: N815, UP045


class LightdashChartList(BaseModel):
    charts: Optional[List[LightdashChart]] = None  # noqa: UP006, UP045


class LightdashDashboardList(BaseModel):
    dashboards: Optional[List[LightdashDashboard]] = None  # noqa: UP006, UP045
