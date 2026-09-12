package org.openmetadata.service.entity.read;

import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;

import com.google.common.cache.CacheBuilder;
import com.google.common.cache.CacheLoader;
import com.google.common.cache.LoadingCache;
import java.time.Clock;
import java.util.Set;
import java.util.UUID;
import org.apache.commons.lang3.tuple.Pair;
import org.junit.jupiter.api.extension.AfterEachCallback;
import org.junit.jupiter.api.extension.BeforeEachCallback;
import org.junit.jupiter.api.extension.ExtensionContext;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.service.entity.EntityModuleDependencies;
import org.openmetadata.service.entity.cache.EntityCacheEpochs;
import org.openmetadata.service.entity.cache.EntityCaches;
import org.openmetadata.service.entity.policy.EntityPolicy;
import org.openmetadata.service.entity.policy.EntityPolicyContext;
import org.openmetadata.service.jdbi3.EntityDAO;
import org.openmetadata.service.util.FreshReadScope;

/**
 * Runs consumer fixtures through the real lookup service with database-boundary rows.
 */
public final class EntityLookupTestContext implements BeforeEachCallback, AfterEachCallback {

  private FreshReadScope.Handle scope;

  @Override
  public void beforeEach(ExtensionContext context) {
    scope = FreshReadScope.enter();
  }

  @Override
  public void afterEach(ExtensionContext context) {
    scope.close();
  }

  public <T extends EntityInterface> EntityDAO<T> attach(
      EntityPolicy<T> repository, String type, Class<T> entityClass) {
    @SuppressWarnings("unchecked")
    final EntityDAO<T> dao = mock(EntityDAO.class);
    final var ids = EntityLookupTestContext.<Pair<String, UUID>>unusedCache();
    final var names = EntityLookupTestContext.<Pair<String, String>>unusedCache();
    final var lookup =
        new EntityLookupService<>(
            new EntityLookupService.Schema<>(type, entityClass, () -> false),
            dao,
            new EntityLookupService.Caches(
                () -> ids, () -> names, () -> null, new EntityCacheEpochs()));
    lenient().when(repository.lookup()).thenReturn(lookup);
    return dao;
  }

  public static <T extends EntityInterface> void attachCached(
      EntityPolicy<T> repository, String type, Class<T> entityClass) {
    @SuppressWarnings("unchecked")
    final EntityDAO<T> dao = mock(EntityDAO.class);
    attachSchema(repository, type, entityClass, dao);
    final var lookup =
        new EntityLookupService<>(
            new EntityLookupService.Schema<>(type, entityClass, () -> false),
            dao,
            new EntityLookupService.Caches(
                EntityCaches::byId, EntityCaches::byName, () -> null, EntityCaches.epochs()));
    lenient().when(repository.lookup()).thenReturn(lookup);
  }

  private static <T extends EntityInterface> void attachSchema(
      EntityPolicy<T> repository, String type, Class<T> entityClass, EntityDAO<T> dao) {
    final var context =
        new EntityPolicyContext<>(
            new EntityPolicyContext.Schema<>("/test", type, entityClass, dao),
            new EntityPolicyContext.WriteFields("", "", Set.of()),
            new EntityModuleDependencies(null, null, null, null, Clock.systemUTC()));
    context.bind(repository);
    lenient().when(repository.context()).thenReturn(context);
  }

  private static <K> LoadingCache<K, String> unusedCache() {
    return CacheBuilder.newBuilder()
        .maximumSize(100)
        .build(
            CacheLoader.from(
                key -> {
                  throw new AssertionError("Consumer fixture must retain its fresh-read scope");
                }));
  }
}
