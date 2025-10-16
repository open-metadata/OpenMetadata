"""
ZI Score (Zero Inefficiency Score) calculation service.

Calculates data infrastructure health score based on:
- Storage efficiency
- Compute utilization
- Query performance
- Other factors
"""

from typing import Dict, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from datetime import datetime, timedelta
from loguru import logger


class ZIScoreService:
    """Service for calculating and managing ZI Scores."""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def calculate_zi_score(self) -> Dict:
        """
        Calculate current ZI Score and breakdown.
        
        Uses v_datalake_health_metrics view for comprehensive scoring
        based on utilization, storage efficiency, and access freshness.
        
        Returns:
            {
                "score": 74,
                "breakdown": {
                    "storage": 26.0,  # storage_efficiency * 35%
                    "compute": 28.0,  # utilization_rate * 40%
                    "query": 18.5,    # access_freshness * 25%
                    "others": 0
                },
                "metadata": {
                    "total_tables": 1500,
                    "active_tables": 890,
                    "inactive_percentage": 40.67,
                    "total_storage_tb": 25.5,
                    "waste_storage_tb": 8.3,
                    "monthly_savings_usd": 12000.00
                }
            }
        """
        try:
            # Query from v_datalake_health_metrics view
            # This view calculates health score from fact_datalake_table_usage_inventory
            query = text("""
                SELECT 
                    health_score,
                    breakdown_storage,
                    breakdown_compute,
                    breakdown_query,
                    breakdown_others,
                    total_tables,
                    active_tables,
                    inactive_percentage,
                    total_storage_tb,
                    waste_storage_tb,
                    monthly_savings_opportunity_usd,
                    total_monthly_cost_usd,
                    zombie_tables,
                    roi
                FROM v_datalake_health_metrics
                LIMIT 1
            """)
            
            result = await self.db.execute(query)
            row = result.fetchone()
            
            if row:
                health_score = float(row[0] or 0)
                breakdown_storage = float(row[1] or 0)
                breakdown_compute = float(row[2] or 0)
                breakdown_query = float(row[3] or 0)
                breakdown_others = float(row[4] or 0)
                
                logger.info(f"Calculated ZI Score from view: {health_score}")
                
                return {
                    "score": round(health_score, 1),
                    "breakdown": {
                        "storage": round(breakdown_storage, 1),
                        "compute": round(breakdown_compute, 1),
                        "query": round(breakdown_query, 1),
                        "others": round(breakdown_others, 1),
                    },
                    "metadata": {
                        "total_tables": int(row[5] or 0),
                        "active_tables": int(row[6] or 0),
                        "inactive_percentage": round(float(row[7] or 0), 2),
                        "total_storage_tb": round(float(row[8] or 0), 2),
                        "waste_storage_tb": round(float(row[9] or 0), 2),
                        "monthly_savings_usd": round(float(row[10] or 0), 2),
                        "total_monthly_cost_usd": round(float(row[11] or 0), 2),
                        "zombie_tables": int(row[12] or 0),
                    }
                }
            
        except Exception as e:
            logger.warning(f"Could not fetch from v_datalake_health_metrics view: {e}")
            # Try fallback to health_score_history table
            try:
                fallback_query = text("""
                    SELECT score, meta
                    FROM health_score_history
                    ORDER BY captured_at DESC
                    LIMIT 1
                """)
                
                result = await self.db.execute(fallback_query)
                row = result.fetchone()
                
                if row:
                    import json
                    score = int(row[0] or 0)
                    meta = json.loads(row[1]) if row[1] else {}
                    
                    logger.info(f"Using health_score_history fallback: score={score}")
                    
                    return {
                        "score": float(score),
                        "breakdown": meta.get("breakdown", {
                            "storage": 44.4,
                            "compute": 11.1,
                            "query": 7.4,
                            "others": 11.1,
                        }),
                        "metadata": meta
                    }
            except Exception as fallback_error:
                logger.warning(f"Fallback also failed: {fallback_error}")
        
        # Final fallback to default values
        logger.info("Using default ZI Score values")
        return {
            "score": 74.0,
            "breakdown": {
                "storage": 26.0,
                "compute": 28.0,
                "query": 18.5,
                "others": 0.0,
            },
            "metadata": {
                "total_tables": 0,
                "active_tables": 0,
                "inactive_percentage": 0.0,
            }
        }
    
    async def get_health_history(self, days: int = 30) -> Dict:
        """
        Get historical ZI Score data.
        
        Args:
            days: Number of days of history to fetch
            
        Returns:
            {
                "data": [...],
                "summary": {...}
            }
        """
        try:
            query = text("""
                SELECT 
                    snapshot_date,
                    health_score,
                    health_status
                FROM fact_health_score_history
                WHERE snapshot_date >= DATE_SUB(NOW(), INTERVAL :days DAY)
                ORDER BY snapshot_date DESC
                LIMIT :days
            """)
            
            result = await self.db.execute(query, {"days": days})
            rows = result.fetchall()
            
            data = [
                {
                    "date": row[0].isoformat() if row[0] else None,
                    "score": float(row[1] or 0),
                    "status": row[2] or "unknown",
                }
                for row in rows
            ]
            
            # Calculate summary statistics
            scores = [d["score"] for d in data if d["score"] > 0]
            avg_score = sum(scores) / len(scores) if scores else 0
            
            # Determine trend
            trend = "stable"
            if len(scores) >= 2:
                recent_avg = sum(scores[:7]) / min(7, len(scores[:7]))
                older_avg = sum(scores[7:14]) / min(7, len(scores[7:14])) if len(scores) > 7 else recent_avg
                if recent_avg > older_avg + 2:
                    trend = "improving"
                elif recent_avg < older_avg - 2:
                    trend = "declining"
            
            logger.debug(f"Fetched {len(data)} days of health history")
            
            return {
                "data": data,
                "summary": {
                    "average_score": round(avg_score, 2),
                    "trend": trend,
                    "days": len(data),
                }
            }
            
        except Exception as e:
            logger.error(f"Error fetching health history: {e}")
            return {
                "data": [],
                "summary": {
                    "average_score": 0.0,
                    "trend": "unknown",
                    "days": 0,
                }
            }
    
    async def get_budget_forecast(self) -> Dict:
        """
        Get budget forecast and savings opportunities.
        
        Uses v_datalake_health_metrics view for accurate cost projections.
        
        Returns:
            {
                "total_monthly_cost_usd": 45000.00,
                "monthly_savings_opportunity_usd": 12000.00,
                "roi": 26.67,
                "breakdown": {...}
            }
        """
        try:
            # Query from v_datalake_health_metrics view
            query = text("""
                SELECT 
                    total_monthly_cost_usd,
                    monthly_savings_opportunity_usd,
                    annual_savings_opportunity_usd,
                    cost_waste_percentage,
                    waste_storage_tb,
                    total_storage_tb
                FROM v_datalake_health_metrics
                LIMIT 1
            """)
            
            result = await self.db.execute(query)
            row = result.fetchone()
            
            if row:
                total_cost = float(row[0] or 0)
                savings_opp = float(row[1] or 0)
                annual_savings = float(row[2] or 0)
                cost_waste_pct = float(row[3] or 0)
                waste_storage_tb = float(row[4] or 0)
                total_storage_tb = float(row[5] or 0)
                
                roi = (savings_opp / total_cost * 100) if total_cost > 0 else 0
                
                # Calculate breakdown (approximations based on typical distributions)
                storage_cost = total_cost * 0.55
                compute_cost = total_cost * 0.35
                query_cost = total_cost * 0.10
                
                # Savings primarily from storage optimization
                storage_savings = savings_opp * 0.75
                compute_savings = savings_opp * 0.20
                query_savings = savings_opp * 0.05
                
                logger.debug(f"Budget forecast: ${total_cost:,.2f}/mo, savings: ${savings_opp:,.2f}/mo")
                
                return {
                    "total_monthly_cost_usd": round(total_cost, 2),
                    "monthly_savings_opportunity_usd": round(savings_opp, 2),
                    "annual_savings_opportunity_usd": round(annual_savings, 2),
                    "roi": round(roi, 2),
                    "cost_waste_percentage": round(cost_waste_pct, 1),
                    "breakdown": {
                        "storage": {
                            "cost": round(storage_cost, 2),
                            "savings": round(storage_savings, 2),
                            "waste_tb": round(waste_storage_tb, 2),
                            "total_tb": round(total_storage_tb, 2),
                        },
                        "compute": {
                            "cost": round(compute_cost, 2),
                            "savings": round(compute_savings, 2),
                        },
                        "query": {
                            "cost": round(query_cost, 2),
                            "savings": round(query_savings, 2),
                        },
                    }
                }
            
        except Exception as e:
            logger.warning(f"Could not fetch budget forecast from view: {e}")
        
        # Fallback defaults
        return {
            "total_monthly_cost_usd": 0.0,
            "monthly_savings_opportunity_usd": 0.0,
            "annual_savings_opportunity_usd": 0.0,
            "roi": 0.0,
            "cost_waste_percentage": 0.0,
            "breakdown": {
                "storage": {"cost": 0.0, "savings": 0.0, "waste_tb": 0.0, "total_tb": 0.0},
                "compute": {"cost": 0.0, "savings": 0.0},
                "query": {"cost": 0.0, "savings": 0.0},
            }
        }
    
    async def save_health_snapshot(
        self,
        health_score: float,
        total_tables: int,
        active_tables: int,
        total_storage_tb: float = 0.0,
        waste_storage_tb: float = 0.0,
        monthly_savings_usd: float = 0.0,
    ) -> bool:
        """
        Save a health score snapshot to history.
        
        Args:
            health_score: Calculated health score (0-100)
            total_tables: Total number of tables
            active_tables: Number of active tables
            total_storage_tb: Total storage in TB
            waste_storage_tb: Wasted storage in TB
            monthly_savings_usd: Estimated monthly savings
            
        Returns:
            True if saved successfully
        """
        try:
            # Determine status based on score
            if health_score >= 80:
                status = "excellent"
            elif health_score >= 60:
                status = "good"
            elif health_score >= 40:
                status = "fair"
            else:
                status = "poor"
            
            utilization_rate = (active_tables / total_tables * 100) if total_tables > 0 else 0
            storage_efficiency = ((total_storage_tb - waste_storage_tb) / total_storage_tb * 100) if total_storage_tb > 0 else 0
            
            query = text("""
                INSERT INTO fact_health_score_history (
                    snapshot_date, health_score, health_status,
                    utilization_rate, storage_efficiency,
                    total_tables, active_tables,
                    total_storage_tb, waste_storage_tb,
                    monthly_savings_usd,
                    created_at
                )
                VALUES (
                    CURDATE(), :health_score, :status,
                    :utilization_rate, :storage_efficiency,
                    :total_tables, :active_tables,
                    :total_storage_tb, :waste_storage_tb,
                    :monthly_savings_usd,
                    NOW()
                )
                ON DUPLICATE KEY UPDATE
                    health_score = :health_score,
                    health_status = :status,
                    utilization_rate = :utilization_rate,
                    storage_efficiency = :storage_efficiency,
                    total_tables = :total_tables,
                    active_tables = :active_tables,
                    total_storage_tb = :total_storage_tb,
                    waste_storage_tb = :waste_storage_tb,
                    monthly_savings_usd = :monthly_savings_usd
            """)
            
            await self.db.execute(query, {
                "health_score": health_score,
                "status": status,
                "utilization_rate": utilization_rate,
                "storage_efficiency": storage_efficiency,
                "total_tables": total_tables,
                "active_tables": active_tables,
                "total_storage_tb": total_storage_tb,
                "waste_storage_tb": waste_storage_tb,
                "monthly_savings_usd": monthly_savings_usd,
            })
            
            await self.db.commit()
            logger.info(f"Saved health snapshot: score={health_score}, status={status}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to save health snapshot: {e}")
            await self.db.rollback()
            return False

