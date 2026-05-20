package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Duration;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.bootstrap.SharedEntities;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.api.lineage.AddLineage;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnLineage;
import org.openmetadata.schema.type.EntitiesEdge;
import org.openmetadata.schema.type.LineageDetails;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.fluent.builders.ColumnBuilder;

/**
 * Integration tests for Impact Analysis lineage filters.
 *
 * <p>Tests the getLineageByEntityCount API (table view) and getLineage/{direction} API (column
 * view) with various filter combinations: tags, tiers, owners, domains, glossary terms, search, and
 * column-level filters.
 *
 * <p>Topology (3 depths with fan-in and fan-out):
 *
 * <pre>
 *   raw_a (PII.Sensitive, Tier1, admin, DomainA)
 *     └─→ stg_a (PersonalData.Personal, Tier2, user1, DomainA)
 *            └─→ int_a (PII.NonSensitive, Tier3, user2, DomainA, GlossaryTerm)
 *                  ├─→ rpt_a (Certification.Gold, Tier1, user3, DomainA)
 *                  └─→ rpt_b (Certification.Gold, Tier1, user3, DomainB)
 *   raw_b (PII.Sensitive, Tier1, admin, DomainB)
 *     └─→ stg_a (fan-in: same staging table)
 * </pre>
 */
@Execution(ExecutionMode.SAME_THREAD)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
public class LineageImpactAnalysisIT {

  private static final ObjectMapper MAPPER = new ObjectMapper();
  private OpenMetadataClient client;
  private TestNamespace namespace;

  // Tables
  private Table rawA;
  private Table rawB;
  private Table stgA;
  private Table intA;
  private Table rptA;
  private Table rptB;

  // Domains
  private Domain domainA;
  private Domain domainB;

