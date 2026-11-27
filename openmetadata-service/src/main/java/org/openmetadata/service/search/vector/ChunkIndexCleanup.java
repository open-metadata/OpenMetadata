package org.openmetadata.service.search.vector;

import java.util.concurrent.Executor;
import java.util.function.Supplier;
import org.openmetadata.service.search.vector.ChunkSetHealRunner.Lease;
import org.openmetadata.service.search.vector.VectorIndexService.LiveEntities;

/**
 * What the chunk index's cleanups check against and where their pass runs. {@code live} is the
 * database's word on which entities exist and are not soft deleted. {@code background} runs a
 * {@link ChunkSetHealRunner} under the lease {@code lease} makes, until the live chunk index records
 * both of its one-time cleanups.
 */
public record ChunkIndexCleanup(LiveEntities live, Supplier<Lease> lease, Executor background) {

  /** This server's: its repositories, the lease every server shares, a virtual thread. */
  public static ChunkIndexCleanup forCluster() {
    return new ChunkIndexCleanup(
        new RepositoryLiveEntities(),
        ChunkSetHealLease::forCluster,
        pass -> Thread.ofVirtual().name("vector-chunk-heal").start(pass));
  }

  void startOn(VectorIndexService service) {
    background.execute(new ChunkSetHealRunner(service, lease.get(), live));
  }
}
