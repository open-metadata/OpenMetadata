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
"""OpenMetadata domain utilities.

In-memory helpers operating on OpenMetadata's data model, reusable across
service-source bases and features. A module belongs here when it satisfies
ALL of:

1. Knows OM concepts (operates on OM-generated types or OM-specific ideas).
2. Owns no I/O infrastructure. May use an INJECTED OM client for read-only
   queries; the client's lifecycle is the caller's.
3. Framework-independent — no topology, stages, or sinks.
4. Cross-cutting — used by more than one service-source base or feature.
"""
