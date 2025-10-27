"""ZI Score calculation service.

ZI Score (Zero Intelligence Score) is a health metric for data infrastructure
based on storage efficiency, compute optimization, and query performance.

The score is calculated from v_datalake_health_metrics view which combines:
- Utilization Rate (40% weight): Active tables vs total tables
- Storage Efficiency (35% weight): Active storage vs total storage
- Access Freshness (25% weight): Recently accessed tables
"""

from typing import Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from loguru import logger

from thirdeye.repo import om_read, te_write


class ZIScoreService:
    """Service for calculating ZI Score metrics."""
    
    def __init__(self, om_session: AsyncSession, te_session: AsyncSession):
        """
        Initialize ZI Score service.
        
        Args:
            om_session: OpenMetadata database session (read-only)
            te_session: ThirdEye database session (read-write)
        """
        self.om_session = om_session
        self.te_session = te_session
    
    async def calculate(self) -> Dict[str, Any]:
        """
        Calculate current ZI Score from v_datalake_health_metrics view.
        
        Returns:
            ZI Score breakdown with:
            - overall: Overall health score (0-100)
            - breakdown: Component percentages for UI gauge
            - storageScore: Storage efficiency (0-100)
            - computeScore: Utilization rate (0-100)
            - queryScore: Access freshness (0-100)
            - trend: Trend indicator (placeholder for now)
            - metadata: Additional context metrics
        """
        logger.info("Calculating ZI Score from health metrics view")
        
        # Get health metrics from ThirdEye view
        metrics = await te_write.get_health_metrics(self.te_session)
        
        if not metrics:
            logger.warning("No health metrics available, returning fallback values")
            # Return fallback data if view has no data yet
            return {
                "overall": 0.0,
                "breakdown": {
                    "storage": 0.0,
                    "compute": 0.0,
                    "query": 0.0,
                    "others": 0.0,
                },
                "storageScore": 0.0,
                "computeScore": 0.0,
                "queryScore": 0.0,
                "trend": "unknown",
                "status": "NO_DATA",
                "metadata": {
                    "message": "No data available. Please ensure fact_datalake_table_usage_inventory has data.",
                },
            }
        
        # Extract component scores
        overall_score = metrics["health_score"]
        storage_efficiency = metrics["storage_efficiency"]
        utilization_rate = metrics["utilization_rate"]
        access_freshness = metrics["access_freshness"]
        
        # Get breakdown percentages (already calculated in the view)
        # These represent the contribution of each component to the overall score
        breakdown_storage = metrics["breakdown_storage"]
        breakdown_compute = metrics["breakdown_compute"]
        breakdown_query = metrics["breakdown_query"]
        breakdown_others = metrics["breakdown_others"]
        
        # Determine trend based on health status
        # TODO: In future, compare with historical scores from fact_health_score_history
        status = metrics["health_status"]
        if status == "EXCELLENT":
            trend = "excellent"
        elif status == "GOOD":
            trend = "improving"
        elif status == "FAIR":
            trend = "stable"
        else:  # POOR or CRITICAL
            trend = "declining"
        
        result = {
            "overall": overall_score,
            "breakdown": {
                # Convert breakdown values to percentages for the UI gauge
                # The view already gives us the weighted contributions (0-35 scale)
                # We need to convert them to percentages that sum to 100
                "storage": round(breakdown_storage, 1),
                "compute": round(breakdown_compute, 1),
                "query": round(breakdown_query, 1),
                "others": round(breakdown_others, 1),
            },
            "storageScore": storage_efficiency,
            "computeScore": utilization_rate,
            "queryScore": access_freshness,
            "trend": trend,
            "status": status,
            "metadata": {
                "totalTables": metrics["total_tables"],
                "activeTables": metrics["active_tables"],
                "inactiveTables": metrics["inactive_tables"],
                "totalStorageTB": metrics["total_storage_tb"],
                "wasteStorageTB": metrics["waste_storage_tb"],
                "wastePercentage": metrics["waste_percentage"],
                "monthlyCostUSD": metrics["total_monthly_cost_usd"],
                "monthlySavingsOpportunityUSD": metrics["monthly_savings_opportunity_usd"],
                "annualSavingsOpportunityUSD": metrics["annual_savings_opportunity_usd"],
                "zombieTables": metrics["zombie_tables"],
                "zombiePercentage": metrics["zombie_percentage"],
                "staleTables": metrics["stale_tables"],
                "stalePercentage": metrics["stale_percentage"],
                "calculatedAt": str(metrics["calculated_at"]) if metrics["calculated_at"] else None,
            },
        }
        
        logger.info(
            f"ZI Score calculated: overall={overall_score:.1f}, "
            f"status={status}, "
            f"savings_opportunity=${metrics['annual_savings_opportunity_usd']:.0f}/year"
        )
        
        return result
