"""
CSV import/export mixin for OpenMetadata client.
"""
import logging
from typing import Dict, Type, TypeVar

from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.glossary import Glossary
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.entity.teams.team import Team
from metadata.generated.schema.entity.teams.user import User
from metadata.ingestion.ometa.client import APIError

logger = logging.getLogger(__name__)

T = TypeVar("T")


class CSVMixin:
    """
    OpenMetadata API methods for CSV import and export operations.

    Implements export_csv and import_csv following the same pattern as Java SDK.
    """

    def export_csv(self, entity: Type[T], name: str) -> str:
        """
        Export entity data in CSV format.

        Args:
            entity: Entity type (e.g., Glossary, Team, User)
            name: Name of the entity to export

        Returns:
            CSV data as string
        """
        try:
            # Determine the API path based on entity type
            endpoint = self._get_csv_endpoint(entity)
            path = f"/{endpoint}/name/{name}/export"

            response = self.client.get(path)
            if isinstance(response, str):
                return response
            if isinstance(response, dict):
                return response.get("data", "")
            return getattr(response, "text", "")
        except APIError as err:
            logger.error(f"Failed to export CSV for {entity.__name__} '{name}': {err}")
            raise

    def export_csv_async(self, entity: Type[T], name: str) -> str:
        """
        Export entity data in CSV format asynchronously.

        Args:
            entity: Entity type
            name: Name of the entity to export

        Returns:
            Job ID for the async export
        """
        try:
            endpoint = self._get_csv_endpoint(entity)
            path = f"/{endpoint}/name/{name}/exportAsync"

            response = self.client.get(path)
            # The async endpoint returns a job ID
            if isinstance(response, dict):
                return response.get("jobId", "")
            return getattr(response, "text", str(response))
        except APIError as err:
            logger.error(
                f"Failed to start async CSV export for {entity.__name__} '{name}': {err}"
            )
            raise

    def import_csv(
        self, entity: Type[T], name: str, csv_data: str, dry_run: bool = False
    ) -> Dict:
        """
        Import entity data from CSV format.

        Args:
            entity: Entity type
            name: Name of the entity to import into
            csv_data: CSV data as string
            dry_run: If True, validate without actually importing

        Returns:
            Import result with statistics
        """
        try:
            endpoint = self._get_csv_endpoint(entity)
            path = f"/{endpoint}/name/{name}/import"
            if dry_run:
                path = f"{path}?dryRun=true"

            response = self.client.put(
                path,
                csv_data,
                headers={"Content-Type": "text/plain"},
            )

            if isinstance(response, dict):
                return response
            if isinstance(response, str):
                return {"message": response}
            return {"message": getattr(response, "text", "")}
        except APIError as err:
            logger.error(f"Failed to import CSV for {entity.__name__} '{name}': {err}")
            raise

    def import_csv_async(
        self, entity: Type[T], name: str, csv_data: str, dry_run: bool = False
    ) -> str:
        """
        Import entity data from CSV format asynchronously.

        Args:
            entity: Entity type
            name: Name of the entity to import into
            csv_data: CSV data as string
            dry_run: If True, validate without actually importing

        Returns:
            Job ID for the async import
        """
        try:
            endpoint = self._get_csv_endpoint(entity)
            path = f"/{endpoint}/name/{name}/importAsync"
            if dry_run:
                path = f"{path}?dryRun=true"

            response = self.client.put(
                path,
                csv_data,
                headers={"Content-Type": "text/plain"},
            )

            if isinstance(response, dict):
                return response.get("jobId", "")
            return getattr(response, "text", str(response))
        except APIError as err:
            logger.error(
                f"Failed to start async CSV import for {entity.__name__} '{name}': {err}"
            )
            raise

    def _get_csv_endpoint(self, entity: Type[T]) -> str:
        """
        Get the API endpoint for CSV operations based on entity type.

        Args:
            entity: Entity type

        Returns:
            API endpoint path
        """
        # Map entity types to their API endpoints
        entity_endpoints = {
            Glossary: "glossaries",
            Team: "teams",
            User: "users",
            Table: "tables",
            Database: "databases",
            DatabaseSchema: "databaseSchemas",
            DatabaseService: "databaseServices",
            # Add more entity types as needed
        }

        endpoint = entity_endpoints.get(entity)
        if not endpoint:
            raise ValueError(
                f"CSV operations not supported for entity type {entity.__name__}"
            )

        return endpoint
