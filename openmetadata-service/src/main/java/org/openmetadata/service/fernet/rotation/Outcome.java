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

/** What the rotation found out about one stored token. */
enum Outcome {
  /** The primary key opens it. */
  PRIMARY("Primary"),
  /** An older key opened it and the primary key's token now stands in its place. */
  REKEYED("Re-encrypted"),
  /** Only an older configured key opens it. */
  OLDER_KEY("Older key"),
  /** No configured key opens it. */
  NO_KEY("No key"),
  /** A bound token that no anchor ties to an owner. */
  UNBOUND("Unbound"),
  /** A token the rotation will not replace. */
  UNREWRITABLE("Not rewritable"),
  /** A value that changed between every read and write. */
  CONTENDED("Contended");

  final String column;

  Outcome(String column) {
    this.column = column;
  }
}
