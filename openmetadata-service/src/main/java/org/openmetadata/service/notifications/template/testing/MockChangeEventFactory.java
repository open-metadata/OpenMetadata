package org.openmetadata.service.notifications.template.testing;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import javax.annotation.Nullable;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.notifications.template.testing.MockChangeEventRegistry.EntityScenario;
import org.openmetadata.service.notifications.template.testing.MockChangeEventRegistry.Scenario;

/**
 * Factory for creating mock ChangeEvents for notification template testing.
 */
public final class MockChangeEventFactory {
  private static final String TEST_USER = "test-user";

  private final MockChangeEventRegistry registry;

  /**
   * Create factory for generating mock ChangeEvents.
   *
   * @param registry Mock registry with builders and appliers
   */
  public MockChangeEventFactory(MockChangeEventRegistry registry) {
    this.registry = Objects.requireNonNull(registry, "registry must not be null");
  }

  /**
   * Create a mock ChangeEvent for the given resource and eventType.
   * Falls back to generic fixture for unknown resources.
   *
   * @param resource Resource type (e.g., "table", "dashboard")
   * @param eventType Optional eventType (null for neutral mode)
   * @return Fully populated ChangeEvent with mock data
   */
  public ChangeEvent create(String resource, @Nullable EventType eventType) {
    Objects.requireNonNull(resource, "resource must not be null");
    String type = resource.trim();

    Map<String, Object> entity = new HashMap<>();
    registry.builder(type).build(entity);

    UUID entityId = UUID.fromString(String.valueOf(entity.get("id")));
    String fqn = "test.namespace.sample_" + type;

    ChangeEvent event =
        new ChangeEvent()
            .withId(UUID.randomUUID())
            .withEntityId(entityId)
            .withEntityType(type)
            .withEntity(JsonUtils.pojoToJson(entity))
            .withUserName(TEST_USER)
            .withTimestamp(Instant.now().toEpochMilli())
            .withEntityFullyQualifiedName(fqn);

    Optional.ofNullable(eventType)
        .ifPresentOrElse(
            typeEvent -> {
              Scenario scenario = new EntityScenario(type, typeEvent);
              registry.scenarioApplier(scenario).apply(event, entity);
            },
            () ->
                event
                    .withEventType(null)
                    .withPreviousVersion(1.0)
                    .withCurrentVersion(1.1)
                    .withChangeDescription(null));

    return event;
  }
}
