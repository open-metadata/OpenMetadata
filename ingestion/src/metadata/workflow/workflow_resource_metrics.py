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
Module to capture resource metrics for workflow execution monitoring
"""

import os
from typing import Optional

import psutil


class WorkflowResourceMetrics:
    """Captures CPU and memory metrics for a workflow process and all its children."""

    def __init__(self, pid: Optional[int] = None):
        """Initialize metrics for the given process ID (defaults to current process)."""
        self.pid: int = pid or os.getpid()
        self._collect_metrics()

    def _collect_metrics(self):
        """Collect metrics for this process and all its children."""
        try:
            process = psutil.Process(self.pid)

            # Get memory and CPU for this process and all its children
            total_mem_rss = process.memory_info().rss
            total_cpu = process.cpu_percent(interval=1)
            process_count = 1
            total_threads = process.num_threads()  # Get thread count for main process

            # Is process is spawning other child processes via multiprocessing
            # then, include all child processes. This is needed to get aggregated
            # view of CPU and memory usage
            try:
                children = process.children(recursive=True)
                process_count += len(children)
                for child in children:
                    try:
                        total_mem_rss += child.memory_info().rss
                        total_cpu += child.cpu_percent(interval=0.1)
                        total_threads += (
                            child.num_threads()
                        )  # Add thread count for each child
                    except (psutil.NoSuchProcess, psutil.AccessDenied):
                        pass
            except Exception:
                pass

            # Get actual system memory info
            system_mem = psutil.virtual_memory()

            # Get CPU core information
            cpu_cores = psutil.cpu_count(logical=False)  # Physical cores
            cpu_logical = psutil.cpu_count(
                logical=True
            )  # Logical cores (with hyperthreading)

            # Store computed metrics
            self.cpu_usage_percent: float = total_cpu
            self.memory_used_rss_bytes: int = total_mem_rss
            self.memory_used_mb: float = total_mem_rss / (1024 * 1024)
            self.memory_total_mb: float = system_mem.total / (1024 * 1024)
            self.memory_usage_percent: float = (total_mem_rss / system_mem.total) * 100
            self.active_processes: int = process_count
            self.active_threads: int = total_threads
            self.system_cpu_cores: int = cpu_cores or 1
            self.system_cpu_threads: int = cpu_logical or 1

        except (psutil.NoSuchProcess, psutil.AccessDenied, Exception):
            # Fallback values if process metrics cannot be collected
            self.cpu_usage_percent = 0.0
            self.memory_used_rss_bytes = 0
            self.memory_used_mb = 0.0
            self.memory_total_mb = 0.0
            self.memory_usage_percent = 0.0
            self.active_processes = 0
            self.active_threads = 0
            self.system_cpu_cores = 1
            self.system_cpu_threads = 1

    def to_dict(self):
        """Return metrics as a dictionary."""
        return {
            "cpu_usage_percent": self.cpu_usage_percent,
            "memory_used_rss_bytes": self.memory_used_rss_bytes,
            "memory_used_mb": self.memory_used_mb,
            "memory_total_mb": self.memory_total_mb,
            "memory_usage_percent": self.memory_usage_percent,
            "active_processes": self.active_processes,
            "active_threads": self.active_threads,
            "system_cpu_cores": self.system_cpu_cores,
            "system_cpu_threads": self.system_cpu_threads,
        }

    def __str__(self):
        """String representation of metrics."""
        return (
            f"CPU: {self.cpu_usage_percent:.2f}% ({self.system_cpu_cores}c/{self.system_cpu_threads}t) | "
            f"Memory: {self.memory_used_mb:.2f}MB/{self.memory_total_mb:.2f}MB ({self.memory_usage_percent:.2f}%) | "
            f"Processes: {self.active_processes} | Threads: {self.active_threads}"
        )
