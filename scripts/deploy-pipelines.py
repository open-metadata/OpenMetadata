"""
Deploy Ingestion Pipelines Script

This script uses the OpenMetadata client to:
1. Paginate over ingestion pipelines in groups of 20
2. Fetch the IDs of those IngestionPipelines  
3. Send bulk deploy requests to api/v1/services/ingestionPipelines/bulk/deploy
4. Track responses to monitor deployment success/failure
"""

import argparse
import json
import logging
import sys
from typing import Dict, List
from uuid import UUID

from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.services.ingestionPipelines.ingestionPipeline import (
    IngestionPipeline,
)
from metadata.generated.schema.entity.services.ingestionPipelines.pipelineServiceClientResponse import (
    PipelineServiceClientResponse,
)
from metadata.generated.schema.security.client.openMetadataJWTClientConfig import (
    OpenMetadataJWTClientConfig,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.ometa.utils import model_str

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


class PipelineDeployer:
    """Class to handle bulk deployment of ingestion pipelines"""
    
    def __init__(self, server_url: str, jwt_token: str):
        """
        Initialize the PipelineDeployer with OpenMetadata connection
        
        Args:
            server_url: OpenMetadata server URL
            jwt_token: JWT token for authentication
        """
        # Remove trailing slash if present
        self.server_url = server_url.rstrip('/')
        
        # Configure OpenMetadata connection
        server_config = OpenMetadataConnection(
            hostPort=self.server_url,
            authProvider="openmetadata",
            securityConfig=OpenMetadataJWTClientConfig(jwtToken=jwt_token),
        )
        
        self.metadata = OpenMetadata(server_config)
        logger.info(f"Connected to OpenMetadata server: {server_url}")
    
    def bulk_deploy_pipelines(self, pipeline_ids: List[str]) -> List[PipelineServiceClientResponse]:
        """
        Send bulk deploy request to OpenMetadata API
        
        Args:
            pipeline_ids: List of pipeline UUIDs to deploy
            
        Returns:
            List of PipelineServiceClientResponse objects
        """
        if not pipeline_ids:
            logger.warning("No pipeline IDs provided for deployment")
            return []
        
        logger.info(f"Deploying {len(pipeline_ids)} pipelines...")
        
        try:
            # Make POST request to bulk deploy endpoint
            response = self.metadata.client.post(
                "/services/ingestionPipelines/bulk/deploy",
                data=json.dumps(pipeline_ids),
            )
            
            if response:
                # Parse response data into Pydantic models
                parsed_responses = [
                    PipelineServiceClientResponse.model_validate(item)
                    for item in response
                ]
                logger.info(f"Bulk deploy request completed with {len(parsed_responses)} responses")
                return parsed_responses
            else:
                logger.error("No response from bulk deploy API")
                return []
                
        except Exception as e:
            logger.error(f"Error during bulk deployment: {e}")
            raise
    
    def analyze_deployment_results(
        self, 
        responses: List[PipelineServiceClientResponse],
        pipeline_ids: List[UUID]
    ) -> Dict[str, int]:
        """
        Analyze deployment responses to track success/failure
        
        Args:
            responses: List of PipelineServiceClientResponse objects
            pipeline_ids: List of pipeline IDs that were deployed (for correlation)
            
        Returns:
            Dictionary with deployment statistics
        """
        stats = {
            "total": len(responses),
            "success": 0,
            "failed": 0,
            "unknown": 0
        }
        
        success_codes = {200, 201}  # HTTP success codes
        
        # Correlate responses with pipeline IDs (assuming same order)
        for i, response in enumerate(responses):
            pipeline_id = pipeline_ids[i] if i < len(pipeline_ids) else "unknown"
            code = response.code
            reason = response.reason or ""
            platform = response.platform
            version = response.version or "unknown"
            
            if code in success_codes:
                stats["success"] += 1
                logger.info(f"✓ Pipeline {pipeline_id} deployed successfully on {platform} v{version} (code: {code})")
            elif code:
                stats["failed"] += 1
                logger.warning(f"✗ Pipeline {pipeline_id} deployment failed on {platform} v{version} (code: {code}): {reason}")
            else:
                stats["unknown"] += 1
                logger.warning(f"? Pipeline {pipeline_id} unknown deployment status on {platform}: {response.model_dump()}")
        
        return stats
    
    def deploy_all_pipelines(self, batch_size: int = 20) -> Dict[str, int]:
        """
        Main method to deploy all ingestion pipelines
        
        Args:
            batch_size: Size of batches for pagination and deployment
            
        Returns:
            Dictionary with overall deployment statistics
        """
        try:
            # Fetch all pipelines
            pipelines = list(self.metadata.list_all_entities(entity=IngestionPipeline, skip_on_failure=True))

            if not pipelines:
                logger.warning("No pipelines found to deploy")
                return {"total": 0, "success": 0, "failed": 0, "unknown": 0}

            logger.info("Found %d pipelines to deploy", len(pipelines))
            
            # Extract pipeline IDs
            pipeline_ids = [model_str(pipeline.id) for pipeline in pipelines]
            
            if not pipeline_ids:
                logger.error("No valid pipeline IDs found")
                return {"total": 0, "success": 0, "failed": 0, "unknown": 0}
            
            # Deploy pipelines in batches
            all_responses = []
            total_batches = (len(pipeline_ids) + batch_size - 1) // batch_size
            
            for i in range(0, len(pipeline_ids), batch_size):
                batch = pipeline_ids[i:i+batch_size]
                batch_num = i//batch_size + 1
                remaining_batches = total_batches - batch_num
                
                logger.info(f"Deploying batch {batch_num}/{total_batches} with {len(batch)} pipelines... ({remaining_batches} chunks remaining)")
                
                batch_responses = self.bulk_deploy_pipelines(batch)
                all_responses.extend(batch_responses)
                
                # Log parsed responses for this batch
                logger.info(f"Batch {batch_num} responses:")
                for j, response in enumerate(batch_responses):
                    pipeline_id = batch[j] if j < len(batch) else "unknown"
                    logger.info(f"  Pipeline {pipeline_id}: code={response.code}, platform={response.platform}, reason={response.reason or 'N/A'}")
                
                logger.info(f"Batch {batch_num} completed. Progress: {batch_num}/{total_batches} batches processed")
            
            # Analyze results - correlate responses with the pipeline IDs we sent
            stats = self.analyze_deployment_results(all_responses, pipeline_ids)
            
            logger.info("=== Deployment Summary ===")
            logger.info(f"Total pipelines: {stats['total']}")
            logger.info(f"Successfully deployed: {stats['success']}")
            logger.info(f"Failed deployments: {stats['failed']}")
            logger.info(f"Unknown status: {stats['unknown']}")
            
            return stats
            
        except Exception as e:
            logger.error(f"Deployment process failed: {e}")
            raise


def main():
    """Main function to run the pipeline deployment script"""
    parser = argparse.ArgumentParser(
        description="Deploy all ingestion pipelines using OpenMetadata bulk deploy API"
    )
    parser.add_argument(
        "--server-url",
        required=True,
        help="OpenMetadata server URL (e.g., http://localhost:8585/api/)"
    )
    parser.add_argument(
        "--jwt-token", 
        required=True,
        help="JWT token for authentication"
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=20,
        help="Batch size for pagination and deployment (default: 20)"
    )
    parser.add_argument(
        "--verbose",
        "-v",
        action="store_true",
        help="Enable verbose logging"
    )
    
    args = parser.parse_args()
    logging.getLogger().setLevel(logging.INFO)
    
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
    
    try:
        deployer = PipelineDeployer(args.server_url, args.jwt_token)
        stats = deployer.deploy_all_pipelines(batch_size=args.batch_size)
        
        # Exit with error code if any deployments failed
        if stats["failed"] > 0:
            sys.exit(1)
        else:
            sys.exit(0)
            
    except Exception as e:
        logger.error(f"Script failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()