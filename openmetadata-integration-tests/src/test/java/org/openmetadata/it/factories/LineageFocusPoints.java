/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.it.factories;

/**
 * The FQNs a lineage benchmark focuses on, one per level of the hierarchy the scene API drills
 * through, plus the two table shapes whose cost differs most.
 *
 * <p>Chosen by {@link LineageGraphLoader} rather than by the benchmark so every run focuses on the
 * same structural position in the graph — a p95 measured against a randomly chosen node is not
 * comparable to the next release's.
 */
public record LineageFocusPoints(
    String serviceFqn,
    String databaseFqn,
    String schemaFqn,
    String hubTableFqn,
    String leafTableFqn,
    String hubColumnFqn) {}
