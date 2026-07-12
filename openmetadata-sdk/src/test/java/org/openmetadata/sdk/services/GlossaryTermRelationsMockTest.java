package org.openmetadata.sdk.services;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.openmetadata.schema.configuration.GlossaryTermRelationSettings;
import org.openmetadata.schema.configuration.GlossaryTermRelationType;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.schema.type.TermRelation;
import org.openmetadata.sdk.exceptions.ApiException;
import org.openmetadata.sdk.exceptions.InvalidRequestException;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;
import org.openmetadata.sdk.services.glossary.GlossaryTermService;
import org.openmetadata.sdk.services.system.SystemSettingsService;

/**
 * Mock tests for the glossary term relations + system settings SDK surface. The {@link HttpClient}
 * boundary is mocked so the tests assert the real URL, HTTP method, payload shape, and idempotency
 * logic the SDK constructs.
 */
class GlossaryTermRelationsMockTest {

  private HttpClient httpClient;
  private GlossaryTermService glossaryTerms;
  private SystemSettingsService settings;

  @BeforeEach
  void setUp() {
    httpClient = mock(HttpClient.class);
    glossaryTerms = new GlossaryTermService(httpClient);
    settings = new SystemSettingsService(httpClient);
  }

  @Test
  void addRelationPostsTypedRelation() {
    UUID fromId = UUID.randomUUID();
    UUID toId = UUID.randomUUID();
    GlossaryTerm updated = new GlossaryTerm();
    when(httpClient.execute(eq(HttpMethod.POST), anyString(), any(), eq(GlossaryTerm.class)))
        .thenReturn(updated);

    GlossaryTerm result = glossaryTerms.addRelation(fromId, toId, "prescribes");

    assertSame(updated, result);
    ArgumentCaptor<String> path = ArgumentCaptor.forClass(String.class);
    ArgumentCaptor<Object> body = ArgumentCaptor.forClass(Object.class);
    verify(httpClient)
        .execute(eq(HttpMethod.POST), path.capture(), body.capture(), eq(GlossaryTerm.class));
    assertEquals("/v1/glossaryTerms/" + fromId + "/relations", path.getValue());
    TermRelation sent = (TermRelation) body.getValue();
    assertEquals("prescribes", sent.getRelationType());
    assertEquals(toId, sent.getTerm().getId());
    assertEquals("glossaryTerm", sent.getTerm().getType());
  }

  @Test
  void removeRelationDeletesWithRelationTypeQueryParam() {
    UUID fromId = UUID.randomUUID();
    UUID toId = UUID.randomUUID();
    when(httpClient.execute(
            eq(HttpMethod.DELETE), anyString(), isNull(), eq(GlossaryTerm.class), any()))
        .thenReturn(new GlossaryTerm());

    glossaryTerms.removeRelation(fromId, toId, "prescribes");

    ArgumentCaptor<String> path = ArgumentCaptor.forClass(String.class);
    ArgumentCaptor<RequestOptions> options = ArgumentCaptor.forClass(RequestOptions.class);
    verify(httpClient)
        .execute(
            eq(HttpMethod.DELETE),
            path.capture(),
            isNull(),
            eq(GlossaryTerm.class),
            options.capture());
    assertEquals("/v1/glossaryTerms/" + fromId + "/relations/" + toId, path.getValue());
    assertEquals("prescribes", options.getValue().getQueryParams().get("relationType"));
  }

  @Test
  void relationGraphParsesNodesAndEdges() {
    UUID id = UUID.randomUUID();
    when(httpClient.executeForString(
            eq(HttpMethod.GET), anyString(), isNull(), any(RequestOptions.class)))
        .thenReturn("{\"nodes\":[{\"id\":\"a\"}],\"edges\":[]}");

    Map<String, Object> graph = glossaryTerms.relationGraph(id, 2, List.of("prescribes"));

    assertTrue(graph.containsKey("nodes"));
    assertTrue(graph.containsKey("edges"));
  }

  @Test
  void relationTypeUsageParsesCounts() {
    when(httpClient.executeForString(
            eq(HttpMethod.GET), eq("/v1/glossaryTerms/relationTypes/usage"), isNull()))
        .thenReturn("{\"prescribes\":3,\"synonym\":5}");

    Map<String, Integer> usage = glossaryTerms.relationTypeUsage();

    assertEquals(3, usage.get("prescribes"));
    assertEquals(5, usage.get("synonym"));
  }

