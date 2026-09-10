/*
 *  Copyright 2026 Collate
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
package org.openmetadata.fuseki;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.time.Duration;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.Test;

class WriteDeadlineTest {
  @Test
  void allStagesShareOneAbsoluteDeadline() throws Exception {
    final AtomicLong clock = new AtomicLong();
    final WriteDeadline deadline = new WriteDeadline(Duration.ofNanos(100), clock::get);
    clock.set(80);
    assertEquals(20, deadline.remainingNanos());
    clock.set(100);
    assertThrows(TimeoutException.class, deadline::remainingNanos);
    assertThrows(WriteDeadline.Expired.class, deadline::check);
  }

  @Test
  void uploadLimitUsesActualBytes() throws Exception {
    final ByteArrayOutputStream output = new ByteArrayOutputStream();
    final WriteDeadline deadline = new WriteDeadline(Duration.ofSeconds(1), System::nanoTime);
    StagedUpload.copyBounded(new ByteArrayInputStream(new byte[1024]), output, deadline, 1024);
    assertEquals(1024, output.size());
    assertThrows(
        StagedUpload.TooLarge.class,
        () ->
            StagedUpload.copyBounded(
                new ByteArrayInputStream(new byte[1025]), output, deadline, 1024));
    assertEquals(1024, output.size());
  }

  @Test
  void deadlineIsCheckedEvenWhenTheUploadEndsWithoutMoreBytes() {
    final WriteDeadline deadline = new WriteDeadline(Duration.ofNanos(1), () -> 0);
    final AtomicLong clock = new AtomicLong();
    final WriteDeadline expired = new WriteDeadline(Duration.ofNanos(1), clock::get);
    clock.set(1);
    assertThrows(
        WriteDeadline.Expired.class,
        () ->
            StagedUpload.copyBounded(
                new ByteArrayInputStream(new byte[0]), new ByteArrayOutputStream(), expired, 100));
    deadline.check();
  }
}
