package org.openmetadata.service.rdf.translator;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import com.fasterxml.jackson.databind.JsonNode;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import org.apache.jena.datatypes.xsd.XSDDatatype;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.Property;
import org.apache.jena.rdf.model.Resource;
import org.apache.jena.vocabulary.RDF;

/**
 * Emits {@code dqv:QualityMeasurement} triples from OpenMetadata table and column profiles.
 *
 * <p>OpenMetadata historically stored these as opaque JSON literals, which makes them
 * unqueryable. This mapper turns each numeric profile field into a navigable measurement so
 * SPARQL can answer "tables with completeness &lt; 95%", "columns whose null count exceeded N",
 * etc.
 */
public final class RdfQualityMapper {

  private static final String OM_NS = "https://open-metadata.org/ontology/";
  private static final String DQV_NS = "http://www.w3.org/ns/dqv#";
  private static final String PROV_NS = "http://www.w3.org/ns/prov#";

  // Maps the JSON field name on Table.profile / Column.profile to the metric URI under om:.
  // Only numeric metrics are emitted as dqv:value literals; min/max are skipped because their
  // type is polymorphic (string / number / dateTime) and a single dqv:value triple can't express
  // that without losing the datatype.
  private static final Map<String, String> TABLE_METRICS =
      Map.of(
          "rowCount", "RowCountMetric",
          "columnCount", "ColumnCountMetric",
          "sizeInByte", "SizeInBytesMetric");

  private static final Map<String, String> COLUMN_METRICS = buildColumnMetricMap();

  private static Map<String, String> buildColumnMetricMap() {
    return Map.ofEntries(
        Map.entry("valuesCount", "ValuesCountMetric"),
        Map.entry("validCount", "ValidCountMetric"),
        Map.entry("nullCount", "NullCountMetric"),
        Map.entry("nullProportion", "NullProportionMetric"),
        Map.entry("missingCount", "MissingCountMetric"),
        Map.entry("missingPercentage", "MissingPercentageMetric"),
        Map.entry("uniqueCount", "UniqueCountMetric"),
        Map.entry("uniqueProportion", "UniqueProportionMetric"),
        Map.entry("distinctCount", "DistinctCountMetric"),
        Map.entry("distinctProportion", "DistinctProportionMetric"),
        Map.entry("duplicateCount", "DuplicateCountMetric"),
        Map.entry("mean", "MeanMetric"),
        Map.entry("sum", "SumMetric"),
        Map.entry("stddev", "StddevMetric"),
        Map.entry("variance", "VarianceMetric"),
        Map.entry("median", "MedianMetric"),
        Map.entry("minLength", "MinLengthMetric"),
        Map.entry("maxLength", "MaxLengthMetric"));
  }

  private RdfQualityMapper() {}

  static void emitTableProfile(JsonNode profile, Resource tableResource, Model model) {
    emitProfile(profile, TABLE_METRICS, tableResource, model);
  }

  static void emitColumnProfile(JsonNode profile, Resource columnResource, Model model) {
    emitProfile(profile, COLUMN_METRICS, columnResource, model);
  }

  private static void emitProfile(
      JsonNode profile, Map<String, String> metrics, Resource subjectResource, Model model) {
    RdfJsonNode.object(profile)
        .ifPresent(
            value ->
                emitMeasurements(value, metrics, readTimestamp(value), subjectResource, model));
  }

  private static void emitMeasurements(
      JsonNode profile,
      Map<String, String> metricMap,
      String timestamp,
      Resource subjectResource,
      Model model) {
    MeasurementContext context =
        new MeasurementContext(
            subjectResource, model, MeasurementVocabulary.from(model), timestamp);

    for (Map.Entry<String, String> entry : metricMap.entrySet()) {
      RdfJsonNode.field(profile, entry.getKey())
          .filter(JsonNode::isNumber)
          .ifPresent(value -> emitMeasurement(entry.getValue(), value, context));
    }
  }

  private static void emitMeasurement(
      String metricLocalName, JsonNode value, MeasurementContext context) {
    Model model = context.model();
    MeasurementVocabulary vocabulary = context.vocabulary();
    String measurementUri =
        measurementUri(context.subject().getURI(), metricLocalName, context.timestamp());
    Resource measurement = model.createResource(measurementUri);
    measurement.addProperty(RDF.type, vocabulary.measurementClass());
    measurement.addProperty(
        vocabulary.isMeasurementOf(), model.createResource(OM_NS + metricLocalName));
    measurement.addProperty(vocabulary.computedOn(), context.subject());
    addNumericValue(measurement, vocabulary.value(), value, model);
    if (!nullOrEmpty(context.timestamp())) {
      measurement.addProperty(
          vocabulary.generatedAtTime(),
          model.createTypedLiteral(context.timestamp(), XSDDatatype.XSDdateTime));
    }
    context.subject().addProperty(vocabulary.hasMeasurement(), measurement);
  }

  private static void addNumericValue(
      Resource measurement, Property dqvValue, JsonNode value, Model model) {
    if (value.isInt()) {
      measurement.addProperty(dqvValue, model.createTypedLiteral(value.asInt()));
    } else if (value.isLong()) {
      measurement.addProperty(dqvValue, model.createTypedLiteral(value.asLong()));
    } else {
      measurement.addProperty(dqvValue, model.createTypedLiteral(value.asDouble()));
    }
  }

  /**
   * Mints a deterministic URI for a dqv:QualityMeasurement so that re-emit overwrites prior
   * triples instead of creating orphans. Each (subject, metric, timestamp) tuple maps to exactly
   * one URI. Missing timestamps fall back to "latest" so back-to-back emits without a profile
   * timestamp are idempotent.
   */
  static String measurementUri(String subjectUri, String metricLocalName, String timestamp) {
    String slot = nullOrEmpty(timestamp) ? "latest" : timestamp;
    String encodedSlot = URLEncoder.encode(slot, StandardCharsets.UTF_8);
    return subjectUri + "/measurement/" + metricLocalName + "/" + encodedSlot;
  }

  private static String readTimestamp(JsonNode profile) {
    return RdfJsonNode.field(profile, "timestamp")
        .flatMap(RdfQualityMapper::timestampValue)
        .orElse(null);
  }

  private static Optional<String> timestampValue(JsonNode timestamp) {
    Optional<String> value = Optional.empty();
    if (timestamp.isTextual()) {
      value = Optional.of(timestamp.asText());
    } else if (timestamp.isNumber()) {
      value = Optional.of(Instant.ofEpochMilli(timestamp.asLong()).toString());
    }
    return value;
  }

  private record MeasurementContext(
      Resource subject, Model model, MeasurementVocabulary vocabulary, String timestamp) {}

  private record MeasurementVocabulary(
      Property hasMeasurement,
      Property isMeasurementOf,
      Property value,
      Property computedOn,
      Property generatedAtTime,
      Resource measurementClass) {

    private static MeasurementVocabulary from(Model model) {
      return new MeasurementVocabulary(
          model.createProperty(DQV_NS, "hasQualityMeasurement"),
          model.createProperty(DQV_NS, "isMeasurementOf"),
          model.createProperty(DQV_NS, "value"),
          model.createProperty(DQV_NS, "computedOn"),
          model.createProperty(PROV_NS, "generatedAtTime"),
          model.createResource(DQV_NS + "QualityMeasurement"));
    }
  }
}
