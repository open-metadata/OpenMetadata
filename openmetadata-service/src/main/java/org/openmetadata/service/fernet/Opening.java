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

package org.openmetadata.service.fernet;

/** What a {@link KeyRing} found when it tried to open a token. */
public sealed interface Opening {

  /** Opened by the primary key. */
  record Primary(String plaintext) implements Opening {
    @Override
    public String toString() {
      return "Primary[]";
    }
  }

  /** Opened by the key at {@code keyIndex}, an older key of the rotation list. */
  record Older(int keyIndex, String plaintext) implements Opening {
    @Override
    public String toString() {
      return "Older[keyIndex=" + keyIndex + "]";
    }
  }

  /** Not a token, or no configured key opens it. */
  record NoKey() implements Opening {}
}
