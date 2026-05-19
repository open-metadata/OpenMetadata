package org.openmetadata.service.rdf.translator;

import com.fasterxml.jackson.databind.JsonNode;
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
    if (usage == null || usage.isNull() || !usage.isObject()) {
      return;
    }
    emitStats(usage.get("dailyStats"), "Daily", entityResource, model);
    emitStats(usage.get("weeklyStats"), "Weekly", entityResource, model);
    emitStats(usage.get("monthlyStats"), "Monthly", entityResource, model);

    JsonNode date = usage.get("date");
    if (date != null && date.isTextual()) {
      Property usageDate = model.createProperty(OM_NS, "usageDate");
      entityResource.addProperty(
          usageDate, model.createTypedLiteral(date.asText(), XSDDatatype.XSDdate));
    }
  }

  private static void emitStats(
      JsonNode stats, String window, Resource entityResource, Model model) {
    if (stats == null || stats.isNull() || !stats.isObject()) {
      return;
    }
    JsonNode count = stats.get("count");
    if (count != null && count.isNumber()) {
      Property countProp = model.createProperty(OM_NS, "usage" + window + "Count");
      entityResource.addProperty(countProp, model.createTypedLiteral(count.asLong()));
    }
    JsonNode pct = stats.get("percentileRank");
    if (pct != null && pct.isNumber()) {
      Property pctProp = model.createProperty(OM_NS, "usage" + window + "Percentile");
      entityResource.addProperty(pctProp, model.createTypedLiteral(pct.asDouble()));
    }
  }
}
