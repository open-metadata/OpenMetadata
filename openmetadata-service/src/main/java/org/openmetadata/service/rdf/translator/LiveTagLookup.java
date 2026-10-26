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
package org.openmetadata.service.rdf.translator;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.util.FullyQualifiedName;

/**
 * Resolves the tags or glossary terms that labels name. A label carries only an FQN and no deleted
 * flag, and a label to a tag whose classification or glossary was soft-deleted stays on its asset,
 * so the projection asks which of them are live. Nothing is cached: on several servers a cache
 * cannot see a delete or restore made on another one.
 */
@FunctionalInterface
public interface LiveTagLookup {

  /** The ids of the live entities of {@code entityType} among {@code fqns}, keyed by FQN. */
  Map<String, UUID> liveIds(String entityType, Set<String> fqns);

  static LiveTagLookup database() {
    return LiveTagLookup::readLiveIds;
  }

  private static Map<String, UUID> readLiveIds(final String entityType, final Set<String> fqns) {
    final Map<String, String> fqnByHash = new HashMap<>();
    fqns.forEach(fqn -> fqnByHash.put(FullyQualifiedName.buildHash(fqn), fqn));
    final Map<String, UUID> live = new HashMap<>();
    for (final EntityReference reference :
        Entity.getEntityRepository(entityType)
            .getDao()
            .findReferencesByNameHashes(List.copyOf(fqnByHash.keySet()), Include.NON_DELETED)) {
      final String fqn =
          fqnByHash.get(FullyQualifiedName.buildHash(reference.getFullyQualifiedName()));
      if (fqn != null) {
        live.put(fqn, reference.getId());
      }
    }
    return live;
  }
}
