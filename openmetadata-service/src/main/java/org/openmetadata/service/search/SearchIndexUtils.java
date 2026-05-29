package org.openmetadata.service.search;

import static org.openmetadata.service.search.SearchUtils.getAggregationBuckets;
import static org.openmetadata.service.search.SearchUtils.getAggregationObject;

import com.fasterxml.jackson.core.type.TypeReference;
import jakarta.json.JsonArray;
import jakarta.json.JsonNumber;
import jakarta.json.JsonObject;
import jakarta.json.JsonString;
import jakarta.json.JsonValue;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.function.Supplier;
import java.util.stream.Collectors;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.ColumnsEntityInterface;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.lineage.EsLineageData;
import org.openmetadata.schema.tests.DataQualityReport;
import org.openmetadata.schema.tests.Datum;
import org.openmetadata.schema.tests.type.DataQualityReportMetadata;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.ChangeSummaryMap;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.type.change.ChangeSummary;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.TypeRegistry;
import org.openmetadata.service.util.Utilities;

@Slf4j
public final class SearchIndexUtils {

  // Keeping the bots list static so we can call this from anywhere in the codebase
  public static final List<String> AI_BOTS =
      List.of("collateaiapplicationbot", "collateaiqualityagentapplicationbot");

  private SearchIndexUtils() {}

  /**
   * Lucene rejects any indexed term whose UTF-8 encoding exceeds 32766 bytes. Values inside a
   * {@code flattened} / {@code flat_object} field (e.g. the recursive {@code columns.children}
   * subtree) are indexed as single un-tokenized keyword terms, so one oversized leaf — such as a
   * long PowerBI DAX expression stored in a column description — fails the whole document with an
   * "immense term" error.
   */
  private static final int LUCENE_MAX_TERM_BYTES = 32766;

  /**
   * Headroom reserved below the Lucene limit. A {@code flat_object} also indexes a
   * {@code _valueAndPath} term (the leaf path prefixed to the value), so the value budget is the
   * limit minus this margin minus the path length; the margin covers delimiters and engine
   * overhead beyond the path we compute.
   */
  private static final int TERM_SAFETY_MARGIN_BYTES = 512;

  /**
   * A Java {@code char} encodes to at most 3 UTF-8 bytes (supplementary code points use a surrogate
   * pair — 2 chars — for 4 bytes, i.e. 2 bytes/char), so {@code length() * 3} is a safe upper bound
   * on a string's UTF-8 size. Used as an allocation-free pre-check before encoding a value.
   */
  private static final int MAX_UTF8_BYTES_PER_CHAR = 3;

  /**
   * Caps oversize string values inside the {@code flat_object} fields of a search document so a
   * single leaf cannot exceed Lucene's per-term byte limit and reject the entire document. Only the
   * subtrees whose dot-path is in {@code flattenedFieldPaths} are trimmed (recursively) — that set
   * is derived from the index mappings ({@code "type": "flattened"}), so it covers exactly the
   * fields at risk and stays in sync with the mappings. {@code text}/{@code keyword} fields
   * (including {@code object}-mapped {@code children}) are left as-is. Trimming is in place, on a
   * character boundary; the full value is preserved on the source entity (database/API), so entity
   * pages and APIs are unaffected.
   *
   * <p>{@code entityContext} is resolved lazily and only when a value is actually trimmed, so the
   * common (no-trim) bulk-reindex path never builds the context string.
   */
  public static void capOversizeValues(
      final Object node,
      final Set<String> flattenedFieldPaths,
      final Supplier<String> entityContext) {
    if (flattenedFieldPaths == null || flattenedFieldPaths.isEmpty()) {
      return;
    }
    try {
      capOversizeValues(node, "", flattenedFieldPaths, entityContext);
    } catch (RuntimeException e) {
      // Best-effort safety net: a defect here must never drop an otherwise-valid document from
      // search. Log and continue — if the document still holds an oversized leaf the engine will
      // reject it as before, but capping must never itself be the cause of an indexing failure.
      LOG.warn(
          "Skipped oversize-value capping for [{}] due to: {}",
          entityContext == null ? "unknown" : entityContext.get(),
          e.toString());
    }
  }

  private static void capOversizeValues(
      final Object node,
      final String path,
      final Set<String> flattenedFieldPaths,
      final Supplier<String> entityContext) {
    if (node instanceof Map<?, ?> rawMap) {
      @SuppressWarnings("unchecked")
      Map<String, Object> map = (Map<String, Object>) rawMap;
      for (Map.Entry<String, Object> entry : map.entrySet()) {
        String childPath = path.isEmpty() ? entry.getKey() : path + "." + entry.getKey();
        if (flattenedFieldPaths.contains(childPath)) {
          trimAllStrings(
              entry.getValue(),
              new StringBuilder(childPath),
              childPath.getBytes(StandardCharsets.UTF_8).length,
              entityContext);
        } else {
          capOversizeValues(entry.getValue(), childPath, flattenedFieldPaths, entityContext);
        }
      }
    } else if (node instanceof List<?> rawList) {
      for (Object item : rawList) {
        capOversizeValues(item, path, flattenedFieldPaths, entityContext);
      }
    }
  }

  private static void trimAllStrings(
      final Object node,
      final StringBuilder path,
      final int pathBytes,
      final Supplier<String> entityContext) {
    if (node instanceof Map<?, ?> rawMap) {
      trimMapStrings(rawMap, path, pathBytes, entityContext);
    } else if (node instanceof List<?> rawList) {
      trimListStrings(rawList, path, pathBytes, entityContext);
    }
  }

