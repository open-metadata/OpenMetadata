package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.CALLS_REAL_METHODS;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.LongStream;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.schema.entity.data.PipelineStatus;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.StatusType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;

/**
 * A bulk status write emits one change event per written status, and every event embeds the whole
 * pipeline. The events are inserted a chunk at a time, so a request never holds all of them.
 */
class PipelineBulkStatusChangeEventsTest {
  private static final long FIRST_TIMESTAMP = 1_785_063_454_240L;

  @Test
  void largeEventsAreInsertedBeforeTheirSizeAddsUp() {
    String description = "x".repeat(1_000_000);
    try (EventFixture fixture = new EventFixture()) {
      fixture.repository.insertStatusChangeEvents(
          pipeline(description), statuses(40), Map.of(), "admin");

      assertEquals(40, fixture.insertedEvents().size());
      assertTrue(fixture.chunks.size() > 1, "Events of 1 MB must not all go out in one insert");
      for (List<String> chunk : fixture.chunks) {
        long chars = chunk.stream().mapToLong(String::length).sum();
        assertTrue(
            chars < PipelineRepository.MAX_CHANGE_EVENT_CHUNK_CHARS + 2L * description.length(),
            "A chunk is inserted once it reaches the size cap");
      }
    }
  }

  @Test
  void smallEventsGoOutOldestFirstInChunksOfOneHundred() {
    try (EventFixture fixture = new EventFixture()) {
      Pipeline pipeline = pipeline("nightly load");
      List<PipelineStatus> written = statuses(250);

      fixture.repository.insertStatusChangeEvents(pipeline, written, Map.of(), "admin");

      assertEquals(List.of(100, 100, 50), fixture.chunks.stream().map(List::size).toList());
      assertEquals(
          written.stream().map(PipelineStatus::getTimestamp).toList(),
          fixture.insertedEvents().stream()
              .map(PipelineBulkStatusChangeEventsTest::statusTimestamp)
              .toList());
      assertNull(pipeline.getPipelineStatus(), "Events are built from a copy of the pipeline");
    }
  }

  private static Pipeline pipeline(String description) {
    return new Pipeline()
        .withId(UUID.randomUUID())
        .withName("nightly_load")
        .withFullyQualifiedName("airflow.nightly_load")
        .withDescription(description)
        .withVersion(0.1);
  }

  private static List<PipelineStatus> statuses(int count) {
    return LongStream.range(0, count)
        .mapToObj(
            run ->
                new PipelineStatus()
                    .withTimestamp(FIRST_TIMESTAMP + run)
                    .withExecutionStatus(StatusType.Successful))
        .toList();
  }

  private static Long statusTimestamp(String changeEventJson) {
    ChangeEvent changeEvent = JsonUtils.readValue(changeEventJson, ChangeEvent.class);
    return JsonUtils.readValue((String) changeEvent.getEntity(), Pipeline.class)
        .getPipelineStatus()
        .getTimestamp();
  }

  /** A real repository whose change-event inserts are recorded instead of written. */
  private static final class EventFixture implements AutoCloseable {
    private final MockedStatic<Entity> entities = mockStatic(Entity.class, CALLS_REAL_METHODS);
    private final List<List<String>> chunks = new ArrayList<>();
    private final PipelineRepository repository;

    EventFixture() {
      CollectionDAO collectionDAO = mock(CollectionDAO.class);
      CollectionDAO.ChangeEventDAO changeEventDAO = mock(CollectionDAO.ChangeEventDAO.class);
      when(collectionDAO.changeEventDAO()).thenReturn(changeEventDAO);
      doAnswer(call -> chunks.add(List.copyOf(call.getArgument(0))))
          .when(changeEventDAO)
          .insertBatch(anyList());
      entities.when(Entity::getCollectionDAO).thenReturn(collectionDAO);
      entities
          .when(() -> Entity.registerEntity(any(), any(), any(PipelineRepository.class)))
          .thenAnswer(call -> null);
      repository = new PipelineRepository();
    }

    List<String> insertedEvents() {
      return chunks.stream().flatMap(List::stream).toList();
    }

    @Override
    public void close() {
      entities.close();
    }
  }
}
