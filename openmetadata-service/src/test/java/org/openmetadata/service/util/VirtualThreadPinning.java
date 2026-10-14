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

package org.openmetadata.service.util;

import java.nio.file.Path;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.atomic.AtomicReference;
import java.util.stream.Collectors;
import jdk.jfr.Recording;
import jdk.jfr.consumer.RecordedEvent;
import jdk.jfr.consumer.RecordedFrame;
import jdk.jfr.consumer.RecordingFile;

/**
 * Runs a task on a named virtual thread under a JFR recording and reports every time that thread
 * parked while pinned to its carrier ({@code jdk.VirtualThreadPinned}, recorded at any duration).
 */
public final class VirtualThreadPinning {

  private static final String PINNED_EVENT = "jdk.VirtualThreadPinned";

  public record Outcome<T>(T result, Throwable failure, List<String> pinnedStacks) {}

  private VirtualThreadPinning() {}

  public static <T> Outcome<T> runRecordingPins(
      Path recordingDir, String threadName, Callable<T> task) throws Exception {
    AtomicReference<T> result = new AtomicReference<>();
    AtomicReference<Throwable> failure = new AtomicReference<>();
    Path dump = recordingDir.resolve(threadName + ".jfr");
    try (Recording recording = new Recording()) {
      recording.enable(PINNED_EVENT).withThreshold(Duration.ZERO).withStackTrace();
      recording.start();
      Thread.ofVirtual().name(threadName).start(() -> runCapturing(task, result, failure)).join();
      recording.stop();
      recording.dump(dump);
    }
    return new Outcome<>(result.get(), failure.get(), pinnedStacksOn(dump, threadName));
  }

  private static <T> void runCapturing(
      Callable<T> task, AtomicReference<T> result, AtomicReference<Throwable> failure) {
    try {
      result.set(task.call());
    } catch (Exception e) {
      failure.set(e);
    }
  }

  private static List<String> pinnedStacksOn(Path dump, String threadName) throws Exception {
    return RecordingFile.readAllEvents(dump).stream()
        .filter(event -> PINNED_EVENT.equals(event.getEventType().getName()))
        .filter(event -> isOnThread(event, threadName))
        .map(VirtualThreadPinning::describeStack)
        .toList();
  }

  private static boolean isOnThread(RecordedEvent event, String threadName) {
    return event.getThread() != null && threadName.equals(event.getThread().getJavaName());
  }

  private static String describeStack(RecordedEvent event) {
    return event.getStackTrace().getFrames().stream()
        .map(VirtualThreadPinning::describeFrame)
        .collect(Collectors.joining("\n  at ", "  at ", ""));
  }

  private static String describeFrame(RecordedFrame frame) {
    return "%s.%s:%d"
        .formatted(
            frame.getMethod().getType().getName(),
            frame.getMethod().getName(),
            frame.getLineNumber());
  }
}
