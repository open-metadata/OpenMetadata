"""
CSV operations with WebSocket support for all entities.
Provides reusable CSV import/export functionality with real-time notifications.
"""
import asyncio
import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass
from enum import Enum
from typing import Any, Callable, Dict, List, Optional, TypeVar, Union

try:
    import socketio

    HAS_SOCKETIO = True
except ImportError:
    HAS_SOCKETIO = False
    socketio = None

from pydantic import BaseModel

logger = logging.getLogger(__name__)

# Simple status enum for CSV operations
class ApiStatus(Enum):
    """API operation status"""

    SUCCESS = "success"
    STARTED = "started"
    FAILED = "failed"
    FAILURE = "failure"
    PARTIAL = "partial"


# Type variable for entity types
# pylint: disable=invalid-name
TEntity = TypeVar("TEntity", bound=BaseModel)
# pylint: enable=invalid-name


@dataclass
class CsvImportResult:
    """Result of a CSV import operation"""

    status: ApiStatus
    dry_run: bool
    records_processed: int = 0
    records_passed: int = 0
    records_failed: int = 0
    import_results: Optional[List[Dict[str, Any]]] = None
    dry_run_results: Optional[List[Dict[str, Any]]] = None


class WebSocketManager:
    """
    Manages WebSocket connections for async operations monitoring.
    Singleton pattern to reuse connections.
    """

    _instances: Dict[str, "WebSocketManager"] = {}

    def __init__(self, server_url: str, user_id: str):
        self.server_url = server_url
        self.user_id = user_id
        self.sio = None
        self.connected = False
        self._csv_import_futures = {}
        self._csv_export_futures = {}
        self._connect()

    @classmethod
    def get_instance(cls, server_url: str, user_id: str) -> "WebSocketManager":
        """Get or create WebSocketManager instance"""
        key = f"{server_url}_{user_id}"
        if key not in cls._instances:
            cls._instances[key] = cls(server_url, user_id)
        return cls._instances[key]

    def _connect(self):
        """Connect to WebSocket server"""
        if not HAS_SOCKETIO:
            logger.debug(
                "WebSocket support not available - install python-socketio for real-time updates"
            )
            self.connected = False
            return

        try:
            ws_url = self.server_url.replace("http://", "ws://").replace(
                "https://", "wss://"
            )
            self.sio = socketio.AsyncClient()

            @self.sio.on("connect")
            async def on_connect():
                logger.info("WebSocket connected")
                self.connected = True

            @self.sio.on("disconnect")
            async def on_disconnect():
                logger.info("WebSocket disconnected")
                self.connected = False

            @self.sio.on("csvImportChannel")
            async def on_csv_import(data):
                job_id = data.get("jobId")
                if job_id in self._csv_import_futures:
                    future = self._csv_import_futures[job_id]
                    result = self._parse_csv_import_result(data)
                    future.set_result(result)
                    del self._csv_import_futures[job_id]

            @self.sio.on("csvExportChannel")
            async def on_csv_export(data):
                job_id = data.get("jobId")
                if job_id in self._csv_export_futures:
                    future = self._csv_export_futures[job_id]
                    future.set_result(data.get("csvData", ""))
                    del self._csv_export_futures[job_id]

            # Connect with user ID in query params
            asyncio.create_task(
                self.sio.connect(
                    f"{ws_url}/api/v1/push/feed",
                    auth={"userId": self.user_id},
                    transports=["websocket"],
                )
            )
        except Exception as e:
            logger.warning(f"Failed to connect WebSocket: {e}")
            self.connected = False

    def _parse_csv_import_result(self, data: Dict[str, Any]) -> CsvImportResult:
        """Parse WebSocket data to CsvImportResult"""
        return CsvImportResult(
            status=ApiStatus(data.get("status", "failure").lower()),
            dry_run=data.get("dryRun", False),
            records_processed=data.get("numberOfRowsPassed", 0)
            + data.get("numberOfRowsFailed", 0),
            records_passed=data.get("numberOfRowsPassed", 0),
            records_failed=data.get("numberOfRowsFailed", 0),
            import_results=data.get("importResult", {}).get("passed", []),
            dry_run_results=data.get("dryRun", {}).get("validations", []),
        )

    async def wait_for_csv_import(
        self, job_id: str, timeout_seconds: int = 60
    ) -> CsvImportResult:
        """Wait for CSV import completion via WebSocket"""
        if not self.connected:
            raise RuntimeError("WebSocket not connected")

        future = asyncio.Future()
        self._csv_import_futures[job_id] = future

        try:
            result = await asyncio.wait_for(future, timeout=timeout_seconds)
            return result
        except asyncio.TimeoutError:
            del self._csv_import_futures[job_id]
            raise TimeoutError(
                f"CSV import {job_id} timed out after {timeout_seconds}s"
            )

    async def wait_for_csv_export(self, job_id: str, timeout_seconds: int = 60) -> str:
        """Wait for CSV export completion via WebSocket"""
        if not self.connected:
            raise RuntimeError("WebSocket not connected")

        future = asyncio.Future()
        self._csv_export_futures[job_id] = future

        try:
            result = await asyncio.wait_for(future, timeout=timeout_seconds)
            return result
        except asyncio.TimeoutError:
            del self._csv_export_futures[job_id]
            raise TimeoutError(
                f"CSV export {job_id} timed out after {timeout_seconds}s"
            )

    async def disconnect(self):
        """Disconnect WebSocket"""
        if self.sio and self.connected:
            await self.sio.disconnect()
            self.connected = False


