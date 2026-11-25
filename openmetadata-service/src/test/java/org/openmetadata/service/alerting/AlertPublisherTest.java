/*
 *  Copyright 2021 Collate
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

package org.openmetadata.service.alerting;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import java.util.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.service.events.consumer.AlertRows;
import org.openmetadata.service.events.consumer.ConsumerInternals;
import org.openmetadata.service.util.DIContainer;
import org.openmetadata.service.util.PerRequestContextCleaner;
import org.quartz.JobDetail;
import org.quartz.JobExecutionContext;
import org.quartz.JobKey;

@ExtendWith(MockitoExtension.class)
class AlertPublisherTest {

  @Mock private DIContainer dependencies;
  @Mock private EventSubscription eventSubscription;

  private AlertPublisher alertPublisher;

  @BeforeEach
  void setUp() {
    alertPublisher = new AlertPublisher(dependencies);

    ConsumerInternals.subscribe(alertPublisher, eventSubscription);
    alertPublisher.openTick(new HashMap<>());

    lenient().when(eventSubscription.getName()).thenReturn("test-subscription");
    lenient().when(eventSubscription.getEnabled()).thenReturn(true);
  }

  @Test
  void testGetEnabledWhenSubscriptionEnabled() {
    lenient().when(eventSubscription.getEnabled()).thenReturn(true);

    boolean result = alertPublisher.getEnabled();

    assertTrue(result);
  }

  @Test
  void testGetEnabledWhenSubscriptionDisabled() {
    lenient().when(eventSubscription.getEnabled()).thenReturn(false);

    boolean result = alertPublisher.getEnabled();

    assertFalse(result);
  }

  @Test
  void testGetEnabledWhenSubscriptionEnabledIsNull() {
    lenient().when(eventSubscription.getEnabled()).thenReturn(false);

    boolean result = alertPublisher.getEnabled();

    assertFalse(result);
  }

  // Quartz threads are shared and never pass the request filter that clears per-request caches.
  @Test
  void tickStartsAndEndsWithClearedCaches() throws Exception {
    UUID alertId = UUID.randomUUID();
    JobDetail job = mock(JobDetail.class);
    when(job.getKey()).thenReturn(new JobKey(alertId.toString(), "OMAlertJobGroup"));
    JobExecutionContext context = mock(JobExecutionContext.class);
    when(context.getJobDetail()).thenReturn(job);

    try (MockedStatic<PerRequestContextCleaner> cleaner =
            mockStatic(PerRequestContextCleaner.class);
        MockedStatic<AlertRows> rows = mockStatic(AlertRows.class)) {
      rows.when(() -> AlertRows.readOrNull(alertId)).thenReturn(null);
      new AlertPublisher(dependencies).execute(context);

      cleaner.verify(PerRequestContextCleaner::clear, times(2));
    }
  }
}
