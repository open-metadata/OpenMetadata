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

import java.util.UUID;
import org.openmetadata.schema.api.rdf.SavedSparqlQueries;
import org.openmetadata.schema.entities.docStore.Data;
import org.openmetadata.schema.entities.docStore.Document;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.docstore.PrivateDocumentType;
import org.openmetadata.service.util.FullyQualifiedName;

/** Converts the typed saved-query contract at the single dynamic Document.Data boundary. */
final class SavedSparqlQueryDocumentCodec {
  Document encode(final UUID userId, final SavedSparqlQueries savedQueries) {
    final String userKey = userId.toString();
    return new Document()
        .withName(userKey)
        .withFullyQualifiedName(documentFqn(userId))
        .withEntityType(PrivateDocumentType.SPARQL_QUERY.value())
        .withData(JsonUtils.convertValue(savedQueries, Data.class));
  }

  SavedSparqlQueries decode(final Document document) {
    requireSavedQueryDocument(document);
    return JsonUtils.convertValue(document.getData(), SavedSparqlQueries.class);
  }

  String documentFqn(final UUID userId) {
    return FullyQualifiedName.add(PrivateDocumentType.SPARQL_QUERY.value(), userId.toString());
  }

  private static void requireSavedQueryDocument(final Document document) {
    if (!PrivateDocumentType.SPARQL_QUERY.value().equals(document.getEntityType())) {
      throw new IllegalArgumentException(
          "Document '" + document.getFullyQualifiedName() + "' is not a saved SPARQL query");
    }
  }
}
