/*
 *  Copyright 2024 Collate.
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
package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import jakarta.json.spi.JsonProvider;
import jakarta.json.stream.JsonGenerator;
import jakarta.ws.rs.core.StreamingOutput;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.search.CapBufferingOutputStream.OverCapacityException;

/**
 * Verifies the cap semantics the search-response cache relies on: a small response is captured for
 * caching, while an oversized one trips the cap so it is never fully materialized in heap. A unit
 * test on this mechanism is exactly what would have caught the regression where streaming silently
 * disabled the cache.
 */
class CapBufferingOutputStreamTest {

  private static final int CAP = 16;

  @Test
  void capturesPayloadUnderTheCap() throws IOException {
    String payload = "{\"hits\":1}";
    CapBufferingOutputStream stream = new CapBufferingOutputStream(CAP);

    stream.write(payload.getBytes(StandardCharsets.UTF_8));

    assertEquals(payload, stream.toUtf8String());
  }

  @Test
  void capturesPayloadExactlyAtTheCap() throws IOException {
    byte[] payload = "0123456789abcdef".getBytes(StandardCharsets.UTF_8);
    CapBufferingOutputStream stream = new CapBufferingOutputStream(CAP);

    stream.write(payload);

    assertEquals(CAP, stream.toUtf8String().length());
  }

  @Test
  void abortsOnceTheCapIsExceededByABulkWrite() {
    byte[] tooBig = new byte[CAP + 1];
    CapBufferingOutputStream stream = new CapBufferingOutputStream(CAP);

    assertThrows(OverCapacityException.class, () -> stream.write(tooBig));
  }

  @Test
  void abortsOnceTheCapIsExceededAcrossMultipleWrites() throws IOException {
    CapBufferingOutputStream stream = new CapBufferingOutputStream(CAP);
    stream.write(new byte[CAP]);

    assertThrows(OverCapacityException.class, () -> stream.write('x'));
  }

  @Test
  void streamingOutputUnderCapIsCaptured() throws IOException {
    String body = "{\"took\":3,\"hits\":{\"total\":0}}";
    StreamingOutput streamingOutput = output -> output.write(body.getBytes(StandardCharsets.UTF_8));
    CapBufferingOutputStream buffer = new CapBufferingOutputStream(1024);

    streamingOutput.write(buffer);

    assertEquals(body, buffer.toUtf8String());
  }

  @Test
  void streamingOutputOverCapTripsTheCap() {
    StreamingOutput oversized = output -> output.write(new byte[2048]);
    CapBufferingOutputStream buffer = new CapBufferingOutputStream(1024);

    assertThrows(OverCapacityException.class, () -> oversized.write(buffer));
  }

  @Test
  void jsonGeneratorOverCapSurfacesOverCapacityInTheCauseChain() {
    JsonProvider provider = JsonProvider.provider();
    CapBufferingOutputStream buffer = new CapBufferingOutputStream(512);

    Exception thrown =
        assertThrows(
            Exception.class,
            () -> {
              try (JsonGenerator generator = provider.createGenerator(buffer)) {
                generator.writeStartArray();
                for (int i = 0; i < 10_000; i++) {
                  generator.write("a-reasonably-long-value-to-exceed-the-cap");
                }
                generator.writeEnd();
              }
            });

    // The generator wraps the OutputStream failure, so the cap signal lives in the cause chain —
    // this is the assumption the cache's oversize detection relies on.
    assertTrue(hasOverCapacityCause(thrown));
  }

  private static boolean hasOverCapacityCause(Throwable error) {
    Throwable cause = error;
    while (cause != null && !(cause instanceof OverCapacityException)) {
      cause = cause.getCause();
    }
    return cause != null;
  }
}
