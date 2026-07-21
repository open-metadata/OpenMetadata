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
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.data.OntologyBulkErrorCode;
import org.openmetadata.service.ontology.OntologyBulkCsvParser.ParsedCsv;

class OntologyBulkCsvParserTest {
  private final OntologyBulkCsvParser parser = new OntologyBulkCsvParser();

  @Test
  void parsesQuotedCsvWithoutLosingColumnIdentity() {
    final String csv =
        OntologyBulkTestFixtures.header()
            + "\nCREATE,1dfe700f-9172-4872-a2b3-d00f3df54ca6,Customer,Customer,"
            + "\"Customer, account holder\",,https://example.org/customer\n";

    final ParsedCsv parsed = parser.parse(csv);

    assertTrue(parsed.errors().isEmpty());
    assertEquals(1, parsed.totalRows());
    assertEquals("Customer, account holder", parsed.rows().getFirst().description());
  }

  @Test
  void reportsUnknownOrIncompleteHeadersAsTypedErrors() {
    final ParsedCsv parsed = parser.parse("action,termId,unexpected\nCREATE,id,value\n");

    assertEquals(1, parsed.errors().size());
    assertEquals(OntologyBulkErrorCode.INVALID_HEADER, parsed.errors().getFirst().getCode());
    assertTrue(parsed.rows().isEmpty());
  }
}
