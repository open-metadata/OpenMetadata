package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.URI;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.util.RdfAccessFixtures;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateOntologyAxiom;
import org.openmetadata.schema.api.data.CreateOntologyProperty;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.data.OntologyReleaseValidation;
import org.openmetadata.schema.api.data.UpdateOntologyConceptBinding;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.entity.data.OntologyConcept;
import org.openmetadata.schema.entity.data.OntologyRelease;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.NativeOntologyShaclSeverity;
import org.openmetadata.schema.type.OntologyAssetBinding;
import org.openmetadata.schema.type.OntologyAxiomType;
import org.openmetadata.schema.type.OntologyBindingAssetType;
import org.openmetadata.schema.type.OntologyConceptBindingsResponse;
import org.openmetadata.schema.type.OntologyExpression;
import org.openmetadata.schema.type.OntologyExpressionKind;
import org.openmetadata.schema.type.OntologyLiteral;
import org.openmetadata.schema.type.OntologyPropertyKind;
import org.openmetadata.schema.type.OntologyReleaseLogicalCheck;
import org.openmetadata.schema.type.OntologyReleaseMember;
import org.openmetadata.schema.type.RelationProvenance;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.config.OpenMetadataConfig;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.Entity;

@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class IndependentOntologyReleaseValidationIT extends BaseOntologyApprovalIT {
  @Test
  void cleanAndForeignCapturedClassesUseTheNameLabelFallback(TestNamespace ns) {
    final Ontology ontology = createOntology(ns);
    declareClass(
        ontology,
        "ExternalClass",
        URI.create("https://standard.example.org/" + ns.shortPrefix() + "/Class"));
    final OntologyRelease release = activate(ns, ontology);

    final OntologyReleaseValidation report = validate(release);
    assertTrue(report.getValid());
    assertEquals(OntologyReleaseLogicalCheck.NOT_RUN, report.getLogicalCheck());
    assertEquals(release.getId(), report.getReleaseId());
    assertEquals(0, report.getShacl().getViolationCount());
    assertEquals(0, report.getShacl().getWarningCount());
    assertTrue(report.getDeprecationImpacts().isEmpty());
    assertTrue(report.getStructure().getViolations().isEmpty());
    assertEquals(report, validate(release));
    final OntologyRelease sameContent = capture(ontology);
    assertEquals(release.getContentDigest(), sameContent.getContentDigest());
    final OntologyReleaseValidation second = validate(sameContent);
    assertEquals(sameContent.getId(), second.getReleaseId());
    assertEquals(release.getId(), second.getBaseReleaseId());
    assertEquals(sameContent.getId(), second.getStructure().getReleaseId());
  }

  @Test
  void twoValueEnumerationPassesAndSingleValueIsRejectedBeforeCapture(TestNamespace ns) {
    final Ontology ontology = createOntology(ns);
    final var properties = SdkClients.adminClient().ontologyProperties();
    final var one = new OntologyLiteral().withValue("one");
    final var two = new OntologyLiteral().withValue("two");
    final CreateOntologyProperty request =
        new CreateOntologyProperty()
            .withOntology(ontology.getFullyQualifiedName())
            .withName("status")
            .withKind(OntologyPropertyKind.DATA)
            .withEnumValues(List.of(one));
    assertEquals(
        400,
        assertThrows(OpenMetadataException.class, () -> properties.create(request))
            .getStatusCode());
    properties.create(request.withEnumValues(List.of(one, two)));
    assertTrue(validate(capture(ontology)).getValid());
  }

  @Test
  void invalidPropertyStructureIsRejectedBeforeCapture(TestNamespace ns) {
    final Ontology ontology = createOntology(ns);
    final var property =
        SdkClients.adminClient()
            .ontologyProperties()
            .create(
                new CreateOntologyProperty()
                    .withName("related")
                    .withOntology(ontology.getFullyQualifiedName())
                    .withKind(OntologyPropertyKind.DATA)
                    .withEnumValues(
                        List.of(
                            new OntologyLiteral().withValue("one"),
                            new OntologyLiteral().withValue("two"))));
    final OntologyRelease release = capture(ontology);
    assertEquals(
        400,
        assertThrows(
                OpenMetadataException.class,
                () ->
                    SdkClients.adminClient()
                        .ontologyProperties()
                        .patch(
                            property.getId(),
                            JsonUtils.readTree(
                                """
                                [{"op":"replace","path":"/kind","value":"OBJECT"}]
                                """)))
            .getStatusCode());
    assertTrue(validate(release).getValid());
  }

  @Test
  void deprecationReportsWarningCapturedDependenciesAndFreshBoundAssets(TestNamespace ns) {
    final Ontology ontology = createOntology(ns);
    final OntologyConcept parent =
        declareClass(ontology, "Parent", URI.create("urn:" + ns.shortPrefix() + ":Parent"));
    final OntologyConcept child =
        declareClass(ontology, "Child", URI.create("urn:" + ns.shortPrefix() + ":Child"));
    final OntologyConcept sibling =
        declareClass(ontology, "Sibling", URI.create("urn:" + ns.shortPrefix() + ":Sibling"));
    for (final OntologyConcept descendant : List.of(child, sibling)) {
      SdkClients.adminClient()
          .ontologyAxioms()
          .create(
              new CreateOntologyAxiom()
                  .withName(descendant.getName() + "OfParent")
                  .withDisplayName("Direct subclass")
                  .withDescription("A direct named parent")
                  .withOntology(ontology.getFullyQualifiedName())
                  .withAxiomType(OntologyAxiomType.SUBCLASS_OF)
                  .withProvenance(RelationProvenance.MANUAL)
                  .withSubjectIri(descendant.getIri())
                  .withExpressions(
                      List.of(
                          new OntologyExpression()
                              .withKind(OntologyExpressionKind.NAMED_CLASS)
                              .withClassIri(parent.getIri()))));
    }
    final var property =
        SdkClients.adminClient()
            .ontologyProperties()
            .create(
                new CreateOntologyProperty()
                    .withName("related")
                    .withOntology(ontology.getFullyQualifiedName())
                    .withKind(OntologyPropertyKind.OBJECT)
                    .withDomain(List.of(parent.getIri()))
                    .withRange(List.of(parent.getIri())));
    final OntologyRelease base = activate(ns, ontology);
    SdkClients.adminClient().ontologyConcepts().update(parent.getId(), parent.withDeprecated(true));
    final OntologyRelease release = capture(ontology);

    final OntologyReleaseValidation first = validate(release);
    assertTrue(first.getValid());
    assertEquals(base.getId(), first.getBaseReleaseId());
    assertEquals(2, first.getShacl().getWarningCount());
    assertEquals(
        NativeOntologyShaclSeverity.WARNING,
        first.getShacl().getFindings().getFirst().getSeverity());
    assertEquals(
        Set.of(child.getIri(), sibling.getIri()),
        first.getShacl().getFindings().stream()
            .map(finding -> finding.getFocusIri())
            .collect(Collectors.toSet()));
    final var impact = first.getDeprecationImpacts().getFirst();
    assertEquals(parent.getId(), impact.getDefinition().getId());
    assertEquals(
        Set.of(child.getId(), sibling.getId()),
        impact.getSubclasses().stream()
            .map(reference -> reference.getId())
            .collect(Collectors.toSet()));
    assertEquals(
        List.of(property.getId()),
        impact.getDomainProperties().stream().map(reference -> reference.getId()).toList());
    assertEquals(
        List.of(property.getId()),
        impact.getRangeProperties().stream().map(reference -> reference.getId()).toList());
    assertEquals(0, impact.getBoundAssetCount());

    final var schema = DatabaseSchemaTestFactory.createSimple(ns);
    final var firstTable =
        SdkClients.adminClient()
            .tables()
            .create(
                new CreateTable()
                    .withName(ns.prefix("boundTableOne"))
                    .withDatabaseSchema(schema.getFullyQualifiedName())
                    .withColumns(
                        List.of(new Column().withName("id").withDataType(ColumnDataType.STRING))));
    final var secondTable =
        SdkClients.adminClient()
            .tables()
            .create(
                new CreateTable()
                    .withName(ns.prefix("boundTableTwo"))
                    .withDatabaseSchema(schema.getFullyQualifiedName())
                    .withColumns(
                        List.of(new Column().withName("id").withDataType(ColumnDataType.STRING))));
    bind(parent, firstTable.getId(), 0L);
    bind(parent, secondTable.getId(), 1L);
    final OntologyReleaseValidation refreshed = validate(release);
    assertEquals(first.getShacl(), refreshed.getShacl());
    assertEquals(2, refreshed.getDeprecationImpacts().getFirst().getBoundAssetCount());
    assertEquals(
        Set.of(firstTable.getId(), secondTable.getId()),
        refreshed.getDeprecationImpacts().getFirst().getBoundAssets().stream()
            .map(reference -> reference.getId())
            .collect(Collectors.toSet()));
    assertFalse(
        refreshed
            .getDeprecationImpacts()
            .getFirst()
            .getBoundAssets()
            .getFirst()
            .getFullyQualifiedName()
            .isBlank());
    try (var fixtures = new RdfAccessFixtures("validationAssets" + ns.shortPrefix())) {
      final var denyTables = fixtures.denyRole(MetadataOperation.VIEW_ALL, Entity.TABLE);
      final OpenMetadataClient restricted =
          new OpenMetadataClient(
              OpenMetadataConfig.builder()
                  .serverUrl(SdkClients.baseUrl())
                  .accessToken(fixtures.userToken("reader", List.of(denyTables.getId())))
                  .build());
      final var visible = validate(restricted, release).getDeprecationImpacts().getFirst();
      assertEquals(0, visible.getBoundAssetCount());
      assertTrue(visible.getBoundAssets().isEmpty());
    }
  }

  @Test
  void cachedValidationDrainsAllBindingPagesAndRechecksCurrentAssetAuthorization(TestNamespace ns) {
    final var ontology = createOntology(ns, "pagedValidation");
    final var concept =
        declareClass(ontology, "Customer", URI.create("urn:" + ns.shortPrefix() + ":Customer"));
    activate(ns, ontology);
    SdkClients.adminClient()
        .ontologyConcepts()
        .update(concept.getId(), concept.withDeprecated(true));
    final var release = capture(ontology);
    final var empty = validate(release);
    assertEquals(0, empty.getDeprecationImpacts().getFirst().getBoundAssetCount());
    final var schema = DatabaseSchemaTestFactory.createSimple(ns);
    final List<UUID> expected = new ArrayList<>();
    for (int index = 0; index < 101; index++) {
      final var table =
          SdkClients.adminClient()
              .tables()
              .create(
                  new CreateTable()
                      .withName(ns.prefix("impact" + index))
                      .withDatabaseSchema(schema.getFullyQualifiedName())
                      .withColumns(
                          List.of(
                              new Column().withName("id").withDataType(ColumnDataType.STRING))));
      bind(concept, table.getId(), index);
      expected.add(table.getId());
    }
    final var complete = validate(release);
    assertEquals(empty.getShacl(), complete.getShacl());
    assertEquals(101, complete.getDeprecationImpacts().getFirst().getBoundAssetCount());
    assertEquals(
        expected.stream().sorted(Comparator.comparing(UUID::toString)).toList(),
        complete.getDeprecationImpacts().getFirst().getBoundAssets().stream()
            .map(asset -> asset.getId())
            .toList());
    final var last =
        SdkClients.adminClient()
            .tables()
            .create(
                new CreateTable()
                    .withName(ns.prefix("impactLast"))
                    .withDatabaseSchema(schema.getFullyQualifiedName())
                    .withColumns(
                        List.of(new Column().withName("id").withDataType(ColumnDataType.STRING))));
    bind(concept, last.getId(), 101L);
    assertEquals(102, validate(release).getDeprecationImpacts().getFirst().getBoundAssetCount());
    try (var fixtures = new RdfAccessFixtures("pagedImpact" + ns.shortPrefix())) {
      final var denyTables = fixtures.denyRole(MetadataOperation.VIEW_ALL, Entity.TABLE);
      final var reader =
          new OpenMetadataClient(
              OpenMetadataConfig.builder()
                  .serverUrl(SdkClients.baseUrl())
                  .accessToken(fixtures.userToken("reader", List.of(denyTables.getId())))
                  .build());
      final var hidden = validate(reader, release).getDeprecationImpacts().getFirst();
      assertEquals(0, hidden.getBoundAssetCount());
      assertTrue(hidden.getBoundAssets().isEmpty());
      assertEquals(102, validate(release).getDeprecationImpacts().getFirst().getBoundAssetCount());
    }
  }

  @Test
  void cachedFindingsStillRequireCapturedMemberView(TestNamespace ns) {
    final Ontology ontology = createOntology(ns);
    declareClass(ontology, "Restricted", URI.create("urn:" + ns.shortPrefix() + ":Restricted"));
    final OntologyRelease release = capture(ontology);
    assertTrue(validate(release).getValid());

    try (var fixtures = new RdfAccessFixtures("validation" + ns.shortPrefix())) {
      final var denyConcepts =
          fixtures.denyRole(MetadataOperation.VIEW_ALL, Entity.ONTOLOGY_CONCEPT);
      final OpenMetadataClient denied =
          new OpenMetadataClient(
              OpenMetadataConfig.builder()
                  .serverUrl(SdkClients.baseUrl())
                  .accessToken(fixtures.userToken("reader", List.of(denyConcepts.getId())))
                  .build());
      assertEquals(release.getId(), denied.ontologyReleases().get(release.getId()).getId());
      assertEquals(
          403,
          assertThrows(
                  OpenMetadataException.class,
                  () ->
                      denied
                          .getHttpClient()
                          .execute(
                              HttpMethod.GET,
                              "/v1/ontologyReleases/" + release.getId() + "/validation",
                              null,
                              OntologyReleaseValidation.class))
              .getStatusCode());
    }
  }

  @Test
  void cachedFindingsStillRequireCapturedBaseMemberView(TestNamespace ns) {
    final Ontology ontology = createOntology(ns);
    final OntologyConcept concept =
        declareClass(ontology, "BaseOnly", URI.create("urn:" + ns.shortPrefix() + ":BaseOnly"));
    final OntologyRelease base = activate(ns, ontology);
    SdkClients.adminClient()
        .ontologyConcepts()
        .delete(concept.getId().toString(), Map.of("hardDelete", "true"));
    final OntologyRelease release = capture(ontology);
    assertEquals(base.getId(), validate(release).getBaseReleaseId());

    try (var fixtures = new RdfAccessFixtures("validationBase" + ns.shortPrefix())) {
      final var denyConcepts =
          fixtures.denyRole(MetadataOperation.VIEW_ALL, Entity.ONTOLOGY_CONCEPT);
      final OpenMetadataClient denied =
          new OpenMetadataClient(
              OpenMetadataConfig.builder()
                  .serverUrl(SdkClients.baseUrl())
                  .accessToken(fixtures.userToken("reader", List.of(denyConcepts.getId())))
                  .build());
      assertEquals(release.getId(), denied.ontologyReleases().get(release.getId()).getId());
      assertEquals(
          403,
          assertThrows(
                  OpenMetadataException.class,
                  () ->
                      denied
                          .getHttpClient()
                          .execute(
                              HttpMethod.GET,
                              "/v1/ontologyReleases/" + release.getId() + "/validation",
                              null,
                              OntologyReleaseValidation.class))
              .getStatusCode());
    }
  }

  @Test
  void missingCurrentConceptDoesNotBecomeEmptyImpact(TestNamespace ns) {
    final Ontology ontology = createOntology(ns);
    final OntologyConcept concept =
        declareClass(ontology, "Retired", URI.create("urn:" + ns.shortPrefix() + ":Retired"));
    activate(ns, ontology);
    SdkClients.adminClient()
        .ontologyConcepts()
        .update(concept.getId(), concept.withDeprecated(true));
    final OntologyRelease release = capture(ontology);
    assertEquals(1, validate(release).getDeprecationImpacts().size());

    SdkClients.adminClient()
        .ontologyConcepts()
        .delete(concept.getId().toString(), Map.of("hardDelete", "true"));
    assertEquals(
        404, assertThrows(OpenMetadataException.class, () -> validate(release)).getStatusCode());
  }

  @Test
  void newlyDeprecatedPropertyHasNoInventedClassOrAssetImpact(TestNamespace ns) {
    final Ontology ontology = createOntology(ns);
    final var property =
        SdkClients.adminClient()
            .ontologyProperties()
            .create(
                new CreateOntologyProperty()
                    .withName("legacyCode")
                    .withOntology(ontology.getFullyQualifiedName())
                    .withKind(OntologyPropertyKind.DATA)
                    .withRange(List.of(URI.create("http://www.w3.org/2001/XMLSchema#string"))));
    activate(ns, ontology);
    SdkClients.adminClient()
        .ontologyProperties()
        .update(property.getId(), property.withDeprecated(true));

    final var impact = validate(capture(ontology)).getDeprecationImpacts().getFirst();
    assertEquals(property.getId(), impact.getDefinition().getId());
    assertEquals(0, impact.getBoundAssetCount());
    assertTrue(impact.getBoundAssets().isEmpty());
    assertTrue(impact.getSubclasses().isEmpty());
    assertTrue(impact.getDomainProperties().isEmpty());
    assertTrue(impact.getRangeProperties().isEmpty());
  }

  @Test
  void warmFindingsDoNotBypassReleaseOrOntologyView(TestNamespace ns) {
    final Ontology ontology = createOntology(ns);
    final OntologyRelease release = capture(ontology);
    assertTrue(validate(release).getValid());

    for (int index = 0; index < 2; index++) {
      try (var fixtures = new RdfAccessFixtures("validationHeader" + ns.shortPrefix() + index)) {
        final var role =
            fixtures.denyRole(
                MetadataOperation.VIEW_ALL, index == 0 ? Entity.ONTOLOGY_RELEASE : Entity.ONTOLOGY);
        final OpenMetadataClient denied =
            new OpenMetadataClient(
                OpenMetadataConfig.builder()
                    .serverUrl(SdkClients.baseUrl())
                    .accessToken(fixtures.userToken("reader", List.of(role.getId())))
                    .build());
        assertEquals(
            403,
            assertThrows(OpenMetadataException.class, () -> validate(denied, release))
                .getStatusCode());
      }
    }
  }

  @Test
  void currentConceptBasicViewIsCheckedAfterCapturedMemberAllView(TestNamespace ns) {
    final Ontology ontology = createOntology(ns);
    final OntologyConcept concept =
        declareClass(ontology, "Deprecated", URI.create("urn:" + ns.shortPrefix() + ":Deprecated"));
    activate(ns, ontology);
    SdkClients.adminClient()
        .ontologyConcepts()
        .update(concept.getId(), concept.withDeprecated(true));
    final OntologyRelease release = capture(ontology);
    assertEquals(1, validate(release).getDeprecationImpacts().size());

    try (var fixtures = new RdfAccessFixtures("validationCurrent" + ns.shortPrefix())) {
      final var denyBasic =
          fixtures.denyRole(MetadataOperation.VIEW_BASIC, Entity.ONTOLOGY_CONCEPT);
      final OpenMetadataClient denied =
          new OpenMetadataClient(
              OpenMetadataConfig.builder()
                  .serverUrl(SdkClients.baseUrl())
                  .accessToken(fixtures.userToken("reader", List.of(denyBasic.getId())))
                  .build());
      assertNotNull(
          denied
              .getHttpClient()
              .execute(
                  HttpMethod.GET,
                  "/v1/ontologyReleases/" + release.getId() + "/members/CONCEPT/" + concept.getId(),
                  null,
                  OntologyReleaseMember.class));
      assertEquals(
          403,
          assertThrows(OpenMetadataException.class, () -> validate(denied, release))
              .getStatusCode());
    }
  }

  private static OntologyReleaseValidation validate(OntologyRelease release) {
    return validate(SdkClients.adminClient(), release);
  }

  private static void bind(OntologyConcept concept, UUID tableId, long revision) {
    SdkClients.adminClient()
        .getHttpClient()
        .execute(
            HttpMethod.PUT,
            "/v1/ontologyConcepts/" + concept.getId() + "/bindings",
            new UpdateOntologyConceptBinding()
                .withExpectedRevision(revision)
                .withAsset(
                    new OntologyAssetBinding()
                        .withAssetType(OntologyBindingAssetType.TABLE)
                        .withAssetId(tableId)),
            OntologyConceptBindingsResponse.class);
  }

  private static OntologyReleaseValidation validate(
      OpenMetadataClient client, OntologyRelease release) {
    final OntologyReleaseValidation report =
        client
            .getHttpClient()
            .execute(
                HttpMethod.GET,
                "/v1/ontologyReleases/" + release.getId() + "/validation",
                null,
                OntologyReleaseValidation.class);
    assertNotNull(report);
    return report;
  }
}