  private static void trimMapStrings(
      final Map<?, ?> rawMap,
      final StringBuilder path,
      final int pathBytes,
      final Supplier<String> entityContext) {
    @SuppressWarnings("unchecked")
    Map<String, Object> map = (Map<String, Object>) rawMap;
    for (Map.Entry<String, Object> entry : map.entrySet()) {
      String key = entry.getKey();
      int mark = path.length();
      path.append('.').append(key);
      int childBytes = pathBytes + 1 + key.getBytes(StandardCharsets.UTF_8).length;
      Object value = entry.getValue();
      Object trimmed = trimIfOversized(value, path, childBytes, entityContext);
      if (trimmed != value) {
        entry.setValue(trimmed);
      }
      trimAllStrings(value, path, childBytes, entityContext);
      path.setLength(mark);
    }
  }

  private static void trimListStrings(
      final List<?> rawList,
      final StringBuilder path,
      final int pathBytes,
      final Supplier<String> entityContext) {
    @SuppressWarnings("unchecked")
    List<Object> list = (List<Object>) rawList;
    for (int index = 0; index < list.size(); index++) {
      Object value = list.get(index);
      Object trimmed = trimIfOversized(value, path, pathBytes, entityContext);
      if (trimmed != value) {
        list.set(index, trimmed);
      }
      trimAllStrings(value, path, pathBytes, entityContext);
    }
  }

  /**
   * Pre-checks by char count before encoding: a {@code String} is at most {@code 3} UTF-8 bytes per
   * char, so a value short enough by {@code length()} cannot exceed the budget and is skipped
   * without allocating a {@code byte[]}. Only candidates that might be oversize are encoded.
   */
  private static Object trimIfOversized(
      final Object value,
      final CharSequence fieldPath,
      final int pathBytes,
      final Supplier<String> entityContext) {
    Object result = value;
    if (value instanceof String text) {
      int budget = valueByteBudget(pathBytes);
      if ((long) text.length() * MAX_UTF8_BYTES_PER_CHAR > budget) {
        result = encodeAndTrim(text, budget, fieldPath, entityContext);
      }
    }
    return result;
  }

  private static Object encodeAndTrim(
      final String text,
      final int budget,
      final CharSequence fieldPath,
      final Supplier<String> entityContext) {
    byte[] bytes = text.getBytes(StandardCharsets.UTF_8);
    Object result = text;
    if (bytes.length > budget) {
      result = trimToByteLimit(bytes, budget);
      LOG.warn(
          "Trimmed oversize search value [entity={}, field={}] from {} to {} bytes to stay under the index term limit",
          entityContext.get(),
          fieldPath.toString(),
          bytes.length,
          budget);
    }
    return result;
  }

  /**
   * Budget for a single value so that both the {@code _value} term and the path-prefixed
   * {@code _valueAndPath} term stay under {@link #LUCENE_MAX_TERM_BYTES}, accounting for the leaf
   * path (UTF-8 bytes) which grows with nesting depth.
   */
  private static int valueByteBudget(final int pathBytes) {
    return Math.max(0, LUCENE_MAX_TERM_BYTES - TERM_SAFETY_MARGIN_BYTES - pathBytes);
  }

  /**
   * Truncates UTF-8 {@code bytes} to at most {@code limit} bytes, backing off any trailing
   * continuation byte ({@code 10xxxxxx}) so a multi-byte character is never split. The source string
   * is always valid UTF-8, so the retained prefix re-decodes without loss or replacement characters.
   */
  private static String trimToByteLimit(final byte[] bytes, final int limit) {
    int cut = Math.min(limit, bytes.length);
    while (cut > 0 && cut < bytes.length && (bytes[cut] & 0xC0) == 0x80) {
      cut--;
    }
    return new String(bytes, 0, cut, StandardCharsets.UTF_8);
  }

  /**
   * Deduplicates identical SQL queries across lineage edges in-place.
   *
   * <p>Each unique SQL text is assigned a sequential integer key ("1", "2", …). Every edge that
   * carries that SQL has its {@code sqlQuery} cleared and {@code sqlQueryKey} set to the shared
   * key. The returned map contains {@code key → sqlText} for all unique SQLs found.
   *
   * <p>Edges with no SQL are left untouched.
   */
  public static Map<String, String> deduplicateSqlAcrossEdges(List<EsLineageData> edges) {
    Map<String, String> sqlTextToKey = new LinkedHashMap<>();
    Map<String, String> sqlQueries = new LinkedHashMap<>();
    int[] counter = {0};

    for (EsLineageData edge : edges) {
      String sql = edge.getSqlQuery();
      if (sql != null && !sql.isEmpty()) {
        String key =
            sqlTextToKey.computeIfAbsent(
                sql,
                k -> {
                  String newKey = String.valueOf(++counter[0]);
                  sqlQueries.put(newKey, sql);
                  return newKey;
                });
        edge.setSqlQueryKey(key);
        edge.setSqlQuery(null);
      }
    }

    return sqlQueries;
  }

