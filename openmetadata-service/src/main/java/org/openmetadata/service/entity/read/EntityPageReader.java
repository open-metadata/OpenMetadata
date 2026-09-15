package org.openmetadata.service.entity.read;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.util.jdbi.JdbiUtils.getAfterOffset;
import static org.openmetadata.service.util.jdbi.JdbiUtils.getBeforeOffset;
import static org.openmetadata.service.util.jdbi.JdbiUtils.getOffset;

import jakarta.ws.rs.core.UriInfo;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Locale;
import java.util.function.Function;
import java.util.function.ToIntFunction;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.system.EntityError;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.jdbi3.EntityDAO;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.ListWithOffsetFunction;
import software.amazon.awssdk.utils.Either;

@Slf4j
public final class EntityPageReader<T extends EntityInterface> implements EntityPages<T> {
  private static final List<String> NOT_FOUND_MESSAGES =
      List.of("not found", "instance for", "does not exist", "entitynotfoundexception");

  public record Projection(UriInfo uriInfo, Fields fields, ListFilter filter) {}

  public record KeysetPage(
      Projection projection, int limit, String after, int total, boolean skipErrors) {}

  public record OffsetPage(Projection projection, int limit, String offset, boolean skipErrors) {}

  public record OffsetSource(
      ListWithOffsetFunction<ListFilter, Integer, Integer, List<String>> rows,
      Function<ListFilter, Integer> count) {}

  public interface Source<T> {
    List<T> hydrate(List<String> rows, Projection projection);

    Iterator<Either<T, EntityError>> deserialize(List<String> rows, Projection projection);

    String cursor(T entity);
  }

  private record Rows<T>(List<T> entities, List<EntityError> errors) {}

  private final EntityDAO<T> dao;
  private final Source<T> source;
  private final ToIntFunction<ListFilter> count;
  private final EntityPagePolicy.Query<T> forward;
  private final EntityPagePolicy.Query<T> backward;

  public EntityPageReader(
      final EntityDAO<T> dao, final Source<T> source, final ToIntFunction<ListFilter> count) {
    this(dao, source, count, EntityPagePolicy.standard());
  }

  public EntityPageReader(
      final EntityDAO<T> dao,
      final Source<T> source,
      final ToIntFunction<ListFilter> count,
      final EntityPagePolicy<T> policy) {
    this.dao = dao;
    this.source = source;
    this.count = count;
    this.forward = policy.forward().apply(this::standardAfter);
    this.backward = policy.backward().apply(this::standardBefore);
  }

  @Override
  public ResultList<T> after(final Projection projection, final int limit, final String after) {
    return forward.read(projection, limit, after);
  }

  private ResultList<T> standardAfter(
      final Projection projection, final int limit, final String after) {
    final int total = count.applyAsInt(projection.filter());
    if (limit <= 0) {
      return new ResultList<>(new ArrayList<>(), null, null, total);
    }
    final EntityCursor.Position position = EntityCursor.after(after);
    final List<T> entities =
        source.hydrate(
            dao.listAfter(projection.filter(), limit + 1, position.name(), position.id()),
            projection);
    final String before = beforeCursor(entities, after);
    final String next = trimForwardPage(entities, limit);
    return new ResultList<>(entities, before, next, total);
  }

  @Override
  public ResultList<T> before(final Projection projection, final int limit, final String before) {
    return backward.read(projection, limit, before);
  }

  private ResultList<T> standardBefore(
      final Projection projection, final int limit, final String before) {
    // Counting must precede the DAO call: query rendering adds derived parameters to the filter.
    final int total = count.applyAsInt(projection.filter());
    if (limit <= 0) {
      return new ResultList<>(new ArrayList<>(), null, null, total);
    }
    final EntityCursor.Position position = EntityCursor.before(before);
    final List<T> entities =
        source.hydrate(
            dao.listBefore(projection.filter(), limit + 1, position.name(), position.id()),
            projection);
    final String previous = trimBackwardPage(entities, limit);
    final String after = entities.isEmpty() ? before : source.cursor(entities.getLast());
    return new ResultList<>(entities, previous, after, total);
  }