  @BeforeAll
  void setUp() throws Exception {
    client = SdkClients.adminClient();
    namespace = new TestNamespace("LineageImpactIT");
    SharedEntities shared = SharedEntities.get();

    DatabaseService service = DatabaseServiceTestFactory.createPostgres(namespace);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(namespace, service);
    String schemaFqn = schema.getFullyQualifiedName();

    // Create domains
    domainA =
        client
            .domains()
            .create(
                new CreateDomain()
                    .withName(namespace.prefix("domain_a"))
                    .withDescription("Domain A for lineage testing")
                    .withDomainType(CreateDomain.DomainType.AGGREGATE));
    domainB =
        client
            .domains()
            .create(
                new CreateDomain()
                    .withName(namespace.prefix("domain_b"))
                    .withDescription("Domain B for lineage testing")
                    .withDomainType(CreateDomain.DomainType.AGGREGATE));

    TagLabel piiSensitive =
        new TagLabel()
            .withTagFQN("PII.Sensitive")
            .withSource(TagLabel.TagSource.CLASSIFICATION)
            .withLabelType(TagLabel.LabelType.MANUAL);
    TagLabel piiNonSensitive =
        new TagLabel()
            .withTagFQN("PII.NonSensitive")
            .withSource(TagLabel.TagSource.CLASSIFICATION)
            .withLabelType(TagLabel.LabelType.MANUAL);
    TagLabel personalData =
        new TagLabel()
            .withTagFQN("PersonalData.Personal")
            .withSource(TagLabel.TagSource.CLASSIFICATION)
            .withLabelType(TagLabel.LabelType.MANUAL);
    TagLabel certGold =
        new TagLabel()
            .withTagFQN("Certification.Gold")
            .withSource(TagLabel.TagSource.CLASSIFICATION)
            .withLabelType(TagLabel.LabelType.MANUAL);
    TagLabel tier1 =
        new TagLabel()
            .withTagFQN("Tier.Tier1")
            .withSource(TagLabel.TagSource.CLASSIFICATION)
            .withLabelType(TagLabel.LabelType.MANUAL);
    TagLabel tier2 =
        new TagLabel()
            .withTagFQN("Tier.Tier2")
            .withSource(TagLabel.TagSource.CLASSIFICATION)
            .withLabelType(TagLabel.LabelType.MANUAL);
    TagLabel tier3 =
        new TagLabel()
            .withTagFQN("Tier.Tier3")
            .withSource(TagLabel.TagSource.CLASSIFICATION)
            .withLabelType(TagLabel.LabelType.MANUAL);
    TagLabel glossaryLabel = shared.GLOSSARY1_TERM1_LABEL;

    // raw_a: PII.Sensitive, Tier1, admin, DomainA
    rawA =
        client
            .tables()
            .create(
                new CreateTable()
                    .withName(namespace.prefix("raw_a"))
                    .withDatabaseSchema(schemaFqn)
                    .withColumns(
                        List.of(
                            ColumnBuilder.of("customer_id", "INT").build(),
                            ColumnBuilder.of("email", "VARCHAR").dataLength(255).build(),
                            ColumnBuilder.of("phone", "VARCHAR").dataLength(50).build()))
                    .withTags(List.of(piiSensitive, tier1))
                    .withOwners(List.of(shared.USER1_REF))
                    .withDomains(List.of(domainA.getFullyQualifiedName())));

    // raw_b: PII.Sensitive, Tier1, admin, DomainB
    rawB =
        client
            .tables()
            .create(
                new CreateTable()
                    .withName(namespace.prefix("raw_b"))
                    .withDatabaseSchema(schemaFqn)
                    .withColumns(
                        List.of(
                            ColumnBuilder.of("order_id", "INT").build(),
                            ColumnBuilder.of("customer_id", "INT").build(),
                            ColumnBuilder.of("amount", "DECIMAL").build()))
                    .withTags(List.of(piiSensitive, tier1))
                    .withOwners(List.of(shared.USER1_REF))
                    .withDomains(List.of(domainB.getFullyQualifiedName())));

    // stg_a: PersonalData.Personal, Tier2, user2, DomainA
    stgA =
        client
            .tables()
            .create(
                new CreateTable()
                    .withName(namespace.prefix("stg_a"))
                    .withDatabaseSchema(schemaFqn)
                    .withColumns(
                        List.of(
                            ColumnBuilder.of("customer_id", "INT").build(),
                            ColumnBuilder.of("email", "VARCHAR").dataLength(255).build(),
                            ColumnBuilder.of("total_orders", "INT").build(),
                            ColumnBuilder.of("total_amount", "DECIMAL").build()))
                    .withTags(List.of(personalData, tier2))
                    .withOwners(List.of(shared.USER2_REF))
                    .withDomains(List.of(domainA.getFullyQualifiedName())));

    // int_a: PII.NonSensitive, Tier3, user3, DomainA, GlossaryTerm
    Column intACustomerId = ColumnBuilder.of("customer_id", "INT").build();
    intACustomerId.setTags(List.of(piiSensitive, glossaryLabel));
    intA =
        client
            .tables()
            .create(
                new CreateTable()
                    .withName(namespace.prefix("int_a"))
                    .withDatabaseSchema(schemaFqn)
                    .withColumns(
                        List.of(
                            intACustomerId,
                            ColumnBuilder.of("email", "VARCHAR").dataLength(255).build(),
                            ColumnBuilder.of("lifetime_value", "DECIMAL").build(),
                            ColumnBuilder.of("churn_score", "DECIMAL").build()))
                    .withTags(List.of(piiNonSensitive, tier3, glossaryLabel))
                    .withOwners(List.of(shared.USER3_REF))
                    .withDomains(List.of(domainA.getFullyQualifiedName())));

    // rpt_a: Certification.Gold, Tier1, user1, DomainA
    rptA =
        client
            .tables()
            .create(
                new CreateTable()
                    .withName(namespace.prefix("rpt_a"))
                    .withDatabaseSchema(schemaFqn)
                    .withColumns(
                        List.of(
                            ColumnBuilder.of("customer_id", "INT").build(),
                            ColumnBuilder.of("lifetime_value", "DECIMAL").build(),
                            ColumnBuilder.of("churn_score", "DECIMAL").build()))
                    .withTags(List.of(certGold, tier1))
                    .withOwners(List.of(shared.USER1_REF))
                    .withDomains(List.of(domainA.getFullyQualifiedName())));

    // rpt_b: Certification.Gold, Tier1, user1, DomainB
    rptB =
        client
            .tables()
            .create(
                new CreateTable()
                    .withName(namespace.prefix("rpt_b"))
                    .withDatabaseSchema(schemaFqn)
                    .withColumns(
                        List.of(
                            ColumnBuilder.of("customer_id", "INT").build(),
                            ColumnBuilder.of("churn_score", "DECIMAL").build()))
                    .withTags(List.of(certGold, tier1, glossaryLabel))
                    .withOwners(List.of(shared.USER1_REF))
                    .withDomains(List.of(domainB.getFullyQualifiedName())));

    // Create lineage with column mappings
    addLineageWithColumns(
        rawA,
        stgA,
        List.of(
            colLineage(rawA, "customer_id", stgA, "customer_id"),
            colLineage(rawA, "email", stgA, "email")));

    addLineageWithColumns(
        rawB,
        stgA,
        List.of(
            colLineage(rawB, "customer_id", stgA, "customer_id"),
            colLineage(rawB, "amount", stgA, "total_amount")));

    addLineageWithColumns(
        stgA,
        intA,
        List.of(
            colLineage(stgA, "customer_id", intA, "customer_id"),
            colLineage(stgA, "email", intA, "email"),
            colLineage(stgA, "total_amount", intA, "lifetime_value")));

    addLineageWithColumns(
        intA,
        rptA,
        List.of(
            colLineage(intA, "customer_id", rptA, "customer_id"),
            colLineage(intA, "lifetime_value", rptA, "lifetime_value"),
            colLineage(intA, "churn_score", rptA, "churn_score")));

    addLineageWithColumns(
        intA,
        rptB,
        List.of(
            colLineage(intA, "customer_id", rptB, "customer_id"),
            colLineage(intA, "churn_score", rptB, "churn_score")));

    // Wait for ES to index
    waitForSearchIndex(stgA.getFullyQualifiedName());
  }

