/*
 *  Copyright 2024 Collate.
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
package org.openmetadata.service.security.policyevaluator;

import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Supplier;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityRepository;

/**
 * Batch-loads on-demand policy fields for a bulk authorization request. One instance is shared by
 * every {@link ResourceContext} in the request; the first entity whose policy reads a field triggers
 * a single batch load for the whole batch, and later reads of that field are no-ops. A field no
 * policy reads is never loaded.
 *
 * <p>This keeps fields with unbounded cardinality (currently tags) off the always-loaded
 * authorization set while still avoiding an N+1 across a bulk request. New fields are added by
 * registering another {@code field -> batch loader} entry — no change to {@link ResourceContext} or
 * its constructors.
 */
public final class BulkFieldHydrator {
  private final Map<String, Runnable> fieldLoaders;
  private final Set<String> hydratedFields = new HashSet<>();
  private Supplier<Map<UUID, List<TagLabel>>> policyTagLoader;
  private Map<UUID, List<TagLabel>> policyTags;

  public BulkFieldHydrator(Map<String, Runnable> fieldLoaders) {
    this.fieldLoaders = fieldLoaders;
  }

  /**
   * The hydrator for the tags of {@code entities}. Where inline children carry tags, a condition
   * reads the policy tags of the whole batch, loaded in one pass the first time it is needed.
   */
  public static <T extends EntityInterface<?>> BulkFieldHydrator forTags(
      EntityRepository<T> repository, Collection<T> entities) {
    List<T> batch = new ArrayList<>(entities);
    BulkFieldHydrator hydrator =
        new BulkFieldHydrator(Map.of(Entity.FIELD_TAGS, () -> repository.batchLoadTags(batch)));
    if (repository.hasNestedPolicyTags()) {
      hydrator.policyTagLoader = () -> repository.loadPolicyTags(batch);
    }
    return hydrator;
  }

  /** The policy tags of one entity of the batch, or null when this hydrator does not load them. */
  List<TagLabel> policyTags(UUID id) {
    if (policyTagLoader == null) {
      return null;
    }
    if (policyTags == null) {
      policyTags = policyTagLoader.get();
    }
    return policyTags.getOrDefault(id, List.of());
  }

  /** Runs the batch loader for {@code field} the first time it is requested in this request. */
  public void hydrate(String field) {
    if (hydratedFields.add(field)) {
      Runnable loader = fieldLoaders.get(field);
      if (loader != null) {
        loader.run();
      }
    }
  }
}
