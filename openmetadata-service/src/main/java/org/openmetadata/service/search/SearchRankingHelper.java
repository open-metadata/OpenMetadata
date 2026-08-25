package org.openmetadata.service.search;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import jakarta.json.JsonObject;
import jakarta.json.JsonValue;
import java.io.IOException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.regex.Pattern;
import java.util.stream.Stream;
import org.openmetadata.schema.api.search.AssetTypeConfiguration;
import org.openmetadata.schema.api.search.FieldBoost;
import org.openmetadata.schema.api.search.RankingConfiguration;
import org.openmetadata.schema.api.search.RankingSignals;
import org.openmetadata.schema.api.search.RankingStage;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.schema.api.search.StopWordsByLanguage;
import org.openmetadata.schema.utils.JsonUtils;

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
  private static final String ESCAPED_QUERY_CHARACTERS = "+-=&|><!(){}[]^\"~*?:\\/";
  private static final List<String> IDENTITY_FIELDS = List.of("name", "fullyQualifiedName");

  /**
   * Hits inspected when deciding whether the query names an entity exactly.
   *
   * <p>The decision has to be a property of the query and the corpus, never of the page being
   * asked for, or pagination tears: the exactly-named document sits in the top band, so a
   * {@code from=0} request sees it and returns the pruned result set while a {@code from=15}
   * request looks at hits 16-30, does not see it, and returns the widened one. The two pages then
   * disagree about {@code hits.total} and about which document is 16th, and rows can repeat or
   * disappear across the boundary. Always judging the same top-of-ranking window keeps every page
   * of one query on the same result set.
   */
  private static final int IDENTITY_PROBE_SIZE = 10;

  /**
   * Hits a caller should read identifiers from. Callers that reuse an already-fetched page must cut
   * it to this many, or a large first page would judge on more hits than the probe issued for a
   * later page and the two could reach opposite conclusions.
   */
  public static int identityProbeSize() {
    return IDENTITY_PROBE_SIZE;
  }

  /**
   * Saturation applied to the text ranking stages so a stage can never score above its configured
   * weight.
   *
   * <p>The identity stages ({@code exact}, {@code phrase}, {@code tokenCoverage}) are {@code
   * constant_score} queries, so their score <em>is</em> the weight. The text stages ({@code fuzzy},
   * {@code standard}) were a {@code multi_match} boosted by the weight, which is BM25 × weight and
   * therefore unbounded: on a corpus where the query term is rare, {@code fuzzyName} (weight 24)
   * measured above 105 — over {@code exactName}'s hard ceiling of 100. Stages are combined with
   * {@code dis_max}, so whichever stage scores highest decides the result, and an unbounded text
   * stage silently outranks an exact identity match while the configured weights stop meaning
   * anything.
   *
   * <p>{@code weight * s / (s + pivot)} maps any BM25 score onto {@code [0, weight)}, which restores
   * the ordering the weights describe while keeping BM25's ordering <em>within</em> the stage.
   */
  public static final String STAGE_SATURATION_SCRIPT =
      "params.weight * _score / (_score + params.pivot)";

  /**
   * BM25 score at which a text stage reaches half its configured weight. Sized so a typical
   * multi-field name match lands near the middle of its band, leaving headroom in both directions
   * for BM25 to order results within the stage.
   */
  private static final double STAGE_SATURATION_PIVOT = 6.0D;

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
    return query == null ? List.of() : exactMatchTexts(List.of(query));
  }

  public static List<String> exactMatchTexts(List<String> queries) {
    if (queries == null || queries.isEmpty()) {
      return List.of();
    }

    LinkedHashSet<String> values = new LinkedHashSet<>();
    for (String query : queries) {
      if (query == null || query.trim().isEmpty()) {
        continue;
      }
      String trimmed = stripSurroundingQuotes(query.trim());
      if (trimmed.isEmpty()) {
        continue;
      }
      addExactTextVariants(values, trimmed);
      addExactTextVariants(values, trimmed.toLowerCase(Locale.ROOT));
    }
    return new ArrayList<>(values);
  }

  private static String stripSurroundingQuotes(String query) {
    return query.length() >= 2 && query.charAt(0) == '"' && query.charAt(query.length() - 1) == '"'
        ? query.substring(1, query.length() - 1).trim()
        : query;
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

  public static Map<String, Double> stageSaturationParams(RankingStage stage) {
    return Map.of("weight", (double) stageWeight(stage), "pivot", STAGE_SATURATION_PIVOT);
  }

  public static String minimumShouldMatch(RankingStage stage) {
    return !nullOrEmpty(stage.getMinimumShouldMatch()) ? stage.getMinimumShouldMatch() : "2<70%";
  }

  public static List<String> queryTerms(String query) {
    if (query == null || query.trim().isEmpty()) {
      return List.of();
    }
    return WHITESPACE_SPLITTER
        .splitAsStream(query.trim())
        .filter(token -> !token.isBlank())
        .toList();
  }

  public static String unescapePlainTextQuery(String query) {
    if (query == null || query.indexOf('\\') < 0) {
      return query;
    }

    StringBuilder unescaped = new StringBuilder(query.length());
    for (int index = 0; index < query.length(); index++) {
      char current = query.charAt(index);
      if (current == '\\'
          && index + 1 < query.length()
          && ESCAPED_QUERY_CHARACTERS.indexOf(query.charAt(index + 1)) >= 0) {
        unescaped.append(query.charAt(++index));
      } else {
        unescaped.append(current);
      }
    }
    return unescaped.toString();
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

  public static boolean signalFieldEnabled(RankingConfiguration ranking, String field) {
    RankingSignals signals = ranking != null ? ranking.getSignals() : null;
    return signals == null
        || nullOrEmpty(signals.getFields())
        || signals.getFields().contains(field);
  }

  public static Map<String, Float> stageFieldWeights(
      RankingStage stage, AssetTypeConfiguration assetConfig) {
    LinkedHashMap<String, Float> weights = new LinkedHashMap<>();
    List<String> fields = listOrEmpty(stage.getFields());
    if (fields.isEmpty()) {
      return weights;
    }

    Map<String, Double> configuredBoosts = configuredBoosts(assetConfig);
    double maxBoost = referenceBoost(configuredBoosts, fields);

    for (String field : fields) {
      Double configuredBoost = configuredBoost(field, configuredBoosts);
      if (configuredBoost == null || configuredBoost <= 0.0D) {
        weights.put(field, 1.0F);
      } else {
        double normalizedBoost = 0.75D + (Math.min(configuredBoost / maxBoost, 1.0D) * 0.5D);
        weights.put(field, (float) normalizedBoost);
      }
    }
    return weights;
  }

  /**
   * Scale that a stage's field boosts are normalised against: the largest boost configured anywhere
   * in the asset's {@code searchFields}, not the largest one inside this stage.
   *
   * <p>Normalising against the stage's own maximum makes a field's weight depend on what it happens
   * to share a stage with. A single-field stage promotes that field to the top weight however small
   * its configured boost — {@code descriptionContext} holds only {@code description} (boost 2 of 20)
   * and was scoring it as if it were a name field. Worse, the {@code all}/{@code dataAsset} search
   * merges every entity type's fields into one stage, so a niche field that one entity type boosts
   * highly sets the ceiling for everyone: {@code fqnParts} fell to 0.875 while a dashboard data
   * model's column name sat at 1.25.
   *
   * <p>Against a config-wide reference the weights mean the same thing in every stage and survive
   * the merge. Falls back to the stage's own maximum when the config carries no boosts at all.
   */
  private static double referenceBoost(Map<String, Double> configuredBoosts, List<String> fields) {
    double configured =
        configuredBoosts.values().stream()
            .filter(boost -> boost != null && boost > 0.0D)
            .mapToDouble(Double::doubleValue)
            .max()
            .orElse(0.0D);
    if (configured > 0.0D) {
      return configured;
    }
    return fields.stream()
        .map(field -> configuredBoost(field, configuredBoosts))
        .filter(boost -> boost != null && boost > 0.0D)
        .mapToDouble(Double::doubleValue)
        .max()
        .orElse(1.0D);
  }

  /**
   * Tie breaker for a stage's {@code best_fields} query: zero for the identity stages.
   *
   * <p>{@code displayName} falls back to {@code name} when an asset has none, and after the analyzer
   * fix {@code name.compound} tokenises identically to {@code name}, so the identity stages query up
   * to four restatements of one piece of evidence. A non-zero tie breaker adds a share of every
   * additional match, which turns "how many near-duplicate fields happened to match" into a
   * relevance signal — a longer, worse name that matched on more of them outranked the name the user
   * actually typed. Scoring the single best field removes the double count. Stages over genuinely
   * distinct fields ({@code structuralContext}, {@code descriptionContext}) keep the fallback.
   */
  public static double stageTieBreaker(RankingStage stage, double fallback) {
    List<String> fields = listOrEmpty(stage.getFields());
    boolean identityStage =
        !fields.isEmpty() && fields.stream().allMatch(SearchRankingHelper::isPrimaryNameField);
    return identityStage ? 0.0D : fallback;
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

  private static Map<String, Double> configuredBoosts(AssetTypeConfiguration assetConfig) {
    LinkedHashMap<String, Double> boosts = new LinkedHashMap<>();
    if (assetConfig == null || assetConfig.getSearchFields() == null) {
      return boosts;
    }
    for (FieldBoost fieldBoost : assetConfig.getSearchFields()) {
      if (!nullOrEmpty(fieldBoost.getField()) && fieldBoost.getBoost() != null) {
        boosts.put(fieldBoost.getField(), fieldBoost.getBoost());
      }
    }
    return boosts;
  }

  private static Double configuredBoost(String field, Map<String, Double> configuredBoosts) {
    Double boost = configuredBoosts.get(field);
    if (boost != null) {
      return boost;
    }
    String baseField = baseSearchField(field);
    return baseField.equals(field) ? null : configuredBoosts.get(baseField);
  }

  private static String baseSearchField(String field) {
    for (String suffix : List.of(".keyword", ".ngram", ".compound")) {
      if (field.endsWith(suffix)) {
        return field.substring(0, field.length() - suffix.length());
      }
    }
    return field;
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
    if (stageName.contains("prefix")) {
      return prefixNameFields(configuredFields, stage.getFields());
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

  /**
   * Analyzed name fields for the identity stages, including the {@code .compound} sub-fields.
   *
   * <p>The base field is stemmed and the compound sub-field is not, which is the point of having
   * both: kstem takes {@code customer} to {@code custom}, so a typed {@code custmer} is three edits
   * from the stemmed form and only reaches the document through the compound field's literal
   * {@code customer}. Dropping the sub-field here, on the grounds that the two restated one piece of
   * evidence, silently removed typo tolerance for every word kstem shortens. The double counting
   * that motivated it is handled by {@link #stageTieBreaker} scoring the single best field instead.
   */
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

  /**
   * Analyzed name fields the prefix stage can run {@code match_bool_prefix} against — no keyword or
   * n-gram sub-fields, since a prefix on a keyword field would only match the whole value.
   */
  private static List<String> prefixNameFields(
      List<String> configuredFields, List<String> fallback) {
    LinkedHashSet<String> fields = new LinkedHashSet<>();
    for (String field : configuredFields) {
      if ((field.equals("name") || field.equals("displayName")) && !field.contains(".")) {
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

  /**
   * Whether the query was an exact identifier lookup, and so should be re-run with {@link
   * #withoutFuzzyStages}.
   *
   * <p>Ranking stages sit under a {@code should} with {@code minimum_should_match: 1}, so the fuzzy
   * stage does not only score — it admits documents. It is an OR {@code multi_match} at partial
   * token coverage, and anything missing one of the query's tokens clears that threshold, since
   * {@code (T-1)/T} exceeds 70% for any realistic T. On a fully-qualified name that describes
   * exactly its siblings under the same parent, which is the "count 1 vs results 7381" bug
   * (#31227).
   *
   * <p>A genuine typo is also "one token off", so neither the query text nor a coverage threshold
   * separates the two. The one unambiguous signal is whether the query <em>is</em> an identifier: if
   * a returned document's name or fully-qualified name equals the query, the user asked for that
   * entity by identity and partial-coverage recall can only add its relatives. If nothing matches
   * the query exactly, it is a half-typed or misspelled search and the fuzzy stage is doing the job
   * its configuration claims — a "typo-tolerant identity fallback".
   *
   * <p>Decided on document identity rather than on which ranking stage matched. Stage provenance is
   * not a usable proxy: {@code closeName} is itself a partial-coverage stage, so an unrelated loose
   * match reads as "precise" and discards a half-typed query's real target.
   *
   * <p>Re-running rather than filtering hits keeps {@code hits.total} consistent with the list that
   * is returned; dropping hits client-side would recreate the count/results mismatch #31106 fixed.
   *
   * <p>Takes a stream rather than a materialised list because {@link #hasPrunableFuzzyStage} is true
   * for the shipped ranking, so this runs on every search response and not only on identifier
   * lookups. Consuming lazily bounds the work to the hits scanned before the first match instead of
   * deserialising every hit's source on the hot path — work the response serialisation then repeats.
   *
   * @param identifiers name and fullyQualifiedName of each returned hit, consumed lazily
   */
  public static boolean isExactIdentifierLookup(String query, Stream<String> identifiers) {
    if (nullOrEmpty(query)) {
      return false;
    }
    String target = query.trim();
    return identifiers.anyMatch(
        identifier -> identifier != null && identifier.equalsIgnoreCase(target));
  }

  /**
   * Whether dropping the fuzzy stages leaves a ranked query that still works — that is, whether
   * there is a fuzzy stage to remove <em>and</em> a non-fuzzy stage left to decide recall.
   *
   * <p>A ranking whose only stage is fuzzy has no precise pass to offer. Pruning it would empty the
   * stage list, {@code buildRankedSimpleQueryV2} would then see no stages and fall back to {@code
   * buildLegacySimpleQueryV2}, and that builder matches {@code fullyQualifiedName} with an OR
   * {@code multi_match} carrying no minimum-should-match at all — wider than the stage that was
   * just removed. Such a config skips the second pass entirely and keeps today's behaviour.
   */
  public static boolean hasPrunableFuzzyStage(SearchSettings searchSettings) {
    return searchSettings != null
        && (rankingHasPrunableFuzzyStage(defaultRanking(searchSettings))
            || listOrEmpty(searchSettings.getAssetTypeConfigurations()).stream()
                .map(AssetTypeConfiguration::getRanking)
                .anyMatch(SearchRankingHelper::rankingHasPrunableFuzzyStage));
  }

  /**
   * A copy of {@code searchSettings} with every fuzzy ranking stage removed.
   *
   * <p>Ranking stages are combined under a {@code should} with {@code minimum_should_match: 1}, so a
   * stage does not only score — it admits documents. The fuzzy stage is an OR {@code multi_match} at
   * partial token coverage, and a document missing just one of the query's tokens always clears that
   * threshold: {@code (T-1)/T} is above 70% for any realistic T. For a fully-qualified name that
   * describes exactly its siblings under the same parent, which is the "count 1 vs results 7381" bug
   * (#31227) — in CI the unwanted sibling column matched {@code ranking:fuzzyName} and nothing else.
   *
   * <p>No coverage threshold or field list can separate that from a genuine typo, because a typo is
   * also "one token off". What separates them is whether anything matched precisely, which is a
   * property of the result set rather than of a document, so it cannot be expressed in one bool
   * query. Hence the two-pass search: run the precise stages first and only widen with this stage's
   * recall when they find nothing — which is what the stage's own purpose already claims to be, a
   * "typo-tolerant identity <b>fallback</b>".
   */
  public static SearchSettings withoutFuzzyStages(SearchSettings searchSettings) {
    // Not memoised. An earlier version cached the pruned copy keyed on the source instance, on the
    // assumption that SettingsCache hands out one SearchSettings per settings version. It does not:
    // SettingsCache.getSetting runs JsonUtils.convertValue on every retrieval and the search
    // managers retrieve once per request, so a reference-identity key could never hit and the cache
    // only held a strong reference to a dead object. Keying it on content would cost as much as the
    // copy it saves, and this runs at most once per request and only for an exact identifier
    // lookup.
    SearchSettings precise = JsonUtils.deepCopy(searchSettings, SearchSettings.class);
    dropFuzzyStages(defaultRanking(precise));
    listOrEmpty(precise.getAssetTypeConfigurations()).stream()
        .map(AssetTypeConfiguration::getRanking)
        .forEach(SearchRankingHelper::dropFuzzyStages);
    return precise;
  }

  /**
   * Runs {@code pass} with the given settings and, when the query turns out to name an entity
   * exactly, runs it again without the fuzzy stages. Shared by the Elasticsearch and OpenSearch
   * managers, whose response and request-builder types differ but whose control flow does not.
   *
   * <p>A first page costs one round-trip unless the query turns out to name an entity, which pays a
   * second. Deeper pages and cursor pages cannot judge from what they return, so they pay a probe
   * plus the page itself.
   */
  public static <R> R searchWithIdentifierPrecision(
      String query,
      SearchSettings searchSettings,
      SearchWindow window,
      SearchPass<R> pass,
      Function<R, Stream<String>> identifiersOf)
      throws IOException {
    if (!hasPrunableFuzzyStage(searchSettings)) {
      return pass.run(searchSettings, window);
    }
    // A cursor request also arrives with from=0, but search_after has scrolled it away from the
    // top,
    // so its window is no more the top of the ranking than a from=15 window is.
    boolean requestedWindowIsTheProbe =
        !window.cursorPaged() && window.from() == 0 && window.size() >= IDENTITY_PROBE_SIZE;
    R requestedWindow = requestedWindowIsTheProbe ? pass.run(searchSettings, window) : null;
    R probe =
        requestedWindowIsTheProbe
            ? requestedWindow
            : pass.run(searchSettings, SearchWindow.probe());
    if (isExactIdentifierLookup(query, identifiersOf.apply(probe))) {
      return pass.run(withoutFuzzyStages(searchSettings), window);
    }
    return requestedWindowIsTheProbe ? requestedWindow : pass.run(searchSettings, window);
  }

  /**
   * The slice of the ranking a pass should return.
   *
   * @param cursorPaged whether the caller supplied a {@code search_after} cursor. Such a request
   *     carries {@code from=0} while pointing anywhere in the ranking, so it must never be mistaken
   *     for the top, and the probe must run without the cursor to read the actual top.
   */
  public record SearchWindow(int from, int size, boolean cursorPaged) {
    public static SearchWindow probe() {
      return new SearchWindow(0, IDENTITY_PROBE_SIZE, false);
    }
  }

  /**
   * One execution of a search, parameterised by the settings it should be built from and the window
   * it should return. The window is a parameter because the identity probe has to read the top of
   * the ranking regardless of which page, or which cursor position, the caller asked for.
   */
  @FunctionalInterface
  public interface SearchPass<R> {
    R run(SearchSettings searchSettings, SearchWindow window) throws IOException;
  }

  /**
   * {@code name} and {@code fullyQualifiedName} of one hit source.
   *
   * <p>Callers map this over their hits lazily so a source is only deserialised until the first
   * identifier matches — see {@link #searchWithIdentifierPrecision}.
   */
  public static Stream<String> identifiersFrom(JsonObject hitSource) {
    if (hitSource == null) {
      return Stream.empty();
    }
    List<String> identifiers = new ArrayList<>(IDENTITY_FIELDS.size());
    for (String field : IDENTITY_FIELDS) {
      JsonValue value = hitSource.get(field);
      if (value != null && value.getValueType() == JsonValue.ValueType.STRING) {
        identifiers.add(hitSource.getString(field));
      }
    }
    return identifiers.stream();
  }

  private static boolean rankingHasPrunableFuzzyStage(RankingConfiguration ranking) {
    boolean prunable = false;
    if (ranking != null) {
      List<RankingStage> stages = listOrEmpty(ranking.getStages());
      prunable =
          stages.stream().anyMatch(SearchRankingHelper::isFuzzyStage)
              && stages.stream().anyMatch(stage -> !isFuzzyStage(stage));
    }
    return prunable;
  }

  private static boolean isFuzzyStage(RankingStage stage) {
    return RankingStage.MatchType.FUZZY.equals(stage.getMatchType());
  }

  private static void dropFuzzyStages(RankingConfiguration ranking) {
    if (ranking != null && !nullOrEmpty(ranking.getStages())) {
      List<RankingStage> preciseStages =
          ranking.getStages().stream().filter(stage -> !isFuzzyStage(stage)).toList();
      // Never leave the list empty. deriveRanking() falls back to the default stages when a pruned
      // list comes out empty, and buildRankedSimpleQueryV2 falls back to the legacy builder, whose
      // unbounded OR multi_match on fullyQualifiedName is wider than the stage just removed. A
      // fuzzy-only ranking keeps its stage; hasPrunableFuzzyStage() skips its second pass instead.
      if (!preciseStages.isEmpty()) {
        ranking.setStages(preciseStages);
      }
    }
  }
}
