package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.lang.reflect.Method;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;
import org.jdbi.v3.sqlobject.statement.SqlQuery;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareSqlQuery;
import org.openmetadata.service.jdbi3.locator.ConnectionType;

/**
 * Pins the access path of the container direct-children listings (#22530) — both
 * {@code /containers/name/{fqn}/children} and the service root listing
 * ({@code /containers?root=true}).
 *
 * <p>The listing used to select children with {@code fqnHash LIKE '<parent>.%' AND fqnHash NOT
 * LIKE '<parent>.%.%'}. That returns the right rows, but neither predicate is an indexable
 * equality, so the listing's {@code ORDER BY name, id LIMIT n} steered MySQL and PostgreSQL
 * alike onto the {@code (deleted, name, id)} index — which already supplies that order — and
 * they scanned container rows until the page filled. For a container near the root of a deep
 * tree (large subtree, few direct children) the scan ran to the end of the table, making the
 * cost O(containers in the deployment) rather than O(children returned).
 *
 * <p>Both spellings return identical rows, so no behavioural test can tell them apart — a
 * revert would show up only as latency in production. These assertions are therefore on the
 * declared SQL itself: the depth test must stay an equality against the generated
 * {@code parentFqnHash} column, and the scanning form must not come back.
 */
class ContainerChildrenQueryShapeTest {

  private static final List<String> CHILDREN_QUERY_METHODS =
      List.of("listDirectChildSummariesByParentHash", "countDirectChildrenByParentHash");

  private static final List<String> ROOT_LISTING_METHODS =
      List.of("listRootBefore", "listRootAfter", "listRootCount");

  @Test
  void childrenQueries_matchParentByIndexedEquality() {
    forEachChildrenQuery(
        (method, connectionType, sql) ->
            assertTrue(
                sql.contains("parentFqnHash = :parentHash"),
                method
                    + " ("
                    + connectionType
                    + ") must select direct children by equality on parentFqnHash so"
                    + " idx_storage_container_entity_parent_children can serve it. SQL: "
                    + sql));
  }

  @Test
  void childrenQueries_doNotScanTheSubtreeWithLikePredicates() {
    forEachChildrenQuery(
        (method, connectionType, sql) -> {
          assertFalse(
              sql.contains("fqnHash LIKE :parentHash"),
              method
                  + " ("
                  + connectionType
                  + ") reintroduces the un-indexable prefix LIKE that caused #22530. SQL: "
                  + sql);
          assertFalse(
              sql.contains("NOT LIKE :parentHashChild"),
              method
                  + " ("
                  + connectionType
                  + ") reintroduces the depth exclusion that forced a row scan. SQL: "
                  + sql);
        });
  }

  /**
   * The service root listing ({@code ?root=true}) answers the same question one level up —
   * "which containers sit directly under this service" — and regressed the same way, for the
   * same reason: {@code fqnHash NOT LIKE '<serviceHash>.%.%'} is not indexable, so the
   * cursor's {@code ORDER BY name, id LIMIT n} won on cost and the listing scanned. It is
   * now a wildcard-free {@code LIKE} against {@code parentFqnHash}, which both engines
   * degenerate to an index lookup.
   */
  @Test
  void rootListingQueries_matchServiceByIndexedParentHash() {
    for (String methodName : ROOT_LISTING_METHODS) {
      Method method = findMethod(methodName);
      for (String sql : declaredSql(method)) {
        assertTrue(
            sql.contains("ce.parentFqnHash LIKE :serviceHashExact"),
            methodName
                + " must select service-root containers via parentFqnHash so"
                + " idx_storage_container_entity_parent_children can serve it. SQL: "
                + sql);
        assertFalse(
            sql.contains("fqnHash NOT LIKE :serviceHashChild"),
            methodName
                + " reintroduces the un-indexable depth exclusion that caused #22530. SQL: "
                + sql);
      }
    }
  }

  /**
   * Every engine variant of {@code method}'s SQL. {@code listRootBefore}/{@code listRootAfter}
   * are plain {@link SqlQuery} (one dialect-neutral statement);
   * {@code listRootCount} is {@link ConnectionAwareSqlQuery} (one per engine).
   */
  private List<String> declaredSql(Method method) {
    List<String> sql =
        Arrays.stream(method.getAnnotationsByType(ConnectionAwareSqlQuery.class))
            .map(ConnectionAwareSqlQuery::value)
            .collect(Collectors.toList());
    SqlQuery plain = method.getAnnotation(SqlQuery.class);
    if (plain != null) {
      sql.add(plain.value());
    }
    assertFalse(sql.isEmpty(), method.getName() + " declares no SQL");
    return sql;
  }

  /** Runs {@code assertion} against every engine variant of both children queries. */
  private void forEachChildrenQuery(SqlAssertion assertion) {
    for (String methodName : CHILDREN_QUERY_METHODS) {
      Method method = findMethod(methodName);
      ConnectionAwareSqlQuery[] variants =
          method.getAnnotationsByType(ConnectionAwareSqlQuery.class);
      assertTrue(
          variants.length >= ConnectionType.values().length,
          methodName + " must declare SQL for every connection type, found " + variants.length);
      for (ConnectionAwareSqlQuery variant : variants) {
        assertion.check(methodName, variant.connectionType(), variant.value());
      }
    }
  }

  private Method findMethod(String name) {
    return Arrays.stream(CollectionDAO.ContainerDAO.class.getMethods())
        .filter(m -> m.getName().equals(name))
        .findFirst()
        .orElseThrow(() -> new AssertionError("ContainerDAO." + name + " not found"));
  }

  @FunctionalInterface
  private interface SqlAssertion {
    void check(String method, ConnectionType connectionType, String sql);
  }
}
