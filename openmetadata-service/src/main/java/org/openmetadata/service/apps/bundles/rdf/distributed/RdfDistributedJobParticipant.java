/*
 *  Copyright 2024 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.apps.bundles.rdf.distributed;

import io.dropwizard.lifecycle.Managed;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.apps.bundles.searchIndex.distributed.IndexJobStatus;
import org.openmetadata.service.apps.bundles.searchIndex.distributed.ServerIdentityResolver;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.rdf.RdfRepository;

@Slf4j
public class RdfDistributedJobParticipant implements Managed {
  private static final long POLL_INTERVAL_MS = TimeUnit.SECONDS.toMillis(15);

  private final CollectionDAO collectionDAO;
  private final String serverId;
  private final DistributedRdfIndexCoordinator coordinator;
  private final AtomicBoolean running = new AtomicBoolean(false);
  private final AtomicBoolean participating = new AtomicBoolean(false);

  @Getter private UUID currentJobId;

  private volatile Thread pollThread;
  private volatile Thread participantThread;

  public RdfDistributedJobParticipant(CollectionDAO collectionDAO) {
    this.collectionDAO = collectionDAO;
    this.serverId = ServerIdentityResolver.getInstance().getServerId();
    this.coordinator = new DistributedRdfIndexCoordinator(collectionDAO);
  }

  @Override
  public void start() {
    RdfRepository rdfRepository = RdfRepository.getInstanceOrNull();
    if (rdfRepository == null || !rdfRepository.isEnabled()) {
      LOG.info(
          "Skipping RDF distributed participant registration because RDF is not initialized or disabled");
      return;
    }

    if (running.compareAndSet(false, true)) {
      pollThread =
          Thread.ofVirtual()
              .name("rdf-distributed-participant-poll")
              .start(
                  () -> {
                    while (running.get() && !Thread.currentThread().isInterrupted()) {
                      try {
                        pollForJobs();
                        TimeUnit.MILLISECONDS.sleep(POLL_INTERVAL_MS);
                      } catch (InterruptedException e) {
                        Thread.currentThread().interrupt();
                        return;
                      } catch (Exception e) {
                        LOG.warn("Error polling for distributed RDF jobs", e);
                      }
                    }
                  });
      LOG.info("Started RDF distributed job participant on server {}", serverId);
    }
  }

  @Override
  public void stop() {
    if (running.compareAndSet(true, false)) {
      interruptThread(pollThread);
      interruptThread(participantThread);
      LOG.info("Stopped RDF distributed job participant on server {}", serverId);
    }
  }

  private void pollForJobs() {
    if (participating.get()) {
      return;
    }

    List<RdfIndexJob> activeJobs =
        coordinator.getRecentJobs(List.of(IndexJobStatus.RUNNING, IndexJobStatus.STOPPING), 10);
    for (RdfIndexJob job : activeJobs) {
      if (job.isTerminal()
          || job.getStatus() != IndexJobStatus.RUNNING
          || DistributedRdfIndexExecutor.isCoordinatingJob(job.getId())
          || !coordinator.hasClaimableWork(job.getId())) {
        continue;
      }

      joinJob(job);
      return;
    }
  }

  private void joinJob(RdfIndexJob job) {
    if (!participating.compareAndSet(false, true)) {
      return;
    }

    currentJobId = job.getId();
    participantThread =
        Thread.ofVirtual()
            .name("rdf-distributed-participant-" + job.getId().toString().substring(0, 8))
            .start(
                () -> {
                  try {
                    int partitionSize =
                        job.getJobConfiguration().getPartitionSize() != null
                            ? job.getJobConfiguration().getPartitionSize()
                            : 10000;
                    DistributedRdfIndexExecutor executor =
                        new DistributedRdfIndexExecutor(collectionDAO, partitionSize);
                    executor.joinJob(job, job.getJobConfiguration());
                  } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                  } catch (Exception e) {
                    LOG.warn("Failed to participate in RDF job {}", job.getId(), e);
                  } finally {
                    currentJobId = null;
                    participating.set(false);
                    participantThread = null;
                  }
                });
  }

  private void interruptThread(Thread thread) {
    if (thread == null) {
      return;
    }
    thread.interrupt();
    try {
      thread.join(5_000);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
    }
  }
}
