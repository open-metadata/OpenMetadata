package org.openmetadata.sdk.fluent.request;

import java.util.Objects;
import java.util.function.Function;
import org.openmetadata.schema.type.BulkCreateConflictPolicy;
import org.openmetadata.schema.type.BulkCreateResult;

/** Bulk creation with per-input outcomes. Defaults to skipping conflicts. */
public final class BulkCreateRequest {
  private final Function<BulkCreateConflictPolicy, BulkCreateResult> createFunction;
  private BulkCreateConflictPolicy onConflict = BulkCreateConflictPolicy.SKIP;

  public BulkCreateRequest(
      final Function<BulkCreateConflictPolicy, BulkCreateResult> createFunction) {
    this.createFunction = Objects.requireNonNull(createFunction, "createFunction");
  }

  /** FAIL reports conflicting inputs as failed; other valid inputs continue. */
  public BulkCreateRequest onConflict(final BulkCreateConflictPolicy policy) {
    onConflict = Objects.requireNonNull(policy, "onConflict");
    return this;
  }

  public BulkCreateResult execute() {
    return createFunction.apply(onConflict);
  }
}
