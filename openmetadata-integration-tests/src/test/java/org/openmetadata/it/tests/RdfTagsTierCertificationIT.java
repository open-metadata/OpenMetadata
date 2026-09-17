/*
 *  Copyright 2026 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.fail;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.UUID;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIf;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.factories.TableTestFactory;
import org.openmetadata.it.util.RdfTestUtils;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.AddGlossaryToAssetsRequest;
import org.openmetadata.schema.api.AddTagToAssetsRequest;
import org.openmetadata.schema.api.classification.CreateClassification;
import org.openmetadata.schema.api.classification.CreateTag;
import org.openmetadata.schema.api.data.CreateGlossary;
import org.openmetadata.schema.api.data.CreateGlossaryTerm;
import org.openmetadata.schema.api.data.UpdateColumn;
import org.openmetadata.schema.entity.classification.Classification;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.AssetCertification;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Integration tests for the RDF/Fuseki pipeline verifying that classification tags, Tier
 * assignments, and asset certifications are materialised as real RDF links rather than synthetic
 * FQN URIs or opaque JSON literals.
 *
 * <p>Exercises the mapper guarantees added to {@code RdfPropertyMapper}:
 * <ul>
 *   <li>{@code om:hasTag} points at {@code entity/tag/{uuid}} (never a fabricated {@code tag/FQN}
 *       URI) so a SPARQL walk from an asset reaches the real Tag entity.</li>
 *   <li>Tier-classified assets also get an {@code om:hasTier} shortcut.</li>
 *   <li>Certifications decompose into {@code om:hasCertification}, {@code om:certificationLevel},
 *       {@code om:certificationAppliedAt}, {@code om:certificationExpiresAt} — not a JSON string
 *       literal under {@code om:certification}.</li>
 * </ul>
 */
@Execution(ExecutionMode.SAME_THREAD)
@Tag("integration")
@Tag("rdf")
@ExtendWith(TestNamespaceExtension.class)
class RdfTagsTierCertificationIT {

  private static final Logger LOG = LoggerFactory.getLogger(RdfTagsTierCertificationIT.class);
  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final String ENTITY_URI_PREFIX = "https://open-metadata.org/entity/";
  private static final String ENTITY_TAG_URI_PREFIX = ENTITY_URI_PREFIX + "tag/";
  private static final String ENTITY_GLOSSARY_TERM_URI_PREFIX = ENTITY_URI_PREFIX + "glossaryTerm/";
  private static final String SYNTHETIC_TAG_URI_PREFIX = "https://open-metadata.org/tag/";
  private static final String OM_NS = "https://open-metadata.org/ontology/";
  private static final Duration AWAIT_TIMEOUT = Duration.ofSeconds(60);
  private static final Duration POLL_INTERVAL = Duration.ofSeconds(1);

  static boolean isRdfEnabled() {
    return RdfTestUtils.isRdfEnabled();
  }

  @Test
  @EnabledIf("isRdfEnabled")
  void classificationTag_linksToRealTagEntityUri(TestNamespace ns) {
    Table table =
        createTableWithTags(
            ns,
            new TagLabel()
                .withTagFQN("PII.Sensitive")
                .withSource(TagLabel.TagSource.CLASSIFICATION)
                .withLabelType(TagLabel.LabelType.MANUAL));

    String entityUri = entityUri("table", table.getId());

    awaitTagBoundByFqn(entityUri, "hasTag", "PII.Sensitive");

    String tagUri = fetchTagUri(entityUri, "hasTag", "PII.Sensitive");
    assertTrue(
        tagUri.startsWith(ENTITY_TAG_URI_PREFIX),
        "hasTag must resolve to entity/tag/{uuid}; got: " + tagUri);
    assertFalse(
        tagUri.startsWith(SYNTHETIC_TAG_URI_PREFIX),
        "hasTag must not use the synthetic tag/FQN URI; got: " + tagUri);
  }

