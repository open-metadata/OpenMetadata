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

package org.openmetadata.service.fernet.rotation;

import java.util.Optional;
import java.util.stream.Stream;

/**
 * The I/O boundary of the rotation: a place that stores text. It yields the values that may hold a
 * token, rereads one, and writes a replacement only if the value still reads exactly as it was read.
 * It does not classify, decide or retry; {@link FernetSweep} does.
 */
interface TokenStore {
  String name();

  /** Every value holding the text {@code fernet:}, lazily, page by page. The caller closes it. */
  Stream<StoredText> candidates();

  /** The value as stored now; empty when it is gone. */
  Optional<StoredText> reread(Location at);

  /** Stores {@code replacement} where {@code read} is, only if it still reads as {@code read}. */
  boolean compareAndSet(StoredText read, String replacement);
}
