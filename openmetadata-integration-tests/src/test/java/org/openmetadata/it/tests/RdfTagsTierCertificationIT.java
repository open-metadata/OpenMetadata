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
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.AssetCertification;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.sdk.client.OpenMetadataClient;
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
}
