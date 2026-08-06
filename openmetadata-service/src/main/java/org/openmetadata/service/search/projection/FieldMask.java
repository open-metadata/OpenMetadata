/*
 *  Copyright 2026 Collate.
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
package org.openmetadata.service.search.projection;

import java.util.LinkedHashSet;
import java.util.Set;

/**
 * Which document paths a write is allowed to touch.
 *
 * <p>Top-level keys only, deliberately. A top-level key is replaced wholesale, which is what {@code
 * SearchClient.DEFAULT_UPDATE_SCRIPT} already does and what makes the write idempotent; nested-path
 * merges are an explicit non-goal. A path like {@code tier.tagFQN} is therefore covered by the key
 * {@code tier} — masking to a sub-field would imply a merge the writer cannot perform.
 */
public sealed interface FieldMask {

  boolean covers(String docPath);

  FieldMask union(FieldMask other);

  /** Every path — a full rebuild. */
  static FieldMask all() {
    return new All();
  }

  /** Only these top-level keys. An empty set covers nothing. */
  static FieldMask of(Set<String> docPaths) {
    return new Subset(Set.copyOf(docPaths));
  }

  /** The top-level key a path belongs to, so {@code tier.tagFQN} resolves to {@code tier}. */
  static String topLevelKeyOf(String docPath) {
    int dot = docPath.indexOf('.');
    return dot < 0 ? docPath : docPath.substring(0, dot);
  }

  record All() implements FieldMask {
    @Override
    public boolean covers(String docPath) {
      return true;
    }

    @Override
    public FieldMask union(FieldMask other) {
      return this; // ALL already subsumes anything
    }
  }

  record Subset(Set<String> docPaths) implements FieldMask {
    public Subset {
      docPaths = Set.copyOf(docPaths);
    }

    @Override
    public boolean covers(String docPath) {
      return docPaths.contains(topLevelKeyOf(docPath));
    }

    @Override
    public FieldMask union(FieldMask other) {
      if (other instanceof All) {
        return other;
      }
      Set<String> merged = new LinkedHashSet<>(docPaths);
      merged.addAll(((Subset) other).docPaths());
      return new Subset(merged);
    }
  }
}
