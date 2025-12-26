package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.CreateEntity;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;

/**
 * Base class for Service entity integration tests.
 *
 * <p>Extends BaseEntityIT to inherit common entity tests and adds service-specific tests. Services
 * typically don't support patch operations.
 *
 * @param <T> The service entity type (e.g., DatabaseService, DashboardService)
 * @param <K> The create request type (e.g., CreateDatabaseService)
 */
public abstract class BaseServiceIT<T extends EntityInterface, K extends CreateEntity>
    extends BaseEntityIT<T, K> {

  // Services typically don't support patch and don't have search indices
  {
    supportsPatch = false;
    supportsSearchIndex = false;
    supportsDomains = false; // Services don't support domains field directly
  }

  @Test
  void test_listWithDomainFilter(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    String typePrefix = getEntityType().replace("Service", "").toLowerCase();

    Domain domain1 =
        client
            .domains()
            .create(
                new CreateDomain()
                    .withName(ns.prefix(typePrefix + "dom1"))
                    .withDescription("Test domain 1")
                    .withDomainType(CreateDomain.DomainType.AGGREGATE));
    Domain domain2 =
        client
            .domains()
            .create(
                new CreateDomain()
                    .withName(ns.prefix(typePrefix + "dom2"))
                    .withDescription("Test domain 2")
                    .withDomainType(CreateDomain.DomainType.AGGREGATE));

    K c1 = createRequest(ns.prefix(typePrefix + "svc1"), ns);
    c1.setDomains(List.of(domain1.getFullyQualifiedName()));
    T s1 = createEntity(c1);

    K c2 = createRequest(ns.prefix(typePrefix + "svc2"), ns);
    c2.setDomains(List.of(domain1.getFullyQualifiedName()));
    T s2 = createEntity(c2);

    K c3 = createRequest(ns.prefix(typePrefix + "svc3"), ns);
    c3.setDomains(List.of(domain2.getFullyQualifiedName()));
    T s3 = createEntity(c3);

    K c4 = createRequest(ns.prefix(typePrefix + "svc4"), ns);
    c4.setDomains(List.of(domain2.getFullyQualifiedName()));
    T s4 = createEntity(c4);

    ListResponse<T> result =
        listEntities(new ListParams().withDomain(domain1.getFullyQualifiedName()).withLimit(1000));
    assertTrue(
        result.getData().stream().anyMatch(s -> s.getName().equals(s1.getName())),
        "Service s1 should be in domain1 results");
    assertTrue(
        result.getData().stream().anyMatch(s -> s.getName().equals(s2.getName())),
        "Service s2 should be in domain1 results");

    result =
        listEntities(new ListParams().withDomain(domain2.getFullyQualifiedName()).withLimit(1000));
    assertTrue(
        result.getData().stream().anyMatch(s -> s.getName().equals(s3.getName())),
        "Service s3 should be in domain2 results");
    assertTrue(
        result.getData().stream().anyMatch(s -> s.getName().equals(s4.getName())),
        "Service s4 should be in domain2 results");
  }
}
