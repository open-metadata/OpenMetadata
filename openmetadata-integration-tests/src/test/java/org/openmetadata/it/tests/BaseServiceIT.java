package org.openmetadata.it.tests;

import org.openmetadata.schema.CreateEntity;
import org.openmetadata.schema.EntityInterface;

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

  // Services typically don't support patch
  {
    supportsPatch = false;
  }
}
