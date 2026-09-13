package org.openmetadata.service.entity.read;

import jakarta.ws.rs.core.UriInfo;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.function.BiFunction;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.search.SearchIndexUtils;
import org.openmetadata.service.search.SearchListFilter;
import org.openmetadata.service.search.SearchResultListMapper;
import org.openmetadata.service.search.SearchSortFilter;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

/** Projects search hits into entity pages while retaining the search document representation. */
public final class EntitySearchReader<T extends EntityInterface> {
  public record Page(int limit, int offset) {}

  public record Query(
      SearchListFilter filter, Page page, SearchSortFilter sort, String text, String queryString) {}

  @FunctionalInterface
  public interface Source {
    SearchResultListMapper search(Query query, SubjectContext subject) throws IOException;
  }

  private final Class<T> entityClass;
  private final Source source;
  private final BiFunction<UriInfo, T, T> withHref;

  public EntitySearchReader(
      final Class<T> entityClass, final Source source, final BiFunction<UriInfo, T, T> withHref) {
    this.entityClass = entityClass;
    this.source = source;
    this.withHref = withHref;
  }

  public ResultList<T> list(final UriInfo uri, final Query query, final SubjectContext subject)
      throws IOException {
    final SearchResultListMapper results = source.search(query, subject);
    final int total = (int) results.getTotal();
    final List<T> entities = new ArrayList<>();
    if (query.page().limit() <= 0) {
      return new ResultList<>(entities, null, query.page().limit(), total);
    }
    for (final var hit : results.getResults()) {
      SearchIndexUtils.normalizeFollowers(hit);
      final T entity = JsonUtils.readOrConvertValueLenient(hit, entityClass);
      entities.add(withHref.apply(uri, entity));
    }
    return new ResultList<>(entities, query.page().offset(), query.page().limit(), total);
  }
}