  @Test
  @EnabledIf("isRdfEnabled")
  void tierTag_emitsHasTierShortcut(TestNamespace ns) {
    Table table =
        createTableWithTags(
            ns,
            new TagLabel()
                .withTagFQN("Tier.Tier1")
                .withSource(TagLabel.TagSource.CLASSIFICATION)
                .withLabelType(TagLabel.LabelType.MANUAL));

    String entityUri = entityUri("table", table.getId());

    awaitTagBoundByFqn(entityUri, "hasTier", "Tier.Tier1");

    String tierUri = fetchTagUri(entityUri, "hasTier", "Tier.Tier1");
    assertTrue(
        tierUri.startsWith(ENTITY_TAG_URI_PREFIX),
        "hasTier target must be entity/tag/{uuid}; got: " + tierUri);

    boolean typedAsTag =
        RdfTestUtils.executeSparqlAsk(
            "ASK { GRAPH ?g { <" + tierUri + "> a <" + OM_NS + "Tag> } }");
    assertTrue(typedAsTag, "hasTier target " + tierUri + " must be rdf:type om:Tag");
  }

  @Test
  @EnabledIf("isRdfEnabled")
  void certification_emitsStructuredTriplesNotJsonBlob(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = createTableWithTags(ns);

    TagLabel certTag =
        new TagLabel()
            .withTagFQN("Certification.Bronze")
            .withSource(TagLabel.TagSource.CLASSIFICATION)
            .withLabelType(TagLabel.LabelType.MANUAL);
    long now = System.currentTimeMillis();
    table.setCertification(
        new AssetCertification()
            .withTagLabel(certTag)
            .withAppliedDate(now)
            .withExpiryDate(now + Duration.ofDays(30).toMillis()));
    client.tables().update(table.getId().toString(), table);

    String entityUri = entityUri("table", table.getId());

    awaitAsk(
        "hasCertification edge should appear and target a Bronze tag",
        "ASK { GRAPH ?g { <"
            + entityUri
            + "> <"
            + OM_NS
            + "hasCertification> ?cert . "
            + "?cert <"
            + OM_NS
            + "tagFQN> \"Certification.Bronze\" } }");

    String certUri = fetchTagUri(entityUri, "hasCertification", "Certification.Bronze");
    assertTrue(
        certUri.startsWith(ENTITY_TAG_URI_PREFIX),
        "hasCertification target must be entity/tag/{uuid}; got: " + certUri);

    awaitAsk(
        "certificationLevel literal should be 'Bronze'",
        "ASK { GRAPH ?g { <" + entityUri + "> <" + OM_NS + "certificationLevel> \"Bronze\" } }");

    awaitAsk(
        "certificationAppliedAt must be a non-string literal",
        "ASK { GRAPH ?g { <"
            + entityUri
            + "> <"
            + OM_NS
            + "certificationAppliedAt> ?t"
            + " FILTER(isLiteral(?t) && DATATYPE(?t) != <http://www.w3.org/2001/XMLSchema#string>) } }");

    boolean jsonLiteralLeaks =
        RdfTestUtils.executeSparqlAsk(
            "ASK { GRAPH ?g { <"
                + entityUri
                + "> <"
                + OM_NS
                + "certification> ?o FILTER(isLiteral(?o)) } }");
    assertFalse(jsonLiteralLeaks, "Certification must not be stored as a JSON string literal");
  }

  @Test
  @EnabledIf("isRdfEnabled")
  void tagEntity_isReachableAndTyped(TestNamespace ns) {
    Table table =
        createTableWithTags(
            ns,
            new TagLabel()
                .withTagFQN("PII.Sensitive")
                .withSource(TagLabel.TagSource.CLASSIFICATION)
                .withLabelType(TagLabel.LabelType.MANUAL));
    String entityUri = entityUri("table", table.getId());
    awaitAsk(
        "hasTag target must be an om:Tag with om:tagFQN 'PII.Sensitive'",
        "ASK { GRAPH ?g { <"
            + entityUri
            + "> <"
            + OM_NS
            + "hasTag> ?tag . "
            + "?tag a <"
            + OM_NS
            + "Tag> ; "
            + "<"
            + OM_NS
            + "tagFQN> \"PII.Sensitive\" } }");
  }

