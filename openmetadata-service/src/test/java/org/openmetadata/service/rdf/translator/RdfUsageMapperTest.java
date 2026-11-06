package org.openmetadata.service.rdf.translator;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.ModelFactory;
import org.apache.jena.rdf.model.Property;
import org.apache.jena.rdf.model.Resource;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class RdfUsageMapperTest {

  private static final String OM = "https://open-metadata.org/ontology/";

  private ObjectMapper mapper;
  private Model model;
  private Resource entity;

  @BeforeEach
  void setUp() {
    mapper = new ObjectMapper();
    model = ModelFactory.createDefaultModel();
    entity = model.createResource("https://open-metadata.org/entity/table/abc");
  }

  @Test
  @DisplayName("Full usage summary emits count + percentile triples for daily/weekly/monthly")
  void fullUsageSummary() {
    ObjectNode usage = mapper.createObjectNode();
    putStats(usage, "dailyStats", 1234, 92.5);
    putStats(usage, "weeklyStats", 8500, 88.0);
    putStats(usage, "monthlyStats", 35_000, 90.1);
    usage.put("date", "2026-04-29");

    RdfUsageMapper.emitUsageSummary(usage, entity, model);

    assertCount("usageDailyCount", 1234);
    assertCount("usageWeeklyCount", 8500);
    assertCount("usageMonthlyCount", 35_000);
    assertPercentile("usageDailyPercentile", 92.5);
    assertPercentile("usageWeeklyPercentile", 88.0);
    assertPercentile("usageMonthlyPercentile", 90.1);

    Property usageDate = model.createProperty(OM, "usageDate");
    assertTrue(model.contains(entity, usageDate));
    assertEquals("2026-04-29", model.getProperty(entity, usageDate).getString());
  }

  @Test
  @DisplayName("Null usageSummary is a no-op")
  void nullUsage() {
    RdfUsageMapper.emitUsageSummary(null, entity, model);
    assertEquals(0, model.size());
  }

  @Test
  @DisplayName("Non-object usageSummary (string, array) is a no-op")
  void nonObjectUsage() {
    RdfUsageMapper.emitUsageSummary(mapper.getNodeFactory().textNode("oops"), entity, model);
    RdfUsageMapper.emitUsageSummary(mapper.createArrayNode(), entity, model);
    assertEquals(0, model.size());
  }

  @Test
  @DisplayName("Missing percentileRank is allowed — count is still emitted")
  void countWithoutPercentile() {
    ObjectNode usage = mapper.createObjectNode();
    ObjectNode dailyStats = mapper.createObjectNode();
    dailyStats.put("count", 42);
    usage.set("dailyStats", dailyStats);

    RdfUsageMapper.emitUsageSummary(usage, entity, model);

    assertCount("usageDailyCount", 42);
    assertFalse(
        model.contains(entity, model.createProperty(OM, "usageDailyPercentile")),
        "Percentile must not be emitted when not present");
  }

  @Test
  @DisplayName("Non-numeric count or percentile is silently skipped")
  void nonNumericValuesSkipped() {
    ObjectNode usage = mapper.createObjectNode();
    ObjectNode bad = mapper.createObjectNode();
    bad.put("count", "not-a-number");
    bad.put("percentileRank", "very high");
    usage.set("dailyStats", bad);

    RdfUsageMapper.emitUsageSummary(usage, entity, model);
    assertEquals(0, model.size(), "Non-numeric stats must be ignored, not coerced");
  }

  @Test
  @DisplayName("Only weekly stats present — daily / monthly predicates absent")
  void onlyWeekly() {
    ObjectNode usage = mapper.createObjectNode();
    putStats(usage, "weeklyStats", 100, 50.0);

    RdfUsageMapper.emitUsageSummary(usage, entity, model);

    assertFalse(model.contains(entity, model.createProperty(OM, "usageDailyCount")));
    assertCount("usageWeeklyCount", 100);
    assertFalse(model.contains(entity, model.createProperty(OM, "usageMonthlyCount")));
  }

  @Test
  @DisplayName("Date is emitted as xsd:date typed literal")
  void datePresent() {
    ObjectNode usage = mapper.createObjectNode();
    usage.put("date", "2026-04-29");
    RdfUsageMapper.emitUsageSummary(usage, entity, model);

    Property usageDate = model.createProperty(OM, "usageDate");
    assertTrue(
        model.contains(entity, usageDate),
        "Date should be present even when no stats are recorded");
    assertEquals("2026-04-29", model.getProperty(entity, usageDate).getString());
  }

  private void putStats(ObjectNode usage, String key, long count, double percentile) {
    ObjectNode stats = mapper.createObjectNode();
    stats.put("count", count);
    stats.put("percentileRank", percentile);
    usage.set(key, stats);
  }

  private void assertCount(String predicate, long expected) {
    Property p = model.createProperty(OM, predicate);
    assertTrue(model.contains(entity, p), "Expected predicate " + predicate);
    assertEquals(expected, model.getProperty(entity, p).getLong());
  }

  private void assertPercentile(String predicate, double expected) {
    Property p = model.createProperty(OM, predicate);
    assertTrue(model.contains(entity, p), "Expected predicate " + predicate);
    assertEquals(expected, model.getProperty(entity, p).getDouble(), 1e-9);
  }
}