  /**
   * Progressively strips lineage fields from a search document JSON to bring it under maxBytes.
   *
   * <p>Stripping order: lineageSqlQueries first (retains topology), then upstreamLineage.
   * Returns the (possibly stripped) JSON — caller must re-check size and handle the still-oversized
   * case.
   */
  public static String stripLineageForSize(
      String json, long maxBytes, String docId, String entityType) {
    if (json.getBytes(StandardCharsets.UTF_8).length <= maxBytes) {
      return json;
    }
    TypeReference<Map<String, Object>> mapType = new TypeReference<>() {};
    Map<String, Object> doc = JsonUtils.readValue(json, mapType);
    if (doc.remove("lineageSqlQueries") != null) {
      stripSqlQueryKeysFromEdges(doc);
      json = JsonUtils.pojoToJson(doc);
      int sizeAfterStrip = json.getBytes(StandardCharsets.UTF_8).length;
      LOG.warn(
          "Document {} ({}) too large, stripped lineageSqlQueries (size now {} bytes)",
          docId,
          entityType,
          sizeAfterStrip);
      if (sizeAfterStrip <= maxBytes) {
        return json;
      }
    }
    doc.remove("upstreamLineage");
    json = JsonUtils.pojoToJson(doc);
    LOG.warn(
        "Document {} ({}) still too large, stripped upstreamLineage (size now {} bytes)",
        docId,
        entityType,
        json.getBytes(StandardCharsets.UTF_8).length);
    return json;
  }

  public static Map<String, Object> stripDocMapIfOversized(
      Map<String, Object> doc, long maxBytes, String docId, String entityType) {
    String json = JsonUtils.pojoToJson(doc);
    if (json.getBytes(StandardCharsets.UTF_8).length <= maxBytes) {
      return doc;
    }
    if (doc.remove("lineageSqlQueries") != null) {
      stripSqlQueryKeysFromEdges(doc);
      json = JsonUtils.pojoToJson(doc);
      int strippedSize = json.getBytes(StandardCharsets.UTF_8).length;
      LOG.warn(
          "Live index doc {} ({}) too large, stripped lineageSqlQueries ({} bytes)",
          docId,
          entityType,
          strippedSize);
      if (strippedSize <= maxBytes) {
        return doc;
      }
    }
    if (doc.remove("upstreamLineage") != null) {
      LOG.warn(
          "Live index doc {} ({}) still too large, stripped upstreamLineage ({} bytes)",
          docId,
          entityType,
          JsonUtils.pojoToJson(doc).getBytes(StandardCharsets.UTF_8).length);
    }
    return doc;
  }

  @SuppressWarnings("unchecked")
  private static void stripSqlQueryKeysFromEdges(Map<String, Object> doc) {
    Object lineage = doc.get("upstreamLineage");
    if (lineage instanceof List<?> edges) {
      for (Object edge : edges) {
        if (edge instanceof Map<?, ?> edgeMap) {
          ((Map<String, Object>) edgeMap).remove("sqlQueryKey");
        }
      }
    }
  }

  public static List<String> parseFollowers(List<EntityReference> followersRef) {
    if (followersRef == null) {
      return Collections.emptyList();
    }
    return followersRef.stream().map(item -> item.getId().toString()).toList();
  }

  public static List<String> parseOwners(List<EntityReference> ownersRef) {
    if (ownersRef == null) {
      return Collections.emptyList();
    }
    return ownersRef.stream().map(item -> item.getId().toString()).toList();
  }

  public static Map<String, Object> toEntityRefMap(EntityReference ref) {
    if (ref == null) {
      return null;
    }
    Map<String, Object> map = new HashMap<>();
    map.put("id", ref.getId() != null ? ref.getId().toString() : null);
    map.put("name", ref.getName());
    map.put(
        "displayName",
        ref.getDisplayName() != null && !ref.getDisplayName().isBlank()
            ? ref.getDisplayName()
            : ref.getName());
    map.put("fullyQualifiedName", ref.getFullyQualifiedName());
    map.put("description", ref.getDescription());
    map.put("deleted", ref.getDeleted());
    map.put("type", ref.getType());
    return map;
  }

  public static void removeNonIndexableFields(Map<String, Object> doc, Set<String> fields) {
    for (String key : fields) {
      if (key.contains(".")) {
        removeFieldByPath(doc, key);
      } else {
        doc.remove(key);
      }
    }
  }

  public static void removeFieldByPath(Map<String, Object> jsonMap, String path) {
    String[] pathElements = path.split("\\.");
    if (pathElements.length == 1) {
      jsonMap.remove(pathElements[0]);
      return;
    }
    Map<String, Object> currentMap = jsonMap;

    String key = pathElements[0];
    Object value = currentMap.get(key);
    if (value instanceof Map) {
      currentMap = (Map<String, Object>) value;
    } else if (value instanceof List) {
      List<?> list = (List<Map<String, Object>>) value;
      for (Object obj : list) {
        @SuppressWarnings("unchecked")
        Map<String, Object> item =
            obj instanceof Map ? (Map<String, Object>) obj : JsonUtils.getMap(obj);
        removeFieldByPath(
            item,
            Arrays.stream(pathElements, 1, pathElements.length).collect(Collectors.joining(".")));
      }
      return;
    } else {
      return;
    }

    // Remove the field at the last path element
    String lastKey = pathElements[pathElements.length - 1];
    currentMap.remove(lastKey);
  }

  private static void handleLeafTermsAggregation(
      JsonObject aggregationResults, List<Datum> reportData, Map<String, String> nodeData) {
    Optional<String> docCount = Optional.ofNullable(aggregationResults.get("doc_count").toString());
    docCount.ifPresentOrElse(
        s -> nodeData.put("document_count", s), () -> nodeData.put("document_count", null));

    Datum datum = new Datum();
    for (Map.Entry<String, String> entry : nodeData.entrySet()) {
      datum.withAdditionalProperty(entry.getKey(), entry.getValue());
    }

    reportData.add(datum);
  }

