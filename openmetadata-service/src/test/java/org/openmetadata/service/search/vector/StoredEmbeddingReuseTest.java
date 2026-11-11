package org.openmetadata.service.search.vector;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Supplier;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.openmetadata.schema.utils.JsonUtils;

class StoredEmbeddingReuseTest {

  private static final long UPDATED_AT = 1_700_000_000_000L;

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

    assertEquals(reused, StoredEmbeddingReuse.fingerprintMatches(header, () -> currentFingerprint));
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
        StoredEmbeddingReuse.fingerprintMatches(JsonUtils.readTree(json), currentFingerprint));
    assertEquals(0, computations.get());
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
  }
}
