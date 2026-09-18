package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.CALLS_REAL_METHODS;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.when;

import jakarta.ws.rs.ServiceUnavailableException;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.service.events.scheduled.EventSubscriptionScheduler;
import org.openmetadata.service.events.subscription.ledger.AlertRecord;

class EventSubscriptionSkipBacklogTest {

  // A server of the previous release trusts an offset cached in job data over the position row,
  // so a skip that could not clean it would be undone by that server's next tick.
  @Test
  void skipBacklogAnswers503WhenJobDataCannotBeRewritten() {
    EventSubscription alert = new EventSubscription().withId(UUID.randomUUID()).withName("alert");
    EventSubscriptionRepository repository =
        mock(EventSubscriptionRepository.class, CALLS_REAL_METHODS);
    doReturn(null).when(repository).getFields(anyString());
    doReturn(alert).when(repository).getByName(any(), anyString(), any());
    EventSubscriptionScheduler scheduler = mock(EventSubscriptionScheduler.class);
    when(scheduler.dropStaleJobData(alert)).thenReturn(false);

    try (MockedStatic<EventSubscriptionScheduler> schedulers =
            mockStatic(EventSubscriptionScheduler.class);
        MockedStatic<AlertRecord> record = mockStatic(AlertRecord.class)) {
      schedulers.when(EventSubscriptionScheduler::getInstance).thenReturn(scheduler);

      assertThrows(
          ServiceUnavailableException.class, () -> repository.syncEventSubscriptionOffset("alert"));

      record.verify(() -> AlertRecord.skipBacklog(any()), never());
    }
  }
}
