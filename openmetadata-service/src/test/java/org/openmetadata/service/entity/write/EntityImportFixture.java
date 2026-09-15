package org.openmetadata.service.entity.write;

import static org.mockito.Mockito.lenient;

import jakarta.ws.rs.core.UriInfo;
import java.util.ArrayList;
import java.util.IdentityHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.service.entity.policy.EntityPolicy;
import org.openmetadata.service.util.RestUtil.PutResponse;

public final class EntityImportFixture<T extends EntityInterface> implements EntityImports<T> {

  public record Creation<T>(List<T> entities, String impersonatedBy) {}

  public record Update<T>(List<T> originals, List<T> updates, EntityCommandActor actor) {}

  private final Map<T, T> matches = new IdentityHashMap<>();

  private final List<T> lookups = new ArrayList<>();

  private Function<T, T> match = matches::get;

  private Function<Creation<T>, List<T>> create =
      request -> {
        throw new AssertionError("Unexpected prepared import create");
      };

  private Function<Update<T>, List<T>> update =
      request -> {
        throw new AssertionError("Unexpected prepared import update");
      };

  public static <T extends EntityInterface> EntityImportFixture<T> attach(
      final EntityPolicy<T> repository) {
    final EntityImportFixture<T> fixture = new EntityImportFixture<>();
    lenient().when(repository.imports()).thenReturn(fixture);
    return fixture;
  }

  public EntityImportFixture<T> matching(final T requested, final T original) {
    matches.put(requested, original);
    return this;
  }

  public EntityImportFixture<T> onMatch(final Function<T, T> operation) {
    match = operation;
    return this;
  }

  public EntityImportFixture<T> onCreate(final Function<Creation<T>, List<T>> operation) {
    create = operation;
    return this;
  }

  public EntityImportFixture<T> onUpdate(final Function<Update<T>, List<T>> operation) {
    update = operation;
    return this;
  }

  @Override
  public T match(final T entity) {
    lookups.add(entity);
    return match.apply(entity);
  }

  @Override
  public boolean identifyUpdate(final T entity) {
    final T original = match(entity);
    if (original == null) {
      return false;
    }
    entity.setId(original.getId());
    return true;
  }

  @Override
  public List<T> create(final List<T> entities, final String impersonatedBy) {
    return create.apply(new Creation<>(entities, impersonatedBy));
  }

  @Override
  public List<T> update(
      final List<T> originals, final List<T> updates, final EntityCommandActor actor) {
    return update.apply(new Update<>(originals, updates, actor));
  }

  @Override
  public PutResponse<T> upsert(final UriInfo uri, final T entity, final String actor) {
    throw new AssertionError("Unexpected single import upsert");
  }

  @Override
  public PutResponse<T> upsertAs(
      final UriInfo uri, final T entity, final EntityCommandActor actor) {
    throw new AssertionError("Unexpected single import upsert with actor");
  }

  @Override
  public List<PutResponse<T>> upsert(final List<T> entities, final String actor) {
    throw new AssertionError("Unexpected mixed import batch");
  }

  public List<T> lookups() {
    return List.copyOf(lookups);
  }
}
