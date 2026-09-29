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
 * A {@link LogTailSource} could not read a run's logs for a reason that will not resolve on a
 * later poll — e.g. the pipeline service client reported a persistent backend failure rather than
 * "no content yet". {@link IngestionLogTailer} treats this distinctly from an ordinary
 * {@link IOException}: instead of retrying silently, it ends the stream with an {@code error}
 * event carrying this message.
 */
public class LogSourceUnavailableException extends IOException {

  public LogSourceUnavailableException(String message) {
    super(message);
  }
}
