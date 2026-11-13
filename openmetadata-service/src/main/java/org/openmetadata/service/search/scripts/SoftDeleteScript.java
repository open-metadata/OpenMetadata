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
 * Sets the field that marks a document deleted, on docs in indexes whose capability names that
 * field: the top-level {@code deleted} by default, or an embedded one such as an incident's {@code
 * testCase.deleted}. Refuses to run against an index whose docs carry another deleted field or
 * none — the previous string-template version had no such guard and so polluted child docs of a
 * soft-deleted parent.
 *
 * <p>Also fixes a latent quoting bug: the legacy template was
 * {@code "ctx._source.put('deleted', '%s')"}, which wraps a boolean in single quotes — the
 * resulting field is a string {@code "true"} / {@code "false"} rather than a JSON boolean.
 * Consumers that read {@code _source.deleted} as a boolean (the UI does) accept both forms today
 * but a stricter parser would not.
 */
public record SoftDeleteScript(boolean deleted, String field) implements IndexUpdateScript {

  public SoftDeleteScript(boolean deleted) {
    this(deleted, EntityIndexCapability.FIELD_DELETED);
  }

  // An embedded field is set only where its parent object exists.
  @Override
  public String painless() {
    int lastDot = field.lastIndexOf('.');
    return lastDot < 0
        ? "ctx._source.put('" + field + "', " + deleted + ")"
        : "if (ctx._source."
            + field.substring(0, lastDot)
            + " != null) { ctx._source."
            + field
            + " = "
            + deleted
            + "; }";
  }

  @Override
  public Map<String, Object> params() {
    return Collections.emptyMap();
  }

  @Override
  public boolean compatibleWith(EntityIndexCapability capability) {
    return capability != null && field.equals(capability.deletedField());
  }
}
