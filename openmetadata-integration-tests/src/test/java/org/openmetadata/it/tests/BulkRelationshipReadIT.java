package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotSame;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.factories.UserTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.SqlQueryCounter;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.DomainRepository;
import org.openmetadata.service.util.RequestEntityCache;

@Isolated("Temporarily decorates the application's SQL logger")
@ExtendWith(TestNamespaceExtension.class)
class BulkRelationshipReadIT {
  @Test
  void incomingOwnersAndOutgoingExpertsShareOneUserLookup(TestNamespace ns) {
    var client = SdkClients.adminClient();
    var user = UserTestFactory.createUser(ns, "owner_expert");
    Domain domain =
        client
            .domains()
            .create(
                new CreateDomain()
                    .withName(ns.prefix("relationships"))
                    .withDescription("Bulk relationship read")
                    .withDomainType(CreateDomain.DomainType.AGGREGATE)
                    .withOwners(List.of(user.getEntityReference()))
                    .withExperts(List.of(user.getName())));
    var repository = (DomainRepository) Entity.getEntityRepository(Entity.DOMAIN);
    RequestEntityCache.clear();

    try (var queries = new SqlQueryCounter(Entity.getJdbi(), "from user_entity")) {
      repository.setFieldsInBulk(repository.fieldPolicy().parse("owners,experts"), List.of(domain));
      assertEquals(
          List.of(user.getId()), domain.getOwners().stream().map(EntityReference::getId).toList());
      assertEquals(
          List.of(user.getId()), domain.getExperts().stream().map(EntityReference::getId).toList());
      assertEquals(1, queries.count());
      assertNotSame(domain.getOwners().getFirst(), domain.getExperts().getFirst());
      domain.getOwners().getFirst().setInherited(true);
      assertNull(domain.getExperts().getFirst().getInherited());
    } finally {
      RequestEntityCache.clear();
    }
  }
}
