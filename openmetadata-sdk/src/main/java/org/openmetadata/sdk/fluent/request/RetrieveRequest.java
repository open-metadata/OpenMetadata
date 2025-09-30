package org.openmetadata.sdk.fluent.request;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.function.Function;

/**
 * Fluent builder for retrieve operations with field expansion.
 *
 * Usage:
 * <pre>
 * // Simple retrieval
 * Table table = Tables.retrieve(id).fetch();
 *
 * // With field expansion
 * Table table = Tables.retrieve(id)
 *     .include("owner", "tags", "columns")
 *     .fetch();
 *
 * // Or use expand alias
 * Table table = Tables.retrieve(id)
 *     .expand("owner", "tags")
 *     .fetch();
 * </pre>
 *
 * @param <T> The entity type being retrieved
 */
public class RetrieveRequest<T> {
  private final String id;
  private final Function<String, T> retrieveFunction;
  private final List<String> fields = new ArrayList<>();

  public RetrieveRequest(String id, Function<String, T> retrieveFunction) {
    this.id = id;
    this.retrieveFunction = retrieveFunction;
  }

  /**
   * Include specific fields in the response.
   *
   * @param fields The fields to include
   * @return This request for chaining
   */
  public RetrieveRequest<T> include(String... fields) {
    this.fields.addAll(Arrays.asList(fields));
    return this;
  }

  /**
   * Alias for include() to match some SDK patterns.
   *
   * @param fields The fields to expand
   * @return This request for chaining
   */
  public RetrieveRequest<T> expand(String... fields) {
    return include(fields);
  }

  /**
   * Include all available fields.
   *
   * @return This request for chaining
   */
  public RetrieveRequest<T> includeAll() {
    // Common fields that can be expanded
    return include(
        "owner",
        "tags",
        "followers",
        "domain",
        "dataProducts",
        "children",
        "parent",
        "reviewers",
        "experts",
        "usageSummary",
        "changeDescription");
  }

  /**
   * Execute the retrieval.
   *
   * @return The retrieved entity
   */
  public T fetch() {
    if (fields.isEmpty()) {
      return retrieveFunction.apply(null);
    } else {
      String fieldsParam = String.join(",", fields);
      return retrieveFunction.apply(fieldsParam);
    }
  }

  /**
   * Alias for fetch() to match some SDK patterns.
   *
   * @return The retrieved entity
   */
  public T get() {
    return fetch();
  }

  /**
   * Execute the retrieval (implements a common interface pattern).
   *
   * @return The retrieved entity
   */
  public T execute() {
    return fetch();
  }
}