  private static void handleLeafMetricsAggregation(
      JsonObject aggregationResults,
      List<Datum> reportData,
      Map<String, String> nodeData,
      String metric) {
    String valueStr = null;
    if (aggregationResults.containsKey("value")) {
      JsonNumber value = aggregationResults.getJsonNumber("value");
      if (value != null) valueStr = value.toString();
    } else {
      valueStr = aggregationResults.getString("value_as_string", null);
    }

    nodeData.put(metric, valueStr);
    Datum datum = new Datum();
    for (Map.Entry<String, String> entry : nodeData.entrySet()) {
      datum.withAdditionalProperty(entry.getKey(), entry.getValue());
    }

    reportData.add(datum);
  }

  /*
   * Traverse the aggregation results and build the report data. Note that the method supports
   * n levels of nested aggregations, but does not support sibling aggregations.
   *
   * @Param aggregationResults the aggregation results
   * @Param reportData the report data
   * @Param nodeData the node data
   * @Param keys the keys to traverse the aggregation tree
   * @Param metric the metric to add to the report data
   * @Param dimensions the dimensions to add to the report data
   * @return the report data
   */
  private static void traverseAggregationResults(
      JsonObject aggregationResults,
      List<Datum> reportData,
      Map<String, String> nodeData,
      List<String> keys,
      String metric,
      List<String> dimensions) {

    if (keys.isEmpty()) {
      // We are in the leaf of the term aggregation. We'll add the count of documents as the metric
      handleLeafTermsAggregation(aggregationResults, reportData, nodeData);
      return;
    }

    // The current key represent the node in the aggregation tree (i.e. the current bucket)
    String currentKey = keys.get(0);
    Optional<JsonObject> aggregation =
        Optional.ofNullable(getAggregationObject(aggregationResults, currentKey));

    aggregation.ifPresent(
        agg -> {
          Optional<JsonArray> buckets = Optional.ofNullable(getAggregationBuckets(agg));
          if (buckets.isEmpty()) {
            if ((keys.size() > 1) && (agg.containsKey(keys.get(1)))) {
              // If the current node in the aggregation tree does not have further buckets
              // but contains the next level of aggregation, it means we are in the nested
              // aggregation. Nested aggregations are structural and don't produce bucket
              // keys, so we pass dimensions through unchanged.
              traverseAggregationResults(
                  agg, reportData, nodeData, keys.subList(1, keys.size()), metric, dimensions);
            } else {
              // If the current node in the aggregation tree does not have further bucket
              // it means we are in the leaf of the metric aggregation. We'll add the metric
              handleLeafMetricsAggregation(agg, reportData, nodeData, metric);
            }
          } else {
            buckets
                .get()
                .forEach(
                    bucket -> {
                      JsonObject bucketObject = (JsonObject) bucket;
                      Optional<JsonValue> val = Optional.of(bucketObject.get("key"));

                      val.ifPresentOrElse(
                          s -> {
                            switch (s.getValueType()) {
                              case NUMBER -> nodeData.put(dimensions.get(0), String.valueOf(s));
                              default -> nodeData.put(
                                  dimensions.get(0), ((JsonString) s).getString());
                            }
                          },
                          () -> nodeData.put(dimensions.get(0), null));

                      // Traverse the next level of the aggregation tree.
                      // Dimensions and keys represent the same level in the tree.
                      // They are used for different purpose (i.e. dimensions are used to
                      // generate the report while the keys are used to traverse the aggregation
                      // tree)
                      traverseAggregationResults(
                          bucketObject,
                          reportData,
                          nodeData,
                          keys.subList(1, keys.size()),
                          metric,
                          dimensions.subList(1, dimensions.size()));
                    });
          }
        });
  }

  public static DataQualityReport parseAggregationResults(
      Optional<JsonObject> aggregationResults, DataQualityReportMetadata metadata) {
    List<Datum> reportData = new ArrayList<>();

    aggregationResults.ifPresent(
        jsonObject ->
            traverseAggregationResults(
                jsonObject,
                reportData,
                new HashMap<>(),
                metadata.getKeys(),
                metadata.getMetrics().get(0),
                metadata.getDimensions()));

    DataQualityReport report = new DataQualityReport();
    return report.withMetadata(metadata).withData(reportData);
  }

  public static List<TagLabel> parseTags(List<TagLabel> tags) {
    if (tags == null) {
      return Collections.emptyList();
    }
    return tags;
  }