  // ===========================================================================================
  // RDF tag sync (issue #33474): RdfTagUpdater built invalid SPARQL for special-char tag FQNs
  // and wrote non-canonical triples to the default graph. These tests exercise the async
  // snapshot writer (RdfUpdater.updateEntity) directly, independent of RdfTagUpdater, and pin
  // down the two regressions that survive today regardless of tag-name characters:
  //   - wrong-URI/wrong-graph orphan triples from RdfTagUpdater's inline writes (RED on main)
  //   - bulk add/remove-to-assets paths that never sync RDF at all (RED on main)
  // ===========================================================================================

  @Test
  @EnabledIf("isRdfEnabled")
  void classificationTagWithSpaceInName_addAndRemove_roundTripsCanonicalTriple(TestNamespace ns) {
    Classification classification = createClassification(ns);
    var tag = createTag(ns, classification, "Sensitive Data");
    String tagFqn = tag.getFullyQualifiedName();

    Table table = createTableWithTags(ns, classificationTagLabel(tagFqn));
    String entityUri = entityUri("table", table.getId());

    awaitTagBoundByFqn(entityUri, "hasTag", tagFqn);
    String tagUri = fetchTagUri(entityUri, "hasTag", tagFqn);
    assertTrue(
        tagUri.startsWith(ENTITY_TAG_URI_PREFIX),
        "hasTag must resolve to entity/tag/{uuid} even for a tag name with a space; got: "
            + tagUri);

    table.setTags(List.of());
    SdkClients.adminClient().tables().update(table.getId().toString(), table);

    awaitAskFalse(
        "hasTag must be gone from the union graph after removing a tag whose name has a space",
        unionAsk(entityUri, "hasTag", tagUri));
  }

  @Test
  @EnabledIf("isRdfEnabled")
  void glossaryTermWithSpaceInName_addAndRemove_roundTripsCanonicalTriple(TestNamespace ns) {
    Glossary glossary = createGlossary(ns);
    GlossaryTerm term = createGlossaryTerm(ns, glossary, "Customer Data");
    String termFqn = term.getFullyQualifiedName();

    Table table = createTableWithTags(ns, glossaryTagLabel(termFqn));
    String entityUri = entityUri("table", table.getId());

    awaitTagBoundByFqn(entityUri, "hasGlossaryTerm", termFqn);
    String termUri = fetchTagUri(entityUri, "hasGlossaryTerm", termFqn);
    assertTrue(
        termUri.startsWith(ENTITY_GLOSSARY_TERM_URI_PREFIX),
        "hasGlossaryTerm must resolve to entity/glossaryTerm/{uuid} even for a term name with a"
            + " space; got: "
            + termUri);

    table.setTags(List.of());
    SdkClients.adminClient().tables().update(table.getId().toString(), table);

    awaitAskFalse(
        "hasGlossaryTerm must be gone from the union graph after removing a term whose name has"
            + " a space",
        unionAsk(entityUri, "hasGlossaryTerm", termUri));
  }

