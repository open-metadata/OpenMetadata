package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.factories.TableTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateDatabaseSchema;
import org.openmetadata.schema.api.domains.CreateDataProduct;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.api.domains.CreateDomain.DomainType;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.domains.DataProduct;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.api.BulkAssets;
import org.openmetadata.sdk.exceptions.InvalidRequestException;
import org.openmetadata.sdk.fluent.Databases;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.Entity;
import org.openmetadata.service.migration.utils.v208.DataProductDomainContainmentRepair;

/**
 * A data product moved to another domain before 1.12.12 / 1.13.1 kept its old domain in the
 * CONTAINS link the "Data Product Domain Validation" rule reads, so on 2.0 every edit to its assets
 * was rejected. The 2.0.8 migration rewrites CONTAINS to the domain the product shows.
 */
// Sequential: the repairAll test sweeps every data product, so it would repair the stale link the
// other test plants before that test checks the rejection.
@Execution(ExecutionMode.SAME_THREAD)
@ExtendWith(TestNamespaceExtension.class)
class DataProductDomainContainmentMigrationIT {
  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final String DOMAIN_RULE = "Data Product Domain Validation";
  private static final String TAG_ONLY_PATCH =
      "[{\"op\":\"add\",\"path\":\"/tags/0\",\"value\":{\"tagFQN\":\"PII.Sensitive\","
          + "\"source\":\"Classification\",\"labelType\":\"Manual\",\"state\":\"Confirmed\"}}]";

  @Test
  void assetOfAProductMovedBeforeTheFixIsEditableOnceContainmentIsRepaired(TestNamespace ns)
      throws Exception {
    Domain oldDomain = createDomain(ns, "containment_old");
    Domain newDomain = createDomain(ns, "containment_new");
    Table table = createTableInheriting(ns, newDomain);
    DataProduct product = createDataProduct(ns, newDomain);
    addAsset(product, table);
    pointContainmentAt(product.getId(), newDomain.getId(), oldDomain.getId());

    InvalidRequestException rejected =
        assertThrows(
            InvalidRequestException.class,
            () -> patchTags(table),
            "A product still containing its old domain rejects a tag-only edit of its asset");
    assertTrue(rejected.getMessage().contains(DOMAIN_RULE), rejected.getMessage());

    assertEquals(1, repair(product));
    assertEquals(Set.of(newDomain.getId().toString()), containedDomains(product.getId()));
    Table updated = patchTags(table);
    assertTrue(
        updated.getTags().stream().map(TagLabel::getTagFQN).anyMatch("PII.Sensitive"::equals));
    assertEquals(0, repair(product), "A repaired product needs nothing on a second run");
  }

  @Test
  void migrationRevivesSoftDeletedContainmentOfTheShownDomain(TestNamespace ns) {
    Domain domain = createDomain(ns, "containment_revive");
    DataProduct product = createDataProduct(ns, domain);
    softDeleteContainment(product.getId(), domain.getId());

    TestSuiteBootstrap.getJdbi()
        .useHandle(
            handle ->
                DataProductDomainContainmentRepair.repairAll(handle, Entity.getCollectionDAO()));

    assertEquals(Set.of(domain.getId().toString()), containedDomains(product.getId()));
  }

  @Test
  void productWhoseContainmentAlreadyMatchesIsNotTouched(TestNamespace ns) {
    Domain domain = createDomain(ns, "containment_match");
    DataProduct product = createDataProduct(ns, domain);

    assertEquals(0, repair(product));
    assertEquals(Set.of(domain.getId().toString()), containedDomains(product.getId()));
  }

  private static Domain createDomain(TestNamespace ns, String suffix) {
    return SdkClients.adminClient()
        .domains()
        .create(
            new CreateDomain()
                .withName(ns.prefix(suffix))
                .withDescription("containment repair")
                .withDomainType(DomainType.AGGREGATE));
  }

  private static DataProduct createDataProduct(TestNamespace ns, Domain domain) {
    return SdkClients.adminClient()
        .dataProducts()
        .create(
            new CreateDataProduct()
                .withName(ns.prefix("containment_dp"))
                .withDescription("containment repair")
                .withDomains(List.of(domain.getFullyQualifiedName())));
  }

  private static Table createTableInheriting(TestNamespace ns, Domain domain) throws Exception {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    Database database =
        Databases.create()
            .name(ns.prefix("containment_db"))
            .in(service.getFullyQualifiedName())
            .execute();
    DatabaseSchema schema =
        SdkClients.adminClient()
            .databaseSchemas()
            .create(
                new CreateDatabaseSchema()
                    .withName(ns.prefix("containment_schema"))
                    .withDatabase(database.getFullyQualifiedName())
                    .withDomains(List.of(domain.getFullyQualifiedName())));
    return TableTestFactory.createSimple(ns, schema.getFullyQualifiedName());
  }

  private static void addAsset(DataProduct product, Table table) throws Exception {
    SdkClients.adminClient()
        .getHttpClient()
        .execute(
            HttpMethod.PUT,
            "/v1/dataProducts/%s/assets/add".formatted(product.getFullyQualifiedName()),
            new BulkAssets().withAssets(List.of(table.getEntityReference())),
            Void.class);
  }

  /** Recreates the pre-fix state: the product shows newDomain but CONTAINS still names oldDomain. */
  private static void pointContainmentAt(UUID productId, UUID shownDomainId, UUID oldDomainId) {
    TestSuiteBootstrap.getJdbi()
        .useHandle(
            handle ->
                handle
                    .createUpdate(
                        "UPDATE entity_relationship SET fromId = :oldDomain WHERE toId = :product "
                            + "AND fromId = :shownDomain AND fromEntity = 'domain' "
                            + "AND toEntity = 'dataProduct' AND relation = :relation")
                    .bind("oldDomain", oldDomainId.toString())
                    .bind("product", productId.toString())
                    .bind("shownDomain", shownDomainId.toString())
                    .bind("relation", Relationship.CONTAINS.ordinal())
                    .execute());
  }

  private static int repair(DataProduct product) {
    return DataProductDomainContainmentRepair.repair(
        Entity.getCollectionDAO().relationshipDAO(), List.of(product.getId().toString()));
  }

  private static void softDeleteContainment(UUID productId, UUID domainId) {
    TestSuiteBootstrap.getJdbi()
        .useHandle(
            handle ->
                handle
                    .createUpdate(
                        "UPDATE entity_relationship SET deleted = TRUE WHERE toId = :product "
                            + "AND fromId = :domain AND fromEntity = 'domain' "
                            + "AND toEntity = 'dataProduct' AND relation = :relation")
                    .bind("product", productId.toString())
                    .bind("domain", domainId.toString())
                    .bind("relation", Relationship.CONTAINS.ordinal())
                    .execute());
  }

  private static Set<String> containedDomains(UUID productId) {
    return Set.copyOf(
        TestSuiteBootstrap.getJdbi()
            .withHandle(
                handle ->
                    handle
                        .createQuery(
                            "SELECT fromId FROM entity_relationship WHERE toId = :product "
                                + "AND fromEntity = 'domain' AND toEntity = 'dataProduct' "
                                + "AND relation = :relation AND deleted = FALSE")
                        .bind("product", productId.toString())
                        .bind("relation", Relationship.CONTAINS.ordinal())
                        .mapTo(String.class)
                        .list()));
  }

  private static Table patchTags(Table table) throws Exception {
    JsonNode patch = MAPPER.readTree(TAG_ONLY_PATCH);
    return SdkClients.adminClient().tables().patch(table.getId().toString(), patch);
  }
}
