package org.openmetadata.service.search;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;
import org.openmetadata.schema.api.search.AssetTypeConfiguration;
import org.openmetadata.schema.api.search.FieldBoost;
import org.openmetadata.schema.api.search.RankingConfiguration;
import org.openmetadata.schema.api.search.RankingSignals;
import org.openmetadata.schema.api.search.RankingStage;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.schema.api.search.StopWordsByLanguage;

public final class SearchRankingHelper {
  private static final Pattern TOKEN_SPLITTER = Pattern.compile("[^\\p{L}\\p{N}]+");
  // Significant-token extraction only removes stop words on word boundaries, so it must split on
  // whitespace alone. Splitting on every non-alphanumeric char (TOKEN_SPLITTER) would break
  // identifier queries like "sample_data" into "sample data", which then fails to match the
  // keyword fqnParts/name compound tokens that keep the identifier intact.
  private static final Pattern WHITESPACE_SPLITTER = Pattern.compile("\\s+");
  // n-gram fields are indexed with an edge-n-gram analyzer; querying them with that same analyzer
  // re-n-grams the query text, so a long single token explodes into hundreds of clauses and trips
  // OpenSearch's maxClauseCount. Query them with a plain analyzer instead (the canonical
  // edge-n-gram
  // pattern): the query stays one token and still matches the indexed n-grams.
  private static final String NGRAM_SEARCH_ANALYZER = "standard";

  private SearchRankingHelper() {}

  public static RankingConfiguration resolveRanking(
      SearchSettings searchSettings, AssetTypeConfiguration assetConfig) {
    if (assetConfig != null && assetConfig.getRanking() != null) {
      return Boolean.FALSE.equals(assetConfig.getRanking().getEnabled())
          ? null
          : assetConfig.getRanking();
    }

    RankingConfiguration defaultRanking = defaultRanking(searchSettings);
    if (defaultRanking == null || Boolean.FALSE.equals(defaultRanking.getEnabled())) {
      return null;
    }
    return deriveRanking(defaultRanking, assetConfig);
  }

  public static String significantQueryText(String query, RankingConfiguration ranking) {
    List<String> tokens = significantTokens(query, ranking, true);
    return tokens.isEmpty() ? (query == null ? "" : query.trim()) : String.join(" ", tokens);
  }

  public static String significantQueryTextPreservingCase(
      String query, RankingConfiguration ranking) {
    List<String> tokens = significantTokens(query, ranking, false);
    return tokens.isEmpty() ? (query == null ? "" : query.trim()) : String.join(" ", tokens);
  }

  public static List<String> exactMatchTexts(String query) {
    if (query == null || query.trim().isEmpty()) {
      return List.of();
    }

    LinkedHashSet<String> values = new LinkedHashSet<>();
    String trimmed = query.trim();
    addExactTextVariants(values, trimmed);
    addExactTextVariants(values, trimmed.toLowerCase(Locale.ROOT));
    return new ArrayList<>(values);
  }

  private static void addExactTextVariants(LinkedHashSet<String> values, String query) {
    values.add(query);
    List<String> tokens =
        TOKEN_SPLITTER.splitAsStream(query).filter(token -> !token.isBlank()).toList();
    if (tokens.size() > 1) {
      values.add(String.join(" ", tokens));
      values.add(String.join("_", tokens));
      values.add(String.join("-", tokens));
      values.add(String.join(".", tokens));
      values.add(String.join("", tokens));
    }
  }

  public static List<String> significantTokens(String query, RankingConfiguration ranking) {
    return significantTokens(query, ranking, true);
  }

  private static List<String> significantTokens(
      String query, RankingConfiguration ranking, boolean normalize) {
    if (query == null || query.trim().isEmpty()) {
      return List.of();
    }

    Set<String> stopWords = stopWords(ranking);

    LinkedHashSet<String> seenTokens = new LinkedHashSet<>();
    List<String> tokens = new ArrayList<>();
    for (String token : WHITESPACE_SPLITTER.split(query.trim())) {
      String normalizedToken = token.toLowerCase(Locale.ROOT);
      if (isSignificantToken(normalizedToken, stopWords) && seenTokens.add(normalizedToken)) {
        tokens.add(normalize ? normalizedToken : token);
      }
    }
    return tokens;
  }

  public static double disMaxTieBreaker(RankingConfiguration ranking) {
    return ranking != null && ranking.getDisMaxTieBreaker() != null
        ? ranking.getDisMaxTieBreaker()
        : 0.05D;
  }

  public static float stageWeight(RankingStage stage) {
    return stage.getWeight() != null ? stage.getWeight().floatValue() : 1.0F;
  }