  public static SearchAggregation buildAggregationTree(String aggregationString) {
    List<List<Map<String, String>>> aggregationsMetadata = new ArrayList<>();
    SearchAggregationNode root = new SearchAggregationNode("root", "root", null);
    String[] siblings = aggregationString.split(";");
    for (String sibling : siblings) {
      List<Map<String, String>> siblingAggregationsMetadata = new ArrayList<>();
      SearchAggregationNode currentNode = root;
      String[] nestedAggregations = sibling.split(Utilities.doubleQuoteRegexEscape(","), -1);
      for (String aggregation : nestedAggregations) {
        SearchAggregationNode bucketNode = new SearchAggregationNode();
        String[] nestedAggregationSiblings = aggregation.split("::");
        for (int j = 0; j < nestedAggregationSiblings.length; j++) {
          Map<String, String> nestedAggregationMetadata = new HashMap<>();

          String nestedAggregationSibling = nestedAggregationSiblings[j];
          String[] parts =
              nestedAggregationSibling.split(Utilities.doubleQuoteRegexEscape(":(?!:)"));
          for (String part : parts) {
            if (part.contains("&")) {
              String[] subParts = part.split("&");
              Map<String, String> params = new HashMap<>();
              for (String subPart : subParts) {
                String[] kvPairs = subPart.split(Utilities.doubleQuoteRegexEscape("="), -1);
                params.put(kvPairs[0], Utilities.cleanUpDoubleQuotes(kvPairs[1]));
                nestedAggregationMetadata.put(
                    kvPairs[0], Utilities.cleanUpDoubleQuotes(kvPairs[1]));
              }
              bucketNode.setValue(params);
            } else {
              String[] kvPairs = part.split(Utilities.doubleQuoteRegexEscape("="), -1);
              switch (kvPairs[0]) {
                case "aggType":
                  bucketNode.setType(Utilities.cleanUpDoubleQuotes(kvPairs[1]));
                  nestedAggregationMetadata.put(
                      kvPairs[0], Utilities.cleanUpDoubleQuotes(kvPairs[1]));
                  break;
                case "bucketName":
                  bucketNode.setName(Utilities.cleanUpDoubleQuotes(kvPairs[1]));
                  nestedAggregationMetadata.put(
                      kvPairs[0], Utilities.cleanUpDoubleQuotes(kvPairs[1]));
                  break;
                default:
                  nestedAggregationMetadata.put(
                      kvPairs[0], Utilities.cleanUpDoubleQuotes(kvPairs[1]));
                  bucketNode.setValue(
                      Map.of(kvPairs[0], Utilities.cleanUpDoubleQuotes(kvPairs[1])));
              }
            }
          }
          currentNode.addChild(bucketNode);
          if (j < nestedAggregationSiblings.length - 1) {
            bucketNode = new SearchAggregationNode();
          }
          siblingAggregationsMetadata.add(nestedAggregationMetadata);
        }
        currentNode = bucketNode;
      }
      aggregationsMetadata.add(siblingAggregationsMetadata);
    }
    return new SearchAggregation(root, aggregationsMetadata);
  }

  public static String getDescriptionSource(
      String description, Map<String, ChangeSummary> changeSummaryMap, String changeSummaryKey) {
    if (description == null) {
      return null;
    }

    String descriptionSource = ChangeSource.INGESTED.value();

    if (changeSummaryMap != null) {
      if (changeSummaryMap.containsKey(changeSummaryKey)
          && changeSummaryMap.get(changeSummaryKey).getChangeSource() != null) {
        if (AI_BOTS.contains(changeSummaryMap.get(changeSummaryKey).getChangedBy())) {
          // If bot is directly PATCHing and not suggesting, we need to still consider it's a
          // suggested change
          descriptionSource = ChangeSource.SUGGESTED.value();
        } else {
          // Otherwise, use the change summary source
          descriptionSource = changeSummaryMap.get(changeSummaryKey).getChangeSource().value();
        }
      }
    }
    return descriptionSource;
  }

  private static void processTagAndTierSources(
      List<TagLabel> tagList, TagAndTierSources tagAndTierSources) {
    if (tagList == null) {
      return;
    }
    for (TagLabel tag : tagList) {
      // Defensive: tags deserialized from historical entity_extension rows may have null
      // labelType or null tagFQN. Skip the malformed tag entirely.
      if (tag == null) {
        continue;
      }
      String tagFQN = tag.getTagFQN();
      TagLabel.LabelType labelType = tag.getLabelType();
      if (tagFQN == null || labelType == null) {
        continue;
      }
      String tagSource = labelType.value();
      Map<String, Integer> bucket =
          tagFQN.startsWith("Tier.")
              ? tagAndTierSources.getTierSources()
              : tagAndTierSources.getTagSources();
      bucket.merge(tagSource, 1, Integer::sum);
    }
  }

  private static void processEntityTagSources(
      EntityInterface entity, TagAndTierSources tagAndTierSources) {
    processTagAndTierSources(entity.getTags(), tagAndTierSources);
  }

  private static void processColumnTagSources(
      ColumnsEntityInterface entity, TagAndTierSources tagAndTierSources) {
    for (Column column : entity.getColumns()) {
      processTagAndTierSources(column.getTags(), tagAndTierSources);
    }
  }

  public static TagAndTierSources processTagAndTierSources(EntityInterface entity) {
    TagAndTierSources tagAndTierSources = new TagAndTierSources();
    processEntityTagSources(entity, tagAndTierSources);
    if (SearchIndexUtils.hasColumns(entity)) {
      processColumnTagSources((ColumnsEntityInterface) entity, tagAndTierSources);
    }
    return tagAndTierSources;
  }

  public static void processDescriptionSource(
      EntityInterface entity,
      Map<String, ChangeSummary> changeSummaryMap,
      Map<String, Integer> descriptionSources) {
    Optional.ofNullable(
            getDescriptionSource(entity.getDescription(), changeSummaryMap, "description"))
        .ifPresent(
            source ->
                descriptionSources.put(source, descriptionSources.getOrDefault(source, 0) + 1));
  }

  public static void processColumnDescriptionSources(
      ColumnsEntityInterface entity,
      Map<String, ChangeSummary> changeSummaryMap,
      Map<String, Integer> descriptionSources) {
    for (Column column : entity.getColumns()) {
      Optional.ofNullable(
              getDescriptionSource(
                  column.getDescription(),
                  changeSummaryMap,
                  String.format("columns.%s.description", column.getName())))
          .ifPresent(
              source ->
                  descriptionSources.put(source, descriptionSources.getOrDefault(source, 0) + 1));
    }
  }

