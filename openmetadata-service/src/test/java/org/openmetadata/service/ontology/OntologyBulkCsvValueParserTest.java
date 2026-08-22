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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.data.OntologyBulkErrorCode;
import org.openmetadata.service.ontology.OntologyBulkCsvParser.CsvRow;
import org.openmetadata.service.ontology.OntologyBulkCsvValueParser.URIValue;
import org.openmetadata.service.ontology.OntologyBulkCsvValueParser.UUIDValue;

class OntologyBulkCsvValueParserTest {
  private static final String FIELD_NAME = "termId";
  private static final int ROW_NUMBER = 7;

  private CsvRow row() {
    return new CsvRow(ROW_NUMBER, "CREATE", null, "Customer", null, null, null, null);
  }

  @Test
  void iriWhitespaceIsTreatedAsInvalidNotBlank() {
    // nullOrEmpty does not trim, so a whitespace-only value is a non-empty,
    // malformed IRI rather than a blank (which the empty-string case covers).
    final URIValue result = OntologyBulkCsvValueParser.iri("   ", row());

    assertNull(result.value());
    assertNotNull(result.error());
  }

  @Test
  void iriEmptyReturnsNullValueAndNoError() {
    final URIValue result = OntologyBulkCsvValueParser.iri("", row());

    assertNull(result.value());
    assertNull(result.error());
  }

  @Test
  void iriAbsoluteParsesWithoutError() {
    final URIValue result = OntologyBulkCsvValueParser.iri("https://example.org/customer", row());

    assertNull(result.error());
    assertNotNull(result.value());
    assertEquals("https://example.org/customer", result.value().toString());
  }

  @Test
  void iriRelativeReportsInvalidIriMustBeAbsolute() {
    final URIValue result = OntologyBulkCsvValueParser.iri("customer/account", row());

    assertNotNull(result.error());
    assertEquals(OntologyBulkErrorCode.INVALID_IRI, result.error().getCode());
    assertEquals("IRI must be absolute", result.error().getMessage());
    assertEquals(ROW_NUMBER, result.error().getRowNumber());
  }

  @Test
  void iriMalformedReportsInvalidIriWithExceptionMessage() {
    final URIValue result = OntologyBulkCsvValueParser.iri("http://exa mple.org", row());

    assertNull(result.value());
    assertNotNull(result.error());
    assertEquals(OntologyBulkErrorCode.INVALID_IRI, result.error().getCode());
    assertNotNull(result.error().getMessage());
    assertTrue(result.error().getMessage().length() > 0);
  }

  @Test
  void uuidRequiredAndMissingReportsMissingRequiredValue() {
    final UUIDValue result = OntologyBulkCsvValueParser.uuid(null, true, row(), FIELD_NAME);

    assertNull(result.value());
    assertNotNull(result.error());
    assertEquals(OntologyBulkErrorCode.MISSING_REQUIRED_VALUE, result.error().getCode());
    assertEquals(FIELD_NAME + " must be a UUID", result.error().getMessage());
    assertEquals(ROW_NUMBER, result.error().getRowNumber());
  }

  @Test
  void uuidPresentButNonUuidReportsInvalidIdentifier() {
    final UUIDValue result = OntologyBulkCsvValueParser.uuid("not-a-uuid", true, row(), FIELD_NAME);

    assertNull(result.value());
    assertNotNull(result.error());
    assertEquals(OntologyBulkErrorCode.INVALID_IDENTIFIER, result.error().getCode());
    assertEquals(FIELD_NAME + " must be a UUID", result.error().getMessage());
  }

  @Test
  void uuidOptionalAndMissingReturnsNullValueAndNoError() {
    final UUIDValue result = OntologyBulkCsvValueParser.uuid("", false, row(), FIELD_NAME);

    assertNull(result.value());
    assertNull(result.error());
  }

  @Test
  void uuidValidParsesToUuidWithoutError() {
    final String identifier = "1dfe700f-9172-4872-a2b3-d00f3df54ca6";

    final UUIDValue result = OntologyBulkCsvValueParser.uuid(identifier, true, row(), FIELD_NAME);

    assertNull(result.error());
    assertEquals(UUID.fromString(identifier), result.value());
  }

  @Test
  void uuidOptionalButInvalidStillReportsInvalidIdentifier() {
    final UUIDValue result = OntologyBulkCsvValueParser.uuid("12345", false, row(), FIELD_NAME);

    assertNull(result.value());
    assertNotNull(result.error());
    assertEquals(OntologyBulkErrorCode.INVALID_IDENTIFIER, result.error().getCode());
  }
}