  @AfterAll
  void tearDown() {
    cleanup(rawA);
    cleanup(rawB);
    cleanup(stgA);
    cleanup(intA);
    cleanup(rptA);
    cleanup(rptB);
    cleanupDomain(domainA);
    cleanupDomain(domainB);
  }

  // ── TABLE VIEW: Downstream filters ────────────────────────────────────

  @Test
  void testDownstream_noFilter() throws Exception {
    Set<String> nodes = getTableViewNodes(stgA, "Downstream", null);
    assertContainsExactly(nodes, intA, rptA, rptB);
  }

  @Test
  void testDownstream_tagFilter_certGold() throws Exception {
    String qf = tagFilter("Certification.Gold");
    Set<String> nodes = getTableViewNodes(stgA, "Downstream", qf);
    assertContainsExactly(nodes, rptA, rptB);
  }

  @Test
  void testDownstream_tagFilter_piiNonSensitive() throws Exception {
    String qf = tagFilter("PII.NonSensitive");
    Set<String> nodes = getTableViewNodes(stgA, "Downstream", qf);
    assertContainsExactly(nodes, intA);
  }

  @Test
  void testDownstream_tierFilter_tier1() throws Exception {
    String qf = tierFilter("Tier.Tier1");
    Set<String> nodes = getTableViewNodes(stgA, "Downstream", qf);
    assertContainsExactly(nodes, rptA, rptB);
  }

  @Test
  void testDownstream_tierFilter_tier3() throws Exception {
    String qf = tierFilter("Tier.Tier3");
    Set<String> nodes = getTableViewNodes(stgA, "Downstream", qf);
    assertContainsExactly(nodes, intA);
  }

  @Test
  void testDownstream_tierFilter_noMatch() throws Exception {
    String qf = tierFilter("Tier.Tier2");
    Set<String> nodes = getTableViewNodes(stgA, "Downstream", qf);
    assertTrue(nodes.isEmpty());
  }

  @Test
  void testDownstream_ownerFilter() throws Exception {
    SharedEntities shared = SharedEntities.get();
    String qf = ownerFilter(shared.USER3.getName());
    Set<String> nodes = getTableViewNodes(stgA, "Downstream", qf);
    assertContainsExactly(nodes, intA);
  }

  @Test
  void testDownstream_ownerFilter_noMatch() throws Exception {
    SharedEntities shared = SharedEntities.get();
    String qf = ownerFilter(shared.USER2.getName());
    Set<String> nodes = getTableViewNodes(stgA, "Downstream", qf);
    assertTrue(nodes.isEmpty());
  }

  @Test
  void testDownstream_domainFilter() throws Exception {
    String qf = domainFilter(domainA.getName());
    Set<String> nodes = getTableViewNodes(stgA, "Downstream", qf);
    assertContainsExactly(nodes, intA, rptA);
  }

  @Test
  void testDownstream_domainFilter_other() throws Exception {
    String qf = domainFilter(domainB.getName());
    Set<String> nodes = getTableViewNodes(stgA, "Downstream", qf);
    assertContainsExactly(nodes, rptB);
  }

  @Test
  void testDownstream_glossaryFilter() throws Exception {
    SharedEntities shared = SharedEntities.get();
    String qf = tagFilter(shared.GLOSSARY1_TERM1.getFullyQualifiedName());
    Set<String> nodes = getTableViewNodes(stgA, "Downstream", qf);
    assertContainsExactly(nodes, intA, rptB);
  }

  @Test
  void testDownstream_comboFilter_goldPlusDomainA() throws Exception {
    String qf = comboFilter(tagClause("Certification.Gold"), domainClause(domainA.getName()));
    Set<String> nodes = getTableViewNodes(stgA, "Downstream", qf);
    assertContainsExactly(nodes, rptA);
  }

