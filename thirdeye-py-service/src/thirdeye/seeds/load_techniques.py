#!/usr/bin/env python
"""
Load optimization techniques from techniques_clean.json into database.

Based on: react-app-old/thirdeye/setup/techniques_clean.json
"""

import json
import asyncio
from pathlib import Path
from sqlalchemy import text
from loguru import logger
import sys

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from thirdeye.db import get_session


async def load_techniques_from_json(json_file: str) -> int:
    """
    Load techniques from JSON file into techniques table.
    
    Args:
        json_file: Path to techniques_clean.json
        
    Returns:
        Number of techniques loaded
    """
    logger.info(f"Loading techniques from: {json_file}")
    
    # Load JSON file
    with open(json_file, 'r', encoding='utf-8') as f:
        techniques = json.load(f)
    
    logger.info(f"Loaded {len(techniques)} techniques from JSON")
    
    async with get_session() as session:
        try:
            # Prepare INSERT statement
            insert_sql = text("""
                INSERT INTO techniques (
                    id, slug, title, category, subcategory,
                    impact_level, complexity, estimated_savings_pct, effort_minutes,
                    description, how_to_implement, code_snippet, success_indicators,
                    when_to_use, prerequisites, tags, last_reviewed, status, version
                ) VALUES (
                    :id, :slug, :title, :category, :subcategory,
                    :impact_level, :complexity, :estimated_savings_pct, :effort_minutes,
                    :description, :how_to_implement, :code_snippet, :success_indicators,
                    :when_to_use, :prerequisites, :tags, :last_reviewed, :status, :version
                )
                ON DUPLICATE KEY UPDATE
                    title = VALUES(title),
                    category = VALUES(category),
                    subcategory = VALUES(subcategory),
                    impact_level = VALUES(impact_level),
                    complexity = VALUES(complexity),
                    estimated_savings_pct = VALUES(estimated_savings_pct),
                    effort_minutes = VALUES(effort_minutes),
                    description = VALUES(description),
                    how_to_implement = VALUES(how_to_implement),
                    code_snippet = VALUES(code_snippet),
                    success_indicators = VALUES(success_indicators),
                    when_to_use = VALUES(when_to_use),
                    prerequisites = VALUES(prerequisites),
                    tags = VALUES(tags),
                    last_reviewed = VALUES(last_reviewed)
            """)
            
            # Insert each technique
            inserted = 0
            for technique in techniques:
                # Convert arrays to JSON strings for MySQL
                params = {
                    "id": technique["id"],
                    "slug": technique["slug"],
                    "title": technique["title"],
                    "category": technique["category"],
                    "subcategory": technique.get("subcategory"),
                    "impact_level": technique["impact_level"],
                    "complexity": technique["complexity"],
                    "estimated_savings_pct": technique["estimated_savings_pct"],
                    "effort_minutes": technique["effort_minutes"],
                    "description": technique["description"],
                    "how_to_implement": json.dumps(technique["how_to_implement"]),
                    "code_snippet": technique["code_snippet"],
                    "success_indicators": json.dumps(technique["success_indicators"]),
                    "when_to_use": technique["when_to_use"],
                    "prerequisites": json.dumps(technique["prerequisites"]),
                    "tags": json.dumps(technique["tags"]),
                    "last_reviewed": technique["last_reviewed"],
                    "status": technique["status"],
                    "version": technique["version"]
                }
                
                await session.execute(insert_sql, params)
                inserted += 1
                
                if inserted % 10 == 0:
                    logger.info(f"Inserted {inserted} / {len(techniques)} techniques...")
            
            await session.commit()
            logger.success(f"✅ Successfully loaded {inserted} techniques")
            return inserted
            
        except Exception as e:
            logger.error(f"Error loading techniques: {e}")
            await session.rollback()
            raise


async def get_techniques_stats():
    """Get statistics about loaded techniques."""
    async with get_session() as session:
        result = await session.execute(text("""
            SELECT 
                category,
                impact_level,
                COUNT(*) as count,
                AVG(estimated_savings_pct) as avg_savings,
                SUM(estimated_savings_pct) as total_potential_savings
            FROM techniques
            WHERE status = 'active'
            GROUP BY category, impact_level
            ORDER BY category, impact_level
        """))
        
        rows = result.fetchall()
        
        print("\n" + "="*70)
        print("TECHNIQUES STATISTICS")
        print("="*70)
        for row in rows:
            print(f"{row[0]:20} | {row[1]:15} | Count: {row[2]:3} | Avg: {row[3]:.1f}% | Total: {row[4]:.0f}%")
        print("="*70 + "\n")


if __name__ == "__main__":
    """
    Usage:
        python -m thirdeye.seeds.load_techniques path/to/techniques_clean.json
    """
    
    if len(sys.argv) < 2:
        # Default path
        json_file = Path(__file__).parent.parent.parent.parent.parent / \
                    "thirdeye-ui/react-app-old/thirdeye/setup/techniques_clean.json"
        
        if not json_file.exists():
            print("Usage: python -m thirdeye.seeds.load_techniques <json_file>")
            print("Example: python -m thirdeye.seeds.load_techniques ./techniques_clean.json")
            sys.exit(1)
    else:
        json_file = sys.argv[1]
    
    if not Path(json_file).exists():
        logger.error(f"File not found: {json_file}")
        sys.exit(1)
    
    # Load techniques
    count = asyncio.run(load_techniques_from_json(json_file))
    
    # Show stats
    asyncio.run(get_techniques_stats())
    
    logger.success(f"✅ Techniques load complete: {count} techniques loaded")