  @Override
  public ResultList<T> offset(final Projection projection, final int limit, final int offset) {
    final int total = count.applyAsInt(projection.filter());
    final List<T> entities =
        source.hydrate(dao.listAfter(projection.filter(), limit, offset), projection);
    return new ResultList<>(entities, offset, limit, total);
  }

  @Override
  public ResultList<T> keyset(final KeysetPage page) {
    if (page.limit() <= 0) {
      return new ResultList<>(new ArrayList<>(), new ArrayList<>(), null, null, page.total());
    }
    final EntityCursor.Position cursor = EntityCursor.after(page.after());
    final List<String> jsons =
        dao.listAfter(page.projection().filter(), page.limit() + 1, cursor.name(), cursor.id());
    final boolean hasMore = jsons.size() > page.limit();
    final List<String> selected = hasMore ? jsons.subList(0, page.limit()) : jsons;
    final Rows<T> rows = deserialize(selected, page.projection(), page.skipErrors());
    final String after =
        hasMore && !rows.entities().isEmpty() ? source.cursor(rows.entities().getLast()) : null;
    return new ResultList<>(rows.entities(), rows.errors(), null, after, page.total());
  }

  @Override
  public ResultList<T> offset(final OffsetPage page, final OffsetSource queries) {
    final int total = queries.count().apply(page.projection().filter());
    final int offset = getOffset(page.offset());
    final String after = getAfterOffset(offset, page.limit(), total);
    final String before = getBeforeOffset(offset, page.limit());
    if (page.limit() <= 0) {
      return new ResultList<>(new ArrayList<>(), new ArrayList<>(), null, null, total);
    }
    final List<String> jsons =
        queries.rows().apply(page.projection().filter(), page.limit(), offset);
    final Rows<T> rows = deserialize(jsons, page.projection(), page.skipErrors());
    return new ResultList<>(rows.entities(), rows.errors(), before, after, total);
  }

  private Rows<T> deserialize(
      final List<String> jsons, final Projection projection, final boolean skipErrors) {
    final Rows<T> rows = new Rows<>(new ArrayList<>(), new ArrayList<>());
    final Iterator<Either<T, EntityError>> iterator = source.deserialize(jsons, projection);
    while (iterator.hasNext()) {
      final Either<T, EntityError> result = iterator.next();
      if (result.right().isPresent()) {
        addError(rows.errors(), result.right().get(), skipErrors);
      } else {
        rows.entities().add(result.left().get());
      }
    }
    return rows;
  }

  private void addError(
      final List<EntityError> errors, final EntityError error, final boolean skipErrors) {
    if (!skipErrors) {
      throw new RuntimeException(error.getMessage());
    }
    errors.add(error);
    if (isNotFound(error)) {
      LOG.debug("Stale reference detected while listing: {}", error.getMessage());
    } else {
      LOG.error("Failed to list entity: {}", error);
    }
  }

  private boolean isNotFound(final EntityError error) {
    if (error == null || error.getMessage() == null) {
      return false;
    }
    final String message = error.getMessage().toLowerCase(Locale.ROOT);
    return NOT_FOUND_MESSAGES.stream().anyMatch(message::contains);
  }

  private String beforeCursor(final List<T> entities, final String after) {
    if (nullOrEmpty(after)) {
      return null;
    }
    return entities.isEmpty() ? after : source.cursor(entities.getFirst());
  }

  private String trimForwardPage(final List<T> entities, final int limit) {
    if (entities.size() <= limit) {
      return null;
    }
    entities.remove(limit);
    return source.cursor(entities.get(limit - 1));
  }

  private String trimBackwardPage(final List<T> entities, final int limit) {
    if (entities.size() <= limit) {
      return null;
    }
    entities.removeFirst();
    return source.cursor(entities.getFirst());
  }
}
