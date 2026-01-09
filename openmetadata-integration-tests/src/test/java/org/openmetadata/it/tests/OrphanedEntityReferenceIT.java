package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import java.util.List;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.DashboardServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateDashboard;
import org.openmetadata.schema.api.data.CreateGlossary;
import org.openmetadata.schema.api.data.CreateGlossaryTerm;
import org.openmetadata.schema.entity.data.Dashboard;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.services.DashboardService;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.Entity;
import org.openmetadata.service.util.FullyQualifiedName;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Integration tests for orphaned entity reference handling.
 *
 * <p>Tests that entities with orphaned references (deleted entities with leftover relationships in
 * join tables) can still be retrieved without causing 404 EntityNotFoundException errors.
 *
 * <p>This test verifies the fix for issue #24266.
 */
@ExtendWith(TestNamespaceExtension.class)
@Execution(ExecutionMode.CONCURRENT)
public class OrphanedEntityReferenceIT {

  private static final Logger LOG = LoggerFactory.getLogger(OrphanedEntityReferenceIT.class);

  @BeforeAll
  static void setup() {
    SdkClients.adminClient();
  }

  @Test
  void testOrphanedRef(TestNamespace ns) {
    DashboardService service = DashboardServiceTestFactory.createMetabase(ns);

    CreateDashboard createDashboard =
        new CreateDashboard()
            .withName(ns.prefix("dOrph"))
            .withService(service.getFullyQualifiedName())
            .withDescription("Dashboard for orphaned reference test");

    Dashboard dashboard = SdkClients.adminClient().dashboards().create(createDashboard);
    assertNotNull(dashboard);

    CreateGlossary createGlossary =
        new CreateGlossary().withName(ns.prefix("gOrph")).withDescription("Orphan test glossary");

    Glossary glossary = SdkClients.adminClient().glossaries().create(createGlossary);
    assertNotNull(glossary);

    CreateGlossaryTerm createTerm =
        new CreateGlossaryTerm()
            .withName(ns.prefix("tOrph"))
            .withGlossary(glossary.getFullyQualifiedName())
            .withDescription("Orphan term");

    GlossaryTerm glossaryTerm = SdkClients.adminClient().glossaryTerms().create(createTerm);
    assertNotNull(glossaryTerm);

    String tagFQN = glossaryTerm.getFullyQualifiedName();
    String tagFQNHash = FullyQualifiedName.buildHash(tagFQN);
    String targetFQNHash = FullyQualifiedName.buildHash(dashboard.getFullyQualifiedName());

    Entity.getCollectionDAO()
        .tagUsageDAO()
        .applyTag(1, tagFQN, tagFQNHash, targetFQNHash, 0, 0, null, null);

    Entity.getCollectionDAO().glossaryTermDAO().delete(glossaryTerm.getId());

    Dashboard retrievedDashboard =
        SdkClients.adminClient().dashboards().get(dashboard.getId().toString(), "tags");

    assertNotNull(retrievedDashboard);
    assertEquals(dashboard.getId(), retrievedDashboard.getId());
    assertEquals(dashboard.getFullyQualifiedName(), retrievedDashboard.getFullyQualifiedName());

    LOG.info(
        "Successfully retrieved dashboard {} even with orphaned glossary term in tag_usage",
        dashboard.getFullyQualifiedName());
  }

