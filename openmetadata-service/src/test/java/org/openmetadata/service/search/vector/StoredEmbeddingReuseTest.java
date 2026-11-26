package org.openmetadata.service.search.vector;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Supplier;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.search.vector.client.EmbeddingModel;

class StoredEmbeddingReuseTest {

  private static final EmbeddingModel MODEL = new EmbeddingModel("model-a", 2);

  private static final long UPDATED_AT = 1_700_000_000_000L;
  private static final String ENTITY_ID = "4f0c1c9e-0000-4000-8000-000000000001";

  @ParameterizedTest(name = "stored={0} current={1} -> reuse={2}")
  @CsvSource({
    "fp-current, fp-current, true",
    // Same updatedAt, but a release changed the embedding text and so the fingerprint.
    "fp-old-text, fp-current, false",
  })
  void reuseFollowsTheFingerprintWhateverTheUpdatedAt(
      String storedFingerprint, String currentFingerprint, boolean reused) {
    JsonNode header =
        JsonUtils.readTree(
            "{\"fingerprint\":\"%s\",\"updatedAt\":%d}".formatted(storedFingerprint, UPDATED_AT));

    assertEquals(
        reused,
        StoredEmbeddingReuse.fingerprintMatches(ENTITY_ID, header, () -> currentFingerprint));
  }

  @ParameterizedTest
  @CsvSource(
      delimiter = '|',
      value = {"{\"updatedAt\":1700000000000}", "{}", "\"not-an-object\""})
  void aDocWithoutAStoredFingerprintIsNotReusedAndSkipsTheFingerprintComputation(String json) {
    AtomicInteger computations = new AtomicInteger();
    Supplier<String> currentFingerprint =
        () -> {
          computations.incrementAndGet();
          return "fp-current";
        };

    assertFalse(
        StoredEmbeddingReuse.fingerprintMatches(
            ENTITY_ID, JsonUtils.readTree(json), currentFingerprint));
    assertEquals(0, computations.get());
  }

  @Test
  void anEntityThatCannotBeFingerprintedIsReembeddedInsteadOfFailingTheLookup() {
    JsonNode header = JsonUtils.readTree("{\"fingerprint\":\"fp-current\"}");
    Supplier<String> failingFingerprint =
        () -> {
          throw new IllegalStateException("tag without an FQN");
        };

    assertFalse(StoredEmbeddingReuse.fingerprintMatches(ENTITY_ID, header, failingFingerprint));
  }

  @ParameterizedTest(name = "{0} -> spliceable={1}")
  @CsvSource(
      delimiter = '|',
      value = {
        "{\"fingerprint\":\"fp\",\"embedding\":[0.1,0.2]}|true",
        "{\"fingerprint\":\"fp\",\"embedding\":[]}|false",
        "{\"fingerprint\":\"fp\"}|false",
        "{\"fingerprint\":\" \",\"embedding\":[0.1]}|false",
        "{\"fingerprint\":7,\"embedding\":[0.1]}|false",
        "{\"embedding\":[0.1]}|false",
        "[0.1]|false"
      })
  void onlyAnObjectWithAVectorAndAFingerprintIsSpliced(String json, boolean spliceable) {
    assertEquals(spliceable, StoredEmbeddingReuse.isSpliceable(JsonUtils.readTree(json)));
  }

  @Test
  void aMissingDocIsNotSpliced() {
    assertFalse(StoredEmbeddingReuse.isSpliceable(null));
    assertFalse(StoredEmbeddingReuse.isSpliceable(null, MODEL));
  }

  @ParameterizedTest(name = "recorded {0} -> spliceable={1}")
  @CsvSource(
      delimiter = '|',
      value = {
        "{\"embeddingModel\":\"model-a\",\"embeddingDimension\":2}|true",
        // Another model of the same size places the same text elsewhere.
        "{\"embeddingModel\":\"model-b\",\"embeddingDimension\":2}|false",
        // One model id configured for another size.
        "{\"embeddingModel\":\"model-a\",\"embeddingDimension\":3}|false",
        "{\"embeddingModel\":\"model-a\"}|false",
        // Written before docs recorded the model of their vector.
        "{}|false"
      })
  void aVectorIsSplicedOnlyForTheModelThatMadeIt(String recordedModel, boolean spliceable) {
    ObjectNode stored = (ObjectNode) JsonUtils.readTree(recordedModel);
    stored.put("fingerprint", "fp").set("embedding", JsonUtils.readTree("[0.1,0.2]"));

    assertEquals(spliceable, StoredEmbeddingReuse.isSpliceable(stored, MODEL));
  }

  @Test
  void aVectorWhoseLengthIsNotTheDimensionOfItsModelIsNotSpliced() {
    JsonNode stored =
        JsonUtils.readTree(
            "{\"fingerprint\":\"fp\",\"embedding\":[0.1,0.2,0.3],"
                + "\"embeddingModel\":\"model-a\",\"embeddingDimension\":2}");

    assertFalse(StoredEmbeddingReuse.isSpliceable(stored, MODEL));
  }

  @ParameterizedTest(name = "stored {0} by {1} -> current={2}")
  @CsvSource({
    "fp-current, model-a, true",
    "fp-old-text, model-a, false",
    "fp-current, model-b, false",
  })
  void aStoredEmbeddingIsCurrentForTheCurrentTextAndTheConfiguredModel(
      String storedFingerprint, String storedModel, boolean current) {
    JsonNode header = header(storedFingerprint, storedModel);

    assertEquals(
        current, StoredEmbeddingReuse.isCurrent(ENTITY_ID, header, MODEL, () -> "fp-current"));
  }

  @Test
  void aDocOfAnotherModelIsNotCurrentAndSkipsTheFingerprintComputation() {
    AtomicInteger computations = new AtomicInteger();
    Supplier<String> currentFingerprint =
        () -> {
          computations.incrementAndGet();
          return "fp-current";
        };

    assertFalse(
        StoredEmbeddingReuse.isCurrent(
            ENTITY_ID, header("fp-current", "model-b"), MODEL, currentFingerprint));
    assertEquals(0, computations.get());
  }

  private static JsonNode header(String fingerprint, String model) {
    return JsonUtils.readTree(
        "{\"fingerprint\":\"%s\",\"embeddingModel\":\"%s\",\"embeddingDimension\":%d}"
            .formatted(fingerprint, model, MODEL.dimension()));
  }
}
