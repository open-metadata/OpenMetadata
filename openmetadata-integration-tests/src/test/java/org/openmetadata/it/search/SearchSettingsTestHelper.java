package org.openmetadata.it.search;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.openmetadata.it.server.ServerHandle;
import org.openmetadata.schema.api.search.AssetTypeConfiguration;
import org.openmetadata.schema.api.search.FieldBoost;
import org.openmetadata.schema.api.search.FieldValueBoost;
import org.openmetadata.schema.api.search.GlobalSettings;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.schema.api.search.TermBoost;
import org.openmetadata.schema.search.PreviewSearchRequest;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.resources.settings.SettingsCache;

/**
 * Reads, mutates, previews, and restores the global SearchSettings (the Settings &gt; Search config)
 * so relevancy tests can assert how a settings change reshapes ranking.
 *
 * <p>Two paths, mirroring the product:
 *
 * <ul>
 *   <li><b>Preview</b> ({@link #previewIds}/{@link #previewScores}) — POSTs inline settings to
 *       {@code /v1/search/preview}; runs the exact production query builder but persists nothing and
 *       bypasses the settings cache, so a test can score the same indexed cohort under two settings
 *       with no global mutation. This is the default for ranking assertions.
 *   <li><b>Live</b> ({@link #putSettings}/{@link #resetSettings}) — the real Settings &gt; Search
 *       save path; subsequent {@code /v1/search/query} calls observe the change. Always restore with
 *       {@link #resetSettings} in a finally block.
 * </ul>
 *
 * <p>Preview/search take the <em>logical</em> index name (e.g. {@code "table"}); the server resolves
 * the cluster-aliased physical index, exactly as the UI search box does.
 */
public final class SearchSettingsTestHelper {

  private static final String SETTINGS_PATH = "/v1/system/settings";
  private static final String SEARCH_SETTINGS_PATH = SETTINGS_PATH + "/searchSettings";
  private static final String RESET_SEARCH_SETTINGS_PATH = SETTINGS_PATH + "/reset/searchSettings";
  private static final String PREVIEW_PATH = "/v1/search/preview";

  private SearchSettingsTestHelper() {}

  /** The currently persisted SearchSettings (Settings &gt; Search). */
  public static SearchSettings currentSettings(final ServerHandle server) {
    final String json =
        server.sdk().getHttpClient().executeForString(HttpMethod.GET, SEARCH_SETTINGS_PATH, null);
    final Settings envelope = JsonUtils.readValue(json, Settings.class);
    return JsonUtils.convertValue(envelope.getConfigValue(), SearchSettings.class);
  }

  /** A deep copy, so a test can build a variant without mutating the shared baseline. */
  public static SearchSettings copyOf(final SearchSettings settings) {
    return JsonUtils.readValue(JsonUtils.pojoToJson(settings), SearchSettings.class);
  }

  /** Persists settings via the real save path and invalidates the in-JVM cache (embedded mode). */
  public static void putSettings(final ServerHandle server, final SearchSettings settings) {
    final Settings envelope =
        new Settings().withConfigType(SettingsType.SEARCH_SETTINGS).withConfigValue(settings);
    server.sdk().getHttpClient().executeForString(HttpMethod.PUT, SETTINGS_PATH, envelope);
    invalidateEmbeddedCache(server);
  }

  /** Restores the seeded defaults — call in a finally block after any {@link #putSettings}. */
  public static void resetSettings(final ServerHandle server) {
    server.sdk().getHttpClient().executeForString(HttpMethod.PUT, RESET_SEARCH_SETTINGS_PATH, null);
    invalidateEmbeddedCache(server);
  }

  private static void invalidateEmbeddedCache(final ServerHandle server) {
    if (!server.isExternal()) {
      SettingsCache.invalidateSettings(SettingsType.SEARCH_SETTINGS.value());
    }
  }

  /** Hit IDs in ranked order for a preview run with the given inline settings. */
  public static List<String> previewIds(
      final ServerHandle server,
      final String query,
      final String index,
      final SearchSettings settings,
      final int size) {
    final List<String> ids = new ArrayList<>();
    preview(server, query, index, settings, size, false)
        .path("hits")
        .path("hits")
        .forEach(hit -> ids.add(hit.path("_id").asText()));
    return ids;
  }

  /** Per-hit {@code _score} keyed by id, preserving ranked order. */
  public static Map<String, Double> previewScores(
      final ServerHandle server,
      final String query,
      final String index,
      final SearchSettings settings,
      final int size) {
    final Map<String, Double> scores = new LinkedHashMap<>();
    preview(server, query, index, settings, size, false)
        .path("hits")
        .path("hits")
        .forEach(hit -> scores.put(hit.path("_id").asText(), hit.path("_score").asDouble()));
    return scores;
  }

  /** Raw engine response for a preview run; pass {@code explain=true} to inspect scoring. */
  public static JsonNode preview(
      final ServerHandle server,
      final String query,
      final String index,
      final SearchSettings settings,
      final int size,
      final boolean explain) {
    final PreviewSearchRequest request =
        new PreviewSearchRequest()
            .withQuery(query)
            .withIndex(index)
            .withSearchSettings(settings)
            .withFrom(0)
            .withSize(size)
            .withTrackTotalHits(true)
            .withFetchSource(false)
            .withExplain(explain);
    final String response =
        server.sdk().getHttpClient().executeForString(HttpMethod.POST, PREVIEW_PATH, request);
    return JsonUtils.readTree(response);
  }

