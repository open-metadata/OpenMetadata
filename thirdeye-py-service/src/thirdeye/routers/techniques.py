"""
Techniques Router - Cost optimization techniques showcase
"""
from fastapi import APIRouter, Depends, HTTPException
from typing import Optional
from loguru import logger

from thirdeye.constants.action_items import ACTION_ITEM_CATEGORIES

router = APIRouter(prefix="/api/v1/thirdeye/techniques", tags=["techniques"])


@router.get("")
async def get_techniques():
    """
    Get all available techniques for showcase
    """
    try:
        logger.info("Fetching all techniques for showcase")
        
        techniques = [
            {
                "id": category["id"],
                "title": category["title"],
                "description": category["description"],
                "subtitle": category["subtitle"],
                "icon": category["icon"],
                "color": category["color"],
                "priority": category["priority"],
                "action": category["action"],
                "category": category["category"],
                "enabled": True,  # Default to enabled
                "isActive": True  # Default to active
            }
            for category in ACTION_ITEM_CATEGORIES
        ]
        
        logger.success(f"Fetched {len(techniques)} techniques")
        return {
            "success": True,
            "data": techniques,
            "totalCount": len(techniques)
        }
        
    except Exception as e:
        logger.error(f"Error fetching techniques: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch techniques: {str(e)}")


@router.get("/{technique_id}")
async def get_technique_by_id(technique_id: str):
    """
    Get a single technique by ID
    """
    try:
        logger.info(f"Fetching technique by ID: {technique_id}")
        
        technique = next((cat for cat in ACTION_ITEM_CATEGORIES if cat["id"] == technique_id), None)
        
        if not technique:
            logger.warning(f"Technique not found: {technique_id}")
            raise HTTPException(status_code=404, detail="Technique not found")
        
        from datetime import datetime
        
        result = {
            "id": technique["id"],
            "title": technique["title"],
            "description": technique["description"],
            "subtitle": technique["subtitle"],
            "icon": technique["icon"],
            "color": technique["color"],
            "priority": technique["priority"],
            "action": technique["action"],
            "category": technique["category"],
            "enabled": True,
            "isActive": True,
            "createdAt": datetime.now().isoformat(),
            "updatedAt": datetime.now().isoformat()
        }
        
        logger.success(f"Found technique: {technique_id}")
        return {
            "success": True,
            "data": result
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching technique: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch technique: {str(e)}")


@router.get("/by-category/{category}")
async def get_techniques_by_category(category: str):
    """
    Get techniques by category (table/summary)
    """
    try:
        logger.info(f"Fetching techniques by category: {category}")
        
        techniques = [
            {
                "id": cat["id"],
                "title": cat["title"],
                "description": cat["description"],
                "subtitle": cat["subtitle"],
                "icon": cat["icon"],
                "color": cat["color"],
                "priority": cat["priority"],
                "action": cat["action"],
                "category": cat["category"],
                "enabled": True,
                "isActive": True
            }
            for cat in ACTION_ITEM_CATEGORIES
            if cat["category"] == category
        ]
        
        logger.success(f"Found {len(techniques)} techniques for category: {category}")
        return {
            "success": True,
            "data": techniques,
            "totalCount": len(techniques)
        }
        
    except Exception as e:
        logger.error(f"Error fetching techniques by category: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch techniques by category: {str(e)}")


@router.get("/stats/overview")
async def get_techniques_stats():
    """
    Get techniques statistics for overview
    """
    try:
        logger.info("Fetching techniques statistics")
        
        total_techniques = len(ACTION_ITEM_CATEGORIES)
        table_techniques = len([cat for cat in ACTION_ITEM_CATEGORIES if cat["category"] == "table"])
        summary_techniques = len([cat for cat in ACTION_ITEM_CATEGORIES if cat["category"] == "summary"])
        
        priority_breakdown = {}
        for cat in ACTION_ITEM_CATEGORIES:
            priority = cat["priority"]
            priority_breakdown[priority] = priority_breakdown.get(priority, 0) + 1
        
        stats = {
            "totalTechniques": total_techniques,
            "tableTechniques": table_techniques,
            "summaryTechniques": summary_techniques,
            "priorityBreakdown": priority_breakdown,
            "enabledTechniques": total_techniques,  # All enabled for showcase
            "activeTechniques": total_techniques  # All active for showcase
        }
        
        logger.success("Techniques statistics fetched successfully")
        return {
            "success": True,
            "data": stats
        }
        
    except Exception as e:
        logger.error(f"Error fetching techniques statistics: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch techniques statistics: {str(e)}")

