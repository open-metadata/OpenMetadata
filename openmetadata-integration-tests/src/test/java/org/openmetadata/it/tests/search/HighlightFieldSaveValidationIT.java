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
 * <p>Every rejection case here mutates nothing on success. {@link
 * #everyEndpointServingSearchSettingsCarriesTheHighlightFlag} does write, and restores the settings
 * it captured before it started.
 */
@Isolated
class HighlightFieldSaveValidationIT {

  private static final String CONTAINER_ASSET_TYPE = "container";
  private static final String TABLE_ASSET_TYPE = "table";
  private static final HttpClient HTTP_CLIENT =
      HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();

  /**
   * Guards the wiring, not the computation, across every endpoint that hands back searchSettings.
   *
   * <p>The unit tests call {@code annotateHighlightableFields} directly, so they pass even if
   * nothing in production calls it — which is exactly what happened twice. First the annotation was
   * hooked to {@code readDefaultSearchSettings} while the served payload came from the store that
   * {@code SettingsCache.initialize} writes unannotated. Then it was hooked to the single-setting
   * GET only, leaving the other four endpoints serving the POJO default {@code false}. The one that
   * bit was the save: {@code mergeSearchSettings} swaps in the seed's {@code allowedFields}, which
   * carry no flag, and the UI writes the PUT response straight into app state — so one Save greyed
   * out every highlight toggle on the page while the server still had the field highlighted.
   *
   * <p>Asserting on one endpoint is what let that through, so this asserts on all of them. Anything
   * that serves these settings has to serve the flag with them.
   */
  @Test
  void everyEndpointServingSearchSettingsCarriesTheHighlightFlag() throws Exception {
    final String original = currentSettingsJson();
    try {
      assertServesHighlightFlag("GET /settings/searchSettings", original);
      assertServesHighlightFlag("GET /settings", searchSettingsFromList());
      assertServesHighlightFlag(
          "PUT /settings", servedBody("PUT /settings", put("/v1/system/settings", original)));
      assertServesHighlightFlag(
          "PATCH /settings/searchSettings",
          servedBody("PATCH /settings/searchSettings", patchWithoutChange()));
      // Last: it discards whatever this cluster had stored, which the restore below then puts back.
      assertServesHighlightFlag(
          "PUT /settings/reset/searchSettings",
          servedBody("PUT /settings/reset/searchSettings", resetToDefault()));
    } finally {
      put("/v1/system/settings", original);
    }
  }

  /**
   * The body of a write that succeeded. Without this the endpoint's own failure arrives as "no
   * allowedFields entry for table" off an error payload, which reads as a missing highlight flag —
   * so an empty-bodied 400 from a malformed request looked exactly like the bug this test exists to
   * catch, and the assertion pointed at the server rather than at the request.
   */
  private String servedBody(final String endpoint, final HttpResponse<String> response) {
    assertTrue(
        response.statusCode() >= 200 && response.statusCode() < 300,
        endpoint
            + " must succeed before its body can be asserted on. status="
            + response.statusCode()
            + " body="
            + response.body());
    return response.body();
  }

  /**
   * A response may not claim a field is highlighted and unhighlightable at the same time. That
   * contradiction is the user-visible bug: the toggle reads disabled off {@code highlight} while the
   * server goes on highlighting the field.
   */
  private void assertServesHighlightFlag(final String endpoint, final String body) {
    final JsonNode tableFields = allowedFieldsFor(body, TABLE_ASSET_TYPE);

    assertTrue(tableFields.size() > 0, endpoint + ": table allowedFields must not be empty");
    assertEquals(
        Boolean.TRUE,
        highlightOf(tableFields, "description"),
        endpoint + ": an analyzed text field must be served highlight=true");
    assertEquals(
        Boolean.TRUE,
        highlightOf(tableFields, "name"),
        endpoint + ": an analyzed text field must be served highlight=true");
    for (final JsonNode assetConfig : searchSettingsIn(body).path("assetTypeConfigurations")) {
      final String assetType = assetConfig.path("assetType").asText();
      final JsonNode fields = allowedFieldsFor(body, assetType);
      for (final JsonNode highlighted : assetConfig.path("highlightFields")) {
        // Only a field with an allowedFields entry reaches the UI as a row, so only those can show
        // the contradiction. One with no entry at all — worksheet.columns.name and friends, which
        // are highlighted but never offered as search fields — is a separate gap, not this one.
        final Boolean served = servedHighlightOf(fields, highlighted.asText());
        if (served != null) {
          assertEquals(
              Boolean.TRUE,
              served,
              endpoint
                  + ": '"
                  + highlighted.asText()
                  + "' is in "
                  + assetType
                  + ".highlightFields, so it cannot also be served as unhighlightable");
        }
      }
    }
  }

  /** Handles both served shapes: a wrapped {@code Settings} and the bare {@code SearchSettings} reset returns. */
  private JsonNode searchSettingsIn(final String body) {
    final JsonNode root = JsonUtils.readTree(body);
    return root.has("config_value") ? root.path("config_value") : root;
  }

  private JsonNode allowedFieldsFor(final String body, final String entityType) {
    JsonNode result = null;
    for (final JsonNode entry : searchSettingsIn(body).path("allowedFields")) {
      if (entityType.equalsIgnoreCase(entry.path("entityType").asText())) {
        result = entry.path("fields");
      }
    }
    if (result == null) {
      throw new AssertionError("no allowedFields entry for " + entityType);
    }
    return result;
  }

  private Boolean highlightOf(final JsonNode fields, final String fieldName) {
    final Boolean result = servedHighlightOf(fields, fieldName);
    if (result == null) {
      throw new AssertionError("no allowedFields entry named " + fieldName);
    }
    return result;
  }

  /** The served flag, or {@code null} when the field has no {@code allowedFields} entry to carry one. */
  private Boolean servedHighlightOf(final JsonNode fields, final String fieldName) {
    Boolean result = null;
    for (final JsonNode field : fields) {
      if (fieldName.equals(field.path("name").asText())) {
        result = field.path("highlight").asBoolean();
      }
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

  /** The searchSettings entry of the list endpoint, re-serialized so it reads like the other bodies. */
  private String searchSettingsFromList() throws Exception {
    final HttpRequest request = baseRequest("/v1/system/settings").GET().build();
    final String body = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString()).body();
    for (final JsonNode entry : JsonUtils.readTree(body).path("data")) {
      if (SettingsType.SEARCH_SETTINGS.value().equals(entry.path("config_type").asText())) {
        return entry.toString();
      }
    }
    throw new AssertionError("no searchSettings entry in the settings list. body=" + body);
  }

  /** Rewrites {@code maxAggregateSize} to the value it already holds, so only the response shape is under test. */
  private HttpResponse<String> patchWithoutChange() throws Exception {
    final int maxAggregateSize =
        searchSettingsIn(currentSettingsJson())
            .path("globalSettings")
            .path("maxAggregateSize")
            .asInt();
    final String patch =
        "[{\"op\":\"replace\",\"path\":\"/globalSettings/maxAggregateSize\",\"value\":"
            + maxAggregateSize
            + "}]";
    // setHeader, not header: header() appends to the application/json baseRequest already sets, and
    // a request carrying two Content-Type values is rejected with an empty-bodied 400.
    final HttpRequest request =
        baseRequest("/v1/system/settings/" + SettingsType.SEARCH_SETTINGS.value())
            .setHeader("Content-Type", "application/json-patch+json")
            .method("PATCH", HttpRequest.BodyPublishers.ofString(patch))
            .build();
    return HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
  }

  private HttpResponse<String> resetToDefault() throws Exception {
    return put("/v1/system/settings/reset/" + SettingsType.SEARCH_SETTINGS.value(), "");
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
