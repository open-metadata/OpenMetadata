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

package org.openmetadata.service.fernet.rotation;

import com.fasterxml.jackson.core.JsonPointer;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import org.openmetadata.service.secrets.SecretOwner;

/**
 * The bound tokens at {@code fields} of {@code config} were written for {@code owner}.
 *
 * @param config the node the fields are relative to, as stored
 * @param owner who the secrets at those fields belong to
 * @param fields where in {@code config} the secrets are
 */
public record Anchor(JsonNode config, SecretOwner owner, List<JsonPointer> fields) {
  public Anchor {
    fields = List.copyOf(fields);
  }
}