  /** The asset-type block within settings (e.g. {@code "table"}); throws if absent. */
  public static AssetTypeConfiguration assetConfig(
      final SearchSettings settings, final String assetType) {
    return settings.getAssetTypeConfigurations().stream()
        .filter(config -> assetType.equalsIgnoreCase(config.getAssetType()))
        .findFirst()
        .orElseThrow(
            () -> new IllegalArgumentException("No asset config for assetType: " + assetType));
  }

  /** Adds a global field=value term boost (applies to every index). */
  public static void addGlobalTermBoost(
      final SearchSettings settings, final String field, final String value, final double boost) {
    termBoosts(settings.getGlobalSettings()).add(termBoost(field, value, boost));
  }

  /** Adds a per-asset field=value term boost (stacks on top of any global term boosts). */
  public static void addAssetTermBoost(
      final SearchSettings settings,
      final String assetType,
      final String field,
      final String value,
      final double boost) {
    final AssetTypeConfiguration config = assetConfig(settings, assetType);
    if (config.getTermBoosts() == null) {
      config.setTermBoosts(new ArrayList<>());
    }
    config.getTermBoosts().add(termBoost(field, value, boost));
  }

  /** Adds a global numeric field-value boost (applies to every index). */
  public static void addGlobalFieldValueBoost(
      final SearchSettings settings, final String field, final double factor) {
    fieldValueBoosts(settings.getGlobalSettings()).add(fieldValueBoost(field, factor));
  }

  /** Adds a per-asset numeric field-value boost, optionally with a modifier and missing default. */
  public static void addAssetFieldValueBoost(
      final SearchSettings settings,
      final String assetType,
      final String field,
      final double factor,
      final FieldValueBoost.Modifier modifier,
      final Double missing) {
    final FieldValueBoost boost = new FieldValueBoost().withField(field).withFactor(factor);
    if (modifier != null) {
      boost.withModifier(modifier);
    }
    if (missing != null) {
      boost.withMissing(missing);
    }
    final AssetTypeConfiguration config = assetConfig(settings, assetType);
    if (config.getFieldValueBoosts() == null) {
      config.setFieldValueBoosts(new ArrayList<>());
    }
    config.getFieldValueBoosts().add(boost);
  }

  /** Sets how an asset type combines multiple boost functions (sum, max, …). */
  public static void setScoreMode(
      final SearchSettings settings,
      final String assetType,
      final AssetTypeConfiguration.ScoreMode scoreMode) {
    assetConfig(settings, assetType).setScoreMode(scoreMode);
  }

  /** Sets how an asset type merges the boost score with the text-match score (multiply, replace…). */
  public static void setBoostMode(
      final SearchSettings settings,
      final String assetType,
      final AssetTypeConfiguration.BoostMode boostMode) {
    assetConfig(settings, assetType).setBoostMode(boostMode);
  }

  /**
   * Clears all global and per-asset term/field-value boosts so a scoring test starts from a clean
   * function-score baseline and only the boosts it adds will fire.
   */
  public static void clearBoosts(final SearchSettings settings, final String assetType) {
    settings.getGlobalSettings().setTermBoosts(new ArrayList<>());
    settings.getGlobalSettings().setFieldValueBoosts(new ArrayList<>());
    final AssetTypeConfiguration config = assetConfig(settings, assetType);
    config.setTermBoosts(new ArrayList<>());
    config.setFieldValueBoosts(new ArrayList<>());
  }

  /** Replaces an asset type's searchable fields with a single boosted, standard-match field. */
  public static void setOnlySearchField(
      final SearchSettings settings,
      final String assetType,
      final String field,
      final double boost) {
    setOnlySearchField(settings, assetType, field, boost, FieldBoost.MatchType.STANDARD);
  }

  /** Replaces an asset type's searchable fields with a single field using the given match type. */
  public static void setOnlySearchField(
      final SearchSettings settings,
      final String assetType,
      final String field,
      final double boost,
      final FieldBoost.MatchType matchType) {
    assetConfig(settings, assetType)
        .setSearchFields(
            new ArrayList<>(
                List.of(
                    new FieldBoost().withField(field).withBoost(boost).withMatchType(matchType))));
  }

  /** Sets the fields an asset type highlights (overrides the global highlight list for that type). */
  public static void setAssetHighlightFields(
      final SearchSettings settings, final String assetType, final String... fields) {
    assetConfig(settings, assetType).setHighlightFields(new ArrayList<>(List.of(fields)));
  }

  /** Caps how many hits any search returns, regardless of the requested size. */
  public static void setMaxResultHits(final SearchSettings settings, final int maxResultHits) {
    settings.getGlobalSettings().setMaxResultHits(maxResultHits);
  }

  private static List<TermBoost> termBoosts(final GlobalSettings global) {
    if (global.getTermBoosts() == null) {
      global.setTermBoosts(new ArrayList<>());
    }
    return global.getTermBoosts();
  }

  private static List<FieldValueBoost> fieldValueBoosts(final GlobalSettings global) {
    if (global.getFieldValueBoosts() == null) {
      global.setFieldValueBoosts(new ArrayList<>());
    }
    return global.getFieldValueBoosts();
  }

  private static TermBoost termBoost(final String field, final String value, final double boost) {
    return new TermBoost().withField(field).withValue(value).withBoost(boost);
  }

  private static FieldValueBoost fieldValueBoost(final String field, final double factor) {
    return new FieldValueBoost().withField(field).withFactor(factor);
  }
}
