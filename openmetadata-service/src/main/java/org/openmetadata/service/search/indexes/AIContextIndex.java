/*
 *  Copyright 2024 Collate
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
package org.openmetadata.service.search.indexes;

import java.util.Map;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.service.aicontext.AIContextBuilder;

/**
 * Mixin for search indexes whose entities carry a materialized AI Context (Context Profile). It is
 * auto-applied by {@link SearchIndex#buildSearchIndexDoc()} and writes the normalized structural
 * context (schema, primary/foreign keys, frequent joins) onto the search document so agents can
 * serve it fast alongside the entity, and query it (e.g. find tables whose foreign keys reference a
 * given column). The heavy knowledge edges (attached glossary/articles/metrics) are left to the
 * on-read {@code get_asset_context} assembler; only the cheap, entity-local structural context is
 * materialized here.
 */
public interface AIContextIndex extends SearchIndex {

  default void applyAIContextFields(Map<String, Object> doc) {
    if (getEntity() instanceof EntityInterface entity) {
      AIContextBuilder.applySearchFields(doc, entity);
    }
  }
}
