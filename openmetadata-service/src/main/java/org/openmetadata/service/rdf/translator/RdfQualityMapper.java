package org.openmetadata.service.rdf.translator;

import com.fasterxml.jackson.databind.JsonNode;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Map;
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
    if (profile == null || profile.isNull() || !profile.isObject()) {
      return;
    }
    String timestamp = readTimestamp(profile);
    emitMeasurements(profile, TABLE_METRICS, timestamp, tableResource, model);
  }

  static void emitColumnProfile(JsonNode profile, Resource columnResource, Model model) {
    if (profile == null || profile.isNull() || !profile.isObject()) {
      return;
    }
    String timestamp = readTimestamp(profile);
    emitMeasurements(profile, COLUMN_METRICS, timestamp, columnResource, model);
  }

  private static void emitMeasurements(
      JsonNode profile,
      Map<String, String> metricMap,
      String timestamp,
      Resource subjectResource,
      Model model) {
    Property hasMeasurement = model.createProperty(DQV_NS, "hasQualityMeasurement");
    Property isMeasurementOf = model.createProperty(DQV_NS, "isMeasurementOf");
    Property dqvValue = model.createProperty(DQV_NS, "value");
    Property dqvComputedOn = model.createProperty(DQV_NS, "computedOn");
    Property generatedAtTime = model.createProperty(PROV_NS, "generatedAtTime");
    Resource measurementClass = model.createResource(DQV_NS + "QualityMeasurement");

    for (Map.Entry<String, String> entry : metricMap.entrySet()) {
      String fieldName = entry.getKey();
      String metricLocalName = entry.getValue();
      JsonNode value = profile.get(fieldName);
      if (value == null || value.isNull() || !value.isNumber()) {
        continue;
      }
      String measurementUri = measurementUri(subjectResource.getURI(), metricLocalName, timestamp);
      Resource measurement = model.createResource(measurementUri);
      measurement.addProperty(RDF.type, measurementClass);
      measurement.addProperty(isMeasurementOf, model.createResource(OM_NS + metricLocalName));
      measurement.addProperty(dqvComputedOn, subjectResource);
      addNumericValue(measurement, dqvValue, value, model);
      if (timestamp != null) {
        measurement.addProperty(
            generatedAtTime, model.createTypedLiteral(timestamp, XSDDatatype.XSDdateTime));
      }
      subjectResource.addProperty(hasMeasurement, measurement);
    }
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
    String slot = timestamp == null || timestamp.isEmpty() ? "latest" : timestamp;
    String encodedSlot = URLEncoder.encode(slot, StandardCharsets.UTF_8);
    return subjectUri + "/measurement/" + metricLocalName + "/" + encodedSlot;
  }

  private static String readTimestamp(JsonNode profile) {
    JsonNode ts = profile.get("timestamp");
    if (ts == null || ts.isNull()) {
      return null;
    }
    if (ts.isTextual()) {
      return ts.asText();
    }
    if (ts.isNumber()) {
      // OpenMetadata profiles record the timestamp as epoch millis; convert to ISO-8601.
      return java.time.Instant.ofEpochMilli(ts.asLong()).toString();
    }
    return null;
  }
}
