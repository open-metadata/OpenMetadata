/*
 *  Copyright 2021 Collate
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

package org.openmetadata.it.tests.mcp;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeFalse;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.openmetadata.it.util.RdfAccessFixtures;
import org.openmetadata.it.util.RdfTestUtils;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.Entity;

/**
 * On a deployment without the RDF store the graph tools answer with a clear "not enabled" message
 * instead of a backend fault, for administrators and for callers who hold only the query grant. Runs
 * in the default lane: in the RDF lane the store is on and {@code RdfMcpKnowledgeGraphIT} covers the
 * tools.
 */
public class McpRdfNotEnabledIT extends McpTestBase {
  private static final String QUERY = "SELECT ?s WHERE { ?s ?p ?o } LIMIT 1";
  private static RdfAccessFixtures access;
  private static String grantedToken;

  @BeforeAll
  static void setUp() throws Exception {
    assumeFalse(RdfTestUtils.isRdfEnabled(), "The RDF lane covers the tools with the store on");
    initAuth();
    access = new RdfAccessFixtures("rdfoff");
    final var grant = access.allowRole(MetadataOperation.EXECUTE_SPARQL_QUERY, Entity.RDF);
    grantedToken = "Bearer " + access.userToken("granted", List.of(grant.getId()));
  }

  @AfterAll
  static void tearDown() {
    if (access != null) {
      access.close();
    }
  }

  @Test
  void anAdministratorIsToldTheGraphIsNotEnabled() throws Exception {
    assertNotEnabled(authToken);
  }

  @Test
  void aGrantedUserIsToldTheGraphIsNotEnabled() throws Exception {
    assertNotEnabled(grantedToken);
  }

  private void assertNotEnabled(final String token) throws Exception {
    final JsonNode result =
        executeMcpRequest(McpTestUtils.createToolCallRequest("sparql_query", Map.of("query", QUERY)), token)
            .path("result");

    assertThat(result.path("isError").asBoolean()).isTrue();
    final JsonNode error = OBJECT_MAPPER.readTree(result.path("content").path(0).path("text").asText());
    assertThat(error.path("statusCode").asInt()).isEqualTo(400);
    assertThat(error.path("error").asText()).contains("RDF knowledge graph is not enabled");
  }
}
