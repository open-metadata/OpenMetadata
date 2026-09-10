package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.rdf.distributed.DistributedRdfIndexCoordinator;
import org.openmetadata.service.apps.bundles.rdf.distributed.RdfIndexPartition;
import org.openmetadata.service.apps.bundles.rdf.distributed.RdfPartitionCalculator;
import org.openmetadata.service.apps.bundles.rdf.distributed.RdfPartitionWorker;
import org.openmetadata.service.apps.bundles.searchIndex.distributed.PartitionStatus;
import org.openmetadata.service.jdbi3.RdfInfraDAOs.RdfIndexPartitionDAO;
import org.openmetadata.service.jdbi3.RdfInfraDAOs.RdfIndexPartitionDAO.RdfIndexPartitionRecord;

/** A reclaimed partition must reject writes from its previous owner, including the same server. */
@Execution(ExecutionMode.CONCURRENT)
public class RdfPartitionLeaseIT {
  private static final String FIRST_SERVER = "rdf-lease-first-server";
  private final String jobId = UUID.randomUUID().toString();
  private final String partitionId = UUID.randomUUID().toString();
  private RdfIndexPartitionDAO partitions;
  private RdfIndexPartitionRecord original;
  private RdfIndexPartition originalClaim;
  private DistributedRdfIndexCoordinator coordinator;

  @BeforeEach
  void createClaim() {
    final var daos = Entity.getCollectionDAO();
    final long now = System.currentTimeMillis();
    daos.rdfIndexJobDAO()
        .insert(jobId, "INITIALIZING", "{}", 10, 0, 0, 0, "{}", "lease-test", now, now);
    partitions = daos.rdfIndexPartitionDAO();
    partitions.insert(partitionId, jobId, Entity.TABLE, 0, 0, 10, 10, 10, 1, "PENDING", 0, 0);
    coordinator = new DistributedRdfIndexCoordinator(daos, new RdfPartitionCalculator(10));
    originalClaim = coordinator.claimNextPartition(UUID.fromString(jobId), FIRST_SERVER);
    assertNotNull(originalClaim);
    original = partitions.findById(partitionId);
  }

  @AfterEach
  void deleteJob() {
    TestSuiteBootstrap.getJdbi()
        .useHandle(
            handle ->
                handle
                    .createUpdate("DELETE FROM rdf_index_job WHERE id = :jobId")
                    .bind("jobId", jobId)
                    .execute());
  }

  @ParameterizedTest
  @CsvSource({"COMPLETED,true", "COMPLETED,false", "FAILED,true", "FAILED,false"})
  void terminalUpdatesRequireTheOriginalClaim(
      final PartitionStatus status, final boolean sameServer) {
    final var replacement = reclaim(sameServer);

    assertEquals(0, writeTerminal(original, status));
    assertEquals(replacement, partitions.findById(partitionId));

    assertEquals(1, writeTerminal(replacement, status));
    assertEquals(status.name(), partitions.findById(partitionId).status());
    assertEquals(0, writeProgress(replacement));
    assertEquals(0, writeHeartbeat(replacement));
  }

  @ParameterizedTest
  @ValueSource(booleans = {true, false})
  void staleProgressAndHeartbeatsCannotOverwriteAReplacement(final boolean sameServer) {
    final var replacement = reclaim(sameServer);
    assertEquals(0, writeProgress(original));
    assertEquals(0, writeHeartbeat(original));
    assertEquals(replacement, partitions.findById(partitionId));

    assertEquals(1, writeProgress(replacement));
    final var progress = partitions.findById(partitionId);
    assertEquals(5, progress.cursor());
    assertEquals(5, progress.successCount());
    assertEquals(17, progress.readerTimeMs());
    assertEquals(19, progress.processTimeMs());
    assertEquals(23, progress.sinkTimeMs());
    assertEquals(1, writeHeartbeat(replacement));
    assertEquals(replacement.claimedAt() + 3000, partitions.findById(partitionId).lastUpdateAt());
  }

  @Test
  void heartbeatKeepsAClaimAliveWithoutEntityProgress() {
    assertEquals(1, writeHeartbeat(original));
    assertEquals(
        0, partitions.reclaimStalePartitionsForRetry(jobId, original.lastUpdateAt() + 1, 3));
    assertEquals(0, partitions.findById(partitionId).processedCount());
    assertEquals("PROCESSING", partitions.findById(partitionId).status());
  }

  @ParameterizedTest
  @ValueSource(booleans = {true, false})
  void coordinatorAndWorkerRetainTheirOriginalClaim(final boolean sameServer) {
    final var claim = originalClaim;
    final var replacement = reclaim(sameServer);

    assertFalse(coordinator.updatePartitionProgress(claim.toBuilder().cursor(5).build()));
    assertFalse(coordinator.completePartition(claim, 10, 10, 10, 0, null));
    assertFalse(coordinator.failPartition(claim, 10, 10, 10, 0, "Stale worker"));

    final var worker = new RdfPartitionWorker(coordinator, null, null, 10);
    assertTrue(worker.processPartition(claim.toBuilder().rangeEnd(0).build()).stopped());
    assertEquals(replacement, partitions.findById(partitionId));
  }

  private int writeProgress(final RdfIndexPartitionRecord claim) {
    return partitions.updateProgress(
        partitionId,
        5,
        5,
        5,
        0,
        17,
        19,
        23,
        claim.claimedAt() + 2000,
        claim.assignedServer(),
        claim.claimedAt());
  }

  private int writeHeartbeat(final RdfIndexPartitionRecord claim) {
    return partitions.updateHeartbeat(
        partitionId, claim.claimedAt() + 3000, claim.assignedServer(), claim.claimedAt());
  }

  private RdfIndexPartitionRecord reclaim(final boolean sameServer) {
    assertEquals(
        1, partitions.reclaimStalePartitionsForRetry(jobId, original.lastUpdateAt() + 1, 3));
    final String server = sameServer ? FIRST_SERVER : "rdf-lease-replacement-server";
    assertEquals(
        1, partitions.claimNextPartitionAtomic(jobId, server, original.claimedAt() + 1000));
    return partitions.findById(partitionId);
  }

  private int writeTerminal(final RdfIndexPartitionRecord claim, final PartitionStatus status) {
    final long now = claim.claimedAt() + 2000;
    return partitions.updateIfProcessing(
        partitionId,
        status.name(),
        10,
        10,
        10,
        0,
        claim.assignedServer(),
        claim.claimedAt(),
        claim.startedAt(),
        now,
        now,
        null,
        claim.retryCount());
  }
}
