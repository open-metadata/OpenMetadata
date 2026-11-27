/*
 *  Copyright 2026 Collate.
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

package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.http.HttpResponse;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.CsvJobClient;

/** The column documentation the bulk import page shows for the type it imports into. */
@Execution(ExecutionMode.CONCURRENT)
public class CsvDocumentationResourceIT {
  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final CsvJobClient CLIENT = CsvJobClient.onDefaultServer();

  @Test
  void test_glossaryTermImportGetsTheGlossaryDocumentation() throws Exception {
    HttpResponse<String> glossary = CLIENT.request("GET", "/v1/csv/documentation/glossary", null);
    HttpResponse<String> glossaryTerm =
        CLIENT.request("GET", "/v1/csv/documentation/glossaryTerm", null);

    assertEquals(200, glossaryTerm.statusCode(), glossaryTerm.body());
    JsonNode termDocumentation = MAPPER.readTree(glossaryTerm.body());
    assertFalse(termDocumentation.path("headers").isEmpty());
    assertEquals(MAPPER.readTree(glossary.body()), termDocumentation);
  }

  @Test
  void test_unknownEntityTypeIsNotFound() throws Exception {
    HttpResponse<String> response =
        CLIENT.request("GET", "/v1/csv/documentation/notAnEntityType", null);

    assertEquals(404, response.statusCode(), response.body());
  }
}
