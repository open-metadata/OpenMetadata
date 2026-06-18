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

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/**
 * An {@link OutputStream} that accumulates written bytes up to {@code maxBytes} so a small search
 * response can be captured for caching, and aborts with {@link OverCapacityException} the moment the
 * cap is exceeded so a large response is never fully materialized.
 *
 * <p>This is how streaming and the response cache are reconciled: the cache must hold the body to
 * store it, but holding a multi-hundred-MB body is exactly the allocation that OOMs the node. The
 * cap lets the common (small) response be buffered, cached, and returned with clean error semantics
 * — serialization happens before the response is committed — while an oversized response trips the
 * cap, is left uncached, and is streamed straight through instead.
 */
public final class CapBufferingOutputStream extends OutputStream {

  private static final int INITIAL_CAPACITY = 8192;

  private final ByteArrayOutputStream buffer;
  private final int maxBytes;

  public CapBufferingOutputStream(int maxBytes) {
    this.maxBytes = maxBytes;
    this.buffer = new ByteArrayOutputStream(Math.min(maxBytes, INITIAL_CAPACITY));
  }

  @Override
  public void write(int b) throws IOException {
    ensureCapacity(1);
    buffer.write(b);
  }

  @Override
  public void write(byte[] bytes, int off, int len) throws IOException {
    ensureCapacity(len);
    buffer.write(bytes, off, len);
  }

  public String toUtf8String() {
    return buffer.toString(StandardCharsets.UTF_8);
  }

  private void ensureCapacity(int additional) throws OverCapacityException {
    if (buffer.size() + additional > maxBytes) {
      throw new OverCapacityException(maxBytes);
    }
  }

  /** Thrown when the buffered payload would exceed the configured cap. */
  public static final class OverCapacityException extends IOException {
    public OverCapacityException(int maxBytes) {
      super(String.format("Response exceeded cache buffer cap of %d bytes", maxBytes));
    }
  }
}