  public static String minimumShouldMatch(RankingStage stage) {
    return !nullOrEmpty(stage.getMinimumShouldMatch()) ? stage.getMinimumShouldMatch() : "2<70%";
  }

  public static String stageSearchAnalyzer(RankingStage stage) {
    List<String> fields = stage.getFields();
    boolean allNgramFields =
        !nullOrEmpty(fields) && fields.stream().allMatch(field -> field.endsWith(".ngram"));
    return allNgramFields ? NGRAM_SEARCH_ANALYZER : null;
  }

  public static Double signalMaxBoost(RankingConfiguration ranking) {
    RankingSignals signals = ranking != null ? ranking.getSignals() : null;
    return signals != null ? signals.getMaxBoost() : null;
  }

  public static String signalScoreMode(RankingConfiguration ranking, String fallback) {
    RankingSignals signals = ranking != null ? ranking.getSignals() : null;
    return signals != null && signals.getScoreMode() != null
        ? signals.getScoreMode().value()
        : fallback;
  }

  public static String signalBoostMode(RankingConfiguration ranking, String fallback) {
    RankingSignals signals = ranking != null ? ranking.getSignals() : null;
    return signals != null && signals.getBoostMode() != null
        ? signals.getBoostMode().value()
        : fallback;
  }

  private static RankingConfiguration defaultRanking(SearchSettings searchSettings) {
    if (searchSettings == null
        || searchSettings.getDefaultConfiguration() == null
        || searchSettings.getDefaultConfiguration().getRanking() == null) {
      return null;
    }
    return searchSettings.getDefaultConfiguration().getRanking();
  }

  private static RankingConfiguration deriveRanking(
      RankingConfiguration defaultRanking, AssetTypeConfiguration assetConfig) {
    RankingConfiguration ranking =
        new RankingConfiguration()
            .withEnabled(defaultRanking.getEnabled())
            .withAlgorithm(defaultRanking.getAlgorithm())
            .withStopWords(defaultRanking.getStopWords())
            .withStopWordsByLanguage(defaultRanking.getStopWordsByLanguage())
            .withDisMaxTieBreaker(defaultRanking.getDisMaxTieBreaker())
            .withSignals(defaultRanking.getSignals());

    List<String> configuredFields = configuredFields(assetConfig);
    List<RankingStage> stages = new ArrayList<>();
    List<RankingStage> defaultStages = listOrEmpty(defaultRanking.getStages());
    for (RankingStage stage : defaultStages) {
      List<String> fields = deriveFieldsForStage(stage, configuredFields);
      if (!fields.isEmpty()) {
        stages.add(copyStage(stage, fields));
      }
    }
    ranking.setStages(stages.isEmpty() ? defaultStages : stages);
    return ranking;
  }

  private static List<String> configuredFields(AssetTypeConfiguration assetConfig) {
    if (assetConfig == null || assetConfig.getSearchFields() == null) {
      return List.of();
    }
    LinkedHashSet<String> fields = new LinkedHashSet<>();
    for (FieldBoost fieldBoost : assetConfig.getSearchFields()) {
      if (!nullOrEmpty(fieldBoost.getField())) {
        fields.add(fieldBoost.getField());
      }
    }
    return new ArrayList<>(fields);
  }

  private static RankingStage copyStage(RankingStage stage, List<String> fields) {
    return new RankingStage()
        .withName(stage.getName())
        .withPurpose(stage.getPurpose())
        .withFields(fields)
        .withMatchType(stage.getMatchType())
        .withWeight(stage.getWeight())
        .withMinimumShouldMatch(stage.getMinimumShouldMatch());
  }

  private static List<String> deriveFieldsForStage(
      RankingStage stage, List<String> configuredFields) {
    if (configuredFields.isEmpty()) {
      return stage.getFields() == null ? List.of() : stage.getFields();
    }

    String stageName = stage.getName() == null ? "" : stage.getName().toLowerCase(Locale.ROOT);
    if (stageName.contains("exact")) {
      return exactNameFields(configuredFields, stage.getFields());
    }
    if (stageName.contains("partial") || stageName.contains("ngram")) {
      return ngramNameFields(configuredFields, stage.getFields());
    }
    if (stageName.contains("close") || stageName.contains("name")) {
      return closeNameFields(configuredFields, stage.getFields());
    }
    if (stageName.contains("description")) {
      return descriptionFields(configuredFields, stage.getFields());
    }
    return structuralFields(configuredFields, stage.getFields());
  }

