#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""
In-memory caching for sources that don't support filtering.
Uses Kubernetes native storage (ConfigMaps, PVCs) without external dependencies.
"""
import json
import os
import pickle
import tempfile
from typing import Any, Dict, List

from kubernetes import client
from kubernetes import config as k8s_config
from kubernetes.client.rest import ApiException

from metadata.ingestion.api.models import Either
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class KubernetesMemoryCache:
    """
    Cache implementation using Kubernetes native storage.

    Options:
    1. ConfigMap for small data (<1MB)
    2. PersistentVolumeClaim for larger data
    3. EmptyDir volume for ephemeral storage
    """

    def __init__(self, namespace: str = "openmetadata", cache_type: str = "pvc"):
        self.namespace = namespace
        self.cache_type = cache_type
        self._init_k8s_client()

    def _init_k8s_client(self):
        """Initialize Kubernetes client"""
        try:
            # Try in-cluster config first
            k8s_config.load_incluster_config()
        except:
            # Fallback to kubeconfig
            k8s_config.load_kube_config()

        self.core_v1 = client.CoreV1Api()

    def write_to_configmap(self, data: List[Either], key: str) -> str:
        """
        Write small datasets to ConfigMap (max ~1MB).
        Good for metadata-only caching.
        """
        # Serialize data
        serialized = json.dumps([self._serialize_either(e) for e in data], default=str)

        # Check size limit (ConfigMap has 1MB limit)
        if len(serialized.encode()) > 1024 * 1024:
            raise ValueError("Data too large for ConfigMap, use PVC instead")

        configmap_name = f"cache-{key.replace('/', '-')}"

        configmap = client.V1ConfigMap(
            metadata=client.V1ObjectMeta(
                name=configmap_name,
                namespace=self.namespace,
                labels={"app": "om-parallel", "type": "cache"},
            ),
            data={"entities": serialized},
        )

        try:
            self.core_v1.create_namespaced_config_map(
                namespace=self.namespace, body=configmap
            )
        except ApiException as e:
            if e.status == 409:  # Already exists
                self.core_v1.patch_namespaced_config_map(
                    name=configmap_name, namespace=self.namespace, body=configmap
                )

        return configmap_name

    def read_from_configmap(self, configmap_name: str) -> List[Either]:
        """Read data from ConfigMap"""
        try:
            cm = self.core_v1.read_namespaced_config_map(
                name=configmap_name, namespace=self.namespace
            )

            serialized = cm.data.get("entities", "[]")
            data = json.loads(serialized)

            # Reconstruct Either objects
            return [self._deserialize_either(d) for d in data]
        except Exception as e:
            logger.error(f"Failed to read ConfigMap {configmap_name}: {e}")
            return []

    def write_to_volume(
        self, data: List[Either], key: str, volume_path: str = "/cache"
    ) -> str:
        """
        Write to mounted volume (PVC or EmptyDir).
        This is used when running inside a pod.
        """
        # Ensure volume is mounted
        if not os.path.exists(volume_path):
            raise ValueError(f"Volume not mounted at {volume_path}")

        file_path = os.path.join(volume_path, f"{key}.pkl")
        os.makedirs(os.path.dirname(file_path), exist_ok=True)

        # Serialize using pickle for efficiency
        with open(file_path, "wb") as f:
            pickle.dump(data, f)

        logger.info(f"Cached {len(data)} entities to {file_path}")
        return file_path

    def read_from_volume(self, key: str, volume_path: str = "/cache") -> List[Either]:
        """Read from mounted volume"""
        file_path = os.path.join(volume_path, f"{key}.pkl")

        if not os.path.exists(file_path):
            logger.warning(f"Cache file not found: {file_path}")
            return []

        with open(file_path, "rb") as f:
            data = pickle.load(f)

        logger.info(f"Loaded {len(data)} entities from cache")
        return data

    def _serialize_either(self, either: Either) -> Dict[str, Any]:
        """Serialize Either object"""
        if either.right:
            return {
                "type": "right",
                "class": type(either.right).__name__,
                "data": either.right.model_dump()
                if hasattr(either.right, "model_dump")
                else str(either.right),
            }
        else:
            return {"type": "left", "error": str(either.left)}

    def _deserialize_either(self, data: Dict[str, Any]) -> Either:
        """Deserialize Either object"""
        if data["type"] == "right":
            # For simplicity, store as dict
            # In real implementation, reconstruct the actual class
            return Either(right=data["data"])
        else:
            return Either(left=data["error"])


class InMemorySourceCache:
    """
    In-memory cache that runs in the partition phase.
    Stores entities in memory and passes them to workers via Argo parameters.
    """

    def __init__(self, max_size_mb: int = 10):
        self.max_size_mb = max_size_mb
        self.cache: Dict[str, List[Dict]] = {}

    def should_use_memory(self, data: List[Either]) -> bool:
        """Check if data fits in memory limits"""
        # Estimate size
        sample = data[:100] if len(data) > 100 else data
        avg_size = sum(len(str(e)) for e in sample) / len(sample)
        estimated_size = avg_size * len(data) / (1024 * 1024)  # MB

        return estimated_size < self.max_size_mb

    def cache_entities(self, source_iter) -> Dict[str, Any]:
        """
        Cache all entities from source iteration.
        Returns metadata about the cache.
        """
        entities = []
        entity_index = {}

        for idx, either in enumerate(source_iter):
            if either.right:
                # Store simplified version
                entity_data = {
                    "idx": idx,
                    "type": type(either.right).__name__,
                    "fqn": getattr(either.right, "fullyQualifiedName", f"entity_{idx}"),
                    "data": either.right.model_dump()
                    if hasattr(either.right, "model_dump")
                    else str(either.right),
                }
                entities.append(entity_data)

                # Build index for efficient filtering
                if hasattr(either.right, "database"):
                    db = either.right.database.name
                    if db not in entity_index:
                        entity_index[db] = []
                    entity_index[db].append(idx)

        # Check if we should use in-memory
        if self.should_use_memory(entities):
            # Return as Argo parameter (JSON)
            return {
                "type": "memory",
                "entities": entities,
                "index": entity_index,
                "count": len(entities),
            }
        else:
            # Too large - need to use volume
            return {
                "type": "volume",
                "path": self._write_to_temp_volume(entities, entity_index),
                "count": len(entities),
            }

    def _write_to_temp_volume(self, entities: List[Dict], index: Dict) -> str:
        """Write to temporary volume for large datasets"""
        temp_dir = tempfile.mkdtemp(prefix="om_cache_")

        # Write entities
        with open(os.path.join(temp_dir, "entities.json"), "w") as f:
            json.dump(entities, f)

        # Write index
        with open(os.path.join(temp_dir, "index.json"), "w") as f:
            json.dump(index, f)

        return temp_dir


class ShardedMemoryAdapter:
    """
    Adapter that uses in-memory caching for sources without filtering.
    This runs in the Argo workflow.
    """

    def __init__(self, cache_metadata: Dict[str, Any]):
        self.cache_metadata = cache_metadata
        self.entities: List[Dict] = []
        self.index: Dict[str, List[int]] = {}
        self._load_cache()

    def _load_cache(self):
        """Load cached data based on type"""
        if self.cache_metadata["type"] == "memory":
            # Data is in the metadata itself
            self.entities = self.cache_metadata["entities"]
            self.index = self.cache_metadata["index"]
        elif self.cache_metadata["type"] == "volume":
            # Load from volume
            path = self.cache_metadata["path"]
            with open(os.path.join(path, "entities.json"), "r") as f:
                self.entities = json.load(f)
            with open(os.path.join(path, "index.json"), "r") as f:
                self.index = json.load(f)

    def get_entities_for_shard(self, shard_key: str) -> List[Dict]:
        """Get entities for a specific shard using index"""
        indices = self.index.get(shard_key, [])
        return [self.entities[i] for i in indices]