  @Test
  @EnabledIf("isRdfEnabled")
  void columnTagRemoval_clearsCanonicalTriple(TestNamespace ns) throws Exception {
    Classification classification = createClassification(ns);
    var tag = createTag(ns, classification, "columnTag");
    String tagFqn = tag.getFullyQualifiedName();

    Table table = createTableWithTags(ns);
    String columnFqn = columnFqn(table, 1);
    String columnUri = columnUri(columnFqn);

    updateColumn(columnFqn, new UpdateColumn().withTags(List.of(classificationTagLabel(tagFqn))));

    awaitTagBoundByFqn(columnUri, "hasTag", tagFqn);
    String tagUri = fetchTagUri(columnUri, "hasTag", tagFqn);

    updateColumn(columnFqn, new UpdateColumn().withTags(List.of()));

    awaitAskFalse(
        "hasTag must be gone from the column's canonical URI after removing the column tag",
        unionAsk(columnUri, "hasTag", tagUri));
  }

  @Test
  @EnabledIf("isRdfEnabled")
  void classificationTag_doesNotLeaveOrphanSyntheticTripleInDefaultGraph(TestNamespace ns)
      throws Exception {
    Classification classification = createClassification(ns);
    var entityTag = createTag(ns, classification, "orphanCheckEntity");
    var columnTag = createTag(ns, classification, "orphanCheckColumn");
    String entityTagFqn = entityTag.getFullyQualifiedName();
    String columnTagFqn = columnTag.getFullyQualifiedName();

    Table table = createTableWithTags(ns, classificationTagLabel(entityTagFqn));
    String entityUri = entityUri("table", table.getId());
    String columnFqn = columnFqn(table, 1);
    String columnUri = columnUri(columnFqn);

    updateColumn(
        columnFqn, new UpdateColumn().withTags(List.of(classificationTagLabel(columnTagFqn))));

    // Synchronization points: the correct snapshot writes have landed before we look for junk.
    awaitTagBoundByFqn(entityUri, "hasTag", entityTagFqn);
    awaitTagBoundByFqn(columnUri, "hasTag", columnTagFqn);

    assertSustainedFalse(
        "entity hasTag must never point at the synthetic tag/<fqn> URI written to the default"
            + " graph",
        unionAsk(entityUri, "hasTag", syntheticTagUri(entityTagFqn)));
    assertSustainedFalse(
        "column hasTag must never point at the synthetic tag/<fqn> URI written to the default"
            + " graph",
        unionAsk(columnUri, "hasTag", syntheticTagUri(columnTagFqn)));
  }

  @Test
  @EnabledIf("isRdfEnabled")
  void bulkAddTagToAssets_syncsRdf(TestNamespace ns) throws Exception {
    Classification classification = createClassification(ns);
    var tag = createTag(ns, classification, "bulkAdd");
    String tagFqn = tag.getFullyQualifiedName();

    Table table = createTableWithTags(ns);
    String entityUri = entityUri("table", table.getId());

    OpenMetadataClient client = SdkClients.adminClient();
    AddTagToAssetsRequest request =
        new AddTagToAssetsRequest()
            .withDryRun(false)
            .withAssets(List.of(table.getEntityReference()));
    client
        .getHttpClient()
        .execute(HttpMethod.PUT, "/v1/tags/" + tag.getId() + "/assets/add", request, Void.class);

    awaitTagBoundByFqn(entityUri, "hasTag", tagFqn);
    String tagUri = fetchTagUri(entityUri, "hasTag", tagFqn);
    assertTrue(
        tagUri.startsWith(ENTITY_TAG_URI_PREFIX),
        "hasTag from a bulk add-to-assets call must resolve to entity/tag/{uuid}; got: " + tagUri);
  }

  @Test
  @EnabledIf("isRdfEnabled")
  void bulkRemoveTagFromAssets_syncsRdf(TestNamespace ns) throws Exception {
    Classification classification = createClassification(ns);
    var tag = createTag(ns, classification, "bulkRemove");
    String tagFqn = tag.getFullyQualifiedName();

    Table table = createTableWithTags(ns, classificationTagLabel(tagFqn));
    String entityUri = entityUri("table", table.getId());
    awaitTagBoundByFqn(entityUri, "hasTag", tagFqn);
    String tagUri = fetchTagUri(entityUri, "hasTag", tagFqn);

    OpenMetadataClient client = SdkClients.adminClient();
    AddTagToAssetsRequest request =
        new AddTagToAssetsRequest()
            .withDryRun(false)
            .withAssets(List.of(table.getEntityReference()));
    client
        .getHttpClient()
        .execute(HttpMethod.PUT, "/v1/tags/" + tag.getId() + "/assets/remove", request, Void.class);

    awaitAskFalse(
        "hasTag must be gone from the union graph after a bulk remove-from-assets call",
        unionAsk(entityUri, "hasTag", tagUri));
  }

