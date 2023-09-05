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
    description: Optional[str]
    projectUuid: str
    spaceUuid: str
    pinnedListUuid: Optional[str]
    spaceName: str
    chartType: Optional[str]
    dashboardUuid: Optional[str]
    dashboardName: Optional[str]


class LightdashDashboard(BaseModel):
    organizationUuid: str
    name: str
    description: Optional[str]
    uuid: str
    projectUuid: str
    updatedAt: str
    spaceUuid: str
    views: float
    firstViewedAt: str
    pinnedListUuid: Optional[str]
    pinnedListOrder: Optional[float]
    charts: Optional[List[LightdashChart]]


class LightdashChartList(BaseModel):
    charts: Optional[List[LightdashChart]]


class LightdashDashboardList(BaseModel):
    dashboards: Optional[List[LightdashDashboard]]
