package org.openmetadata.service.apps.bundles.searchIndex.distributed;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class DistributedJobContextTest {

  @Test
  void distributedContextExposesJobMetadataAndCustomSource() {
    UUID jobId = UUID.randomUUID();
    SearchIndexJob job = SearchIndexJob.builder().id(jobId).createdAt(100L).startedAt(200L).build();

    DistributedJobContext context = new DistributedJobContext(job, "REDIS");
    context.setDistributedMetadata("participants", 3);
    context.setDistributedMetadata("ignored", null);

    assertEquals(jobId, context.getJobId());
    assertEquals(
        "DistributedSearchIndex-" + jobId.toString().substring(0, 8), context.getJobName());
    assertEquals(200L, context.getStartTime());
    assertEquals(jobId, context.getAppId());
    assertTrue(context.isDistributed());
    assertEquals("REDIS", context.getSource());
    assertEquals(job, context.getJob());
    assertEquals(Map.of("participants", 3), context.getDistributedMetadata());
  }

  @Test
  void distributedContextFallsBackToCreatedTimestampAndDefaultSource() {
    UUID jobId = UUID.randomUUID();
    SearchIndexJob job = SearchIndexJob.builder().id(jobId).createdAt(300L).build();

    DistributedJobContext context = new DistributedJobContext(job);

    assertEquals(300L, context.getStartTime());
    assertEquals("DISTRIBUTED", context.getSource());
  }
}