  @Test
  @EnabledIf("isRdfEnabled")
  void bulkAddGlossaryTermToAssets_syncsRdf(TestNamespace ns) throws Exception {
    Glossary glossary = createGlossary(ns);
    GlossaryTerm term = createGlossaryTerm(ns, glossary, "bulkAddTerm");
    String termFqn = term.getFullyQualifiedName();

    Table table = createTableWithTags(ns);
    String entityUri = entityUri("table", table.getId());

    OpenMetadataClient client = SdkClients.adminClient();
    AddGlossaryToAssetsRequest request =
        new AddGlossaryToAssetsRequest()
            .withDryRun(false)
            .withAssets(List.of(table.getEntityReference()));
    client
        .getHttpClient()
        .execute(
            HttpMethod.PUT,
            "/v1/glossaryTerms/" + term.getId() + "/assets/add",
            request,
            Void.class);

    awaitTagBoundByFqn(entityUri, "hasGlossaryTerm", termFqn);
    String termUri = fetchTagUri(entityUri, "hasGlossaryTerm", termFqn);
    assertTrue(
        termUri.startsWith(ENTITY_GLOSSARY_TERM_URI_PREFIX),
        "hasGlossaryTerm from a bulk add-to-assets call must resolve to entity/glossaryTerm/{uuid};"
            + " got: "
            + termUri);
  }

  @Test
  @EnabledIf("isRdfEnabled")
  void bulkRemoveGlossaryTermFromAssets_syncsRdf(TestNamespace ns) throws Exception {
    Glossary glossary = createGlossary(ns);
    GlossaryTerm term = createGlossaryTerm(ns, glossary, "bulkRemoveTerm");
    String termFqn = term.getFullyQualifiedName();

    Table table = createTableWithTags(ns, glossaryTagLabel(termFqn));
    String entityUri = entityUri("table", table.getId());
    awaitTagBoundByFqn(entityUri, "hasGlossaryTerm", termFqn);
    String termUri = fetchTagUri(entityUri, "hasGlossaryTerm", termFqn);

    OpenMetadataClient client = SdkClients.adminClient();
    AddGlossaryToAssetsRequest request =
        new AddGlossaryToAssetsRequest()
            .withDryRun(false)
            .withAssets(List.of(table.getEntityReference()));
    client
        .getHttpClient()
        .execute(
            HttpMethod.PUT,
            "/v1/glossaryTerms/" + term.getId() + "/assets/remove",
            request,
            Void.class);

    awaitAskFalse(
        "hasGlossaryTerm must be gone from the union graph after a bulk remove-from-assets call",
        unionAsk(entityUri, "hasGlossaryTerm", termUri));
  }

  /* ----------------------------- helpers ---------------------------------- */

  private Table createTableWithTags(TestNamespace ns, TagLabel... tagLabels) {
    var service = DatabaseServiceTestFactory.createPostgres(ns);
    var schema = DatabaseSchemaTestFactory.createSimple(ns, service);
    Table table = TableTestFactory.createSimple(ns, schema.getFullyQualifiedName());
    if (tagLabels.length > 0) {
      table.setTags(List.of(tagLabels));
      SdkClients.adminClient().tables().update(table.getId().toString(), table);
      table = SdkClients.adminClient().tables().get(table.getId().toString(), "tags,certification");
    }
    return table;
  }