  @Test
  void defineGlossaryRelationTypeAppendsWhenAbsent() {
    Settings current =
        new Settings()
            .withConfigType(SettingsType.GLOSSARY_TERM_RELATION_SETTINGS)
            .withConfigValue(new GlossaryTermRelationSettings().withRelationTypes(List.of()));
    when(httpClient.execute(eq(HttpMethod.GET), anyString(), isNull(), eq(Settings.class)))
        .thenReturn(current);
    when(httpClient.execute(eq(HttpMethod.PATCH), anyString(), any(), eq(Settings.class)))
        .thenReturn(current);

    settings.defineGlossaryRelationType(new GlossaryTermRelationType().withName("prescribes"));

    ArgumentCaptor<Object> patch = ArgumentCaptor.forClass(Object.class);
    verify(httpClient)
        .execute(eq(HttpMethod.PATCH), anyString(), patch.capture(), eq(Settings.class));
    ObjectNode precondition = (ObjectNode) ((ArrayNode) patch.getValue()).get(0);
    assertEquals("test", precondition.get("op").asText());
    assertEquals("/relationTypes", precondition.get("path").asText());
    assertTrue(precondition.get("value").isArray());
    assertTrue(precondition.get("value").isEmpty());
    ObjectNode operation = (ObjectNode) ((ArrayNode) patch.getValue()).get(1);
    assertEquals("add", operation.get("op").asText());
    assertEquals("/relationTypes/-", operation.get("path").asText());
    assertEquals("prescribes", operation.get("value").get("name").asText());
  }

  @Test
  void defineGlossaryRelationTypeSkipsWhenPresent() {
    Settings current =
        new Settings()
            .withConfigType(SettingsType.GLOSSARY_TERM_RELATION_SETTINGS)
            .withConfigValue(
                new GlossaryTermRelationSettings()
                    .withRelationTypes(
                        List.of(new GlossaryTermRelationType().withName("prescribes"))));
    when(httpClient.execute(eq(HttpMethod.GET), anyString(), isNull(), eq(Settings.class)))
        .thenReturn(current);

    Settings result =
        settings.defineGlossaryRelationType(new GlossaryTermRelationType().withName("prescribes"));

    assertSame(current, result);
    verify(httpClient, never())
        .execute(eq(HttpMethod.PATCH), anyString(), any(), eq(Settings.class));
  }

  @Test
  void defineGlossaryRelationTypeInitializesNullRelationTypes() {
    Map<String, Object> config = new HashMap<>();
    config.put("relationTypes", null);
    Settings current =
        new Settings()
            .withConfigType(SettingsType.GLOSSARY_TERM_RELATION_SETTINGS)
            .withConfigValue(config);
    when(httpClient.execute(eq(HttpMethod.GET), anyString(), isNull(), eq(Settings.class)))
        .thenReturn(current);
    when(httpClient.execute(eq(HttpMethod.PATCH), anyString(), any(), eq(Settings.class)))
        .thenReturn(current);

    settings.defineGlossaryRelationType(new GlossaryTermRelationType().withName("prescribes"));

    ArgumentCaptor<Object> patch = ArgumentCaptor.forClass(Object.class);
    verify(httpClient)
        .execute(eq(HttpMethod.PATCH), anyString(), patch.capture(), eq(Settings.class));
    ArrayNode operations = (ArrayNode) patch.getValue();
    assertEquals("test", operations.get(0).get("op").asText());
    assertTrue(operations.get(0).get("value").isNull());
    assertEquals("replace", operations.get(1).get("op").asText());
    assertEquals("/relationTypes", operations.get(1).get("path").asText());
    assertEquals("prescribes", operations.get(1).get("value").get(0).get("name").asText());
  }

  @Test
  void defineGlossaryRelationTypeInitializesAbsentRelationTypes() {
    Settings current =
        new Settings()
            .withConfigType(SettingsType.GLOSSARY_TERM_RELATION_SETTINGS)
            .withConfigValue(Map.of());
    when(httpClient.execute(eq(HttpMethod.GET), anyString(), isNull(), eq(Settings.class)))
        .thenReturn(current);
    when(httpClient.execute(eq(HttpMethod.PATCH), anyString(), any(), eq(Settings.class)))
        .thenReturn(current);

    settings.defineGlossaryRelationType(new GlossaryTermRelationType().withName("prescribes"));

    ArgumentCaptor<Object> patch = ArgumentCaptor.forClass(Object.class);
    verify(httpClient)
        .execute(eq(HttpMethod.PATCH), anyString(), patch.capture(), eq(Settings.class));
    ArrayNode operations = (ArrayNode) patch.getValue();
    assertEquals(1, operations.size());
    assertEquals("add", operations.get(0).get("op").asText());
    assertEquals("/relationTypes", operations.get(0).get("path").asText());
    assertEquals("prescribes", operations.get(0).get("value").get(0).get("name").asText());
  }

