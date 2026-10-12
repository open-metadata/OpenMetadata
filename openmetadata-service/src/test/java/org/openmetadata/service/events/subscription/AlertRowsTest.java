package org.openmetadata.service.events.subscription;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.mockito.Mockito;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.EventSubscriptionRepository;

/** Whether an alert is gone is decided by its own row, never by a row it refers to. */
class AlertRowsTest {

  private final UUID alertId = UUID.randomUUID();
  private final EventSubscriptionRepository repository = mock(EventSubscriptionRepository.class);
  private MockedStatic<Entity> entity;

  @BeforeEach
  void useTheMockRepository() {
    entity = Mockito.mockStatic(Entity.class);
    entity.when(() -> Entity.getEntityRepository(Entity.EVENT_SUBSCRIPTION)).thenReturn(repository);
  }

  @AfterEach
  void release() {
    entity.close();
  }

  // A full read also resolves the alert's owners, domains and template, and a strict lookup of any
  // of them throws the same exception a missing alert does.
  @Test
  void aMissingRelatedRowNeverMeansGone() {
    when(repository.get(any(), eq(alertId), any(), any(Include.class), anyBoolean()))
        .thenThrow(new EntityNotFoundException("user instance for an owner not found"));
    when(repository.find(alertId, Include.NON_DELETED, false)).thenReturn(ownRow());

    assertNotNull(AlertRows.readOrNull(alertId));
  }

  @Test
  void theAlertIsGoneWhenItsOwnRowIs() {
    when(repository.find(alertId, Include.NON_DELETED, false))
        .thenThrow(new EntityNotFoundException("eventsubscription instance not found"));

    assertNull(AlertRows.readOrNull(alertId));
    assertThrows(EntityNotFoundException.class, () -> AlertRows.read(alertId));
  }

  @Test
  void aReadThatFailsIsNotAGoneAlert() {
    when(repository.find(alertId, Include.NON_DELETED, false))
        .thenThrow(new IllegalStateException("the database is unreachable"));

    assertThrows(IllegalStateException.class, () -> AlertRows.readOrNull(alertId));
  }

  @Test
  void theTemplateIsResolvedOnceTheAlertIsKnownToExist() {
    EntityReference template = new EntityReference().withId(UUID.randomUUID());
    when(repository.find(alertId, Include.NON_DELETED, false)).thenReturn(ownRow());
    when(repository.templateOf(alertId)).thenReturn(template);

    assertEquals(template, AlertRows.read(alertId).getNotificationTemplate());

    when(repository.templateOf(alertId))
        .thenThrow(new EntityNotFoundException("notificationTemplate instance not found"));
    assertThrows(EntityNotFoundException.class, () -> AlertRows.readOrNull(alertId));
  }

  private EventSubscription ownRow() {
    return new EventSubscription().withId(alertId).withName("alert");
  }
}
