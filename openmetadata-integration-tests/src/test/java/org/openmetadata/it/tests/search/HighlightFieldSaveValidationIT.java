package org.openmetadata.it.tests.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.schema.api.search.AssetTypeConfiguration;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.schema.utils.JsonUtils;

/**
 * Saving a highlight field the index mapping cannot highlight must be rejected by the Settings &gt;
 * Search save path, rather than silently accepted and neutralised at query time.
 *
 * <p>Complements {@link ExtensionHighlightSearchIT} and {@link
 * org.openmetadata.it.tests.FlattenedChildrenHighlightSearchIT}: those assert the query-time guard
 * still protects a cluster whose settings already carry such a value; this asserts the value can no
 * longer be introduced through the API in the first place.
 *
 * <p>Mutates nothing on success — every case here is expected to be rejected, so the stored settings
 * are unchanged and no restore is needed.
 */
@Isolated
class HighlightFieldSaveValidationIT {

  private static final String CONTAINER_ASSET_TYPE = "container";
  private static final String TABLE_ASSET_TYPE = "table";
  private static final HttpClient HTTP_CLIENT =
      HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();

  /**
   * Guards the wiring, not the computation. The unit tests call {@code
   * annotateHighlightableFields} directly, so they pass even if nothing in production calls it —
   * which is exactly what happened: the annotation was hooked to {@code readDefaultSearchSettings},
   * while the served payload comes from the store that {@code SettingsCache.initialize} writes
   * without annotating. Every field then serialized as the POJO default {@code false}, disabling
   * every highlight toggle in the UI. This asserts the flag on the response the UI actually reads.
   */
  @Test
  void servedAllowedFieldsCarryTheHighlightFlag() throws Exception {
    final JsonNode tableFields = allowedFieldsFor(TABLE_ASSET_TYPE);

    assertTrue(tableFields.size() > 0, "table allowedFields must not be empty");
    assertEquals(
        Boolean.TRUE,
        highlightOf(tableFields, "description"),
        "an analyzed text field must be served highlight=true");
    assertEquals(
        Boolean.TRUE,
        highlightOf(tableFields, "name"),
        "an analyzed text field must be served highlight=true");
  }

  private JsonNode allowedFieldsFor(final String entityType) throws Exception {
    JsonNode result = null;
    final JsonNode allowedFields =
        JsonUtils.readTree(currentSettingsJson()).path("config_value").path("allowedFields");
    for (final JsonNode entry : allowedFields) {
      if (entityType.equals(entry.path("entityType").asText())) {
        result = entry.path("fields");
      }
    }
    if (result == null) {
      throw new AssertionError("no allowedFields entry for " + entityType);
    }
    return result;
  }

  private Boolean highlightOf(final JsonNode fields, final String fieldName) {
    Boolean result = null;
    for (final JsonNode field : fields) {
      if (fieldName.equals(field.path("name").asText())) {
        result = field.path("highlight").asBoolean();
      }
    }
    if (result == null) {
      throw new AssertionError("no allowedFields entry named " + fieldName);
    }
    return result;
  }

  @Test
  void savingHighlightFieldOnNonIndexedPathIsRejected() throws Exception {
    // `extension` is object/enabled:false, so a custom-property highlight can never match.
    final HttpResponse<String> response = saveHighlightField("extension.foundry_rid");

    assertEquals(
        400,
        response.statusCode(),
        "Saving a non-indexed highlight field must be rejected. body=" + response.body());
    assertTrue(
        response.body().contains("extension.foundry_rid"),
        "The error must name the offending field. body=" + response.body());
    assertTrue(
        response.body().contains("not indexed"),
        "The error must explain why the field cannot be highlighted. body=" + response.body());
  }

  @Test
  void savingHighlightFieldOnFlattenedChildrenPathIsRejected() throws Exception {
    final HttpResponse<String> response = saveHighlightField("dataModel.columns.children.name");

    assertEquals(
        400,
        response.statusCode(),
        "Saving a stale flattened-children highlight field must be rejected. body="
            + response.body());
  }

  @Test
  void savingAnAnalyzedHighlightFieldIsAccepted() throws Exception {
    // The negative cases above must be rejected for the right reason, not because this save path
    // rejects any edit to highlightFields.
    final HttpResponse<String> response = saveHighlightField("description");

    assertTrue(
        response.statusCode() >= 200 && response.statusCode() < 300,
        "An analyzed field must remain saveable. status="
            + response.statusCode()
            + " body="
            + response.body());
  }

  /** PUTs the current settings with {@code highlightField} added to the container asset type. */
  private HttpResponse<String> saveHighlightField(final String highlightField) throws Exception {
    final Settings settings = JsonUtils.readValue(currentSettingsJson(), Settings.class);
    final SearchSettings config =
        JsonUtils.convertValue(settings.getConfigValue(), SearchSettings.class);
    for (final AssetTypeConfiguration assetConfig : config.getAssetTypeConfigurations()) {
      if (CONTAINER_ASSET_TYPE.equalsIgnoreCase(assetConfig.getAssetType())) {
        final List<String> highlightFields =
            assetConfig.getHighlightFields() == null
                ? new ArrayList<>()
                : new ArrayList<>(assetConfig.getHighlightFields());
        if (!highlightFields.contains(highlightField)) {
          highlightFields.add(highlightField);
        }
        assetConfig.setHighlightFields(highlightFields);
      }
    }
    settings.setConfigValue(config);
    return put("/v1/system/settings", JsonUtils.pojoToJson(settings));
  }

  private String currentSettingsJson() throws Exception {
    final HttpRequest request =
        baseRequest("/v1/system/settings/" + SettingsType.SEARCH_SETTINGS.value()).GET().build();
    return HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString()).body();
  }

  private HttpResponse<String> put(final String path, final String body) throws Exception {
    final HttpRequest request =
        baseRequest(path).PUT(HttpRequest.BodyPublishers.ofString(body)).build();
    return HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
  }

  private HttpRequest.Builder baseRequest(final String path) {
    return HttpRequest.newBuilder()
        .uri(URI.create(SdkClients.getServerUrl() + path))
        .header("Authorization", "Bearer " + SdkClients.getAdminToken())
        .header("Content-Type", "application/json")
        .header("Accept", "application/json")
        .timeout(Duration.ofSeconds(30));
  }
}