  @Test
  void testDownstream_comboFilter_tier1PlusOwner() throws Exception {
    SharedEntities shared = SharedEntities.get();
    String qf = comboFilter(tierClause("Tier.Tier1"), ownerClause(shared.USER1.getName()));
    Set<String> nodes = getTableViewNodes(stgA, "Downstream", qf);
    assertContainsExactly(nodes, rptA, rptB);
  }

  @Test
  void testDownstream_searchFilter() throws Exception {
    String qf = searchFilter("rpt");
    Set<String> nodes = getTableViewNodes(stgA, "Downstream", qf);
    assertContainsExactly(nodes, rptA, rptB);
  }

  // ── TABLE VIEW: Search + filter combos (OR name/displayName AND other filters) ──

  @Test
  void testDownstream_searchPlusTag() throws Exception {
    // Search "rpt" + Tag=Certification.Gold → only rpt tables with Gold tag
    String qf = comboFilter(searchClause("rpt"), tagClause("Certification.Gold"));
    Set<String> nodes = getTableViewNodes(stgA, "Downstream", qf);
    assertContainsExactly(nodes, rptA, rptB);
  }

  @Test
  void testDownstream_searchPlusTag_noOverlap() throws Exception {
    // Search "int" + Tag=Certification.Gold → int_a has no Gold tag
    String qf = comboFilter(searchClause("int"), tagClause("Certification.Gold"));
    Set<String> nodes = getTableViewNodes(stgA, "Downstream", qf);
    assertTrue(nodes.isEmpty());
  }

  @Test
  void testDownstream_searchPlusTier() throws Exception {
    // Search "rpt" + Tier=Tier1 → rpt tables with Tier1
    String qf = comboFilter(searchClause("rpt"), tierClause("Tier.Tier1"));
    Set<String> nodes = getTableViewNodes(stgA, "Downstream", qf);
    assertContainsExactly(nodes, rptA, rptB);
  }

  @Test
  void testDownstream_searchPlusGlossary() throws Exception {
    SharedEntities shared = SharedEntities.get();
    // Search "rpt" + Glossary=ChurnRisk → only rpt_b has ChurnRisk
    String qf =
        comboFilter(searchClause("rpt"), tagClause(shared.GLOSSARY1_TERM1.getFullyQualifiedName()));
    Set<String> nodes = getTableViewNodes(stgA, "Downstream", qf);
    assertContainsExactly(nodes, rptB);
  }

  @Test
  void testDownstream_searchPlusDomain() throws Exception {
    // Search "rpt" + Domain=domainA → only rpt_a is in domainA
    String qf = comboFilter(searchClause("rpt"), domainClause(domainA.getName()));
    Set<String> nodes = getTableViewNodes(stgA, "Downstream", qf);
    assertContainsExactly(nodes, rptA);
  }

  @Test
  void testDownstream_searchPlusOwner() throws Exception {
    SharedEntities shared = SharedEntities.get();
    // Search "rpt" + Owner → rpt tables owned by USER1
    String qf = comboFilter(searchClause("rpt"), ownerClause(shared.USER1.getName()));
    Set<String> nodes = getTableViewNodes(stgA, "Downstream", qf);
    assertContainsExactly(nodes, rptA, rptB);
  }

  @Test
  void testDownstream_searchNoMatch() throws Exception {
    // Search for nonexistent name → 0 results regardless of other filters
    String qf = comboFilter(searchClause("nonexistent_xyz"), tagClause("Certification.Gold"));
    Set<String> nodes = getTableViewNodes(stgA, "Downstream", qf);
    assertTrue(nodes.isEmpty());
  }

  // ── TABLE VIEW: Upstream filters ──────────────────────────────────────

  @Test
  void testUpstream_noFilter() throws Exception {
    Set<String> nodes = getTableViewNodes(stgA, "Upstream", null);
    assertContainsExactly(nodes, rawA, rawB);
  }

  @Test
  void testUpstream_tagFilter() throws Exception {
    String qf = tagFilter("PII.Sensitive");
    Set<String> nodes = getTableViewNodes(stgA, "Upstream", qf);
    assertContainsExactly(nodes, rawA, rawB);
  }

  @Test
  void testUpstream_domainFilter() throws Exception {
    String qf = domainFilter(domainA.getName());
    Set<String> nodes = getTableViewNodes(stgA, "Upstream", qf);
    assertContainsExactly(nodes, rawA);
  }

  @Test
  void testUpstream_multiDepth_noFilter() throws Exception {
    Set<String> nodes = getTableViewNodes(intA, "Upstream", null);
    assertContainsExactly(nodes, rawA, rawB, stgA);
  }

  @Test
  void testUpstream_multiDepth_tierFilter() throws Exception {
    String qf = tierFilter("Tier.Tier1");
    Set<String> nodes = getTableViewNodes(intA, "Upstream", qf);
    assertContainsExactly(nodes, rawA, rawB);
  }

