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

import org.openmetadata.schema.api.data.OntologyBulkTemplate;
import org.openmetadata.schema.api.data.OntologyBulkTemplate.MediaType;

public final class OntologyBulkTemplateFactory {
  private static final String FILE_NAME = "ontology-bulk-template.csv";
  private static final String SAMPLE_ROW =
      "CREATE,00000000-0000-4000-8000-000000000001,Example Concept,Example Concept,"
          + "Describe the concept,,";

  private OntologyBulkTemplateFactory() {}

  public static OntologyBulkTemplate create() {
    final String header = String.join(",", OntologyBulkCsvParser.HEADERS);
    return new OntologyBulkTemplate()
        .withFileName(FILE_NAME)
        .withMediaType(MediaType.TEXT_CSV)
        .withHeaders(OntologyBulkCsvParser.HEADERS)
        .withCsv(header + System.lineSeparator() + SAMPLE_ROW + System.lineSeparator())
        .withMaximumSynchronousRows(OntologyBulkExecutionService.MAXIMUM_SYNCHRONOUS_ROWS);
  }
}
