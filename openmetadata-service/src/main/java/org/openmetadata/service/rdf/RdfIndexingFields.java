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
package org.openmetadata.service.rdf;

import java.util.List;
import java.util.Set;
import org.openmetadata.service.Entity;
import org.openmetadata.service.rdf.translator.RdfPropertyMapper;

public final class RdfIndexingFields {

  private RdfIndexingFields() {}

  public static List<String> forEntityType(String entityType) {
    return forSupportedFields(Entity.getEntityRepository(entityType).getAllowedFieldsCopy());
  }

  static List<String> forSupportedFields(Set<String> supportedFields) {
    // The RDF mapper emits even fields absent from its JSON-LD contexts, so a search-index field
    // subset can silently remove triples. Start from the repository's complete field contract.
    return supportedFields.stream()
        .filter(field -> !RdfPropertyMapper.isIgnoredEntityField(field))
        .sorted()
        .toList();
  }
}