  @Test
  void defineGlossaryRelationTypeRechecksAfterConcurrentRegistration() {
    Settings absent =
        new Settings()
            .withConfigType(SettingsType.GLOSSARY_TERM_RELATION_SETTINGS)
            .withConfigValue(new GlossaryTermRelationSettings().withRelationTypes(List.of()));
    Settings present =
        new Settings()
            .withConfigType(SettingsType.GLOSSARY_TERM_RELATION_SETTINGS)
            .withConfigValue(
                new GlossaryTermRelationSettings()
                    .withRelationTypes(
                        List.of(new GlossaryTermRelationType().withName("prescribes"))));
    when(httpClient.execute(eq(HttpMethod.GET), anyString(), isNull(), eq(Settings.class)))
        .thenReturn(absent, present);
    when(httpClient.execute(eq(HttpMethod.PATCH), anyString(), any(), eq(Settings.class)))
        .thenThrow(new ApiException("unprocessable settings patch", 422));

    Settings result =
        settings.defineGlossaryRelationType(new GlossaryTermRelationType().withName("prescribes"));

    assertSame(present, result);
    verify(httpClient, times(2))
        .execute(eq(HttpMethod.GET), anyString(), isNull(), eq(Settings.class));
    verify(httpClient).execute(eq(HttpMethod.PATCH), anyString(), any(), eq(Settings.class));
  }

  @Test
  void defineGlossaryRelationTypeRetriesOnlyAfterSnapshotChanges() {
    Settings initial =
        new Settings()
            .withConfigType(SettingsType.GLOSSARY_TERM_RELATION_SETTINGS)
            .withConfigValue(new GlossaryTermRelationSettings().withRelationTypes(List.of()));
    Map<String, Object> existingType = new HashMap<>();
    existingType.put("name", "treats");
    existingType.put("description", null);
    Settings latest =
        new Settings()
            .withConfigType(SettingsType.GLOSSARY_TERM_RELATION_SETTINGS)
            .withConfigValue(Map.of("relationTypes", List.of(existingType)));
    when(httpClient.execute(eq(HttpMethod.GET), anyString(), isNull(), eq(Settings.class)))
        .thenReturn(initial, latest);
    when(httpClient.execute(eq(HttpMethod.PATCH), anyString(), any(), eq(Settings.class)))
        .thenThrow(new InvalidRequestException("different wording"))
        .thenReturn(latest);

    Settings result =
        settings.defineGlossaryRelationType(new GlossaryTermRelationType().withName("prescribes"));

    assertSame(latest, result);
    ArgumentCaptor<Object> patches = ArgumentCaptor.forClass(Object.class);
    verify(httpClient, times(2))
        .execute(eq(HttpMethod.PATCH), anyString(), patches.capture(), eq(Settings.class));
    ArrayNode retryPatch = (ArrayNode) patches.getAllValues().get(1);
    assertEquals("treats", retryPatch.get(0).get("value").get(0).get("name").asText());
    assertTrue(retryPatch.get(0).get("value").get(0).get("description").isNull());
  }

  @Test
  void defineGlossaryRelationTypeDoesNotRetryUnrelatedBadRequest() {
    Settings current =
        new Settings()
            .withConfigType(SettingsType.GLOSSARY_TERM_RELATION_SETTINGS)
            .withConfigValue(new GlossaryTermRelationSettings().withRelationTypes(List.of()));
    InvalidRequestException failure = new InvalidRequestException("invalid relation type");
    when(httpClient.execute(eq(HttpMethod.GET), anyString(), isNull(), eq(Settings.class)))
        .thenReturn(current);
    when(httpClient.execute(eq(HttpMethod.PATCH), anyString(), any(), eq(Settings.class)))
        .thenThrow(failure);

    InvalidRequestException thrown =
        assertThrows(
            InvalidRequestException.class,
            () ->
                settings.defineGlossaryRelationType(
                    new GlossaryTermRelationType().withName("prescribes")));

    assertSame(failure, thrown);
    verify(httpClient, times(2))
        .execute(eq(HttpMethod.GET), anyString(), isNull(), eq(Settings.class));
    verify(httpClient).execute(eq(HttpMethod.PATCH), anyString(), any(), eq(Settings.class));
  }
}
