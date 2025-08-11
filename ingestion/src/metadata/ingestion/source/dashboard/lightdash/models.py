"""Lightdash models"""

from typing import List, Optional

from pydantic import BaseModel


class LightdashChart(BaseModel):
    """
    Lightdash chart model
    """

    name: str
    organizationUuid: str
    uuid: str
    description: Optional[str] = None
    projectUuid: str
    spaceUuid: str
    pinnedListUuid: Optional[str] = None
    spaceName: str
    chartType: Optional[str] = None
    chartKind: Optional[str] = None
    dashboardUuid: Optional[str] = None
    dashboardName: Optional[str] = None


class LightdashDashboard(BaseModel):
    organizationUuid: str
    name: str
    description: Optional[str] = None
    uuid: str
    projectUuid: str
    updatedAt: str
    spaceUuid: str
    spaceName: Optional[str] = None
    views: float
    firstViewedAt: str
    pinnedListUuid: Optional[str] = None
    pinnedListOrder: Optional[float] = None
    charts: Optional[List[LightdashChart]] = None


class LightdashSpace(BaseModel):
    organizationUuid: str
    projectUuid: str
    uuid: str
    name: str
    isPrivate: bool
    parentSpaceUuid: Optional[str] = None


class LightdashChartList(BaseModel):
    charts: Optional[List[LightdashChart]] = None


class LightdashDashboardList(BaseModel):
    dashboards: Optional[List[LightdashDashboard]] = None