  @Test
  void testUpstream_multiDepth_tier2() throws Exception {
    String qf = tierFilter("Tier.Tier2");
    Set<String> nodes = getTableViewNodes(intA, "Upstream", qf);
    assertContainsExactly(nodes, stgA);
  }

  @Test
  void testUpstream_source_noResults() throws Exception {
    Set<String> nodes = getTableViewNodes(rawA, "Upstream", null);
    assertTrue(nodes.isEmpty());
  }

  // ── TABLE VIEW: Full chain from source and sink ───────────────────────

  @Test
  void testDownstream_fullChain_fromSource() throws Exception {
    Set<String> nodes = getTableViewNodes(rawA, "Downstream", null);
    assertContainsExactly(nodes, stgA, intA, rptA, rptB);
  }

  @Test
  void testDownstream_fullChain_goldFilter() throws Exception {
    String qf = tagFilter("Certification.Gold");
    Set<String> nodes = getTableViewNodes(rawA, "Downstream", qf);
    assertContainsExactly(nodes, rptA, rptB);
  }

  @Test
  void testUpstream_fullChain_fromSink() throws Exception {
    Set<String> nodes = getTableViewNodes(rptA, "Upstream", null);
    assertContainsExactly(nodes, intA, stgA, rawA, rawB);
  }

  @Test
  void testDownstream_sink_noResults() throws Exception {
    Set<String> nodes = getTableViewNodes(rptA, "Downstream", null);
    assertTrue(nodes.isEmpty());
  }

  // ── COLUMN VIEW: Downstream filters ───────────────────────────────────

  @Test
  void testColumnView_downstream_colEmail() throws Exception {
    JsonNode result = getColumnViewResult(stgA, "Downstream", 3, null, "columnName:email");
    assertNotNull(result);
    assertTrue(getColumnCount(result) > 0);
  }

  @Test
  void testColumnView_downstream_colCustomerId() throws Exception {
    JsonNode result = getColumnViewResult(stgA, "Downstream", 3, null, "columnName:customer_id");
    assertNotNull(result);
    assertTrue(getColumnCount(result) > 0);
  }

  @Test
  void testColumnView_downstream_colTotalAmount() throws Exception {
    JsonNode result = getColumnViewResult(stgA, "Downstream", 3, null, "columnName:total_amount");
    assertNotNull(result);
    assertTrue(getColumnCount(result) > 0);
  }

  @Test
  void testColumnView_downstream_tagFilter_matchesExactPairs() throws Exception {
    JsonNode result = getColumnViewResult(stgA, "Downstream", 3, null, "tag:PII.Sensitive");
    assertNotNull(result);
    assertColumnPairsExactly(
        result,
        columnPair(stgA, "customer_id", intA, "customer_id"),
        columnPair(intA, "customer_id", rptA, "customer_id"),
        columnPair(intA, "customer_id", rptB, "customer_id"));
  }

  @Test
  void testColumnView_downstream_glossaryFilter_matchesExactPairs() throws Exception {
    JsonNode result =
        getColumnViewResult(
            stgA,
            "Downstream",
            3,
            null,
            "glossary:" + SharedEntities.get().GLOSSARY1_TERM1.getFullyQualifiedName());
    assertNotNull(result);
    assertColumnPairsExactly(
        result,
        columnPair(stgA, "customer_id", intA, "customer_id"),
        columnPair(intA, "customer_id", rptA, "customer_id"),
        columnPair(intA, "customer_id", rptB, "customer_id"));
  }

  @Test
  void testColumnView_downstream_glossaryFilter_doesNotMatchClassificationTags() throws Exception {
    JsonNode result = getColumnViewResult(stgA, "Downstream", 3, null, "glossary:PII.Sensitive");
    assertNotNull(result);
    assertEquals(0, getColumnCount(result));
  }

  // ── COLUMN VIEW: Upstream filters ─────────────────────────────────────

  @Test
  void testColumnView_upstream_colEmail() throws Exception {
    JsonNode result = getColumnViewResult(stgA, "Upstream", 1, null, "columnName:email");
    assertNotNull(result);
    assertTrue(getColumnCount(result) > 0);
  }

  @Test
  void testColumnView_upstream_colCustomerId() throws Exception {
    JsonNode result = getColumnViewResult(stgA, "Upstream", 1, null, "columnName:customer_id");
    assertNotNull(result);
    assertTrue(getColumnCount(result) > 0);
  }

  // ── COLUMN VIEW: Malformed filter handling ─────────────────────────────

  @Test
  void testColumnView_malformedSingleFilter_noMatch() throws Exception {
    // Single malformed filter like "bad" should match nothing
    JsonNode result = getColumnViewResult(stgA, "Downstream", 3, null, "bad");
    assertNotNull(result);
    assertEquals(0, getColumnCount(result));
  }