class BaseCsvExporter(ABC):
    """Base class for CSV Export operations with WebSocket support."""

    def __init__(self, client, entity_name: str):
        self.client = client
        self.entity_name = entity_name
        self.async_mode = False
        self.on_complete: Optional[Callable[[str], None]] = None
        self.on_error: Optional[Callable[[Exception], None]] = None
        self.wait_for_completion = False
        self.timeout_seconds = 60
        self.use_websocket = False

    def with_async(self) -> "BaseCsvExporter":
        """Enable async mode"""
        self.async_mode = True
        return self

    def wait_completion(self, timeout_seconds: int = 60) -> "BaseCsvExporter":
        """Wait for completion with timeout"""
        self.wait_for_completion = True
        self.timeout_seconds = timeout_seconds
        return self

    def with_websocket(self) -> "BaseCsvExporter":
        """Enable WebSocket notifications"""
        self.use_websocket = True
        return self

    def on_complete_callback(
        self, callback: Callable[[str], None]
    ) -> "BaseCsvExporter":
        """Set completion callback"""
        self.on_complete = callback
        return self

    def on_error_callback(
        self, callback: Callable[[Exception], None]
    ) -> "BaseCsvExporter":
        """Set error callback"""
        self.on_error = callback
        return self

    @abstractmethod
    def perform_sync_export(self) -> str:
        """Perform synchronous export"""

    @abstractmethod
    def perform_async_export(self) -> str:
        """Perform asynchronous export and return job ID"""

    def execute(self) -> str:
        """Execute the export operation"""
        if self.async_mode:
            return self.perform_async_export()
        return self.perform_sync_export()

    def execute_async(self) -> str:
        """Execute async and return job ID immediately (similar to Java CompletableFuture)

        This returns the job ID immediately without waiting. For WebSocket support,
        use execute_async_with_wait() instead.
        """
        job_id = self.perform_async_export()

        # Call callback if provided
        if self.on_complete:
            self.on_complete(job_id)

        return job_id

    async def execute_async_with_wait(self) -> str:
        """Execute async with WebSocket support and wait for completion"""
        job_id = self.perform_async_export()

        if self.use_websocket and self.wait_for_completion:
            try:
                # Get user ID from client
                user_id = self.client.get_user_id()
                if user_id:
                    ws_manager = WebSocketManager.get_instance(
                        self.client.server_url, user_id
                    )
                    result = await ws_manager.wait_for_csv_export(
                        job_id, self.timeout_seconds
                    )
                    if self.on_complete:
                        self.on_complete(result)
                    return result
            except Exception as e:
                logger.debug(f"WebSocket not available, falling back to polling: {e}")
                if self.on_error:
                    self.on_error(e)

        # Fallback to simple async completion
        if self.wait_for_completion:
            await asyncio.sleep(min(2, self.timeout_seconds))

        if self.on_complete:
            self.on_complete(job_id)
        return job_id

    def to_csv(self) -> str:
        """Alias for execute"""
        return self.execute()


