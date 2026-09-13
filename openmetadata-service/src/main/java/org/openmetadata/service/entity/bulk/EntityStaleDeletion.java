package org.openmetadata.service.entity.bulk;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import jakarta.ws.rs.core.Response.Status;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.function.BiPredicate;
import java.util.function.Function;
import java.util.function.Predicate;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.type.ApiStatus;
import org.openmetadata.schema.type.api.BulkDeleteStaleRequest;
import org.openmetadata.schema.type.api.BulkOperationResult;
import org.openmetadata.schema.type.api.BulkResponse;
import org.openmetadata.service.Entity;
import org.openmetadata.service.entity.bulk.StaleEntityPlanner.Candidate;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.jdbi3.EntityDAO.EntityIdFqnPair;

/** Reconciles an ingestion scope through the existing per-entity deletion transactions. */
@Slf4j
public final class EntityStaleDeletion {
  public record Scopes(
      Predicate<String> supported,
      BiPredicate<String, String> exists,
      Function<String, String> serviceType) {}

  @FunctionalInterface
  public interface Delete {
    void entity(String actor, UUID id, boolean recursive, boolean hard);
  }

  private record Options(String actor, boolean dryRun, boolean recursive, boolean hard) {}

  private final String entityType;
  private final Scopes scopes;
  private final Function<String, List<EntityIdFqnPair>> discover;
  private final Delete delete;

  public EntityStaleDeletion(
      final String entityType,
      final Scopes scopes,
      final Function<String, List<EntityIdFqnPair>> discover,
      final Delete delete) {
    this.entityType = entityType;
    this.scopes = scopes;
    this.discover = discover;
    this.delete = delete;
  }

  public BulkOperationResult reconcile(final BulkDeleteStaleRequest request, final String actor) {
    final String scopeType = validatedScopeType(request);
    final Options options =
        new Options(
            actor,
            Boolean.TRUE.equals(request.getDryRun()),
            !Boolean.FALSE.equals(request.getRecursive()),
            Boolean.TRUE.equals(request.getHardDelete()));
    final Outcome outcome = new Outcome();
    if (hasScopeToReconcile(request, scopeType)) {
      final List<Candidate> stale =
          StaleEntityPlanner.plan(discover.apply(request.getScopeFqn()), request.getSeenFqns());
      final Set<String> deletedHashes = new HashSet<>();
      stale.forEach(candidate -> reconcile(candidate, options, outcome, deletedHashes));
    }
    return outcome.result(options.dryRun());
  }

  private String validatedScopeType(final BulkDeleteStaleRequest request) {
    if (nullOrEmpty(request.getScopeFqn())) {
      throw BadRequestException.of("scopeFqn is required for deleteStale");
    }
    if (nullOrEmpty(request.getScopeEntityType())) {
      throw BadRequestException.of("scopeEntityType is required for deleteStale");
    }
    final String type =
        Entity.FIELD_SERVICE.equals(request.getScopeEntityType())
            ? scopes.serviceType().apply(entityType)
            : request.getScopeEntityType();
    if (!scopes.supported().test(type)) {
      throw BadRequestException.of(
          "Unsupported scopeEntityType '%s' for deleteStale"
              .formatted(request.getScopeEntityType()));
    }
    return type;
  }

  private boolean hasScopeToReconcile(
      final BulkDeleteStaleRequest request, final String scopeType) {
    if (nullOrEmpty(request.getSeenFqns())) {
      // Empty discovery also describes a failed connector run, so it cannot authorize deletion.
      LOG.warn(
          "deleteStale for scope {} '{}' received an empty seenFqns; treating as zero deletions",
          request.getScopeEntityType(),
          request.getScopeFqn());
      return false;
    }
    final boolean exists = scopes.exists().test(scopeType, request.getScopeFqn());
    if (!exists) {
      LOG.warn(
          "deleteStale scope {} '{}' not found; nothing to delete this run",
          request.getScopeEntityType(),
          request.getScopeFqn());
    }
    return exists;
  }

  private void reconcile(
      final Candidate candidate,
      final Options options,
      final Outcome outcome,
      final Set<String> deletedHashes) {
    if (options.dryRun() || StaleEntityPlanner.isCovered(candidate.hash(), deletedHashes)) {
      outcome.succeeded(candidate.fqn());
      return;
    }
    try {
      delete.entity(options.actor(), candidate.id(), options.recursive(), options.hard());
      deletedHashes.add(candidate.hash());
      outcome.succeeded(candidate.fqn());
    } catch (RuntimeException exception) {
      LOG.warn(
          "Failed to delete stale {} '{}': {}",
          entityType,
          candidate.fqn(),
          exception.getMessage());
      outcome.failed(candidate.fqn(), exception.getMessage());
    }
  }

  private static final class Outcome {
    private final List<BulkResponse> success = new ArrayList<>();
    private final List<BulkResponse> failure = new ArrayList<>();

    private void succeeded(final String fqn) {
      success.add(new BulkResponse().withRequest(fqn).withStatus(Status.OK.getStatusCode()));
    }

    private void failed(final String fqn, final String message) {
      failure.add(
          new BulkResponse()
              .withRequest(fqn)
              .withStatus(Status.INTERNAL_SERVER_ERROR.getStatusCode())
              .withMessage(message));
    }

    private BulkOperationResult result(final boolean dryRun) {
      return new BulkOperationResult()
          .withDryRun(dryRun)
          .withStatus(failure.isEmpty() ? ApiStatus.SUCCESS : ApiStatus.PARTIAL_SUCCESS)
          .withNumberOfRowsProcessed(success.size() + failure.size())
          .withNumberOfRowsPassed(success.size())
          .withNumberOfRowsFailed(failure.size())
          .withSuccessRequest(success)
          .withFailedRequest(failure);
    }
  }
}