  private static List<String> exactNameFields(
      List<String> configuredFields, List<String> fallback) {
    LinkedHashSet<String> fields = new LinkedHashSet<>();
    addIfConfigured(fields, configuredFields, "displayName.keyword");
    addIfConfigured(fields, configuredFields, "name.keyword");
    addIfConfigured(fields, configuredFields, "fullyQualifiedName.keyword");
    addIfConfigured(fields, configuredFields, "fullyQualifiedName");
    if (hasField(configuredFields, "displayName")) {
      fields.add("displayName.keyword");
    }
    if (hasField(configuredFields, "name")) {
      fields.add("name.keyword");
    }
    if (hasField(configuredFields, "fullyQualifiedName")) {
      fields.add("fullyQualifiedName");
    }
    return withFallback(fields, fallback);
  }

  private static List<String> closeNameFields(
      List<String> configuredFields, List<String> fallback) {
    LinkedHashSet<String> fields = new LinkedHashSet<>();
    for (String field : configuredFields) {
      if (isPrimaryNameField(field) && !field.endsWith(".keyword") && !field.endsWith(".ngram")) {
        fields.add(field);
      }
    }
    return withFallback(fields, fallback);
  }

  private static List<String> ngramNameFields(
      List<String> configuredFields, List<String> fallback) {
    LinkedHashSet<String> fields = new LinkedHashSet<>();
    for (String field : configuredFields) {
      if (field.endsWith(".ngram") && isPrimaryNameField(field)) {
        fields.add(field);
      }
    }
    return withFallback(fields, fallback);
  }

  private static List<String> descriptionFields(
      List<String> configuredFields, List<String> fallback) {
    LinkedHashSet<String> fields = new LinkedHashSet<>();
    for (String field : configuredFields) {
      if (isDescriptionContextField(field)) {
        fields.add(field);
      }
    }
    return withFallback(fields, fallback);
  }

  private static List<String> structuralFields(
      List<String> configuredFields, List<String> fallback) {
    LinkedHashSet<String> fields = new LinkedHashSet<>();
    for (String field : configuredFields) {
      if (!isPrimaryNameField(field)
          && !isDescriptionContextField(field)
          && !field.startsWith("extension.")) {
        fields.add(field);
      }
    }
    return withFallback(fields, fallback);
  }

  private static List<String> withFallback(LinkedHashSet<String> fields, List<String> fallback) {
    if (fields.isEmpty() && fallback != null) {
      fields.addAll(fallback);
    }
    return new ArrayList<>(fields);
  }

  private static boolean hasField(List<String> fields, String field) {
    return fields.contains(field);
  }

  private static void addIfConfigured(
      LinkedHashSet<String> fields, List<String> configuredFields, String field) {
    if (configuredFields.contains(field)) {
      fields.add(field);
    }
  }

  private static boolean isPrimaryNameField(String field) {
    String normalized = field;
    if (normalized.endsWith(".keyword")) {
      normalized = normalized.substring(0, normalized.length() - ".keyword".length());
    } else if (normalized.endsWith(".ngram")) {
      normalized = normalized.substring(0, normalized.length() - ".ngram".length());
    } else if (normalized.endsWith(".compound")) {
      normalized = normalized.substring(0, normalized.length() - ".compound".length());
    }
    return normalized.equals("name")
        || normalized.equals("displayName")
        || normalized.equals("fullyQualifiedName");
  }

  private static boolean isDescriptionContextField(String field) {
    String lowerField = field.toLowerCase(Locale.ROOT);
    return lowerField.contains("description")
        || lowerField.equals("querytext")
        || lowerField.equals("extractedtext");
  }

  private static Set<String> stopWords(RankingConfiguration ranking) {
    if (ranking == null) {
      return Set.of();
    }

    LinkedHashSet<String> stopWords = new LinkedHashSet<>();
    addStopWords(stopWords, ranking.getStopWords());

    StopWordsByLanguage stopWordsByLanguage = ranking.getStopWordsByLanguage();
    if (stopWordsByLanguage != null && stopWordsByLanguage.getAdditionalProperties() != null) {
      stopWordsByLanguage
          .getAdditionalProperties()
          .values()
          .forEach(words -> addStopWords(stopWords, words));
    }
    return stopWords;
  }

  private static void addStopWords(Set<String> stopWords, List<String> words) {
    if (words == null) {
      return;
    }
    words.stream()
        .filter(word -> word != null && !word.isBlank())
        .map(word -> word.toLowerCase(Locale.ROOT))
        .forEach(stopWords::add);
  }

  private static boolean isSignificantToken(String token, Set<String> stopWords) {
    if (token.isBlank() || stopWords.contains(token)) {
      return false;
    }
    return token.codePointCount(0, token.length()) > 1
        || !isWeakSingleCharacterToken(token.codePointAt(0));
  }

  private static boolean isWeakSingleCharacterToken(int codePoint) {
    return Character.UnicodeScript.of(codePoint) == Character.UnicodeScript.LATIN;
  }
}
