package org.openmetadata.service.jdbi3;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.FieldInterface;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.util.ChildFieldResolver;

/**
 * Builds one page of an entity's inline child collection: table columns, topic and apiEndpoint
 * schema fields, container data-model columns, mlmodel features, pipeline tasks, searchIndex
 * fields.
 *
 * <p>A standalone collaborator rather than a method on EntityRepository. That class has no
 * authorization dependency and is inherited by many repositories with no child collection at all,
 * so a page builder plus a protected hook there would reach far past the repositories that need it.
 *
 * <p>Nothing here authorizes. Each resource authorizes VIEW_BASIC on the parent before calling.
 */
public final class ChildFieldPageReader {

  /** Per-type enrichment of one page: custom metrics, extensions, profiles, PII masking. */
  public interface ChildPageEnricher {
    List<FieldInterface> enrich(
        EntityInterface parent, List<FieldInterface> page, String fieldsParam);

    /** For the entity types whose children need nothing beyond tags. */
    ChildPageEnricher NONE = (parent, page, fieldsParam) -> page;
  }

  private final EntityRepository<? extends EntityInterface> repository;
  private final ChildFieldResolver.ChildContainerSpec spec;

  public ChildFieldPageReader(
      EntityRepository<? extends EntityInterface> repository,
      ChildFieldResolver.ChildContainerSpec spec) {
    this.repository = repository;
    this.spec = spec;
  }

  /**
   * Primary form: the caller already holds the parent, so nothing here re-fetches it.
   *
   * <p>The caller also owns how the parent was loaded. Inline child collections ride in the stored
   * entity JSON, so a plain find or findByName with no fields is enough, and everything an enricher
   * adds comes from the enricher's own queries rather than from the parent's loaded fields.
   *
   * <p>A null sortBy preserves stored order. Any other value sorts, with "ordinalPosition" reading
   * that field and everything else falling back to name, which is what the table endpoint has
   * always done with an unrecognised value.
   */
  public ResultList<FieldInterface> read(
      EntityInterface parent,
      int limit,
      int offset,
      String fieldsParam,
      String sortBy,
      String sortOrder,
      ChildPageEnricher enricher) {
    String entityType = spec.entityType();
    ChildFieldResolver.ensureChildFqns(parent, entityType);
    List<FieldInterface> allChildren = ChildFieldResolver.childrenOf(parent, entityType);
    return allChildren.isEmpty()
        ? emptyChildPage(limit, offset)
        : buildChildPage(
            parent, allChildren, limit, offset, fieldsParam, sortBy, sortOrder, enricher);
  }

  /** Convenience overload for a caller that holds only an FQN. */
  public ResultList<FieldInterface> read(
      String fqn,
      int limit,
      int offset,
      String fieldsParam,
      Include include,
      String sortBy,
      String sortOrder,
      ChildPageEnricher enricher) {
    return read(
        repository.findByName(fqn, include),
        limit,
        offset,
        fieldsParam,
        sortBy,
        sortOrder,
        enricher);
  }

  /**
   * An entity with no children answers with before "0" and after offset + limit even though there
   * is nothing to page to. That is what both legacy readers returned and what clients see today.
   */
  private ResultList<FieldInterface> emptyChildPage(int limit, int offset) {
    return new ResultList<>(new ArrayList<>(), "0", String.valueOf(offset + limit), 0);
  }

  private ResultList<FieldInterface> buildChildPage(
      EntityInterface parent,
      List<FieldInterface> allChildren,
      int limit,
      int offset,
      String fieldsParam,
      String sortBy,
      String sortOrder,
      ChildPageEnricher enricher) {
    List<FieldInterface> sorted = sortChildFields(allChildren, sortBy, sortOrder);
    int total = sorted.size();
    int[] bounds = clampPageBounds(offset, limit, total);
    int toIndex = bounds[1];
    List<FieldInterface> page = new ArrayList<>(sorted.subList(bounds[0], toIndex));

    if (fieldsParam != null && fieldsParam.contains("tags")) {
      Entity.populateEntityFieldTags(spec.entityType(), page, parent.getFullyQualifiedName(), true);
    }
    List<FieldInterface> enriched = enricher.enrich(parent, page, fieldsParam);

    String before = offset > 0 ? String.valueOf(Math.max(0, offset - limit)) : null;
    String after = toIndex < total ? String.valueOf(toIndex) : null;
    return new ResultList<>(enriched, before, after, total);
  }

  /**
   * Package-visible statics: they touch no instance state, so the pagination and ordering rules can
   * be tested without standing up a repository.
   */
  static List<FieldInterface> sortChildFields(
      List<FieldInterface> children, String sortBy, String sortOrder) {
    List<FieldInterface> result = new ArrayList<>(children);
    if (sortBy != null) {
      Comparator<FieldInterface> comparator = childComparator(sortBy);
      result.sort("desc".equalsIgnoreCase(sortOrder) ? comparator.reversed() : comparator);
    }
    return result;
  }

  static Comparator<FieldInterface> childComparator(String sortBy) {
    return "ordinalPosition".equals(sortBy)
        ? Comparator.comparing(
            ChildFieldPageReader::ordinalPositionOrNull,
            Comparator.nullsLast(Comparator.naturalOrder()))
        : Comparator.comparing(
            FieldInterface::getName, Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER));
  }

  /** Only Column carries an ordinal position; every other child type sorts as null. */
  private static Integer ordinalPositionOrNull(FieldInterface field) {
    return field instanceof Column column ? column.getOrdinalPosition() : null;
  }

  /** Clamps [offset, offset + limit) into [0, total], returning {fromIndex, toIndex}. */
  static int[] clampPageBounds(int offset, int limit, int total) {
    int fromIndex = Math.min(offset, total);
    int toIndex = Math.min(offset + limit, total);
    return new int[] {fromIndex, toIndex};
  }
}
