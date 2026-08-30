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

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

import jakarta.ws.rs.NotFoundException;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entities.docStore.Document;

class PrivateDocumentTypeTest {
  @Test
  void hidesPrivateDocumentsFromTheGenericDocumentBoundary() {
    final Document savedQuery =
        new Document().withEntityType(PrivateDocumentType.SPARQL_QUERY.value());

    assertThrows(NotFoundException.class, () -> PrivateDocumentType.requirePublic(savedQuery));
  }

  @Test
  void allowsPublicDocumentTypesAndUnfilteredLists() {
    assertDoesNotThrow(() -> PrivateDocumentType.requirePublic("KnowledgePanel"));
    assertDoesNotThrow(() -> PrivateDocumentType.requirePublic((String) null));
  }
}