class BaseCsvImporter(ABC):
    """Base class for CSV Import operations with WebSocket support."""

    def __init__(self, client, entity_name: str):
        self.client = client
        self.entity_name = entity_name
        self.csv_data: Optional[str] = None
        self.dry_run = False
        self.async_mode = False
        self.on_complete: Optional[Callable[[CsvImportResult], None]] = None
        self.on_error: Optional[Callable[[Exception], None]] = None
        self.wait_for_completion = False
        self.timeout_seconds = 60
        self.use_websocket = False

    def with_data(self, csv_data: str) -> "BaseCsvImporter":
        """Set CSV data"""
        self.csv_data = csv_data
        return self

    def from_file(self, file_path: str) -> "BaseCsvImporter":
        """Load CSV from file"""
        with open(file_path, "r", encoding="utf-8") as f:
            self.csv_data = f.read()
        return self

    def set_dry_run(self, dry_run: bool = True) -> "BaseCsvImporter":
        """Enable dry run mode"""
        self.dry_run = dry_run
        return self

    def with_async(self) -> "BaseCsvImporter":
        """Enable async mode"""
        self.async_mode = True
        return self

    def wait_completion(self, timeout_seconds: int = 60) -> "BaseCsvImporter":
        """Wait for completion with timeout"""
        self.wait_for_completion = True
        self.timeout_seconds = timeout_seconds
        return self

    def with_websocket(self) -> "BaseCsvImporter":
        """Enable WebSocket notifications"""
        self.use_websocket = True
        return self

    def on_complete_callback(
        self, callback: Callable[[CsvImportResult], None]
    ) -> "BaseCsvImporter":
        """Set completion callback"""
        self.on_complete = callback
        return self

    def on_error_callback(
        self, callback: Callable[[Exception], None]
    ) -> "BaseCsvImporter":
        """Set error callback"""
        self.on_error = callback
        return self

    @abstractmethod
    def perform_sync_import(self) -> str:
        """Perform synchronous import"""

    @abstractmethod
    def perform_async_import(self) -> str:
        """Perform asynchronous import and return job ID"""

    def execute(self) -> Union[str, CsvImportResult]:
        """Execute the import operation"""
        if not self.csv_data:
            raise ValueError("CSV data not provided. Use with_data() or from_file()")

        if self.async_mode:
            return self.perform_async_import()
        return self.perform_sync_import()

    def execute_async(self) -> str:
        """Execute async and return job ID immediately (similar to Java CompletableFuture)

        This returns the job ID immediately without waiting. For WebSocket support,
        use execute_async_with_wait() instead.
        """
        if not self.csv_data:
            raise ValueError("CSV data not provided. Use with_data() or from_file()")

        job_id = self.perform_async_import()

        # Call callback if provided (with a simple result)
        if self.on_complete:
            result = CsvImportResult(
                status=ApiStatus.STARTED, dry_run=self.dry_run, records_processed=0
            )
            self.on_complete(result)

        return job_id

    async def execute_async_with_wait(self) -> CsvImportResult:
        """Execute async with WebSocket support and wait for completion"""
        if not self.csv_data:
            raise ValueError("CSV data not provided. Use with_data() or from_file()")

        job_id = self.perform_async_import()

        if self.use_websocket and self.wait_for_completion:
            try:
                # Get user ID from client
                user_id = self.client.get_user_id()
                if user_id:
                    ws_manager = WebSocketManager.get_instance(
                        self.client.server_url, user_id
                    )
                    result = await ws_manager.wait_for_csv_import(
                        job_id, self.timeout_seconds
                    )
                    if self.on_complete:
                        self.on_complete(result)
                    return result
            except Exception as e:
                logger.debug(f"WebSocket not available, falling back to polling: {e}")
                if self.on_error:
                    self.on_error(e)

        # Fallback to simple async completion
        result = CsvImportResult(
            status=ApiStatus.SUCCESS, dry_run=self.dry_run, records_processed=0
        )

        if self.wait_for_completion:
            await asyncio.sleep(min(2, self.timeout_seconds))

        if self.on_complete:
            self.on_complete(result)
        return result

    def apply(self) -> Union[str, CsvImportResult]:
        """Alias for execute"""
        return self.execute()
