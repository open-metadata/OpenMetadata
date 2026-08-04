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

package org.openmetadata.service.ontology;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

import jakarta.ws.rs.BadRequestException;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.data.OntologyBulkMatchField;
import org.openmetadata.schema.api.data.OntologyBulkMatchMode;
import org.openmetadata.schema.api.data.OntologyBulkRequest;
import org.openmetadata.schema.entity.data.RelationshipType;

class OntologyBulkRequestValidatorTest {
  private final OntologyBulkRequestValidator validator = new OntologyBulkRequestValidator();

  @Test
  void acceptsEachDiscriminatedPayload() {
    final RelationshipType source = OntologyBulkTestFixtures.relationshipType("broader");
    final RelationshipType target = OntologyBulkTestFixtures.relationshipType("relatedTo");

    assertDoesNotThrow(
        () ->
            validator.validate(
                OntologyBulkTestFixtures.glossary(),
                OntologyBulkTestFixtures.csvRequest(
                    OntologyBulkTestFixtures.header() + "\n", true)));
    assertDoesNotThrow(
        () ->
            validator.validate(
                OntologyBulkTestFixtures.glossary(),
                OntologyBulkTestFixtures.findRequest(
                    OntologyBulkMatchField.DESCRIPTION,
                    OntologyBulkMatchMode.CONTAINS,
                    "customer",
                    "client",
                    false,
                    true)));
    assertDoesNotThrow(
        () ->
            validator.validate(
                OntologyBulkTestFixtures.glossary(),
                OntologyBulkTestFixtures.retypeRequest(source, target)));
  }

  @Test
  void rejectsMixedPayloadsAndReadOnlyModels() {
    final OntologyBulkRequest mixed =
        OntologyBulkTestFixtures.findRequest(
                OntologyBulkMatchField.NAME,
                OntologyBulkMatchMode.EXACT,
                "Customer",
                "Client",
                true,
                true)
            .withCsv(OntologyBulkTestFixtures.header());
    final OntologyBulkRequest csv =
        OntologyBulkTestFixtures.csvRequest(OntologyBulkTestFixtures.header() + "\n", true);

    assertThrows(
        BadRequestException.class,
        () -> validator.validate(OntologyBulkTestFixtures.glossary(), mixed));
    assertThrows(
        BadRequestException.class,
        () -> validator.validate(OntologyBulkTestFixtures.readOnlyGlossary(), csv));
  }
}
