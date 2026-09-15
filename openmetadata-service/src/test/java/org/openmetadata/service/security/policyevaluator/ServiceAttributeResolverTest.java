package org.openmetadata.service.security.policyevaluator;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.services.ServiceAttributes;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.DatabaseServiceRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.util.EntityUtil.Fields;

/**
 * The reverse "which services carry this tag / go by this name" index that the search-side service
 * conditions compile into their query.
 */
class ServiceAttributeResolverTest {

  private static final String DEV_TAG = "Environment.Development";
  private static final String STAGING_TAG = "Environment.Staging";

  private DatabaseService sandbox;
  private DatabaseService warehouse;

  @BeforeEach
  void setUp() {
    sandbox = service("snowflake-sandbox", new TagLabel().withTagFQN(DEV_TAG));
    warehouse = service("snowflake-warehouse");
    registerDatabaseServices(sandbox, warehouse);
    // The snapshot is cached across tests, so force a rebuild against this test's services.
    ServiceAttributeResolver.invalidate();
  }

  @Test
  void resolvesTagsToTheServicesCarryingThem() {
    assertEquals(
        Set.of(sandbox.getId().toString()),
        ServiceAttributeResolver.serviceIdsForTags(Set.of(DEV_TAG)));
  }

  @Test
  void resolvesTagsAsAUnionAcrossArguments() {
    DatabaseService staging = service("redshift-staging", new TagLabel().withTagFQN(STAGING_TAG));
    registerDatabaseServices(sandbox, warehouse, staging);
    ServiceAttributeResolver.invalidate();

    assertEquals(
        Set.of(sandbox.getId().toString(), staging.getId().toString()),
        ServiceAttributeResolver.serviceIdsForTags(List.of(DEV_TAG, STAGING_TAG)),
        "matchAnyServiceTag is a union over its arguments");
  }

  @Test
  void resolvesNothingForAnUnusedTag() {
    assertTrue(
        ServiceAttributeResolver.serviceIdsForTags(Set.of("Environment.NoSuchTag")).isEmpty());
  }

  /**
   * An empty argument list must resolve to no services, not to every service. The search
   * translation depends on this to compile a zero-argument condition into match-nothing.
   */
  @Test
  void resolvesNothingForNoArguments() {
    assertTrue(ServiceAttributeResolver.serviceIdsForTags(List.of()).isEmpty());
    assertTrue(ServiceAttributeResolver.serviceIdsForNames(List.of()).isEmpty());
  }

  /** serviceAttributes is stored inline, so it arrives with the listing without a field request. */
  @Test
  void resolvesEnvironmentsToServiceIds() {
    warehouse.setServiceAttributes(
        new ServiceAttributes().withEnvironment(ServiceAttributes.Environment.PRODUCTION));
    registerDatabaseServices(sandbox, warehouse);
    ServiceAttributeResolver.invalidate();

    assertEquals(
        Set.of(warehouse.getId().toString()),
        ServiceAttributeResolver.serviceIdsForEnvironments(Set.of("Production")));
    assertEquals(
        Set.of(warehouse.getId().toString()),
        ServiceAttributeResolver.serviceIdsForEnvironments(Set.of("production")),
        "matching is case-insensitive, to agree with the REST evaluator");
    assertTrue(
        ServiceAttributeResolver.serviceIdsForEnvironments(Set.of("Development")).isEmpty(),
        "a service with no environment set must not match any environment");
  }

  @Test
  void resolvesNamesToServiceIds() {
    assertEquals(
        Set.of(sandbox.getId().toString()),
        ServiceAttributeResolver.serviceIdsForNames(Set.of("snowflake-sandbox")));
    assertTrue(ServiceAttributeResolver.serviceIdsForNames(Set.of("no-such-service")).isEmpty());
  }

  /**
   * The generation identifies the service state compiled into cached queries. It must move when
   * that state does, or the OpenSearch RBAC query cache keeps serving the previous service ids for
   * the rest of its own TTL.
   */
  @Test
  void generationTracksTheResolvedServiceState() {
    long before = ServiceAttributeResolver.generation();

    warehouse.setTags(List.of(new TagLabel().withTagFQN(DEV_TAG)));
    ServiceAttributeResolver.invalidate();

    assertNotEquals(before, ServiceAttributeResolver.generation());
    assertEquals(
        Set.of(sandbox.getId().toString(), warehouse.getId().toString()),
        ServiceAttributeResolver.serviceIdsForTags(Set.of(DEV_TAG)));
  }

  /** Rebuilding to the same content leaves query caches keyed on the generation warm. */
  @Test
  void generationIsStableWhenNothingChanged() {
    long before = ServiceAttributeResolver.generation();
    ServiceAttributeResolver.invalidate();

    assertEquals(before, ServiceAttributeResolver.generation());
  }

  private static DatabaseService service(String name, TagLabel... tags) {
    return new DatabaseService()
        .withId(UUID.randomUUID())
        .withName(name)
        .withFullyQualifiedName(name)
        .withTags(new ArrayList<>(List.of(tags)));
  }

  /**
   * Registrations are global and never torn down, so the stand-in answers the indexing policy hooks
   * the way a real repository does — a bare mock answers false and would report every database
   * service as non-indexable for the rest of the JVM.
   */
  private static void registerDatabaseServices(DatabaseService... services) {
    DatabaseServiceRepository repository = mock(DatabaseServiceRepository.class);
    doReturn(true).when(repository).isSearchIndexable(any());
    doReturn(true).when(repository).isVectorEmbeddable(any());
    when(repository.getEntityType()).thenReturn(Entity.DATABASE_SERVICE);
    when(repository.getFields(anyString())).thenReturn(Fields.EMPTY_FIELDS);
    when(repository.listAll(any(Fields.class), any(ListFilter.class)))
        .thenReturn(List.of(services));
    when(repository.getAllTags(any()))
        .thenAnswer(invocation -> invocation.getArgument(0, DatabaseService.class).getTags());
    Entity.registerEntity(DatabaseService.class, Entity.DATABASE_SERVICE, repository);
  }
}
