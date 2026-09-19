package org.openmetadata.service.security.policyevaluator;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.DatabaseServiceRepository;

/**
 * Connector-type validation for {@code matchAnyServiceType}. A type that matches nothing makes a
 * Deny rule quietly grant access, so a typo has to be rejected when the policy is written.
 */
class ServiceAttributeUtilTest {

  @BeforeEach
  void registerDatabaseService() {
    DatabaseServiceRepository repository = mock(DatabaseServiceRepository.class);
    doReturn(true).when(repository).isSearchIndexable(any());
    doReturn(true).when(repository).isVectorEmbeddable(any());
    when(repository.getEntityType()).thenReturn(Entity.DATABASE_SERVICE);
    // The connector types are read off this class's getServiceType() return type.
    doReturn(DatabaseService.class).when(repository).getEntityClass();
    Entity.registerEntity(DatabaseService.class, Entity.DATABASE_SERVICE, repository);
  }

  /**
   * A repository that cannot report its entity class must not take down policy validation; the
   * check degrades to accepting the value rather than throwing.
   */
  @Test
  void toleratesARepositoryWithNoEntityClass() {
    DatabaseServiceRepository repository = mock(DatabaseServiceRepository.class);
    doReturn(true).when(repository).isSearchIndexable(any());
    doReturn(true).when(repository).isVectorEmbeddable(any());
    when(repository.getEntityType()).thenReturn(Entity.DATABASE_SERVICE);
    doReturn(null).when(repository).getEntityClass();
    Entity.registerEntity(DatabaseService.class, Entity.DATABASE_SERVICE, repository);

    assertTrue(ServiceAttributeUtil.isKnownServiceType("anything"));
  }

  @Test
  void acceptsAConnectorTypeDeclaredByAServiceSchema() {
    assertTrue(ServiceAttributeUtil.isKnownServiceType("Snowflake"));
    assertTrue(ServiceAttributeUtil.isKnownServiceType("Postgres"));
  }

  /** The condition matches case-insensitively, so validation has to as well. */
  @Test
  void acceptsAKnownTypeInAnyCase() {
    assertTrue(ServiceAttributeUtil.isKnownServiceType("snowflake"));
    assertTrue(ServiceAttributeUtil.isKnownServiceType("SNOWFLAKE"));
  }

  @Test
  void rejectsATypo() {
    assertFalse(ServiceAttributeUtil.isKnownServiceType("Snowflak"));
    assertFalse(ServiceAttributeUtil.isKnownServiceType("NoSuchConnector"));
  }

  @Test
  void enumeratesTheDeclaredTypesForTheErrorMessage() {
    assertTrue(ServiceAttributeUtil.serviceTypes().contains("snowflake"));
    assertFalse(ServiceAttributeUtil.serviceTypes().isEmpty());
  }
}
