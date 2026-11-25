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
package org.openmetadata.mcp.tools;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;

import jakarta.validation.constraints.DecimalMin;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.mcp.util.McpResponseTrim;
import org.openmetadata.schema.api.configuration.MCPConfiguration;
import org.openmetadata.schema.entity.teams.Persona;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.PersonaContext;
import org.openmetadata.schema.type.PersonaContextDefinition;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.aicontext.PersonaContextAccess;
import org.openmetadata.service.aicontext.PersonaContextBuilder.MaterializedPersonaContext;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.UserRepository;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.DefaultAuthorizer;
import org.openmetadata.service.security.auth.CatalogSecurityContext;
import org.openmetadata.service.security.auth.SecurityConfigurationManager;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

class GetPersonaContextToolTest {

  @Test
  void omittedPersonaNameUsesSharedContextForTheCaller() throws Exception {
    Persona shared =
        new Persona()
            .withId(UUID.randomUUID())
            .withName("company")
            .withFullyQualifiedName("company")
            .withContextDefinition(
                new PersonaContextDefinition().withPrompt("Use company context"));
    CatalogSecurityContext caller = mock(CatalogSecurityContext.class);
    Authorizer authorizer = mock(Authorizer.class);
    GetPersonaContextTool tool = new GetPersonaContextTool();
    try (var entities = mockStatic(Entity.class);
        var subjects = mockStatic(DefaultAuthorizer.class)) {
      entities
          .when(() -> Entity.getEntityRepository(Entity.USER))
          .thenReturn(mock(UserRepository.class));
      subjects
          .when(() -> DefaultAuthorizer.getSubjectContext(caller))
          .thenReturn(new SubjectContext(new User().withName("member"), null));

      assertThrows(EntityNotFoundException.class, () -> tool.execute(authorizer, caller, Map.of()));
      PersonaContextAccess.setMissingActivePersonaFallback(() -> shared);
      Map<String, Object> result = tool.execute(authorizer, caller, Map.of("format", "json"));
      assertEquals("json", result.get("format"));
      assertEquals("Use company context", result.get("instructions"));
      assertEquals(
          shared.getId().toString(),
          JsonUtils.readTree((String) result.get("content")).at("/persona/id").asText());

      entities
          .when(
              () ->
                  Entity.getEntityByName(
                      Entity.PERSONA, "missing", "contextDefinition,users", Include.NON_DELETED))
          .thenThrow(EntityNotFoundException.byMessage("Named persona is missing"));
      assertThrows(
          EntityNotFoundException.class,
          () -> tool.execute(authorizer, caller, Map.of("personaName", "missing")));
    } finally {
      PersonaContextAccess.setMissingActivePersonaFallback(null);
    }
  }

  @Test
  void splitsLargeDocumentsDeterministicallyAtLineBoundaries() {
    String content = "a".repeat(84_999) + "\n" + "b".repeat(90_000) + "\nend";

    List<String> parts = GetPersonaContextTool.split(content);

    assertEquals(content, String.join("", parts));
    assertTrue(
        parts.stream()
            .allMatch(
                part ->
                    McpResponseTrim.serializedLength(Map.of("content", part))
                        <= McpResponseTrim.MAX_RESPONSE_CHARS - 10_000));
    assertTrue(parts.getFirst().endsWith("\n"));
  }

  @Test
  void splitsIntoFullSizedPartsAtTheLowestAllowedCap() throws NoSuchFieldException {
    // Read from the schema, so lowering the minimum below what the part budget needs fails here.
    int minimumCap =
        Integer.parseInt(
            MCPConfiguration.class
                .getDeclaredField("maxResponseChars")
                .getAnnotation(DecimalMin.class)
                .value());
    SecurityConfigurationManager manager = SecurityConfigurationManager.getInstance();
    MCPConfiguration previous = SecurityConfigurationManager.getCurrentMcpConfig();
    manager.setCurrentMcpConfig(new MCPConfiguration().withMaxResponseChars(minimumCap));
    try {
      String content = "a".repeat(10_000);

      List<String> parts = GetPersonaContextTool.split(content);

      assertEquals(List.of(content), parts);
    } finally {
      manager.setCurrentMcpConfig(previous);
    }
  }

  @Test
  void budgetsJsonEscapingInsideTheMcpEnvelope() {
    String content = "{\"line\":\"\\\\quoted\\nvalue\"}\n".repeat(10_000);

    List<String> parts = GetPersonaContextTool.split(content);

    assertEquals(content, String.join("", parts));
    assertTrue(parts.size() > 1);
    assertTrue(
        parts.stream()
            .allMatch(
                part ->
                    McpResponseTrim.serializedLength(Map.of("content", part))
                        <= McpResponseTrim.MAX_RESPONSE_CHARS - 10_000));
  }

  @Test
  void representsAnEmptyDocumentAsOnePart() {
    assertEquals(List.of(""), GetPersonaContextTool.split(""));
  }

  @Test
  void carriesThePromptAsInstructionsOnTheFirstPartOnly() {
    MaterializedPersonaContext materialized =
        materialized(
            "You assist finance analysts.", "a".repeat(80_000) + "\n" + "b".repeat(80_000));

    Map<String, Object> first = GetPersonaContextTool.page(materialized, "markdown", 1);
    Map<String, Object> second = GetPersonaContextTool.page(materialized, "markdown", 2);

    assertEquals("You assist finance analysts.", first.get("instructions"));
    assertFalse(second.containsKey("instructions"));
    // The document stays reference data; the prompt is never paged inside it.
    assertFalse(((String) first.get("content")).contains("You assist finance analysts."));
  }

  @Test
  void carriesThePromptInTheJsonFormatToo() {
    Map<String, Object> first =
        GetPersonaContextTool.page(materialized("Answer tersely.", "# doc"), "json", 1);

    assertEquals("Answer tersely.", first.get("instructions"));
    assertEquals("json", first.get("format"));
  }

  @Test
  void omitsInstructionsWhenThePersonaHasNoPrompt() {
    Map<String, Object> first =
        GetPersonaContextTool.page(materialized(null, "# doc"), "markdown", 1);

    assertFalse(first.containsKey("instructions"));
  }

  @Test
  void firstPartLeavesRoomForTheLargestPrompt() {
    // Quotes double when serialized, so this is the widest prompt the 8000-character cap admits.
    // Over MAX_RESPONSE_CHARS, dispatch would replace the whole part with a truncated envelope.
    String content = "a".repeat(84_999) + "\n" + "b".repeat(90_000) + "\nend";
    MaterializedPersonaContext materialized = materialized("\"".repeat(8_000), content);

    Map<String, Object> first = GetPersonaContextTool.page(materialized, "markdown", 1);
    int totalParts = (int) first.get("totalParts");
    StringBuilder paged = new StringBuilder();
    for (int part = 1; part <= totalParts; part++) {
      paged.append(GetPersonaContextTool.page(materialized, "markdown", part).get("content"));
    }

    assertTrue(McpResponseTrim.serializedLength(first) <= McpResponseTrim.MAX_RESPONSE_CHARS);
    assertEquals(content, paged.toString());
  }

  private static MaterializedPersonaContext materialized(String prompt, String markdown) {
    return new MaterializedPersonaContext(
        new PersonaContext().withPrompt(prompt).withFingerprint("fingerprint"), markdown);
  }
}
