package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.GlossaryTermTestFactory;
import org.openmetadata.it.factories.GlossaryTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Integration tests for Glossary Term Relation Settings migration.
 *
 * <p>Verifies that the 2.0.0 migration properly creates default glossary term relation settings,
 * and that delete protection works correctly for relation types that are in use.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class GlossaryTermRelationSettingsIT {

  private static final Logger LOG = LoggerFactory.getLogger(GlossaryTermRelationSettingsIT.class);
  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final HttpClient HTTP_CLIENT =
      HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
  private static final Object SETTINGS_LOCK = new Object();

  @Test
  void test_glossaryTermRelationSettingsExist() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String settingsJson =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                "/v1/system/settings/glossaryTermRelationSettings",
                null,
                RequestOptions.builder().build());

    System.out.println("Response body: " + settingsJson);

    assertNotNull(settingsJson, "Settings response should not be null");
    assertFalse(settingsJson.isEmpty(), "Settings response should not be empty");

    JsonNode settings = MAPPER.readTree(settingsJson);
    assertNotNull(settings, "Settings JSON should be parseable");

    assertEquals(
        "glossaryTermRelationSettings",
        settings.get("config_type").asText(),
        "Config type should be glossaryTermRelationSettings");

    JsonNode configValue = settings.get("config_value");
    assertNotNull(configValue, "Config value should not be null");

    JsonNode relationTypes = configValue.get("relationTypes");
    assertNotNull(relationTypes, "relationTypes should not be null");
    assertTrue(relationTypes.isArray(), "relationTypes should be an array");
    assertFalse(relationTypes.isEmpty(), "relationTypes should not be empty");

    System.out.println("Found " + relationTypes.size() + " relation types");

    boolean hasRelatedTo = false;
    boolean hasSynonym = false;
    boolean hasBroader = false;

    for (JsonNode relationType : relationTypes) {
      String name = relationType.get("name").asText();
      System.out.println("  - " + name + ": " + relationType.get("displayName").asText());

      if ("relatedTo".equals(name)) hasRelatedTo = true;
      if ("synonym".equals(name)) hasSynonym = true;
      if ("broader".equals(name)) hasBroader = true;

      assertNotNull(relationType.get("displayName"), "displayName should exist for " + name);
      assertNotNull(relationType.get("category"), "category should exist for " + name);
      assertNotNull(relationType.get("isSymmetric"), "isSymmetric should exist for " + name);
      assertNotNull(relationType.get("isTransitive"), "isTransitive should exist for " + name);
    }

    assertTrue(hasRelatedTo, "Should have 'relatedTo' relation type");
    assertTrue(hasSynonym, "Should have 'synonym' relation type");
    assertTrue(hasBroader, "Should have 'broader' relation type");
  }

  @Test
  void test_relationTypesHaveColors() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String settingsJson =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                "/v1/system/settings/glossaryTermRelationSettings",
                null,
                RequestOptions.builder().build());

    assertNotNull(settingsJson, "Settings response should not be null");
    assertFalse(settingsJson.isEmpty(), "Settings response should not be empty");

    JsonNode settings = MAPPER.readTree(settingsJson);
    JsonNode relationTypes = settings.get("config_value").get("relationTypes");

    for (JsonNode relationType : relationTypes) {
      String name = relationType.get("name").asText();
      JsonNode colorNode = relationType.get("color");
      assertNotNull(colorNode, "color should exist for " + name);

      String color = colorNode.asText();
      assertTrue(
          color.matches("^#[0-9a-fA-F]{6}$"),
          "color should be a valid hex color for " + name + ", got: " + color);
    }
  }

  @Test
  void test_usageCountsApiReturnsValidData() throws Exception {
    String baseUrl = SdkClients.getServerUrl();
    String token = SdkClients.getAdminToken();

    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(baseUrl + "/v1/glossaryTerms/relationTypes/usage"))
            .header("Authorization", "Bearer " + token)
            .header("Accept", "application/json")
            .timeout(Duration.ofSeconds(30))
            .GET()
            .build();

    HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());

    assertEquals(200, response.statusCode(), "Usage counts API should return 200");
    assertNotNull(response.body(), "Response body should not be null");

    @SuppressWarnings("unchecked")
    Map<String, Integer> usageCounts =
        MAPPER.readValue(
            response.body(),
            new com.fasterxml.jackson.core.type.TypeReference<Map<String, Integer>>() {});
    assertNotNull(usageCounts, "Usage counts should be parseable");
    LOG.info("Usage counts: {}", usageCounts);
  }

  @Test
  void test_deleteRelationTypeProtection(TestNamespace ns) throws Exception {
    synchronized (SETTINGS_LOCK) {
      String customTypeName = "testCustomType" + System.currentTimeMillis();

      JsonNode currentSettings = getSettings();
      ArrayNode relationTypes =
          (ArrayNode) currentSettings.get("config_value").get("relationTypes");

      ObjectNode newType = MAPPER.createObjectNode();
      newType.put("name", customTypeName);
      newType.put("displayName", "Test Custom Type");
      newType.put("description", "A test custom relation type for delete protection testing");
      newType.put("isSymmetric", true);
      newType.put("isTransitive", false);
      newType.put("isCrossGlossaryAllowed", true);
      newType.put("category", "associative");
      newType.put("isSystemDefined", false);
      newType.put("color", "#ff5733");
      relationTypes.add(newType);

      ObjectNode newSettings = MAPPER.createObjectNode();
      newSettings.set("relationTypes", relationTypes);
      updateSettings(newSettings);
      LOG.info("Created custom relation type: {}", customTypeName);

      Glossary glossary = GlossaryTestFactory.createSimple(ns);
      GlossaryTerm term1 = GlossaryTermTestFactory.createWithName(ns, glossary, "termA");
      GlossaryTerm term2 = GlossaryTermTestFactory.createWithName(ns, glossary, "termB");

      GlossaryTerm updatedTerm =
          addTermRelation(term1.getId().toString(), term2.getId().toString(), customTypeName);
      assertNotNull(updatedTerm, "Should successfully add relation with custom type");
      LOG.info(
          "Created relation between {} and {} with type {}",
          term1.getName(),
          term2.getName(),
          customTypeName);

      JsonNode settingsWithRelationInUse = getSettings();
      ArrayNode typesWithRelationInUse =
          (ArrayNode) settingsWithRelationInUse.get("config_value").get("relationTypes");

      ArrayNode typesWithoutCustom = MAPPER.createArrayNode();
      for (JsonNode type : typesWithRelationInUse) {
        if (!customTypeName.equals(type.get("name").asText())) {
          typesWithoutCustom.add(type);
        }
      }

      ObjectNode settingsWithoutCustomType = MAPPER.createObjectNode();
      settingsWithoutCustomType.set("relationTypes", typesWithoutCustom);

      int deleteStatusCode = updateSettingsAndGetStatus(settingsWithoutCustomType);
      LOG.info("Delete attempt status code: {}", deleteStatusCode);

      assertTrue(
          deleteStatusCode >= 400,
          "Delete should fail when relation type is in use. Got status: " + deleteStatusCode);

      removeTermRelation(term1.getId().toString(), term2.getId().toString(), customTypeName);
      removeTermRelation(term2.getId().toString(), term1.getId().toString(), customTypeName);
      LOG.info(
          "Removed relation between {} and {} (both directions)", term1.getName(), term2.getName());

      int deleteAfterRemovalStatusCode = updateSettingsAndGetStatus(settingsWithoutCustomType);
      LOG.info("Delete after removal status code: {}", deleteAfterRemovalStatusCode);

      assertEquals(
          200, deleteAfterRemovalStatusCode, "Delete should succeed after relations are removed");

      JsonNode finalSettings = getSettings();
      ArrayNode finalTypes = (ArrayNode) finalSettings.get("config_value").get("relationTypes");
      boolean customTypeExists = false;
      for (JsonNode type : finalTypes) {
        if (customTypeName.equals(type.get("name").asText())) {
          customTypeExists = true;
          break;
        }
      }
      assertFalse(customTypeExists, "Custom type should be deleted from settings");
      LOG.info("Successfully verified delete protection for relation type: {}", customTypeName);
    }
  }

  @Test
  void test_oneToManyCardinalityConstraints(TestNamespace ns) throws Exception {
    synchronized (SETTINGS_LOCK) {
      String customTypeName = "oneToMany" + System.currentTimeMillis();

      JsonNode currentSettings = getSettings();
      ArrayNode relationTypes =
          (ArrayNode) currentSettings.get("config_value").get("relationTypes");

      ObjectNode newType = MAPPER.createObjectNode();
      newType.put("name", customTypeName);
      newType.put("displayName", "One To Many Type");
      newType.put("description", "Source can relate to many targets, each target only one source");
      newType.put("isSymmetric", false);
      newType.put("isTransitive", false);
      newType.put("isCrossGlossaryAllowed", true);
      newType.put("category", "associative");
      newType.put("isSystemDefined", false);
      newType.put("color", "#22c55e");
      newType.put("cardinality", "ONE_TO_MANY");
      relationTypes.add(newType);

      ObjectNode newSettings = MAPPER.createObjectNode();
      newSettings.set("relationTypes", relationTypes);
      updateSettings(newSettings);

      try {
        Glossary glossary = GlossaryTestFactory.createSimple(ns);
        GlossaryTerm source = GlossaryTermTestFactory.createWithName(ns, glossary, "source");
        GlossaryTerm targetA = GlossaryTermTestFactory.createWithName(ns, glossary, "targetA");
        GlossaryTerm targetB = GlossaryTermTestFactory.createWithName(ns, glossary, "targetB");
        GlossaryTerm source2 = GlossaryTermTestFactory.createWithName(ns, glossary, "source2");

        int status1 =
            addTermRelationAndGetStatus(
                source.getId().toString(), targetA.getId().toString(), customTypeName);
        assertEquals(200, status1, "Source to targetA should succeed");

        int status2 =
            addTermRelationAndGetStatus(
                source.getId().toString(), targetB.getId().toString(), customTypeName);
        assertEquals(
            200, status2, "Source to targetB should succeed (ONE_TO_MANY allows multiple targets)");

        int status3 =
            addTermRelationAndGetStatus(
                source2.getId().toString(), targetA.getId().toString(), customTypeName);
        assertTrue(
            status3 >= 400,
            "Second source to same target should be rejected (target max=1). Got: " + status3);

        removeTermRelation(source.getId().toString(), targetA.getId().toString(), customTypeName);
        removeTermRelation(source.getId().toString(), targetB.getId().toString(), customTypeName);
      } finally {
        cleanupCustomType(customTypeName);
      }
    }
  }

  @Test
  void test_manyToOneCardinalityConstraints(TestNamespace ns) throws Exception {
    synchronized (SETTINGS_LOCK) {
      String customTypeName = "manyToOne" + System.currentTimeMillis();

      JsonNode currentSettings = getSettings();
      ArrayNode relationTypes =
          (ArrayNode) currentSettings.get("config_value").get("relationTypes");

      ObjectNode newType = MAPPER.createObjectNode();
      newType.put("name", customTypeName);
      newType.put("displayName", "Many To One Type");
      newType.put("description", "Many sources can relate to one target, source limited to one");
      newType.put("isSymmetric", false);
      newType.put("isTransitive", false);
      newType.put("isCrossGlossaryAllowed", true);
      newType.put("category", "associative");
      newType.put("isSystemDefined", false);
      newType.put("color", "#f59e0b");
      newType.put("cardinality", "MANY_TO_ONE");
      relationTypes.add(newType);

      ObjectNode newSettings = MAPPER.createObjectNode();
      newSettings.set("relationTypes", relationTypes);
      updateSettings(newSettings);

      try {
        Glossary glossary = GlossaryTestFactory.createSimple(ns);
        GlossaryTerm sourceA = GlossaryTermTestFactory.createWithName(ns, glossary, "srcA");
        GlossaryTerm sourceB = GlossaryTermTestFactory.createWithName(ns, glossary, "srcB");
        GlossaryTerm target = GlossaryTermTestFactory.createWithName(ns, glossary, "target");
        GlossaryTerm target2 = GlossaryTermTestFactory.createWithName(ns, glossary, "target2");

        int status1 =
            addTermRelationAndGetStatus(
                sourceA.getId().toString(), target.getId().toString(), customTypeName);
        assertEquals(200, status1, "sourceA to target should succeed");

        int status2 =
            addTermRelationAndGetStatus(
                sourceB.getId().toString(), target.getId().toString(), customTypeName);
        assertEquals(
            200,
            status2,
            "sourceB to same target should succeed (MANY_TO_ONE allows multiple sources)");

        int status3 =
            addTermRelationAndGetStatus(
                sourceA.getId().toString(), target2.getId().toString(), customTypeName);
        assertTrue(
            status3 >= 400,
            "sourceA to second target should be rejected (source max=1). Got: " + status3);

        removeTermRelation(sourceA.getId().toString(), target.getId().toString(), customTypeName);
        removeTermRelation(sourceB.getId().toString(), target.getId().toString(), customTypeName);
      } finally {
        cleanupCustomType(customTypeName);
      }
    }
  }

  @Test
  void test_customCardinalityConstraints(TestNamespace ns) throws Exception {
    synchronized (SETTINGS_LOCK) {
      String customTypeName = "customCard" + System.currentTimeMillis();

      JsonNode currentSettings = getSettings();
      ArrayNode relationTypes =
          (ArrayNode) currentSettings.get("config_value").get("relationTypes");

      ObjectNode newType = MAPPER.createObjectNode();
      newType.put("name", customTypeName);
      newType.put("displayName", "Custom Cardinality Type");
      newType.put("description", "Custom cardinality with sourceMax=2, targetMax=2");
      newType.put("isSymmetric", false);
      newType.put("isTransitive", false);
      newType.put("isCrossGlossaryAllowed", true);
      newType.put("category", "associative");
      newType.put("isSystemDefined", false);
      newType.put("color", "#8b5cf6");
      newType.put("cardinality", "CUSTOM");
      newType.put("sourceMax", 2);
      newType.put("targetMax", 2);
      relationTypes.add(newType);

      ObjectNode newSettings = MAPPER.createObjectNode();
      newSettings.set("relationTypes", relationTypes);
      updateSettings(newSettings);

      try {
        Glossary glossary = GlossaryTestFactory.createSimple(ns);
        GlossaryTerm src = GlossaryTermTestFactory.createWithName(ns, glossary, "src");
        GlossaryTerm tgtA = GlossaryTermTestFactory.createWithName(ns, glossary, "tgtA");
        GlossaryTerm tgtB = GlossaryTermTestFactory.createWithName(ns, glossary, "tgtB");
        GlossaryTerm tgtC = GlossaryTermTestFactory.createWithName(ns, glossary, "tgtC");

        int s1 =
            addTermRelationAndGetStatus(
                src.getId().toString(), tgtA.getId().toString(), customTypeName);
        assertEquals(200, s1, "First relation should succeed (within sourceMax=2)");

        int s2 =
            addTermRelationAndGetStatus(
                src.getId().toString(), tgtB.getId().toString(), customTypeName);
        assertEquals(200, s2, "Second relation should succeed (at sourceMax=2)");

        int s3 =
            addTermRelationAndGetStatus(
                src.getId().toString(), tgtC.getId().toString(), customTypeName);
        assertTrue(
            s3 >= 400, "Third relation should be rejected (exceeds sourceMax=2). Got: " + s3);

        removeTermRelation(src.getId().toString(), tgtA.getId().toString(), customTypeName);
        removeTermRelation(src.getId().toString(), tgtB.getId().toString(), customTypeName);
      } finally {
        cleanupCustomType(customTypeName);
      }
    }
  }

  @Test
  void test_systemDefinedRelationTypeCannotBeDeleted() throws Exception {
    synchronized (SETTINGS_LOCK) {
      JsonNode currentSettings = getSettings();
      ArrayNode relationTypes =
          (ArrayNode) currentSettings.get("config_value").get("relationTypes");

      ArrayNode withoutRelatedTo = MAPPER.createArrayNode();
      boolean foundRelatedTo = false;
      for (JsonNode type : relationTypes) {
        if ("relatedTo".equals(type.get("name").asText())) {
          foundRelatedTo = true;
          JsonNode isSystemDefined = type.get("isSystemDefined");
          assertTrue(
              isSystemDefined != null && isSystemDefined.asBoolean(),
              "'relatedTo' should be system-defined");
        } else {
          withoutRelatedTo.add(type);
        }
      }
      assertTrue(foundRelatedTo, "relatedTo should exist in default settings");

      ObjectNode settingsWithoutRelatedTo = MAPPER.createObjectNode();
      settingsWithoutRelatedTo.set("relationTypes", withoutRelatedTo);

      int status = updateSettingsAndGetStatus(settingsWithoutRelatedTo);
      LOG.info("Attempt to delete system-defined 'relatedTo' status: {}", status);

      assertTrue(
          status >= 400,
          "Should not be able to remove system-defined relation type 'relatedTo'. Got: " + status);
    }
  }

  @Test
  void test_defaultRelationTypesHaveExpectedProperties() throws Exception {
    JsonNode settings = getSettings();
    JsonNode relationTypes = settings.get("config_value").get("relationTypes");

    boolean hasBroader = false;
    boolean hasNarrower = false;

    for (JsonNode type : relationTypes) {
      String name = type.get("name").asText();
      if ("broader".equals(name)) {
        hasBroader = true;
        assertFalse(type.get("isSymmetric").asBoolean(), "broader should not be symmetric");
        assertTrue(type.get("isTransitive").asBoolean(), "broader should be transitive");
        assertEquals(
            "hierarchical", type.get("category").asText(), "broader should be hierarchical");
        JsonNode inverse = type.get("inverseRelation");
        assertNotNull(inverse, "broader should have inverseRelation");
        assertEquals("narrower", inverse.asText(), "broader inverse should be narrower");
      }
      if ("narrower".equals(name)) {
        hasNarrower = true;
        JsonNode inverse = type.get("inverseRelation");
        assertNotNull(inverse, "narrower should have inverseRelation");
        assertEquals("broader", inverse.asText(), "narrower inverse should be broader");
      }
    }

    assertTrue(hasBroader, "Should have 'broader' relation type");
    assertTrue(hasNarrower, "Should have 'narrower' relation type");
  }

  @Test
  void test_cardinalityConstraints(TestNamespace ns) throws Exception {
    synchronized (SETTINGS_LOCK) {
      String customTypeName = "cardinalityType" + System.currentTimeMillis();

      JsonNode currentSettings = getSettings();
      ArrayNode relationTypes =
          (ArrayNode) currentSettings.get("config_value").get("relationTypes");

      ObjectNode newType = MAPPER.createObjectNode();
      newType.put("name", customTypeName);
      newType.put("displayName", "Cardinality Type");
      newType.put("description", "Relation type with cardinality constraints");
      newType.put("isSymmetric", false);
      newType.put("isTransitive", false);
      newType.put("isCrossGlossaryAllowed", true);
      newType.put("category", "associative");
      newType.put("isSystemDefined", false);
      newType.put("color", "#4f46e5");
      newType.put("cardinality", "ONE_TO_ONE");
      relationTypes.add(newType);

      ObjectNode newSettings = MAPPER.createObjectNode();
      newSettings.set("relationTypes", relationTypes);
      updateSettings(newSettings);

      Glossary glossary = GlossaryTestFactory.createSimple(ns);
      GlossaryTerm term1 = GlossaryTermTestFactory.createWithName(ns, glossary, "cardA");
      GlossaryTerm term2 = GlossaryTermTestFactory.createWithName(ns, glossary, "cardB");
      GlossaryTerm term3 = GlossaryTermTestFactory.createWithName(ns, glossary, "cardC");

      int status1 =
          addTermRelationAndGetStatus(
              term1.getId().toString(), term2.getId().toString(), customTypeName);
      assertEquals(200, status1, "First relation should succeed");

      int status2 =
          addTermRelationAndGetStatus(
              term1.getId().toString(), term3.getId().toString(), customTypeName);
      assertTrue(status2 >= 400, "Should reject source cardinality violation");

      int status3 =
          addTermRelationAndGetStatus(
              term3.getId().toString(), term2.getId().toString(), customTypeName);
      assertTrue(status3 >= 400, "Should reject target cardinality violation");

      removeTermRelation(term1.getId().toString(), term2.getId().toString(), customTypeName);

      int status4 =
          addTermRelationAndGetStatus(
              term3.getId().toString(), term2.getId().toString(), customTypeName);
      assertEquals(200, status4, "Should allow relation after previous one is removed");

      removeTermRelation(term3.getId().toString(), term2.getId().toString(), customTypeName);

      JsonNode settingsAfter = getSettings();
      ArrayNode typesAfter = (ArrayNode) settingsAfter.get("config_value").get("relationTypes");
      ArrayNode typesWithoutCustom = MAPPER.createArrayNode();
      for (JsonNode type : typesAfter) {
        if (!customTypeName.equals(type.get("name").asText())) {
          typesWithoutCustom.add(type);
        }
      }

      ObjectNode settingsWithoutCustomType = MAPPER.createObjectNode();
      settingsWithoutCustomType.set("relationTypes", typesWithoutCustom);
      updateSettings(settingsWithoutCustomType);
    }
  }

  private JsonNode getSettings() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    String settingsJson =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                "/v1/system/settings/glossaryTermRelationSettings",
                null,
                RequestOptions.builder().build());
    return MAPPER.readTree(settingsJson);
  }

  private void updateSettings(ObjectNode settings) throws Exception {
    String baseUrl = SdkClients.getServerUrl();
    String token = SdkClients.getAdminToken();

    ObjectNode payload = MAPPER.createObjectNode();
    payload.put("config_type", "glossaryTermRelationSettings");
    payload.set("config_value", settings);

    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(baseUrl + "/v1/system/settings"))
            .header("Authorization", "Bearer " + token)
            .header("Content-Type", "application/json")
            .timeout(Duration.ofSeconds(30))
            .PUT(HttpRequest.BodyPublishers.ofString(MAPPER.writeValueAsString(payload)))
            .build();

    HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
    if (response.statusCode() != 200) {
      throw new RuntimeException(
          "Failed to update settings: status="
              + response.statusCode()
              + ", body="
              + response.body());
    }
  }

  private int updateSettingsAndGetStatus(ObjectNode settings) throws Exception {
    String baseUrl = SdkClients.getServerUrl();
    String token = SdkClients.getAdminToken();

    ObjectNode payload = MAPPER.createObjectNode();
    payload.put("config_type", "glossaryTermRelationSettings");
    payload.set("config_value", settings);

    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(baseUrl + "/v1/system/settings"))
            .header("Authorization", "Bearer " + token)
            .header("Content-Type", "application/json")
            .timeout(Duration.ofSeconds(30))
            .PUT(HttpRequest.BodyPublishers.ofString(MAPPER.writeValueAsString(payload)))
            .build();

    HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
    return response.statusCode();
  }

  private GlossaryTerm addTermRelation(String fromTermId, String toTermId, String relationType)
      throws Exception {
    String baseUrl = SdkClients.getServerUrl();
    String token = SdkClients.getAdminToken();

    String url = String.format("%s/v1/glossaryTerms/%s/relations", baseUrl, fromTermId);

    String jsonBody =
        String.format(
            "{\"term\":{\"id\":\"%s\",\"type\":\"glossaryTerm\"},\"relationType\":\"%s\"}",
            toTermId, relationType);

    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(url))
            .header("Authorization", "Bearer " + token)
            .header("Content-Type", "application/json")
            .timeout(Duration.ofSeconds(30))
            .POST(HttpRequest.BodyPublishers.ofString(jsonBody))
            .build();

    HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());

    if (response.statusCode() != 200) {
      LOG.warn(
          "Failed to add term relation: status={}, body={}",
          response.statusCode(),
          response.body());
      return null;
    }

    return MAPPER.readValue(response.body(), GlossaryTerm.class);
  }

  private int addTermRelationAndGetStatus(String fromTermId, String toTermId, String relationType)
      throws Exception {
    String baseUrl = SdkClients.getServerUrl();
    String token = SdkClients.getAdminToken();

    String url = String.format("%s/v1/glossaryTerms/%s/relations", baseUrl, fromTermId);

    String jsonBody =
        String.format(
            "{\"term\":{\"id\":\"%s\",\"type\":\"glossaryTerm\"},\"relationType\":\"%s\"}",
            toTermId, relationType);

    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(url))
            .header("Authorization", "Bearer " + token)
            .header("Content-Type", "application/json")
            .timeout(Duration.ofSeconds(30))
            .POST(HttpRequest.BodyPublishers.ofString(jsonBody))
            .build();

    HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
    return response.statusCode();
  }

  private void removeTermRelation(String fromTermId, String toTermId, String relationType)
      throws Exception {
    String baseUrl = SdkClients.getServerUrl();
    String token = SdkClients.getAdminToken();

    String url =
        String.format(
            "%s/v1/glossaryTerms/%s/relations/%s?relationType=%s",
            baseUrl, fromTermId, toTermId, relationType);

    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(url))
            .header("Authorization", "Bearer " + token)
            .timeout(Duration.ofSeconds(30))
            .DELETE()
            .build();

    HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());

    if (response.statusCode() != 200) {
      LOG.warn(
          "Failed to remove term relation: status={}, body={}",
          response.statusCode(),
          response.body());
    }
  }

  private void cleanupCustomType(String customTypeName) throws Exception {
    JsonNode settingsAfter = getSettings();
    ArrayNode typesAfter = (ArrayNode) settingsAfter.get("config_value").get("relationTypes");
    ArrayNode typesWithoutCustom = MAPPER.createArrayNode();
    for (JsonNode type : typesAfter) {
      if (!customTypeName.equals(type.get("name").asText())) {
        typesWithoutCustom.add(type);
      }
    }
    ObjectNode settingsWithoutCustomType = MAPPER.createObjectNode();
    settingsWithoutCustomType.set("relationTypes", typesWithoutCustom);
    try {
      updateSettings(settingsWithoutCustomType);
    } catch (Exception e) {
      LOG.warn("Failed to cleanup custom type {}: {}", customTypeName, e.getMessage());
    }
  }
}