  public static boolean hasColumns(EntityInterface entity) {
    return List.of(entity.getClass().getInterfaces()).contains(ColumnsEntityInterface.class);
  }

  public static Map<String, Integer> processDescriptionSources(
      EntityInterface entity, Map<String, ChangeSummary> changeSummaryMap) {
    Map<String, Integer> descriptionSources = new HashMap<>();
    processDescriptionSource(entity, changeSummaryMap, descriptionSources);
    if (hasColumns(entity)) {
      processColumnDescriptionSources(
          (ColumnsEntityInterface) entity, changeSummaryMap, descriptionSources);
    }
    return descriptionSources;
  }

  public static Map<String, ChangeSummary> getChangeSummaryMap(EntityInterface entity) {
    return Optional.ofNullable(entity.getChangeDescription())
        .map(ChangeDescription::getChangeSummary)
        .map(ChangeSummaryMap::getAdditionalProperties)
        .orElse(null);
  }

  @Getter
  public static class TagAndTierSources {
    private final Map<String, Integer> tagSources;
    private final Map<String, Integer> tierSources;

    public TagAndTierSources() {
      this.tagSources = new HashMap<>();
      this.tierSources = new HashMap<>();
    }
  }

  /**
   * Flattens a custom property value into a searchable string.
   * Handles various types: String, Number, Boolean, List, Map (entityReference, timeInterval, etc.)
   */
  private static String flattenValue(Object value) {
    if (value == null) {
      return "";
    }
    if (value instanceof String) {
      return (String) value;
    }
    if (value instanceof Number || value instanceof Boolean) {
      return value.toString();
    }
    if (value instanceof List<?> list) {
      return list.stream().map(SearchIndexUtils::flattenValue).collect(Collectors.joining(" "));
    }
    if (value instanceof Map<?, ?> map) {
      return flattenMapValue(map);
    }
    return value.toString();
  }

  /**
   * Extracts searchable text from Map-based custom property values.
   * Handles entityReference, timeInterval, hyperlink, table-cp, and other complex types.
   */
  private static String flattenMapValue(Map<?, ?> map) {
    List<String> parts = new ArrayList<>();

    // EntityReference: extract displayName, name, or fullyQualifiedName
    if (map.containsKey("type") && map.containsKey("id")) {
      // This looks like an entityReference
      extractIfPresent(map, "displayName", parts);
      extractIfPresent(map, "name", parts);
      extractIfPresent(map, "fullyQualifiedName", parts);
      if (!parts.isEmpty()) {
        return String.join(" ", parts);
      }
    }

    // TimeInterval: extract start and end
    if (map.containsKey("start") || map.containsKey("end")) {
      extractIfPresent(map, "start", parts);
      extractIfPresent(map, "end", parts);
      if (!parts.isEmpty()) {
        return String.join(" ", parts);
      }
    }

    // Hyperlink: extract url and displayText
    if (map.containsKey("url")) {
      extractIfPresent(map, "displayText", parts);
      extractIfPresent(map, "url", parts);
      if (!parts.isEmpty()) {
        return String.join(" ", parts);
      }
    }

    // Table-cp (rows): flatten nested row data
    if (map.containsKey("rows")) {
      Object rows = map.get("rows");
      if (rows instanceof List) {
        return flattenValue(rows);
      }
    }

    // Generic fallback: extract all string/number values from the map
    for (Map.Entry<?, ?> entry : map.entrySet()) {
      Object v = entry.getValue();
      if (v instanceof String || v instanceof Number) {
        parts.add(v.toString());
      }
    }

    if (!parts.isEmpty()) {
      return String.join(" ", parts);
    }

    // Last resort: JSON representation
    return JsonUtils.pojoToJson(map);
  }

  private static void extractIfPresent(Map<?, ?> map, String key, List<String> parts) {
    Object value = map.get(key);
    if (value != null) {
      String str = value.toString();
      if (!str.isEmpty()) {
        parts.add(str);
      }
    }
  }

  /**
   * Builds typed custom properties for ES nested array indexing.
   * This enables range queries, exact matches, and structured queries on custom properties
   * while keeping the field count bounded.
   *
   * @param extension The extension object containing custom properties
   * @param entityType The entity type (e.g., "table", "dashboard") to look up property types
   * @return List of typed custom property maps for ES nested indexing
   */
  public static List<Map<String, Object>> buildTypedCustomProperties(
      Object extension, String entityType) {
    if (extension == null) {
      return Collections.emptyList();
    }

    List<Map<String, Object>> typedProperties = new ArrayList<>();

    try {
      Map<String, Object> extensionMap = JsonUtils.getMap(extension);
      if (extensionMap == null || extensionMap.isEmpty()) {
        return Collections.emptyList();
      }

      for (Map.Entry<String, Object> entry : extensionMap.entrySet()) {
        String propertyName = entry.getKey();
        Object value = entry.getValue();

        if (value == null) {
          continue;
        }

        String propertyType = getPropertyTypeSafe(entityType, propertyName);
        List<Map<String, Object>> propertyEntries =
            buildTypedPropertyEntries(propertyName, propertyType, value);
        typedProperties.addAll(propertyEntries);
      }
    } catch (Exception e) {
      LOG.warn("Failed to build typed custom properties for entity type {}", entityType, e);
      return Collections.emptyList();
    }

    return typedProperties;
  }

