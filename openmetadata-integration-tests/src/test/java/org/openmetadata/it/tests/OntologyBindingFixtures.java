package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.net.URI;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.IntStream;
import org.openmetadata.it.factories.TopicTestFactory;
import org.openmetadata.it.util.RdfAccessFixtures;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.data.CreateOntologyAxiom;
import org.openmetadata.schema.api.data.CreateOntologyProperty;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.data.NativeOntologyAssetCluster;
import org.openmetadata.schema.api.data.NativeOntologyConceptEdge;
import org.openmetadata.schema.api.data.NativeOntologyDataGraph;
import org.openmetadata.schema.api.data.UpdateOntologyConceptBinding;
import org.openmetadata.schema.api.lineage.AddLineage;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.entity.data.OntologyAxiom;
import org.openmetadata.schema.entity.data.OntologyConcept;
import org.openmetadata.schema.entity.data.OntologyProperty;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.data.Topic;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EntitiesEdge;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.OntologyAssetBinding;
import org.openmetadata.schema.type.OntologyAxiomType;
import org.openmetadata.schema.type.OntologyBindingAssetType;
import org.openmetadata.schema.type.OntologyColumnBinding;
import org.openmetadata.schema.type.OntologyConceptBindingsResponse;
import org.openmetadata.schema.type.OntologyExpression;
import org.openmetadata.schema.type.OntologyExpressionKind;
import org.openmetadata.schema.type.OntologyPropertyKind;
import org.openmetadata.schema.type.OntologyRestrictionKind;
import org.openmetadata.schema.type.RelationProvenance;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.config.OpenMetadataConfig;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpMethod;

/** REST helpers shared by the native concept binding and data graph integration tests. */
final class OntologyBindingFixtures {
  static final URI CUSTOMER = URI.create("urn:Customer");
  static final URI ORDER = URI.create("urn:Order");
  static final URI INVOICE = URI.create("urn:Invoice");
  static final URI RELATES_TO = URI.create("urn:relatesTo");
  private static final int WIDE_TABLE_COLUMNS = 100;

  private OntologyBindingFixtures() {}

  static OpenMetadataClient admin() {
    return SdkClients.adminClient();
  }

  static OpenMetadataClient client(final String token) {
    return new OpenMetadataClient(
        OpenMetadataConfig.builder().serverUrl(SdkClients.baseUrl()).accessToken(token).build());
  }

  static void assertStatus(final int status, final Runnable request) {
    assertEquals(status, assertThrows(OpenMetadataException.class, request::run).getStatusCode());
  }

  static NativeOntologyDataGraph graph(
      final OpenMetadataClient client, final Ontology ontology, final String query) {
    return client
        .getHttpClient()
        .execute(
            HttpMethod.GET,
            "/v1/ontologies/" + ontology.getId() + "/dataGraph" + query,
            null,
            NativeOntologyDataGraph.class);
  }

  static OntologyConceptBindingsResponse bindings(
      final OntologyConcept concept, final String query) {
    return bindings(admin(), concept, query);
  }

  static OntologyConceptBindingsResponse bindings(
      final OpenMetadataClient client, final OntologyConcept concept, final String query) {
    return client
        .getHttpClient()
        .execute(
            HttpMethod.GET,
            bindingsPath(concept) + query,
            null,
            OntologyConceptBindingsResponse.class);
  }

  static String bindingsPath(final OntologyConcept concept) {
    return "/v1/ontologyConcepts/" + concept.getId() + "/bindings";
  }

  static void bind(
      final OntologyConcept concept,
      final Table table,
      final List<OntologyColumnBinding> columns,
      final long revision) {
    bind(
        concept,
        new OntologyAssetBinding()
            .withAssetType(OntologyBindingAssetType.TABLE)
            .withAssetId(table.getId())
            .withColumns(columns),
        revision);
  }