  @Test
  void testColumnView_malformedMultiFilter_noMatch() throws Exception {
    // Multiple malformed filters like "bad,worse" should also match nothing
    // (consistent with single malformed filter)
    JsonNode result = getColumnViewResult(stgA, "Downstream", 3, null, "bad,worse");
    assertNotNull(result);
    assertEquals(0, getColumnCount(result));
  }

  @Test
  void testColumnView_emptyValueFilter_noMatch() throws Exception {
    // Filter with empty value like "tag:" should match nothing
    JsonNode result = getColumnViewResult(stgA, "Downstream", 3, null, "tag:");
    assertNotNull(result);
    assertEquals(0, getColumnCount(result));
  }

  @Test
  void testColumnView_commaOnlyFilter_noMatch() throws Exception {
    // Just commas should match nothing
    JsonNode result = getColumnViewResult(stgA, "Downstream", 3, null, ",,,");
    assertNotNull(result);
    assertEquals(0, getColumnCount(result));
  }

  @Test
  void testColumnView_validPlusMalformedFilter() throws Exception {
    // Valid filter combined with malformed — malformed part is ignored, valid part applies
    JsonNode result = getColumnViewResult(stgA, "Downstream", 3, null, "columnName:email,bad:");
    assertNotNull(result);
    assertTrue(getColumnCount(result) > 0);
  }

  // ── TABLE VIEW: Filtered pagination count matches data ────────────────

  @Test
  void testTableView_filteredCountMatchesData() throws Exception {
    String qf = tierFilter("Tier.Tier1");
    Set<String> nodes = getTableViewNodes(rawA, "Downstream", qf);
    assertContainsExactly(nodes, rptA, rptB);
  }

  @Test
  void testTableView_nodeDepthWithFilter_respectsDepth() throws Exception {
    // Node Depth=1 + Tier=Tier1 filter: should only show depth 1 entities with Tier1
    String qf = tierFilter("Tier.Tier1");
    Map<String, Integer> nodes = getTableViewNodesWithDepth(rawA, "Downstream", 1, qf);
    // All returned nodes should be at depth 1 (not deeper)
    assertTrue(nodes.values().stream().allMatch(depth -> depth == 1));
  }

  @Test
  void testTableView_nodeDepthWithFilter_includesAllDepthsUpToSelected() throws Exception {
    // Node Depth=2 + Tag=Certification.Gold: should show matching entities at depth 1 AND 2
    String qf = tagFilter("Certification.Gold");
    Map<String, Integer> nodes = getTableViewNodesWithDepth(rawA, "Downstream", 2, qf);
    // All returned nodes should be at depth <= 2
    assertTrue(nodes.values().stream().allMatch(depth -> Math.abs(depth) <= 2));
  }

  @Test
  void testTableView_searchPlusFilter_paginationConsistent() throws Exception {
    // Search + filter should return consistent paginated results
    String qf = comboFilter(searchClause("rpt"), tagClause("Certification.Gold"));
    Set<String> nodes = getTableViewNodes(stgA, "Downstream", qf);
    // All returned nodes should contain "rpt" in name
    assertTrue(nodes.stream().allMatch(fqn -> fqn.contains("rpt")));
  }

  @Test
  void testTableView_paginationWithOffsetReturnsUniquePages() throws Exception {
    Set<String> firstPage = getTableViewNodes(rawA, "Downstream", 0, 2, null);
    Set<String> secondPage = getTableViewNodes(rawA, "Downstream", 2, 2, null);

    assertEquals(2, firstPage.size());
    assertEquals(2, secondPage.size());
    assertTrue(firstPage.stream().noneMatch(secondPage::contains));

    Set<String> combined = new HashSet<>(firstPage);
    combined.addAll(secondPage);
    assertContainsExactly(combined, stgA, intA, rptA, rptB);
  }

  // ── Helper methods ────────────────────────────────────────────────────

