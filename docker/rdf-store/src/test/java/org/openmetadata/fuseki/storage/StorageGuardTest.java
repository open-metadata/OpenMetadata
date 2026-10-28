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
package org.openmetadata.fuseki.storage;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.file.FileStore;
import java.nio.file.attribute.FileAttributeView;
import java.nio.file.attribute.FileStoreAttributeView;
import java.time.Duration;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.Test;

class StorageGuardTest {
  private static final long GIB = 1L << 30;

  private final Volume volume = new Volume(250 * GIB);
  private final AtomicLong now = new AtomicLong();

  @Test
  void theReserveIsAPercentageOfTheVolumeByDefault() {
    assertEquals(25 * GIB, StorageGuard.reserve(volume, null));
    assertEquals(25 * GIB, StorageGuard.reserve(volume, " "));
    assertEquals(5 * GIB / 2, StorageGuard.reserve(volume, "1%"));
  }

  @Test
  void theReserveMayBeAnAbsoluteSize() {
    assertEquals(20 * GIB, StorageGuard.reserve(volume, "20g"));
    assertEquals(512L << 20, StorageGuard.reserve(volume, "512m"));
  }

  @Test
  void aMalformedReserveIsRefusedAtStartup() {
    assertThrows(IllegalArgumentException.class, () -> StorageGuard.reserve(volume, "lots"));
    assertThrows(IllegalArgumentException.class, () -> StorageGuard.reserve(volume, "0%"));
  }

  @Test
  void writesStopOnceFreeSpaceFallsBelowTheReserve() {
    final StorageGuard guard = new StorageGuard(volume, 25 * GIB, now::get);
    volume.usable = 26 * GIB;
    assertFalse(guard.isLowOnSpace());

    volume.usable = 24 * GIB;
    now.addAndGet(Duration.ofSeconds(1).toNanos());
    assertTrue(guard.isLowOnSpace());

    volume.usable = 100 * GIB;
    now.addAndGet(Duration.ofSeconds(1).toNanos());
    assertFalse(guard.isLowOnSpace(), "writes resume once maintenance freed space");
  }

  @Test
  void theVolumeIsRecheckedAtMostOnceASecond() {
    final StorageGuard guard = new StorageGuard(volume, 25 * GIB, now::get);
    volume.usable = 100 * GIB;
    assertFalse(guard.isLowOnSpace());

    volume.usable = 0;
    now.addAndGet(Duration.ofMillis(500).toNanos());
    assertFalse(guard.isLowOnSpace());
    now.addAndGet(Duration.ofMillis(500).toNanos());
    assertTrue(guard.isLowOnSpace());
  }

  /** A volume whose free space the test sets. */
  private static final class Volume extends FileStore {
    private final long total;
    private volatile long usable;

    Volume(final long total) {
      this.total = total;
      this.usable = total;
    }

    @Override
    public long getTotalSpace() {
      return total;
    }

    @Override
    public long getUsableSpace() {
      return usable;
    }

    @Override
    public long getUnallocatedSpace() {
      return usable;
    }

    @Override
    public String name() {
      return "test";
    }

    @Override
    public String type() {
      return "test";
    }

    @Override
    public boolean isReadOnly() {
      return false;
    }

    @Override
    public boolean supportsFileAttributeView(final Class<? extends FileAttributeView> type) {
      return false;
    }

    @Override
    public boolean supportsFileAttributeView(final String name) {
      return false;
    }

    @Override
    public <V extends FileStoreAttributeView> V getFileStoreAttributeView(final Class<V> type) {
      return null;
    }

    @Override
    public Object getAttribute(final String attribute) {
      throw new UnsupportedOperationException(attribute);
    }
  }
}
