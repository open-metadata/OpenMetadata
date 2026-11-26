package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;

class EmbeddingFieldUpdateTest {
  private static final String INDEX = "table_search_index";

  private final ListAppender<ILoggingEvent> logs = new ListAppender<>();

  @BeforeEach
  void captureLogs() {
    logs.start();
    logger().addAppender(logs);
  }

  @AfterEach
  void releaseLogs() {
    logger().detachAppender(logs);
  }

  private static Logger logger() {
    return (Logger) LoggerFactory.getLogger(EmbeddingFieldUpdate.class);
  }

  private static LiveEmbeddingField declared(String type, Integer dimensions) {
    return new LiveEmbeddingField(
        INDEX,
        Set.of(INDEX),
        Map.of(INDEX, new LiveEmbeddingField.Declared(type, dimensions)),
        Set.of(),
        null);
  }

  private List<String> errors() {
    return logs.list.stream()
        .filter(event -> event.getLevel() == Level.ERROR)
        .map(ILoggingEvent::getFormattedMessage)
        .toList();
  }

  @Test
  void anIndexWithoutTheFieldGetsItDeclared() {
    assertEquals(
        EmbeddingFieldUpdate.DECLARE,
        EmbeddingFieldUpdate.decide(LiveEmbeddingField.notMapped(INDEX), 384, "model"));
    assertTrue(errors().isEmpty());
  }

  @Test
  void aVectorOfTheConfiguredDimensionsIsKept() {
    assertEquals(
        EmbeddingFieldUpdate.KEEP,
        EmbeddingFieldUpdate.decide(declared("dense_vector", 384), 384, "model"));
    assertTrue(errors().isEmpty());
  }

  @Test
  void aVectorOfOtherDimensionsIsLeftOutAndTheRebuildIsSpelledOut() {
    assertEquals(
        EmbeddingFieldUpdate.LEAVE_OUT,
        EmbeddingFieldUpdate.decide(declared("dense_vector", 384), 768, "text-embedding-3-large"));

    String error = errors().getFirst();
    assertTrue(error.contains(INDEX + " has dense_vector of 384 dimensions"), error);
    assertTrue(error.contains("768-dimension vectors"), error);
    assertTrue(error.contains("text-embedding-3-large"), error);
    assertTrue(error.contains("Search Indexing"), error);
    assertTrue(error.contains("reindex --force"), error);
  }

  @Test
  void aFieldOfAnotherTypeIsLeftOut() {
    assertEquals(
        EmbeddingFieldUpdate.LEAVE_OUT,
        EmbeddingFieldUpdate.decide(declared("float", null), 384, "model"));
    assertTrue(errors().getFirst().contains(INDEX + " has float"));
  }

  @Test
  void anIndexThatCannotTakeAVectorFieldIsLeftOut() {
    LiveEmbeddingField withoutKnn =
        new LiveEmbeddingField(INDEX, Set.of(INDEX), Map.of(), Set.of(INDEX), null);

    assertEquals(
        EmbeddingFieldUpdate.LEAVE_OUT, EmbeddingFieldUpdate.decide(withoutKnn, 384, "model"));
    assertTrue(errors().getFirst().contains(INDEX + " was created without vector support"));
  }

  @Test
  void anUnreadableFieldIsLeftOutAndTheServerIsToBeRestarted() {
    assertEquals(
        EmbeddingFieldUpdate.LEAVE_OUT,
        EmbeddingFieldUpdate.decide(
            LiveEmbeddingField.unreadable(INDEX, "503 Service Unavailable"), 384, "model"));

    String error = errors().getFirst();
    assertTrue(error.contains("Could not read the live embedding field of search index " + INDEX));
    assertTrue(error.contains("503 Service Unavailable"));
    assertTrue(error.contains("Restart the server"));
  }
}
