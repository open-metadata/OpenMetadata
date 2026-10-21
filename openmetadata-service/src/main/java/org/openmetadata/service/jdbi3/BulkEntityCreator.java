package org.openmetadata.service.jdbi3;

import static org.openmetadata.schema.type.Include.ALL;
import static org.openmetadata.service.jdbi3.EntityRepository.BULK_CREATE_TXN_CHUNK_SIZE;
import static org.openmetadata.service.jdbi3.EntityRepository.isDuplicateKeyException;

import com.google.common.collect.Lists;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Consumer;
import java.util.function.Function;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.statement.UnableToExecuteStatementException;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.BulkCreateConflictPolicy;
import org.openmetadata.schema.type.BulkCreateItemResult;
import org.openmetadata.schema.type.BulkCreateItemResult.Reason;
import org.openmetadata.schema.type.BulkCreateItemResult.Status;
import org.openmetadata.schema.type.BulkCreateResult;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.util.FullyQualifiedName;

@Slf4j
@RequiredArgsConstructor
final class BulkEntityCreator<T extends EntityInterface<?>> {
  private final EntityRepository<T> repository;
  private final Consumer<List<T>> createEntities;
  private final BulkCreateConflictPolicy onConflict;

  <C> BulkCreateResult create(List<C> requests, Function<C, T> mapper) {
    final List<BulkCreateItemResult> results = new ArrayList<>(requests.size());
    final List<Candidate<T>> candidates = mapRequests(requests, mapper, results);
    final List<Candidate<T>> pending = prepareNew(candidates);
    for (List<Candidate<T>> chunk : Lists.partition(pending, BULK_CREATE_TXN_CHUNK_SIZE)) {
      createChunk(new ArrayList<>(chunk));
    }
    return new BulkCreateResult()
        .withOnConflict(onConflict)
        .withCreatedCount(count(results, Status.CREATED))
        .withSkippedCount(count(results, Status.SKIPPED))
        .withFailedCount(count(results, Status.FAILED))
        .withResults(List.copyOf(results));
  }

  private <C> List<Candidate<T>> mapRequests(
      List<C> requests, Function<C, T> mapper, List<BulkCreateItemResult> results) {
    final List<Candidate<T>> candidates = new ArrayList<>();
    for (int index = 0; index < requests.size(); index++) {
      final BulkCreateItemResult result = new BulkCreateItemResult().withIndex(index);
      results.add(result);
      try {
        final T entity = mapper.apply(requests.get(index));
        repository.setFullyQualifiedName(entity);
        result.setFullyQualifiedName(entity.getFullyQualifiedName());
        candidates.add(new Candidate<>(entity, result));
      } catch (IllegalArgumentException | EntityNotFoundException exception) {
        validationFailure(result, exception);
      }
    }
    return candidates;
  }

  private List<Candidate<T>> prepareNew(List<Candidate<T>> candidates) {
    final Map<String, UUID> existing = existingIds(candidates);
    final Set<String> seen = new HashSet<>();
    final List<Candidate<T>> pending = new ArrayList<>();
    for (Candidate<T> candidate : candidates) {
      final UUID storedId = existing.get(candidate.hash());
      if (storedId != null) {
        conflict(candidate, Reason.ALREADY_EXISTS, storedId);
      } else if (!seen.add(candidate.hash())) {
        conflict(candidate, Reason.DUPLICATE_IN_REQUEST, null);
      } else if (prepare(candidate)) {
        pending.add(candidate);
      }
    }
    return pending;
  }

  private boolean prepare(Candidate<T> candidate) {
    try {
      repository.prepareInternal(candidate.entity(), false);
      return true;
    } catch (IllegalArgumentException | EntityNotFoundException exception) {
      final UUID storedId = existingIds(List.of(candidate)).get(candidate.hash());
      if (storedId != null && !storedId.equals(candidate.entity().getId())) {
        conflict(candidate, Reason.ALREADY_EXISTS, storedId);
      } else {
        validationFailure(candidate.result(), exception);
      }
      return false;
    }
  }

  private void createChunk(List<Candidate<T>> pending) {
    while (!pending.isEmpty()) {
      try {
        createEntities.accept(pending.stream().map(Candidate::entity).toList());
        pending.forEach(
            candidate ->
                candidate.result().withStatus(Status.CREATED).withId(candidate.entity().getId()));
        return;
      } catch (UnableToExecuteStatementException exception) {
        // Retry only after rollback and only when removing a concurrent winner makes progress.
        if (!isDuplicateKeyException(exception) || !removeConcurrentDuplicates(pending)) {
          throw exception;
        }
        LOG.warn(
            "Conflicting {}; {} remaining in chunk", repository.getEntityType(), pending.size());
      }
    }
  }

  private boolean removeConcurrentDuplicates(List<Candidate<T>> pending) {
    final Map<String, UUID> existing = existingIds(pending);
    return pending.removeIf(
        candidate -> {
          final UUID storedId = existing.get(candidate.hash());
          // Our own committed IDs must not hide a failure in postCreate as a conflict.
          if (storedId != null && !storedId.equals(candidate.entity().getId())) {
            conflict(candidate, Reason.ALREADY_EXISTS, storedId);
            return true;
          }
          return false;
        });
  }

  private Map<String, UUID> existingIds(List<Candidate<T>> candidates) {
    final List<String> fqns =
        candidates.stream().map(candidate -> candidate.entity().getFullyQualifiedName()).toList();
    final Map<String, UUID> existing = new HashMap<>();
    for (EntityReference reference : repository.getDao().findReferencesByFqns(fqns, ALL)) {
      existing.put(
          FullyQualifiedName.buildHash(reference.getFullyQualifiedName()), reference.getId());
    }
    return existing;
  }

  private void conflict(Candidate<T> candidate, Reason reason, UUID storedId) {
    candidate
        .result()
        .withStatus(onConflict == BulkCreateConflictPolicy.SKIP ? Status.SKIPPED : Status.FAILED)
        .withId(storedId)
        .withReason(reason)
        .withMessage(
            reason == Reason.ALREADY_EXISTS
                ? "An entity with this fully qualified name already exists."
                : "Repeated fully qualified name in this request; the first occurrence wins.");
  }

  private static void validationFailure(BulkCreateItemResult result, RuntimeException exception) {
    result
        .withStatus(Status.FAILED)
        .withReason(Reason.VALIDATION_ERROR)
        .withMessage(exception.getMessage());
  }

  private static int count(List<BulkCreateItemResult> results, Status status) {
    return (int) results.stream().filter(result -> result.getStatus() == status).count();
  }

  private record Candidate<E extends EntityInterface<?>>(E entity, BulkCreateItemResult result) {
    private String hash() {
      return FullyQualifiedName.buildHash(entity.getFullyQualifiedName());
    }
  }
}
