/*
 *  Copyright 2025 Collate
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
package org.openmetadata.service.search.vector;

import org.openmetadata.service.search.vector.VectorDocBuilder.BodyTextExtractor;

/**
 * Explicit contract for an entity type that wants to contribute a typed body text extractor to
 * the vector embedding pipeline. Implementations are the single place where "this entity type
 * has a custom body text extractor" is declared; downstream distributions implement this
 * interface once per entity type and invoke {@link #register()} from a stable initialization
 * site (typically the owning {@code EntityRepository} static initializer so both server and CLI
 * lifecycles register the extractor exactly once).
 *
 * <p>This interface is intentionally tiny — it exists to document the shape of the contract and
 * let IDEs guide contributors, not to impose an inheritance hierarchy. The backing mechanism is
 * still {@link VectorDocBuilder#registerBodyTextExtractor(String, BodyTextExtractor)}; callers
 * that already use the raw registration hook keep working unchanged.
 */
public interface VectorBodyTextContributor {

  /**
   * Entity type key as used in the entity reference (for example {@code "table"},
   * {@code "contextMemory"}). Must match the value returned by {@code getEntityReference().getType()}
   * on instances of the contributed entity class and the key used in
   * {@code AvailableEntityTypes.LIST} — mismatches silently disable the custom extractor.
   */
  String entityType();

  /**
   * Typed body text extractor for this entity type. Runs on the hot path of every create / update
   * and every reembed iteration; implementations should be fast and side-effect free.
   */
  BodyTextExtractor extractor();

  /**
   * Register this contributor's extractor with the shared {@link VectorDocBuilder} registry.
   * Registration is idempotent, so calling it from a static initializer is safe even if the
   * owning class is loaded multiple times (for example, once in the server path and once in a
   * CLI subcommand).
   */
  default void register() {
    VectorDocBuilder.registerBodyTextExtractor(entityType(), extractor());
  }
}
