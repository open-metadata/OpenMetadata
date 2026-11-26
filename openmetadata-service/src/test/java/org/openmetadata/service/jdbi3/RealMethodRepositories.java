package org.openmetadata.service.jdbi3;

import static org.mockito.Mockito.CALLS_REAL_METHODS;
import static org.mockito.Mockito.mock;

import java.lang.reflect.Field;

/**
 * A repository that runs its real methods without a database. A mock skips the constructor, so
 * the entity class that methods such as {@code serializeForVersionHistory} read is set here.
 */
final class RealMethodRepositories {
  private RealMethodRepositories() {}

  static <R extends EntityRepository<?>> R of(final Class<R> repository, final Class<?> entity) {
    final R instance = mock(repository, CALLS_REAL_METHODS);
    try {
      final Field entityClass = EntityRepository.class.getDeclaredField("entityClass");
      entityClass.setAccessible(true);
      entityClass.set(instance, entity);
    } catch (ReflectiveOperationException e) {
      throw new IllegalStateException("Cannot set the entity class of " + repository, e);
    }
    return instance;
  }
}