  private static String entityUri(String type, UUID id) {
    return ENTITY_URI_PREFIX + type + "/" + id;
  }

  /**
   * Wait until a predicate link from the entity to some tag resource identified by tagFQN exists.
   * Independent of the tag URI shape (entity/real vs synthetic) so this doubles as a
   * "RDF listener has caught up" probe.
   */
  private static void awaitTagBoundByFqn(String entityUri, String predicate, String tagFqn) {
    String sparql =
        "ASK { GRAPH ?g { <"
            + entityUri
            + "> <"
            + OM_NS
            + predicate
            + "> ?tag . "
            + "?tag <"
            + OM_NS
            + "tagFQN> \""
            + tagFqn
            + "\" } }";
    awaitAsk(predicate + " should eventually bind a tag with FQN '" + tagFqn + "'", sparql);
  }

  /** Retrieves the concrete URI bound to `entityUri predicate ?tag` where tag has the given FQN. */
  private static String fetchTagUri(String entityUri, String predicate, String tagFqn) {
    String sparql =
        "SELECT ?tag WHERE { GRAPH ?g { <"
            + entityUri
            + "> <"
            + OM_NS
            + predicate
            + "> ?tag . "
            + "?tag <"
            + OM_NS
            + "tagFQN> \""
            + tagFqn
            + "\" } } LIMIT 1";
    String json = RdfTestUtils.executeSparqlSelect(sparql);
    if (json == null) {
      fail("SPARQL SELECT returned null for predicate " + predicate);
    }
    try {
      JsonNode results = MAPPER.readTree(json).path("results").path("bindings");
      if (!results.isArray() || results.size() == 0) {
        fail("No binding found for predicate " + predicate + " on " + entityUri);
      }
      String uri = results.get(0).path("tag").path("value").asText();
      LOG.info(
          "RDF: {} --{}--> {} (expected prefix {})",
          entityUri,
          predicate,
          uri,
          ENTITY_TAG_URI_PREFIX);
      return uri;
    } catch (Exception e) {
      fail("Could not parse SPARQL response: " + e.getMessage() + "; body=" + json);
      return null;
    }
  }

  private static void awaitAsk(String message, String sparql) {
    try {
      Awaitility.await(message)
          .atMost(AWAIT_TIMEOUT)
          .pollInterval(POLL_INTERVAL)
          .until(() -> RdfTestUtils.executeSparqlAsk(sparql));
    } catch (Exception e) {
      LOG.warn("Await failed for query: {}", sparql);
      throw e;
    }
    assertTrue(RdfTestUtils.executeSparqlAsk(sparql), message);
  }

  /** Waits until a SPARQL ASK query returns false, e.g. a triple removed by a PATCH/bulk call. */
  private static void awaitAskFalse(String message, String sparql) {
    try {
      Awaitility.await(message)
          .atMost(AWAIT_TIMEOUT)
          .pollInterval(POLL_INTERVAL)
          .until(() -> !RdfTestUtils.executeSparqlAsk(sparql));
    } catch (Exception e) {
      LOG.warn("Await-false failed for query: {}", sparql);
      throw e;
    }
    assertFalse(RdfTestUtils.executeSparqlAsk(sparql), message);
  }

  /**
   * RdfTagUpdater's inline writes and the async snapshot writer both run post-commit,
   * independently of each other, so a single ASK could win a race even when the buggy write lands
   * moments later. Requires the negative condition to hold over a sustained window instead of
   * checking it once, mirroring the dryRun "must never happen" pattern in {@code TagResourceIT}.
   */
  private static void assertSustainedFalse(String message, String sparql) {
    Awaitility.await(message)
        .pollDelay(Duration.ofSeconds(3))
        .pollInterval(Duration.ofSeconds(1))
        .atMost(Duration.ofSeconds(20))
        .during(Duration.ofSeconds(10))
        .until(() -> !RdfTestUtils.executeSparqlAsk(sparql));
  }

