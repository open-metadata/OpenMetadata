package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assumptions.assumeFalse;

import java.time.Duration;
import java.util.List;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.factories.ShortStackFactory;
import org.openmetadata.it.search.ReindexHelpers;
import org.openmetadata.it.server.ServerHandle;
import org.openmetadata.it.util.OssTestServer;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateDataContract;
import org.openmetadata.schema.api.domains.CreateDataProduct;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.api.domains.CreateDomain.DomainType;
import org.openmetadata.schema.entity.data.DataContract;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.domains.DataProduct;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.type.ContractExecutionStatus;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.SemanticsRule;
import org.openmetadata.sdk.exceptions.OpenMetadataException;

/**
 * The nightly data contract validation app validates every contract, including the ones it
 * materializes for assets that inherit a Data Product contract. It runs over every contract on the
 * server, so it runs isolated from other tests.
 */
@Execution(ExecutionMode.SAME_THREAD)
@Isolated
@ExtendWith(TestNamespaceExtension.class)
public class DataContractValidationAppIT {
  private static final String APP = "DataContractValidationApplication";
  private static final Duration RUN_TIMEOUT = Duration.ofMinutes(5);
  private static final SemanticsRule HAS_ONE_OWNER =
      new SemanticsRule()
          .withName("Has one owner")
          .withDescription("The asset has exactly one owner")
          .withRule("{\"==\":[{\"size\":{\"var\":\"owners\"}},1]}")
          .withEnabled(true);

  private static ServerHandle server;

  @BeforeAll
  static void setup() {
    server = OssTestServer.defaultHandle();
  }

  @Test
  void assetsDoNotGetAContractFromADataProductContractThatIsNotApproved(TestNamespace ns) {
    assumeFalse(TestSuiteBootstrap.isK8sEnabled(), "App trigger needs the embedded scheduler");
    Table asset = assetOfDataProductWithContract(ns, EntityStatus.DRAFT);

    runApp();

    OpenMetadataException missing =
        assertThrows(
            OpenMetadataException.class,
            () -> SdkClients.adminClient().dataContracts().getByEntityId(asset.getId(), "table"));
    assertEquals(404, missing.getStatusCode());
  }

  @Test
  void laterRunsStillApplyTheInheritedRules(TestNamespace ns) {
    assumeFalse(TestSuiteBootstrap.isK8sEnabled(), "App trigger needs the embedded scheduler");
    Table asset = assetOfDataProductWithContract(ns, EntityStatus.APPROVED);

    runApp();
    runApp();

    DataContract materialized =
        SdkClients.adminClient().dataContracts().getByEntityId(asset.getId(), "table");
    assertEquals(
        ContractExecutionStatus.Failed,
        SdkClients.adminClient()
            .dataContracts()
            .getLatestResult(materialized.getId())
            .getContractExecutionStatus(),
        "The second run must still check the Data Product's rule the asset breaks");
  }

  /** A table in a Data Product whose contract requires one owner; the table has none. */
  private static Table assetOfDataProductWithContract(TestNamespace ns, EntityStatus status) {
    Domain domain =
        SdkClients.adminClient()
            .domains()
            .create(
                new CreateDomain()
                    .withName(ns.prefix("contract_app_domain"))
                    .withDescription("Domain for nightly contract validation tests")
                    .withDomainType(DomainType.AGGREGATE));
    DataProduct dataProduct =
        SdkClients.adminClient()
            .dataProducts()
            .create(
                new CreateDataProduct()
                    .withName(ns.prefix("contract_app_product"))
                    .withDescription("Data product whose contract its assets inherit")
                    .withDomains(List.of(domain.getFullyQualifiedName())));
    SdkClients.adminClient()
        .dataContracts()
        .create(
            new CreateDataContract()
                .withName(ns.prefix("product_contract"))
                .withEntity(dataProduct.getEntityReference())
                .withEntityStatus(status)
                .withSemantics(List.of(HAS_ONE_OWNER)));
    Table table = ShortStackFactory.table(ns);
    Table withProduct =
        SdkClients.adminClient().tables().get(table.getId().toString(), "domains,dataProducts");
    withProduct.setDomains(List.of(domain.getEntityReference()));
    withProduct.setDataProducts(List.of(dataProduct.getEntityReference()));
    return SdkClients.adminClient().tables().update(table.getId().toString(), withProduct);
  }

  private static void runApp() {
    Awaitility.await("previous " + APP + " run to finish")
        .atMost(RUN_TIMEOUT)
        .pollInterval(Duration.ofSeconds(1))
        .ignoreExceptions()
        .until(
            () ->
                ReindexHelpers.latestRunStatus(server, APP) == null
                    || ReindexHelpers.latestRunIsTerminal(server, APP));
    long triggeredAt = System.currentTimeMillis();
    Awaitility.await(APP + " trigger to be accepted")
        .atMost(RUN_TIMEOUT)
        .pollInterval(Duration.ofSeconds(1))
        .ignoreExceptions()
        .until(
            () -> {
              ReindexHelpers.triggerApp(server, APP);
              return true;
            });
    Awaitility.await(APP + " run to finish")
        .atMost(RUN_TIMEOUT)
        .pollInterval(Duration.ofSeconds(1))
        .ignoreExceptions()
        .until(() -> ReindexHelpers.freshRunIsTerminal(server, APP, triggeredAt));
  }
}
