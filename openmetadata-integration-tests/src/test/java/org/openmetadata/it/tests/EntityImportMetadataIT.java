package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.schema.type.Include.NON_DELETED;

import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.it.factories.DashboardServiceTestFactory;
import org.openmetadata.it.factories.UserTestFactory;
import org.openmetadata.it.tests.EntityTransactionBoundaryIT.TransactionCounter;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.SqlFailureProbe;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateChart;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.entity.data.Chart;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.cache.EntityCacheBypass;
import org.openmetadata.service.entity.read.EntityReadService;
import org.openmetadata.service.entity.write.EntityCommandActor;
import org.openmetadata.service.jdbi3.ChartRepository;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;
import org.openmetadata.service.util.RequestEntityCache;

@ExtendWith(TestNamespaceExtension.class)
@Isolated("Counts import commits and injects a failure after the canonical row write")
class EntityImportMetadataIT {
  private static final String FIELDS = "owners,tags,domains";
  private static final String TAG = "PII.Sensitive";

  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void emptyImportFieldsRemoveMetadataWhileOrdinaryPutRetainsIt(
      boolean importing, TestNamespace ns) {
    final Chart original = fixture(ns);
    final Chart updated = emptyMetadata(original);
    try (var transactions = new TransactionCounter(Entity.getJdbi())) {
      repository()
          .creates()
          .upsert(null, updated, new EntityCommandActor("admin", null), importing);
      assertEquals(1, transactions.commits());
      assertEquals(0, transactions.rollbacks());
    }
    assertMetadata(original, importing);
    assertEquals(importing ? 0.2 : original.getVersion(), updated.getVersion());
  }

  @Test
  void anImportFailureRestoresOwnersDomainsTagsAndVersion(TestNamespace ns) {
    final Chart original = fixture(ns);
    final Chart updated = emptyMetadata(original);
    try (var transactions = new TransactionCounter(Entity.getJdbi());
        var failure =
            new SqlFailureProbe(
                Entity.getJdbi(),
                "update chart_entity",
                () -> new IllegalStateException("Failure after imported chart row write"))) {
      assertThrows(
          RuntimeException.class,
          () ->
              repository()
                  .creates()
                  .upsert(null, updated, new EntityCommandActor("admin", null), true));
      assertEquals(0, transactions.commits());
      assertEquals(1, transactions.rollbacks());
    }
    assertMetadata(original, false);
  }

  private Chart fixture(TestNamespace ns) {
    final var client = SdkClients.adminClient();
    final var owner = UserTestFactory.createUser(ns, "import_owner");
    final var domain =
        ns.trackRoot(
            Entity.DOMAIN,
            client
                .domains()
                .create(
                    new CreateDomain()
                        .withName(ns.prefix("import_domain"))
                        .withDescription("Import metadata fixture")
                        .withDomainType(CreateDomain.DomainType.AGGREGATE)));
    final var service = DashboardServiceTestFactory.createMetabase(ns);
    final Chart created =
        client
            .charts()
            .create(
                new CreateChart()
                    .withName(ns.prefix("import_metadata"))
                    .withService(service.getFullyQualifiedName())
                    .withOwners(List.of(owner.getEntityReference()))
                    .withDomains(List.of(domain.getFullyQualifiedName()))
                    .withTags(
                        List.of(
                            new TagLabel()
                                .withTagFQN(TAG)
                                .withSource(TagLabel.TagSource.CLASSIFICATION)
                                .withLabelType(TagLabel.LabelType.MANUAL)
                                .withState(TagLabel.State.CONFIRMED))));
    client.charts().getByName(created.getFullyQualifiedName(), FIELDS);
    return client.charts().get(created.getId().toString(), FIELDS);
  }

  private Chart emptyMetadata(Chart original) {
    final Chart updated =
        JsonUtils.deepCopy(original, Chart.class)
            .withOwners(new ArrayList<>())
            .withDomains(new ArrayList<>())
            .withTags(new ArrayList<>());
    repository().preparation().prepare(updated, true);
    return updated;
  }

  private void assertMetadata(Chart original, boolean removed) {
    final var charts = SdkClients.adminClient().charts();
    for (final Chart actual :
        List.of(
            fresh(original),
            charts.get(original.getId().toString(), FIELDS),
            charts.getByName(original.getFullyQualifiedName(), FIELDS))) {
      assertEquals(
          removed ? List.of() : original.getOwners().stream().map(EntityReference::getId).toList(),
          listOrEmpty(actual.getOwners()).stream().map(EntityReference::getId).toList());
      assertEquals(
          removed ? List.of() : original.getDomains().stream().map(EntityReference::getId).toList(),
          listOrEmpty(actual.getDomains()).stream().map(EntityReference::getId).toList());
      assertEquals(
          removed ? List.of() : List.of(TAG),
          listOrEmpty(actual.getTags()).stream().map(TagLabel::getTagFQN).toList());
      assertEquals(removed ? 0.2 : original.getVersion(), actual.getVersion());
    }
  }

  private Chart fresh(Chart original) {
    RequestEntityCache.clear();
    try (var bypass = EntityCacheBypass.skip()) {
      return repository()
          .reads()
          .byId(
              original.getId(),
              new EntityReadService.Query(
                  null,
                  repository().fieldPolicy().parse(FIELDS),
                  RelationIncludes.fromInclude(NON_DELETED),
                  false));
    } finally {
      RequestEntityCache.clear();
    }
  }

  private static ChartRepository repository() {
    return (ChartRepository) Entity.getEntityRepository(Entity.CHART);
  }
}