  private Map<String, Integer> getTableViewNodesWithDepth(
      Table entity, String direction, int nodeDepth, String queryFilter) throws Exception {
    String[] result = {null};
    Awaitility.await("getLineageByEntityCount with nodeDepth")
        .atMost(Duration.ofSeconds(30))
        .pollInterval(Duration.ofSeconds(2))
        .ignoreExceptions()
        .until(
            () -> {
              result[0] =
                  client
                      .lineage()
                      .getLineageByEntityCount(
                          entity.getFullyQualifiedName(),
                          direction,
                          0,
                          100,
                          nodeDepth,
                          100,
                          false,
                          queryFilter,
                          null);
              return result[0] != null;
            });

    JsonNode root = MAPPER.readTree(result[0]);
    JsonNode nodes = root.get("nodes");
    if (nodes == null || nodes.isEmpty()) return Map.of();

    String entityFqn = entity.getFullyQualifiedName();
    Map<String, Integer> nodesWithDepth = new HashMap<>();
    nodes
        .fields()
        .forEachRemaining(
            entry -> {
              if (!entry.getKey().equals(entityFqn)) {
                int depth =
                    entry.getValue().has("nodeDepth")
                        ? entry.getValue().get("nodeDepth").asInt()
                        : 0;
                nodesWithDepth.put(entry.getKey(), depth);
              }
            });
    return nodesWithDepth;
  }

  private Set<String> getTableViewNodes(Table entity, String direction, String queryFilter)
      throws Exception {
    return getTableViewNodes(entity, direction, 0, 100, queryFilter);
  }

  private Set<String> getTableViewNodes(
      Table entity, String direction, int from, int size, String queryFilter) throws Exception {
    String[] result = {null};
    Awaitility.await("getLineageByEntityCount")
        .atMost(Duration.ofSeconds(30))
        .pollInterval(Duration.ofSeconds(2))
        .ignoreExceptions()
        .until(
            () -> {
              result[0] =
                  client
                      .lineage()
                      .getLineageByEntityCount(
                          entity.getFullyQualifiedName(),
                          direction,
                          from,
                          size,
                          100,
                          false,
                          queryFilter,
                          null);
              return result[0] != null;
            });

    JsonNode root = MAPPER.readTree(result[0]);
    JsonNode nodes = root.get("nodes");
    if (nodes == null || nodes.isEmpty()) return Set.of();

    String entityFqn = entity.getFullyQualifiedName();
    Set<String> nodeFqns = new HashSet<>();
    nodes
        .fieldNames()
        .forEachRemaining(
            fqn -> {
              if (!fqn.equals(entityFqn)) {
                nodeFqns.add(fqn);
              }
            });
    return nodeFqns;
  }

  private JsonNode getColumnViewResult(
      Table entity, String direction, int depth, String queryFilter, String columnFilter)
      throws Exception {
    int upDepth = direction.equals("Upstream") ? depth : 0;
    int downDepth = direction.equals("Downstream") ? depth : 0;

    String[] result = {null};
    Awaitility.await("searchLineageWithDirection")
        .atMost(Duration.ofSeconds(30))
        .pollInterval(Duration.ofSeconds(2))
        .ignoreExceptions()
        .until(
            () -> {
              result[0] =
                  client
                      .lineage()
                      .searchLineageWithDirection(
                          entity.getFullyQualifiedName(),
                          direction,
                          upDepth,
                          downDepth,
                          false,
                          queryFilter,
                          columnFilter);
              return result[0] != null;
            });

    return MAPPER.readTree(result[0]);
  }

  private int getColumnCount(JsonNode result) {
    int count = 0;
    for (String edgeType : List.of("upstreamEdges", "downstreamEdges")) {
      JsonNode edges = result.get(edgeType);
      if (edges != null && edges.isObject()) {
        for (JsonNode edge : (Iterable<JsonNode>) edges::elements) {
          JsonNode columns = edge.get("columns");
          if (columns != null) count += columns.size();
        }
      }
    }
    return count;
  }

  private void assertColumnPairsExactly(JsonNode result, String... expectedPairs) {
    assertEquals(Set.of(expectedPairs), getColumnPairs(result), "Column lineage pairs mismatch");
  }

  private Set<String> getColumnPairs(JsonNode result) {
    Set<String> pairs = new HashSet<>();
    for (String edgeType : List.of("upstreamEdges", "downstreamEdges")) {
      JsonNode edges = result.get(edgeType);
      if (edges == null || !edges.isObject()) {
        continue;
      }

      for (JsonNode edge : (Iterable<JsonNode>) edges::elements) {
        JsonNode columns = edge.get("columns");
        if (columns == null || !columns.isArray()) {
          continue;
        }

        for (JsonNode columnLineage : columns) {
          String toColumn = columnLineage.path("toColumn").asText();
          JsonNode fromColumns = columnLineage.path("fromColumns");
          if (!fromColumns.isArray()) {
            continue;
          }

          for (JsonNode fromColumn : fromColumns) {
            pairs.add(fromColumn.asText() + "->" + toColumn);
          }
        }
      }
    }

    return pairs;
  }

  private void assertContainsExactly(Set<String> actualFqns, Table... expectedTables) {
    Set<String> expected = new HashSet<>();
    for (Table t : expectedTables) {
      expected.add(t.getFullyQualifiedName());
    }
    assertEquals(expected, actualFqns, "Node FQNs mismatch");
  }

