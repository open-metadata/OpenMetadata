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
package org.openmetadata.service.search.scripts;

import java.util.Collections;
import java.util.Map;
import org.openmetadata.service.search.capability.EntityIndexCapability;

/**
 * Sets the top-level {@code deleted} field on docs in indexes whose schema declares it. Refuses
 * to run against time-series indexes (no {@code deleted} field) — the previous string-template
 * version had no such guard and so polluted child docs of a soft-deleted parent.
 *
 * <p>Also fixes a latent quoting bug: the legacy template was
 * {@code "ctx._source.put('deleted', '%s')"}, which wraps a boolean in single quotes — the
 * resulting field is a string {@code "true"} / {@code "false"} rather than a JSON boolean.
 * Consumers that read {@code _source.deleted} as a boolean (the UI does) accept both forms today
 * but a stricter parser would not.
 */
public record SoftDeleteScript(boolean deleted) implements IndexUpdateScript {

  @Override
  public String painless() {
    return "ctx._source.put('deleted', " + deleted + ")";
  }

  @Override
  public Map<String, Object> params() {
    return Collections.emptyMap();
  }

  @Override
  public boolean compatibleWith(EntityIndexCapability capability) {
    return capability != null && capability.hasFieldDeleted();
  }
}
