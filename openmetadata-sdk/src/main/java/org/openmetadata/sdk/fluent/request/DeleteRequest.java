package org.openmetadata.sdk.fluent.request;

import java.util.HashMap;
import java.util.Map;
import java.util.function.Consumer;

/**
 * Fluent builder for delete operations following Stripe SDK patterns.
 *
 * Usage:
 * <pre>
 * // Soft delete
 * Tables.delete(id).execute();
 *
 * // Hard delete
 * Tables.delete(id).hardDelete().execute();
 *
 * // Recursive delete
 * Tables.delete(id).recursive().execute();
 *
 * // Combined
 * Tables.delete(id).recursive().hardDelete().execute();
 * </pre>
 */
public class DeleteRequest<T> {
  private final String id;
  private final Consumer<Map<String, String>> deleteFunction;
  private boolean recursive = false;
  private boolean hardDelete = false;

  public DeleteRequest(String id, Consumer<Map<String, String>> deleteFunction) {
    this.id = id;
    this.deleteFunction = deleteFunction;
  }

  /**
   * Enable recursive deletion.
   */
  public DeleteRequest<T> recursive() {
    this.recursive = true;
    return this;
  }

  /**
   * Enable hard delete (permanent deletion).
   */
  public DeleteRequest<T> hardDelete() {
    this.hardDelete = true;
    return this;
  }

  /**
   * Execute the delete operation.
   */
  public void execute() {
    Map<String, String> params = new HashMap<>();
    if (recursive) {
      params.put("recursive", "true");
    }
    if (hardDelete) {
      params.put("hardDelete", "true");
    }
    deleteFunction.accept(params);
  }

  /**
   * Alias for execute() to match some SDK patterns.
   */
  public void now() {
    execute();
  }
}
