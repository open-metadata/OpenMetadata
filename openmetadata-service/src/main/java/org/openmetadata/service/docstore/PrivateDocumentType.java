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

package org.openmetadata.service.docstore;

import jakarta.ws.rs.NotFoundException;
import java.util.Arrays;
import org.openmetadata.schema.entities.docStore.Document;

/** Document types that are available only through their owner-bound typed API. */
public enum PrivateDocumentType {
  SPARQL_QUERY("SparqlQuery");

  public static final String EXCLUDED_ENTITY_TYPE_FILTER = "excludedEntityType";
  private static final String NOT_FOUND_MESSAGE = "Document was not found";

  private final String entityType;

  PrivateDocumentType(final String entityType) {
    this.entityType = entityType;
  }

  public String value() {
    return entityType;
  }

  public static boolean isPrivate(final String entityType) {
    return Arrays.stream(values()).anyMatch(type -> type.entityType.equals(entityType));
  }

  public static void requirePublic(final String entityType) {
    if (isPrivate(entityType)) {
      throw new NotFoundException(NOT_FOUND_MESSAGE);
    }
  }

  public static void requirePublic(final Document document) {
    requirePublic(document.getEntityType());
  }
}