  /** Builds an ASK query with no {@code GRAPH} clause, i.e. Fuseki's unioned default+named view. */
  private static String unionAsk(String subjectUri, String predicate, String objectUri) {
    return "ASK { <" + subjectUri + "> <" + OM_NS + predicate + "> <" + objectUri + "> }";
  }

  /** The wrong, non-canonical tag URI that {@code RdfTagUpdater} builds for classification tags. */
  private static String syntheticTagUri(String tagFqn) {
    return SYNTHETIC_TAG_URI_PREFIX + tagFqn.replace(".", "/");
  }

  private static String columnFqn(Table table, int columnIndex) {
    return table.getFullyQualifiedName() + "." + table.getColumns().get(columnIndex).getName();
  }

  private static String columnUri(String columnFqn) {
    return ENTITY_URI_PREFIX + "column/" + URLEncoder.encode(columnFqn, StandardCharsets.UTF_8);
  }

  /**
   * Mutates a column's tags via the dedicated column endpoint ({@code
   * PUT /v1/columns/name/{fqn}?entityType=table}), the same path {@code ColumnResourceIT} uses.
   * Going through {@code tables().update()} with a locally mutated nested {@code columns} list is
   * not reliable here: the SDK's client-side JSON diff can fail to detect a change confined to one
   * column's {@code tags}, so the PATCH silently no-ops. The column endpoint builds its own
   * server-side diff of the full table and still runs through {@code TableRepository.patch()}, so
   * it exercises the exact tag-update code path this test suite is verifying.
   */
  private static void updateColumn(String columnFqn, UpdateColumn request) throws Exception {
    SdkClients.adminClient()
        .getHttpClient()
        .executeForString(
            HttpMethod.PUT,
            "/v1/columns/name/"
                + URLEncoder.encode(columnFqn, StandardCharsets.UTF_8)
                + "?entityType=table",
            request);
  }

  private static TagLabel classificationTagLabel(String tagFqn) {
    return new TagLabel()
        .withTagFQN(tagFqn)
        .withSource(TagLabel.TagSource.CLASSIFICATION)
        .withLabelType(TagLabel.LabelType.MANUAL);
  }

  private static TagLabel glossaryTagLabel(String termFqn) {
    return new TagLabel()
        .withTagFQN(termFqn)
        .withSource(TagLabel.TagSource.GLOSSARY)
        .withLabelType(TagLabel.LabelType.MANUAL);
  }

  private static Classification createClassification(TestNamespace ns) {
    CreateClassification request =
        new CreateClassification()
            .withName(ns.prefix("rdfTagCls"))
            .withDescription("RDF tag sync IT classification");
    return SdkClients.adminClient().classifications().create(request);
  }

  private static org.openmetadata.schema.entity.classification.Tag createTag(
      TestNamespace ns, Classification classification, String baseName) {
    CreateTag request =
        new CreateTag()
            .withName(ns.prefix(baseName))
            .withClassification(classification.getFullyQualifiedName())
            .withDescription("RDF tag sync IT tag");
    return SdkClients.adminClient().tags().create(request);
  }

  private static Glossary createGlossary(TestNamespace ns) {
    CreateGlossary request =
        new CreateGlossary()
            .withName(ns.prefix("rdfTagGlossary"))
            .withDescription("RDF tag sync IT glossary");
    return SdkClients.adminClient().glossaries().create(request);
  }

  private static GlossaryTerm createGlossaryTerm(
      TestNamespace ns, Glossary glossary, String baseName) {
    CreateGlossaryTerm request =
        new CreateGlossaryTerm()
            .withName(ns.prefix(baseName))
            .withGlossary(glossary.getFullyQualifiedName())
            .withDescription("RDF tag sync IT term");
    return SdkClients.adminClient().glossaryTerms().create(request);
  }
}
