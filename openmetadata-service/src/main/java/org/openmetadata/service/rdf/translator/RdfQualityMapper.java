package org.openmetadata.service.rdf.translator;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import org.apache.jena.datatypes.xsd.XSDDatatype;
import org.apache.jena.rdf.model.Literal;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.Resource;

/**
 * Emits the latest table and column profile as literal facts on the profiled table or column, so a
 * node card shows them and SPARQL filters on them directly ("columns whose null ratio exceeds 5%").
 *
 * <p>The graph holds the latest profile only, as the profiled node's own triples, so a newer profile
 * replaces them in the same entity write
 * (ADR:2026-11-18-the-rdf-graph-carries-the-latest-quality-evidence). The measure set is bounded;
 * min and max are emitted only when numeric, because a non-numeric bound is a data value with no
 * single datatype.
 */
public final class RdfQualityMapper {
  private static final String OM_NS = "https://open-metadata.org/ontology/";
  private static final String PROFILED_AT = "profiledAt";

  private static final Map<String, String> TABLE_MEASURES =
      Map.of(
          "rowCount", "profileRowCount",
          "columnCount", "profileColumnCount",
          "sizeInByte", "profileSizeInBytes");

  private static final Map<String, String> COLUMN_MEASURES =
      Map.ofEntries(
          Map.entry("valuesCount", "profileValuesCount"),
          Map.entry("nullCount", "profileNullCount"),
          Map.entry("nullProportion", "profileNullProportion"),
          Map.entry("distinctCount", "profileDistinctCount"),
          Map.entry("uniqueCount", "profileUniqueCount"),
          Map.entry("min", "profileMin"),
          Map.entry("max", "profileMax"),
          Map.entry("mean", "profileMean"),
          Map.entry("minLength", "profileMinLength"),
          Map.entry("maxLength", "profileMaxLength"));

  private RdfQualityMapper() {}

  static void emitTableProfile(JsonNode profile, Resource tableResource, Model model) {
    emitProfile(profile, TABLE_MEASURES, tableResource, model);
  }

  static void emitColumnProfile(JsonNode profile, Resource columnResource, Model model) {
    emitProfile(profile, COLUMN_MEASURES, columnResource, model);
  }

  private static void emitProfile(
      JsonNode profile, Map<String, String> measures, Resource subject, Model model) {
    RdfJsonNode.object(profile).ifPresent(value -> emitFacts(value, measures, subject, model));
  }

  private static void emitFacts(
      JsonNode profile, Map<String, String> measures, Resource subject, Model model) {
    measures.forEach(
        (field, predicate) ->
            RdfJsonNode.field(profile, field)
                .filter(JsonNode::isNumber)
                .ifPresent(
                    value ->
                        subject.addLiteral(
                            model.createProperty(OM_NS, predicate), number(value, model))));
    profiledAt(profile)
        .ifPresent(
            time ->
                subject.addLiteral(
                    model.createProperty(OM_NS, PROFILED_AT),
                    model.createTypedLiteral(time, XSDDatatype.XSDdateTime)));
  }

  private static Literal number(JsonNode value, Model model) {
    return value.isIntegralNumber()
        ? model.createTypedLiteral(value.asLong())
        : model.createTypedLiteral(value.asDouble());
  }

  private static Optional<String> profiledAt(JsonNode profile) {
    return RdfJsonNode.field(profile, "timestamp").flatMap(RdfQualityMapper::timestampValue);
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
}