  private static String getPropertyTypeSafe(String entityType, String propertyName) {
    try {
      return TypeRegistry.getCustomPropertyType(entityType, propertyName);
    } catch (Exception e) {
      LOG.debug(
          "Could not find property type for {}.{}, using 'unknown'", entityType, propertyName);
      return "unknown";
    }
  }

  private static List<Map<String, Object>> buildTypedPropertyEntries(
      String propertyName, String propertyType, Object value) {
    List<Map<String, Object>> entries = new ArrayList<>();

    switch (propertyType) {
      case "integer", "number" -> entries.add(buildNumericEntry(propertyName, propertyType, value));
      case "timestamp" -> entries.add(buildTimestampEntry(propertyName, propertyType, value));
      case "timeInterval" -> entries.add(buildTimeIntervalEntry(propertyName, propertyType, value));
      case "date-cp", "dateTime-cp", "time-cp" -> entries.add(
          buildDateStringEntry(propertyName, propertyType, value));
      case "entityReference" -> entries.add(
          buildEntityReferenceEntry(propertyName, propertyType, value));
      case "entityReferenceList" -> entries.addAll(
          buildEntityReferenceListEntries(propertyName, propertyType, value));
      case "enum" -> entries.addAll(buildEnumEntries(propertyName, propertyType, value));
      case "markdown", "sqlQuery" -> entries.add(buildTextEntry(propertyName, propertyType, value));
      case "table-cp" -> entries.addAll(buildTableEntries(propertyName, propertyType, value));
      case "hyperlink-cp" -> entries.addAll(
          buildHyperlinkEntries(propertyName, propertyType, value));
      default -> entries.add(buildStringEntry(propertyName, propertyType, value));
    }

    return entries;
  }

  private static Map<String, Object> buildNumericEntry(
      String name, String propertyType, Object value) {
    Map<String, Object> entry = createBaseEntry(name, propertyType);
    if (value instanceof Number num) {
      if (value instanceof Double || value instanceof Float) {
        entry.put("doubleValue", num.doubleValue());
      } else {
        entry.put("longValue", num.longValue());
      }
    } else if (value instanceof String str) {
      try {
        if (str.contains(".")) {
          entry.put("doubleValue", Double.parseDouble(str));
        } else {
          entry.put("longValue", Long.parseLong(str));
        }
      } catch (NumberFormatException e) {
        entry.put("stringValue", str);
      }
    }
    return entry;
  }

  private static Map<String, Object> buildTimestampEntry(
      String name, String propertyType, Object value) {
    Map<String, Object> entry = createBaseEntry(name, propertyType);
    if (value instanceof Number num) {
      entry.put("longValue", num.longValue());
    } else if (value instanceof String str) {
      try {
        entry.put("longValue", Long.parseLong(str));
      } catch (NumberFormatException e) {
        entry.put("stringValue", str);
      }
    }
    return entry;
  }

  private static Map<String, Object> buildTimeIntervalEntry(
      String name, String propertyType, Object value) {
    Map<String, Object> entry = createBaseEntry(name, propertyType);
    if (value instanceof Map<?, ?> map) {
      Object start = map.get("start");
      Object end = map.get("end");
      if (start instanceof Number num) {
        entry.put("start", num.longValue());
      }
      if (end instanceof Number num) {
        entry.put("end", num.longValue());
      }
    }
    return entry;
  }

  private static Map<String, Object> buildDateStringEntry(
      String name, String propertyType, Object value) {
    Map<String, Object> entry = createBaseEntry(name, propertyType);
    entry.put("stringValue", value.toString());
    return entry;
  }

  private static Map<String, Object> buildEntityReferenceEntry(
      String name, String propertyType, Object value) {
    Map<String, Object> entry = createBaseEntry(name, propertyType);
    if (value instanceof Map<?, ?> map) {
      populateEntityRefFields(entry, map);
    }
    return entry;
  }

  private static List<Map<String, Object>> buildEntityReferenceListEntries(
      String name, String propertyType, Object value) {
    List<Map<String, Object>> entries = new ArrayList<>();
    if (value instanceof List<?> list) {
      for (Object item : list) {
        if (item instanceof Map<?, ?> map) {
          Map<String, Object> entry = createBaseEntry(name, propertyType);
          populateEntityRefFields(entry, map);
          entries.add(entry);
        }
      }
    }
    if (entries.isEmpty()) {
      entries.add(createBaseEntry(name, propertyType));
    }
    return entries;
  }

  private static void populateEntityRefFields(Map<String, Object> entry, Map<?, ?> map) {
    if (map.get("id") != null) {
      entry.put("refId", map.get("id").toString());
    }
    if (map.get("type") != null) {
      entry.put("refType", map.get("type").toString());
    }
    if (map.get("name") != null) {
      entry.put("refName", map.get("name").toString());
    }
    if (map.get("fullyQualifiedName") != null) {
      entry.put("refFqn", map.get("fullyQualifiedName").toString());
    }
    if (map.get("displayName") != null) {
      entry.put("stringValue", map.get("displayName").toString());
    }
  }

  private static List<Map<String, Object>> buildEnumEntries(
      String name, String propertyType, Object value) {
    List<Map<String, Object>> entries = new ArrayList<>();
    if (value instanceof List<?> list) {
      for (Object item : list) {
        Map<String, Object> entry = createBaseEntry(name, propertyType);
        entry.put("stringValue", item.toString());
        entries.add(entry);
      }
    } else if (value instanceof String str) {
      Map<String, Object> entry = createBaseEntry(name, propertyType);
      entry.put("stringValue", str);
      entries.add(entry);
    }
    if (entries.isEmpty()) {
      entries.add(createBaseEntry(name, propertyType));
    }
    return entries;
  }