  static void bind(
      final OntologyConcept concept, final OntologyAssetBinding asset, final long revision) {
    final var saved =
        admin()
            .getHttpClient()
            .execute(
                HttpMethod.PUT,
                bindingsPath(concept),
                new UpdateOntologyConceptBinding().withExpectedRevision(revision).withAsset(asset),
                OntologyConceptBindingsResponse.class);
    assertEquals(revision + 1, saved.getRevision());
  }

  static void bindAll(final OntologyConcept concept, final List<Table> tables) {
    for (int index = 0; index < tables.size(); index++) {
      bind(concept, tables.get(index), List.of(), index);
    }
  }

  static OntologyAssetBinding topicAsset(final Topic topic) {
    return new OntologyAssetBinding()
        .withAssetType(OntologyBindingAssetType.TOPIC)
        .withAssetId(topic.getId());
  }

  static void bindSharedTopic(final TestNamespace ns, final List<OntologyConcept> concepts) {
    final var topic = TopicTestFactory.createSimple(ns);
    for (final var concept : concepts) {
      bind(concept, topicAsset(topic), 0L);
    }
  }

  static List<Table> tables(final TestNamespace ns, final String schema, final int count) {
    final var tables = new ArrayList<Table>();
    for (int index = 0; index < count; index++) {
      tables.add(
          admin()
              .tables()
              .create(
                  new CreateTable()
                      .withName(ns.prefix("t" + UUID.randomUUID()))
                      .withDatabaseSchema(schema)
                      .withColumns(
                          List.of(
                              new Column()
                                  .withName("value")
                                  .withDataType(ColumnDataType.STRING)))));
    }
    return tables;
  }

  static OntologyColumnBinding column(final OntologyProperty property) {
    return new OntologyColumnBinding()
        .withPropertyId(property.getId())
        .withColumnPath(List.of("value"));
  }

  /** A table of 100 columns, every one assigned to {@code property}. */
  static OntologyAssetBinding wideTableAsset(
      final TestNamespace ns, final String schema, final OntologyProperty property) {
    final var columns =
        IntStream.range(0, WIDE_TABLE_COLUMNS)
            .mapToObj(
                index -> new Column().withName("field" + index).withDataType(ColumnDataType.STRING))
            .toList();
    final var table =
        admin()
            .tables()
            .create(
                new CreateTable()
                    .withName(ns.prefix("wide" + UUID.randomUUID()))
                    .withDatabaseSchema(schema)
                    .withColumns(columns));
    return new OntologyAssetBinding()
        .withAssetType(OntologyBindingAssetType.TABLE)
        .withAssetId(table.getId())
        .withColumns(
            columns.stream()
                .map(
                    column ->
                        new OntologyColumnBinding()
                            .withPropertyId(property.getId())
                            .withColumnPath(List.of(column.getName())))
                .toList());
  }

  static OntologyProperty objectProperty(final Ontology ontology, final String displayName) {
    return admin()
        .ontologyProperties()
        .create(
            new CreateOntologyProperty()
                .withName("relatesTo")
                .withDisplayName(displayName)
                .withOntology(ontology.getFullyQualifiedName())
                .withKind(OntologyPropertyKind.OBJECT)
                .withIri(RELATES_TO));
  }

  static OntologyProperty dataProperty(final Ontology ontology, final OntologyConcept domain) {
    return admin()
        .ontologyProperties()
        .create(
            new CreateOntologyProperty()
                .withName("postalCode")
                .withOntology(ontology.getFullyQualifiedName())
                .withKind(OntologyPropertyKind.DATA)
                .withDomain(List.of(domain.getIri()))
                .withRange(List.of(URI.create("http://www.w3.org/2001/XMLSchema#string"))));
  }

  static OntologyAxiom assertion(final Ontology ontology, final URI subject, final URI target) {
    return assertion(ontology, subject, target, "relates" + subject.getSchemeSpecificPart());
  }