  @Test
  void testMultiOrphans(TestNamespace ns) {
    DashboardService service = DashboardServiceTestFactory.createMetabase(ns);

    CreateDashboard createDashboard =
        new CreateDashboard()
            .withName(ns.prefix("dMulti"))
            .withService(service.getFullyQualifiedName())
            .withDescription("Dashboard for multiple orphaned references test");

    Dashboard dashboard = SdkClients.adminClient().dashboards().create(createDashboard);
    assertNotNull(dashboard);

    CreateGlossary createGlossary =
        new CreateGlossary().withName(ns.prefix("gMulti")).withDescription("Multi orphan glossary");

    Glossary glossary = SdkClients.adminClient().glossaries().create(createGlossary);

    String targetFQNHash = FullyQualifiedName.buildHash(dashboard.getFullyQualifiedName());

    for (int i = 0; i < 3; i++) {
      CreateGlossaryTerm createTerm =
          new CreateGlossaryTerm()
              .withName(ns.prefix("t" + i))
              .withGlossary(glossary.getFullyQualifiedName())
              .withDescription("Term " + i);

      GlossaryTerm term = SdkClients.adminClient().glossaryTerms().create(createTerm);

      String tagFQN = term.getFullyQualifiedName();
      String tagFQNHash = FullyQualifiedName.buildHash(tagFQN);
      Entity.getCollectionDAO()
          .tagUsageDAO()
          .applyTag(1, tagFQN, tagFQNHash, targetFQNHash, 0, 0, null, null);

      Entity.getCollectionDAO().glossaryTermDAO().delete(term.getId());
    }

    Dashboard retrievedDashboard =
        SdkClients.adminClient().dashboards().get(dashboard.getId().toString(), "tags");

    assertNotNull(retrievedDashboard);
    assertEquals(dashboard.getId(), retrievedDashboard.getId());

    LOG.info(
        "Successfully retrieved dashboard {} with multiple orphaned references filtered",
        dashboard.getFullyQualifiedName());
  }

  @Test
  void testMixedRefs(TestNamespace ns) {
    DashboardService service = DashboardServiceTestFactory.createMetabase(ns);

    CreateGlossary createGlossary =
        new CreateGlossary().withName(ns.prefix("gMix")).withDescription("Mixed refs glossary");

    Glossary glossary = SdkClients.adminClient().glossaries().create(createGlossary);

    CreateGlossaryTerm createValidTerm =
        new CreateGlossaryTerm()
            .withName(ns.prefix("vTerm"))
            .withGlossary(glossary.getFullyQualifiedName())
            .withDescription("Valid term");

    GlossaryTerm validTerm = SdkClients.adminClient().glossaryTerms().create(createValidTerm);
    String validTagFQN = validTerm.getFullyQualifiedName();

    TagLabel validTagLabel =
        new TagLabel()
            .withTagFQN(validTagFQN)
            .withSource(TagLabel.TagSource.GLOSSARY)
            .withLabelType(TagLabel.LabelType.MANUAL);

    CreateDashboard createDashboard =
        new CreateDashboard()
            .withName(ns.prefix("dMix"))
            .withService(service.getFullyQualifiedName())
            .withDescription("Dashboard for mixed references test")
            .withTags(List.of(validTagLabel));

    Dashboard dashboard = SdkClients.adminClient().dashboards().create(createDashboard);
    assertNotNull(dashboard);

    CreateGlossaryTerm createOrphanTerm =
        new CreateGlossaryTerm()
            .withName(ns.prefix("oTerm"))
            .withGlossary(glossary.getFullyQualifiedName())
            .withDescription("Orphan term");

    GlossaryTerm orphanTerm = SdkClients.adminClient().glossaryTerms().create(createOrphanTerm);
    String orphanTagFQN = orphanTerm.getFullyQualifiedName();
    String orphanTagFQNHash = FullyQualifiedName.buildHash(orphanTagFQN);
    String targetFQNHash = FullyQualifiedName.buildHash(dashboard.getFullyQualifiedName());

    Entity.getCollectionDAO()
        .tagUsageDAO()
        .applyTag(1, orphanTagFQN, orphanTagFQNHash, targetFQNHash, 0, 0, null, null);

    Entity.getCollectionDAO().glossaryTermDAO().delete(orphanTerm.getId());

    Dashboard retrievedDashboard =
        SdkClients.adminClient().dashboards().get(dashboard.getId().toString(), "tags");

    assertNotNull(retrievedDashboard);
    assertEquals(dashboard.getId(), retrievedDashboard.getId());

    assertNotNull(retrievedDashboard.getTags());
    assertEquals(1, retrievedDashboard.getTags().size());
    assertEquals(validTagFQN, retrievedDashboard.getTags().get(0).getTagFQN());

    LOG.info(
        "Successfully retrieved dashboard {} with only valid tag {} (orphan filtered)",
        dashboard.getFullyQualifiedName(),
        validTagFQN);
  }
}