  private ColumnLineage colLineage(Table from, String fromCol, Table to, String toCol) {
    return new ColumnLineage()
        .withFromColumns(List.of(from.getFullyQualifiedName() + "." + fromCol))
        .withToColumn(to.getFullyQualifiedName() + "." + toCol);
  }

  private String columnPair(Table from, String fromCol, Table to, String toCol) {
    return from.getFullyQualifiedName()
        + "."
        + fromCol
        + "->"
        + to.getFullyQualifiedName()
        + "."
        + toCol;
  }

  private void addLineageWithColumns(Table from, Table to, List<ColumnLineage> columns) {
    LineageDetails details = new LineageDetails();
    details.setColumnsLineage(columns);
    details.setSource(LineageDetails.Source.MANUAL);

    AddLineage addLineage =
        new AddLineage()
            .withEdge(
                new EntitiesEdge()
                    .withFromEntity(from.getEntityReference())
                    .withToEntity(to.getEntityReference())
                    .withLineageDetails(details));

    Awaitility.await("Add lineage " + from.getName() + " → " + to.getName())
        .atMost(Duration.ofSeconds(30))
        .pollInterval(Duration.ofSeconds(1))
        .ignoreExceptions()
        .until(
            () -> {
              client.lineage().addLineage(addLineage);
              return true;
            });
  }

  private void waitForSearchIndex(String fqn) {
    Awaitility.await("Wait for ES index of " + fqn)
        .atMost(Duration.ofSeconds(60))
        .pollInterval(Duration.ofSeconds(3))
        .ignoreExceptions()
        .until(
            () -> {
              String result =
                  client
                      .lineage()
                      .getLineageByEntityCount(fqn, "Downstream", 0, 10, 10, false, null, null);
              JsonNode root = MAPPER.readTree(result);
              return root.has("nodes") && root.get("nodes").size() > 0;
            });
  }

  private void cleanup(Table table) {
    if (table == null) return;
    try {
      client.tables().delete(table.getId().toString());
    } catch (Exception ignored) {
    }
  }

  private void cleanupDomain(Domain domain) {
    if (domain == null) return;
    try {
      client.domains().delete(domain.getId().toString());
    } catch (Exception ignored) {
    }
  }

  // ── Filter query builders ─────────────────────────────────────────────

  private String tagFilter(String tagFqn) {
    return String.format(
        "{\"query\":{\"bool\":{\"must\":[{\"term\":{\"tags.tagFQN\":\"%s\"}}]}}}", tagFqn);
  }

  private String tierFilter(String tierFqn) {
    return String.format(
        "{\"query\":{\"bool\":{\"must\":[{\"term\":{\"tier.tagFQN\":\"%s\"}}]}}}", tierFqn);
  }

  private String ownerFilter(String ownerName) {
    return String.format(
        "{\"query\":{\"bool\":{\"must\":[{\"term\":{\"ownerName\":\"%s\"}}]}}}", ownerName);
  }

  private String domainFilter(String domainName) {
    return String.format(
        "{\"query\":{\"bool\":{\"must\":[{\"term\":{\"domains.name.keyword\":\"%s\"}}]}}}",
        domainName);
  }

  private String searchFilter(String searchValue) {
    return String.format(
        "{\"query\":{\"bool\":{\"must\":[{\"bool\":{\"should\":[{\"wildcard\":{\"displayName.keyword\":{\"value\":\"*%s*\"}}},{\"wildcard\":{\"name.keyword\":{\"value\":\"*%s*\"}}}]}}]}}}",
        searchValue, searchValue);
  }

  private String tagClause(String tagFqn) {
    return String.format("{\"term\":{\"tags.tagFQN\":\"%s\"}}", tagFqn);
  }

  private String tierClause(String tierFqn) {
    return String.format("{\"term\":{\"tier.tagFQN\":\"%s\"}}", tierFqn);
  }

  private String ownerClause(String ownerName) {
    return String.format("{\"term\":{\"ownerName\":\"%s\"}}", ownerName);
  }

  private String domainClause(String domainName) {
    return String.format("{\"term\":{\"domains.name.keyword\":\"%s\"}}", domainName);
  }

  private String searchClause(String searchValue) {
    return String.format(
        "{\"bool\":{\"should\":[{\"wildcard\":{\"displayName.keyword\":{\"value\":\"*%s*\"}}},{\"wildcard\":{\"name.keyword\":{\"value\":\"*%s*\"}}}]}}",
        searchValue, searchValue);
  }

  private String comboFilter(String... clauses) {
    String joined = String.join(",", clauses);
    return String.format("{\"query\":{\"bool\":{\"must\":[%s]}}}", joined);
  }
}
