package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.context.CreateContextMemory;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.context.MemoryShareConfig;
import org.openmetadata.schema.entity.context.MemoryVisibility;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.sdk.services.context.ContextMemoryService;
import org.openmetadata.service.Entity;

/** A memory anchored to an asset takes the asset's governance: its domain on create, its readers on read. */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class ContextMemoryAnchorIT {

  @Test
  void anAnchoredMemoryWithoutDomains_takesTheAnchorsDomain(TestNamespace ns) {
    Domain domain = createDomain(ns, "sales");
    Table anchor = tableInDomain(ns, domain);

    ContextMemory memory =
        adminMemories()
            .create(
                entityMemory(ns, "in-domain").withPrimaryEntity(ref(Entity.TABLE, anchor.getId())));

    assertEquals(List.of(domain.getId()), domainIds(memory));
  }

  @Test
  void explicitDomains_winOverTheAnchors(TestNamespace ns) {
    Table anchor = tableInDomain(ns, createDomain(ns, "sales"));
    Domain own = createDomain(ns, "finance");

    ContextMemory memory =
        adminMemories()
            .create(
                entityMemory(ns, "own-domain")
                    .withPrimaryEntity(ref(Entity.TABLE, anchor.getId()))
                    .withDomains(List.of(own.getFullyQualifiedName())));

    assertEquals(List.of(own.getId()), domainIds(memory));
  }

  @Test
  void aMultiDomainAnchor_isNotCopied(TestNamespace ns) {
    List<String> twoDomains =
        List.of(
            createDomain(ns, "first").getFullyQualifiedName(),
            createDomain(ns, "second").getFullyQualifiedName());
    User anchor = createUser(ns, null, twoDomains);

    ContextMemory memory =
        adminMemories()
            .create(
                entityMemory(ns, "multi-domain")
                    .withPrimaryEntity(ref(Entity.USER, anchor.getId())));

    assertTrue(
        domainIds(memory).isEmpty(),
        "two domains would break 'Multiple Domains are not allowed' on every later PATCH");
  }

  private static List<UUID> domainIds(ContextMemory memory) {
    ContextMemory withDomains =
        adminMemories().get(memory.getId().toString(), Entity.FIELD_DOMAINS);
    return listOrEmpty(withDomains.getDomains()).stream().map(EntityReference::getId).toList();
  }

  private static Domain createDomain(TestNamespace ns, String name) {
    CreateDomain request =
        new CreateDomain()
            .withName(ns.prefix(name))
            .withDomainType(CreateDomain.DomainType.AGGREGATE)
            .withDescription("Context memory anchor domain");
    return ns.trackRoot(Entity.DOMAIN, SdkClients.adminClient().domains().create(request));
  }

  private static Table tableInDomain(TestNamespace ns, Domain domain) {
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns);
    CreateTable request =
        new CreateTable()
            .withName(ns.prefix("orders"))
            .withDatabaseSchema(schema.getFullyQualifiedName())
            .withColumns(List.of(new Column().withName("id").withDataType(ColumnDataType.BIGINT)))
            .withDomains(List.of(domain.getFullyQualifiedName()));
    return SdkClients.adminClient().tables().create(request);
  }

  private static User createUser(TestNamespace ns, Role role, List<String> domains) {
    String name = "cmanchor_" + UUID.randomUUID().toString().substring(0, 8);
    CreateUser request =
        new CreateUser()
            .withName(name)
            .withEmail(name + "@test.openmetadata.org")
            .withDomains(domains);
    if (role != null) {
      request.withRoles(List.of(role.getId()));
    }
    return ns.trackRoot(Entity.USER, SdkClients.adminClient().users().create(request));
  }

  private static CreateContextMemory entityMemory(TestNamespace ns, String name) {
    return new CreateContextMemory()
        .withName(ns.prefix(name))
        .withQuestion("Which column holds the order total?")
        .withAnswer("orders.amount_usd, in US dollars.")
        .withShareConfig(new MemoryShareConfig().withVisibility(MemoryVisibility.ENTITY));
  }

  private static EntityReference ref(String type, UUID id) {
    return new EntityReference().withId(id).withType(type);
  }

  private static ContextMemoryService adminMemories() {
    return new ContextMemoryService(SdkClients.adminClient().getHttpClient());
  }
}
