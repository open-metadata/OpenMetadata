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
package org.openmetadata.service.logstorage.stream;

import java.io.IOException;

/**
 * Reads one pipeline run's log forward, one chunk at a time.
 *
 * <p>A source is stateful: it remembers where the previous read stopped, so {@link #readNext()}
 * only ever returns content the caller has not seen. That keeps cursor arithmetic — which differs
 * per backend, line offsets for S3 and chunk offsets for Airflow — inside the implementation
 * instead of leaking into the streaming loop.
 *
 * <p>Implementations are not thread safe. A source belongs to exactly one
 * {@link IngestionLogTailer}, which reads it from a single scheduler thread.
 */
public interface LogTailSource {

  /**
   * Log content written since the previous call, or an empty chunk when the run has produced
   * nothing new. Never blocks waiting for content.
   */
  LogChunk readNext() throws IOException;

  /**
   * A slice of log content plus the opaque cursor that points just past it. Clients hand the cursor
   * back to resume a stream where it stopped.
   */
  record LogChunk(String content, String cursor) {

    public boolean isEmpty() {
      return content == null || content.isEmpty();
    }

    public int size() {
      return content == null ? 0 : content.length();
    }
  }
}