  private static Map<String, Object> buildTextEntry(
      String name, String propertyType, Object value) {
    Map<String, Object> entry = createBaseEntry(name, propertyType);
    entry.put("textValue", value.toString());
    entry.put("stringValue", value.toString());
    return entry;
  }

  private static List<Map<String, Object>> buildTableEntries(
      String name, String propertyType, Object value) {
    List<Map<String, Object>> entries = new ArrayList<>();
    if (value instanceof Map<?, ?> map && map.containsKey("rows")) {
      Object rowsObj = map.get("rows");
      if (rowsObj instanceof List<?> rows) {
        for (Object rowObj : rows) {
          if (rowObj instanceof Map<?, ?> row) {
            for (Map.Entry<?, ?> cell : row.entrySet()) {
              String columnName = cell.getKey().toString();
              String cellValue = cell.getValue() != null ? cell.getValue().toString() : "";
              Map<String, Object> entry =
                  createBaseEntry(name + ".rows." + columnName, propertyType);
              entry.put("stringValue", cellValue);
              entry.put("textValue", cellValue);
              entries.add(entry);
            }
          }
        }
      }
    }
    return entries;
  }

  private static List<Map<String, Object>> buildHyperlinkEntries(
      String name, String propertyType, Object value) {
    List<Map<String, Object>> entries = new ArrayList<>();
    if (value instanceof Map<?, ?> map) {
      // Create separate entries for URL and displayText with distinct names
      // This allows wildcard search on each field independently
      if (map.get("url") != null) {
        Map<String, Object> urlEntry = createBaseEntry(name + ".url", propertyType);
        String urlValue = map.get("url").toString();
        urlEntry.put("stringValue", urlValue);
        urlEntry.put("textValue", urlValue);
        entries.add(urlEntry);
      }
      if (map.get("displayText") != null) {
        Map<String, Object> displayTextEntry = createBaseEntry(name + ".displayText", propertyType);
        String displayTextValue = map.get("displayText").toString();
        displayTextEntry.put("stringValue", displayTextValue);
        displayTextEntry.put("textValue", displayTextValue);
        entries.add(displayTextEntry);
      }
    }
    return entries;
  }

  private static Map<String, Object> buildStringEntry(
      String name, String propertyType, Object value) {
    Map<String, Object> entry = createBaseEntry(name, propertyType);
    String strValue = flattenValue(value);
    entry.put("stringValue", strValue);
    entry.put("textValue", strValue);
    return entry;
  }

  private static Map<String, Object> createBaseEntry(String name, String propertyType) {
    Map<String, Object> entry = new HashMap<>();
    entry.put("name", name);
    entry.put("propertyType", propertyType);
    return entry;
  }

  /**
   * Transforms column extensions to typed custom properties within the search document.
   * This modifies the columns in-place to add customPropertiesTyped for each column
   * that has an extension, keeping the field count bounded.
   *
   * @param doc The search document containing columns
   * @param columnEntityType The entity type for column custom properties (e.g., "tableColumn")
   */
  @SuppressWarnings("unchecked")
  public static void transformColumnExtensions(Map<String, Object> doc, String columnEntityType) {
    transformColumnExtensionsAtPath(doc, "columns", columnEntityType);
  }

  /**
   * Transforms column extensions to typed custom properties at a nested path.
   * This is useful for entities like Container where columns are at "dataModel.columns".
   *
   * @param doc The search document
   * @param path The path to the columns (e.g., "columns" or "dataModel.columns")
   * @param columnEntityType The entity type for column custom properties
   */
  @SuppressWarnings("unchecked")
  public static void transformColumnExtensionsAtPath(
      Map<String, Object> doc, String path, String columnEntityType) {
    String[] pathParts = path.split("\\.");
    Object current = doc;

    // Navigate to the parent of the columns
    for (int i = 0; i < pathParts.length - 1; i++) {
      if (current instanceof Map) {
        current = ((Map<String, Object>) current).get(pathParts[i]);
      } else {
        return;
      }
    }

    if (current instanceof Map) {
      Object columnsObj = ((Map<String, Object>) current).get(pathParts[pathParts.length - 1]);
      if (columnsObj instanceof List) {
        List<Map<String, Object>> columns = (List<Map<String, Object>>) columnsObj;
        transformColumnExtensionsRecursive(columns, columnEntityType);
      }
    }
  }

  @SuppressWarnings("unchecked")
  private static void transformColumnExtensionsRecursive(
      List<Map<String, Object>> columns, String columnEntityType) {
    if (columns == null || columns.isEmpty()) {
      return;
    }

    for (Map<String, Object> column : columns) {
      // Transform extension to customPropertiesTyped
      Object extensionObj = column.get("extension");
      if (extensionObj != null) {
        List<Map<String, Object>> typedProps =
            buildTypedCustomProperties(extensionObj, columnEntityType);
        if (!typedProps.isEmpty()) {
          column.put("customPropertiesTyped", typedProps);
        }
      }

      // Process nested children recursively
      Object childrenObj = column.get("children");
      if (childrenObj instanceof List) {
        List<Map<String, Object>> children = (List<Map<String, Object>>) childrenObj;
        transformColumnExtensionsRecursive(children, columnEntityType);
      }
    }
  }
}
