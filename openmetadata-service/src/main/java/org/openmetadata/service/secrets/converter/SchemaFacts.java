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

package org.openmetadata.service.secrets.converter;

import java.util.Set;

/** Schema-derived roots used by credential retarget protection. */
public final class SchemaFacts {
  private SchemaFacts() {}

  public static Set<String> passwordChildren(Class<?> owner, String property) {
    JsonSchemaRepository schemas = JsonSchemaRepository.getInstance();
    JsonSchemaRepository.Ref root = schemas.schemaFor(owner);
    JsonSchemaRepository.Ref schema = root == null ? null : schemas.property(root, property);
    return schema == null ? Set.of() : schemas.facts(schema).passwordChildren();
  }
}
