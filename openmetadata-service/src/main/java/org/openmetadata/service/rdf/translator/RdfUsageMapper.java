package org.openmetadata.service.rdf.translator;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.function.Function;
import org.apache.jena.datatypes.xsd.XSDDatatype;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.Property;
import org.apache.jena.rdf.model.Resource;

/**
 * Emits RDF triples from {@code Entity.usageSummary} ({@code UsageDetails}). Surfaces query
 * usage as a navigable signal so SPARQL — and the {@code /v1/rdf/insights/important} endpoint
 * built on top — can rank entities by how often they're actually queried.
 *
 * <p>Triples emitted on the entity (only when the corresponding stat is present and numeric):
 *
 * <ul>
 *   <li>{@code om:usageDailyCount}, {@code om:usageDailyPercentile}
 *   <li>{@code om:usageWeeklyCount}, {@code om:usageWeeklyPercentile}
 *   <li>{@code om:usageMonthlyCount}, {@code om:usageMonthlyPercentile}
 *   <li>{@code om:usageDate} ({@code xsd:date})
 * </ul>
 *
 * <p>Percentile values come from OpenMetadata's usage pipeline as 0–100 floats; we keep them in
 * that scale (consumers divide by 100 when blending into a 0–1 importance score).
 */
public final class RdfUsageMapper {

  private static final String OM_NS = "https://open-metadata.org/ontology/";

  private RdfUsageMapper() {}

  public static void emitUsageSummary(JsonNode usage, Resource entityResource, Model model) {
    RdfJsonNode.object(usage)
        .ifPresent(value -> emitUsageSummaryFields(value, new UsageContext(entityResource, model)));
  }

  private static void emitUsageSummaryFields(JsonNode usage, UsageContext context) {
    emitStats(usage.get("dailyStats"), "Daily", context);
    emitStats(usage.get("weeklyStats"), "Weekly", context);
    emitStats(usage.get("monthlyStats"), "Monthly", context);
    RdfJsonNode.field(usage, "date")
        .filter(JsonNode::isTextual)
        .ifPresent(
            date ->
                context
                    .entity()
                    .addProperty(
                        context.model().createProperty(OM_NS, "usageDate"),
                        context.model().createTypedLiteral(date.asText(), XSDDatatype.XSDdate)));
  }

  private static void emitStats(JsonNode stats, String window, UsageContext context) {
    RdfJsonNode.object(stats)
        .ifPresent(
            value -> {
              addNumericProperty(
                  value, "count", "usage" + window + "Count", JsonNode::asLong, context);
              addNumericProperty(
                  value,
                  "percentileRank",
                  "usage" + window + "Percentile",
                  JsonNode::asDouble,
                  context);
            });
  }

  private static void addNumericProperty(
      JsonNode source,
      String fieldName,
      String propertyName,
      Function<JsonNode, Number> valueMapper,
      UsageContext context) {
    Property property = context.model().createProperty(OM_NS, propertyName);
    RdfJsonNode.field(source, fieldName)
        .filter(JsonNode::isNumber)
        .ifPresent(
            value ->
                context
                    .entity()
                    .addProperty(
                        property, context.model().createTypedLiteral(valueMapper.apply(value))));
  }

  private record UsageContext(Resource entity, Model model) {}
}
