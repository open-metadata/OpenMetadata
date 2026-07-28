package org.openmetadata.service.events.subscription;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import jakarta.ws.rs.BadRequestException;
import java.io.IOException;
import java.util.List;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.events.AlertFilteringInput;
import org.openmetadata.schema.api.events.CreateEventSubscription;
import org.openmetadata.schema.entity.events.Argument;
import org.openmetadata.schema.entity.events.ArgumentsInput;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.events.subscription.EventSubscriptionResource;

class EventTypeValidationTest {

  @BeforeAll
  static void loadDescriptors() throws IOException {
    EventsSubscriptionRegistry.initialize(
        EventSubscriptionResource.getNotificationsFilterDescriptors(),
        EventSubscriptionResource.getObservabilityFilterDescriptors());
  }

  @Test
  void unreachableEventTypeIsRejectedNamingTheValue() {
    BadRequestException exception =
        assertThrows(
            BadRequestException.class, () -> validate(Entity.GLOSSARY_TERM, "suggestionCreated"));
    assertTrue(exception.getMessage().contains("suggestionCreated"));
    assertTrue(exception.getMessage().contains(Entity.GLOSSARY_TERM));
  }

  @Test
  void eventTypesTheResourceProducesAreAccepted() {
    assertDoesNotThrow(() -> validate(Entity.GLOSSARY_TERM, "entityCreated"));
    assertDoesNotThrow(() -> validate(Entity.GLOSSARY_TERM, "threadCreated"));
    assertDoesNotThrow(() -> validate(Entity.TABLE, "entityCreated", "postCreated"));
    assertDoesNotThrow(() -> validate("all", "entityLineageAdded"));
  }

  @Test
  void fieldsChangedIsAcceptedOnlyWhereUsageEmitsIt() {
    assertDoesNotThrow(() -> validate(Entity.TABLE, "entityFieldsChanged"));
    assertThrows(
        BadRequestException.class, () -> validate(Entity.GLOSSARY_TERM, "entityFieldsChanged"));
  }

  @Test
  void unknownEventTypeIsRejected() {
    assertThrows(BadRequestException.class, () -> validate(Entity.TABLE, "notAnEventType"));
  }

  @Test
  void excludingAnUnreachableEventTypeIsAccepted() {
    assertDoesNotThrow(
        () ->
            AlertUtil.validateAndBuildFilteringConditions(
                List.of(Entity.GLOSSARY_TERM),
                CreateEventSubscription.AlertType.NOTIFICATION,
                eventTypeFilterWithEffect(ArgumentsInput.Effect.EXCLUDE, "suggestionCreated")));
  }

  @Test
  void anAbsentEffectIsValidatedLikeInclude() {
    assertThrows(
        BadRequestException.class,
        () ->
            AlertUtil.validateAndBuildFilteringConditions(
                List.of(Entity.GLOSSARY_TERM),
                CreateEventSubscription.AlertType.NOTIFICATION,
                eventTypeFilterWithEffect(null, "suggestionCreated")));
  }

  private static void validate(String resource, String... eventTypes) {
    AlertUtil.validateAndBuildFilteringConditions(
        List.of(resource),
        CreateEventSubscription.AlertType.NOTIFICATION,
        eventTypeFilter(eventTypes));
  }

  private static AlertFilteringInput eventTypeFilter(String... eventTypes) {
    return eventTypeFilterWithEffect(ArgumentsInput.Effect.INCLUDE, eventTypes);
  }

  private static AlertFilteringInput eventTypeFilterWithEffect(
      ArgumentsInput.Effect effect, String... eventTypes) {
    return new AlertFilteringInput()
        .withFilters(
            List.of(
                new ArgumentsInput()
                    .withName("filterByEventType")
                    .withEffect(effect)
                    .withArguments(
                        List.of(
                            new Argument()
                                .withName("eventTypeList")
                                .withInput(List.of(eventTypes))))));
  }
}
