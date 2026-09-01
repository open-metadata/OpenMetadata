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
import org.openmetadata.schema.api.data.GlossaryTermRelationGraph;
import org.openmetadata.schema.api.data.OntologyStudioAsset;
import org.openmetadata.schema.api.data.OntologyStudioDataGraph;
import org.openmetadata.schema.api.data.OntologyStudioSummary;
import org.openmetadata.schema.configuration.GlossaryTermRelationSettings;
import org.openmetadata.schema.configuration.GlossaryTermRelationType;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.schema.type.RelationshipTypeUsage;
import org.openmetadata.schema.type.TermRelation;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.sdk.exceptions.ApiException;
import org.openmetadata.sdk.exceptions.InvalidRequestException;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;
import org.openmetadata.sdk.services.glossary.GlossaryTermRelationGraphOptions;
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
    GlossaryTermRelationGraph expected = new GlossaryTermRelationGraph();
    when(httpClient.execute(
            eq(HttpMethod.GET),
            anyString(),
            isNull(),
            eq(GlossaryTermRelationGraph.class),
            any(RequestOptions.class)))
        .thenReturn(expected);

    GlossaryTermRelationGraph graph = glossaryTerms.relationGraph(id, 2, List.of("prescribes"));

    assertSame(expected, graph);
    ArgumentCaptor<RequestOptions> options = ArgumentCaptor.forClass(RequestOptions.class);
    verify(httpClient)
        .execute(
            eq(HttpMethod.GET),
            eq("/v1/glossaryTerms/" + id + "/relationsGraph"),
            isNull(),
            eq(GlossaryTermRelationGraph.class),
            options.capture());
    assertEquals("2", options.getValue().getQueryParams().get("depth"));
    assertEquals("prescribes", options.getValue().getQueryParams().get("relationTypes"));
    assertEquals("500", options.getValue().getQueryParams().get("nodeLimit"));
    assertEquals("1000", options.getValue().getQueryParams().get("edgeLimit"));
  }

  @Test
  void relationGraphOptionsRejectInvalidBounds() {
    assertThrows(
        IllegalArgumentException.class,
        () -> new GlossaryTermRelationGraphOptions(0, List.of(), 500, 1000));
    assertThrows(
        IllegalArgumentException.class,
        () -> new GlossaryTermRelationGraphOptions(1, List.of(), 0, 1000));
    assertThrows(
        IllegalArgumentException.class,
        () -> new GlossaryTermRelationGraphOptions(1, List.of(), 500, 10001));
  }

  @Test
  void relationTypeUsageParsesCounts() {
    when(httpClient.executeForString(
            eq(HttpMethod.GET), eq("/v1/glossaryTerms/relationTypes/usage"), isNull()))
        .thenReturn(
            "[{\"relationshipType\":{\"id\":\"11111111-1111-1111-1111-111111111111\","
                + "\"type\":\"relationshipType\",\"name\":\"prescribes\"},\"count\":3},"
                + "{\"relationshipType\":{\"id\":\"22222222-2222-2222-2222-222222222222\","
                + "\"type\":\"relationshipType\",\"name\":\"synonym\"},\"count\":5}]");

    List<RelationshipTypeUsage> usage = glossaryTerms.relationTypeUsage();

    assertEquals(2, usage.size());
    assertEquals("prescribes", usage.getFirst().getRelationshipType().getName());
    assertEquals(3, usage.getFirst().getCount());
    assertEquals("synonym", usage.getLast().getRelationshipType().getName());
    assertEquals(5, usage.getLast().getCount());
  }

  @Test
  void studioEndpointsUseBoundedPagingParameters() {
    UUID termId = UUID.randomUUID();
    when(httpClient.execute(
            eq(HttpMethod.GET),
            eq("/v1/glossaryTerms/studio/summary"),
            isNull(),
            eq(OntologyStudioSummary.class),
            any(RequestOptions.class)))
        .thenReturn(new OntologyStudioSummary());
    when(httpClient.execute(
            eq(HttpMethod.GET),
            eq("/v1/glossaryTerms/studio/data"),
            isNull(),
            eq(OntologyStudioDataGraph.class),
            any(RequestOptions.class)))
        .thenReturn(new OntologyStudioDataGraph());
    when(httpClient.executeForString(
            eq(HttpMethod.GET),
            eq("/v1/glossaryTerms/" + termId + "/studioAssets"),
            any(RequestOptions.class)))
        .thenReturn("{\"data\":[],\"paging\":{\"total\":0}}");

    glossaryTerms.studioSummary("Commerce", 5, 10);
    glossaryTerms.studioData("Commerce", 12, 24, 4);
    ResultList<OntologyStudioAsset> assets = glossaryTerms.studioAssets(termId, 6, 12);

    ArgumentCaptor<RequestOptions> options = ArgumentCaptor.forClass(RequestOptions.class);
    verify(httpClient, times(2))
        .execute(eq(HttpMethod.GET), anyString(), isNull(), any(Class.class), options.capture());
    assertEquals("5", options.getAllValues().getFirst().getQueryParams().get("limit"));
    assertEquals("10", options.getAllValues().getFirst().getQueryParams().get("offset"));
    assertEquals("Commerce", options.getAllValues().getFirst().getQueryParams().get("parent"));
    assertEquals("4", options.getAllValues().getLast().getQueryParams().get("assetPreviewSize"));
    assertEquals(0, assets.getData().size());
  }

  @Test
  void getGlossaryRelationSettingsReturnsOnlyRelationConfiguration() {
    GlossaryTermRelationSettings relationConfiguration =
        new GlossaryTermRelationSettings()
            .withRelationTypes(List.of(new GlossaryTermRelationType().withName("prescribes")));
    Settings response =
        new Settings()
            .withConfigType(SettingsType.GLOSSARY_TERM_RELATION_SETTINGS)
            .withConfigValue(relationConfiguration);
    when(httpClient.execute(
            eq(HttpMethod.GET),
            eq("/v1/system/settings/glossaryTermRelationSettings"),
            isNull(),
            eq(Settings.class)))
        .thenReturn(response);

    GlossaryTermRelationSettings result = settings.getGlossaryRelationSettings();

    assertEquals("prescribes", result.getRelationTypes().get(0).getName());
    verify(httpClient)
        .execute(
            eq(HttpMethod.GET),
            eq("/v1/system/settings/glossaryTermRelationSettings"),
            isNull(),
            eq(Settings.class));
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

    GlossaryTermRelationSettings result =
        settings.defineGlossaryRelationType(new GlossaryTermRelationType().withName("prescribes"));

    assertEquals("prescribes", result.getRelationTypes().get(0).getName());
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
    assertEquals(2, operations.size());
    assertEquals("test", operations.get(0).get("op").asText());
    assertEquals("", operations.get(0).get("path").asText());
    assertTrue(operations.get(0).get("value").isObject());
    assertTrue(operations.get(0).get("value").isEmpty());
    assertEquals("add", operations.get(1).get("op").asText());
    assertEquals("/relationTypes", operations.get(1).get("path").asText());
    assertEquals("prescribes", operations.get(1).get("value").get(0).get("name").asText());
  }

  @Test
  void defineGlossaryRelationTypeRetriesAbsentInitializationAfterBadRequestTestFailure() {
    assertAbsentInitializationRetriesAfterTestFailure(400);
  }

  @Test
  void defineGlossaryRelationTypeRetriesAbsentInitializationAfterUnprocessableTestFailure() {
    assertAbsentInitializationRetriesAfterTestFailure(422);
  }

  private void assertAbsentInitializationRetriesAfterTestFailure(int statusCode) {
    Settings initial =
        new Settings()
            .withConfigType(SettingsType.GLOSSARY_TERM_RELATION_SETTINGS)
            .withConfigValue(Map.of());
    Settings latest =
        new Settings()
            .withConfigType(SettingsType.GLOSSARY_TERM_RELATION_SETTINGS)
            .withConfigValue(
                new GlossaryTermRelationSettings()
                    .withRelationTypes(List.of(new GlossaryTermRelationType().withName("treats"))));
    when(httpClient.execute(eq(HttpMethod.GET), anyString(), isNull(), eq(Settings.class)))
        .thenReturn(initial, latest);
    when(httpClient.execute(eq(HttpMethod.PATCH), anyString(), any(), eq(Settings.class)))
        .thenThrow(
            new ApiException("The JSON Patch operation 'test' failed for path ''", statusCode))
        .thenReturn(latest);

    GlossaryTermRelationSettings result =
        settings.defineGlossaryRelationType(new GlossaryTermRelationType().withName("prescribes"));

    assertEquals("treats", result.getRelationTypes().get(0).getName());
    ArgumentCaptor<Object> patches = ArgumentCaptor.forClass(Object.class);
    verify(httpClient, times(2))
        .execute(eq(HttpMethod.PATCH), anyString(), patches.capture(), eq(Settings.class));
    ArrayNode initialPatch = (ArrayNode) patches.getAllValues().get(0);
    assertEquals("test", initialPatch.get(0).get("op").asText());
    assertEquals("", initialPatch.get(0).get("path").asText());
    ArrayNode retryPatch = (ArrayNode) patches.getAllValues().get(1);
    assertEquals("test", retryPatch.get(0).get("op").asText());
    assertEquals("/relationTypes", retryPatch.get(0).get("path").asText());
    assertEquals("treats", retryPatch.get(0).get("value").get(0).get("name").asText());
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

    GlossaryTermRelationSettings result =
        settings.defineGlossaryRelationType(new GlossaryTermRelationType().withName("prescribes"));

    assertEquals("prescribes", result.getRelationTypes().get(0).getName());
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
        .thenThrow(new ApiException("precondition failed", 412))
        .thenReturn(latest);

    GlossaryTermRelationSettings result =
        settings.defineGlossaryRelationType(new GlossaryTermRelationType().withName("prescribes"));

    assertEquals("treats", result.getRelationTypes().get(0).getName());
    ArgumentCaptor<Object> patches = ArgumentCaptor.forClass(Object.class);
    verify(httpClient, times(2))
        .execute(eq(HttpMethod.PATCH), anyString(), patches.capture(), eq(Settings.class));
    ArrayNode retryPatch = (ArrayNode) patches.getAllValues().get(1);
    assertEquals("treats", retryPatch.get(0).get("value").get(0).get("name").asText());
    assertTrue(retryPatch.get(0).get("value").get(0).get("description").isNull());
  }

  @Test
  void defineGlossaryRelationTypeDoesNotRetryUnrelatedBadRequest() {
    Settings initial =
        new Settings()
            .withConfigType(SettingsType.GLOSSARY_TERM_RELATION_SETTINGS)
            .withConfigValue(new GlossaryTermRelationSettings().withRelationTypes(List.of()));
    Settings latest =
        new Settings()
            .withConfigType(SettingsType.GLOSSARY_TERM_RELATION_SETTINGS)
            .withConfigValue(
                new GlossaryTermRelationSettings()
                    .withRelationTypes(List.of(new GlossaryTermRelationType().withName("treats"))));
    InvalidRequestException failure =
        new InvalidRequestException("relation type test failed validation");
    when(httpClient.execute(eq(HttpMethod.GET), anyString(), isNull(), eq(Settings.class)))
        .thenReturn(initial, latest);
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

  @Test
  void defineGlossaryRelationTypeDoesNotRetryUnrelatedUnprocessablePatch() {
    Settings initial =
        new Settings()
            .withConfigType(SettingsType.GLOSSARY_TERM_RELATION_SETTINGS)
            .withConfigValue(new GlossaryTermRelationSettings().withRelationTypes(List.of()));
    Settings latest =
        new Settings()
            .withConfigType(SettingsType.GLOSSARY_TERM_RELATION_SETTINGS)
            .withConfigValue(
                new GlossaryTermRelationSettings()
                    .withRelationTypes(List.of(new GlossaryTermRelationType().withName("treats"))));
    ApiException failure = new ApiException("relation type test failed validation", 422);
    when(httpClient.execute(eq(HttpMethod.GET), anyString(), isNull(), eq(Settings.class)))
        .thenReturn(initial, latest);
    when(httpClient.execute(eq(HttpMethod.PATCH), anyString(), any(), eq(Settings.class)))
        .thenThrow(failure);

    ApiException thrown =
        assertThrows(
            ApiException.class,
            () ->
                settings.defineGlossaryRelationType(
                    new GlossaryTermRelationType().withName("prescribes")));

    assertSame(failure, thrown);
    verify(httpClient, times(2))
        .execute(eq(HttpMethod.GET), anyString(), isNull(), eq(Settings.class));
    verify(httpClient).execute(eq(HttpMethod.PATCH), anyString(), any(), eq(Settings.class));
  }
}