  static OntologyAxiom assertion(
      final Ontology ontology, final URI subject, final URI target, final String name) {
    return admin().ontologyAxioms().create(assertionRequest(ontology, subject, target, name));
  }

  static CreateOntologyAxiom assertionRequest(
      final Ontology ontology, final URI subject, final URI target, final String name) {
    return new CreateOntologyAxiom()
        .withName(name)
        .withDisplayName("Related concepts")
        .withDescription("An object property assertion between bound concepts")
        .withOntology(ontology.getFullyQualifiedName())
        .withAxiomType(OntologyAxiomType.OBJECT_PROPERTY_ASSERTION)
        .withSubjectIri(subject)
        .withPropertyIri(RELATES_TO)
        .withTargetIri(target)
        .withExpressions(List.of())
        .withProvenance(RelationProvenance.MANUAL);
  }

  static void restriction(final Ontology ontology, final URI subject, final URI target) {
    admin()
        .ontologyAxioms()
        .create(
            new CreateOntologyAxiom()
                .withName("restricts" + subject.getSchemeSpecificPart())
                .withDisplayName("Restricted concept")
                .withDescription("A named filler restriction between bound concepts")
                .withOntology(ontology.getFullyQualifiedName())
                .withAxiomType(OntologyAxiomType.SUBCLASS_OF)
                .withSubjectIri(subject)
                .withProvenance(RelationProvenance.MANUAL)
                .withExpressions(
                    List.of(
                        new OntologyExpression()
                            .withKind(OntologyExpressionKind.RESTRICTION)
                            .withPropertyIri(RELATES_TO)
                            .withRestrictionKind(OntologyRestrictionKind.SOME)
                            .withFiller(
                                new OntologyExpression()
                                    .withKind(OntologyExpressionKind.NAMED_CLASS)
                                    .withClassIri(target)))));
  }

  static void lineage(final EntityInterface<?> from, final EntityInterface<?> to) {
    admin()
        .lineage()
        .addLineage(
            new AddLineage()
                .withEdge(
                    new EntitiesEdge()
                        .withFromEntity(from.getEntityReference())
                        .withToEntity(to.getEntityReference())));
  }

  static void assertEdge(
      final NativeOntologyDataGraph graph,
      final OntologyConcept from,
      final OntologyConcept to,
      final OntologyProperty property) {
    final NativeOntologyConceptEdge edge =
        graph.getEdges().stream()
            .filter(
                candidate ->
                    candidate.getFromConceptId().equals(from.getId())
                        && candidate.getToConceptId().equals(to.getId()))
            .findFirst()
            .orElseThrow();
    assertEquals(RELATES_TO, edge.getPropertyIri());
    assertEquals("Relates to", edge.getLabel());
    assertEquals(property.getId(), edge.getProperty().getId());
  }

  static Set<String> serviceTypes(final NativeOntologyAssetCluster cluster) {
    final var types = new HashSet<String>();
    cluster.getAssets().forEach(asset -> types.add(asset.getServiceType()));
    return types;
  }

  static Set<UUID> ids(final List<Table> tables) {
    final var ids = new HashSet<UUID>();
    tables.forEach(table -> ids.add(table.getId()));
    return ids;
  }

  /** A reader denied {@code resource} by a rule that exempts the resources they own. */
  static OpenMetadataClient ownerReader(final RdfAccessFixtures fixtures, final String resource) {
    final var role = fixtures.denyRole(MetadataOperation.VIEW_BASIC, resource);
    final var policy =
        admin().policies().get(role.getPolicies().getFirst().getId().toString(), "rules");
    policy.getRules().getFirst().setCondition("!isOwner()");
    admin().policies().update(policy.getId(), policy);
    return client(fixtures.userToken("owner", List.of(role.getId())));
  }

  static EntityReference readerReference(final OpenMetadataClient reader) {
    return reader
        .getHttpClient()
        .execute(HttpMethod.GET, "/v1/users/loggedInUser", null, User.class)
        .getEntityReference();
  }
}
