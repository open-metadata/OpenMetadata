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

import java.util.function.Consumer;

/**
 * Ties bound tokens ({@code fernet:bound:}) to the owner and field they were written for, so the
 * rotation can open and re-encrypt them. Implementations are loaded with {@link
 * java.util.ServiceLoader} and sit beside the code that owns each owner kind, calling its own owner
 * and field functions. A bound token no implementation anchors is reported {@code UNBOUND} and
 * blocks the removal of a key, so a new owner kind ships its anchors.
 */
public interface BoundSecretAnchors {

  /** Reports every anchor in {@code document}: the bound tokens at these fields belong to this owner. */
  void anchorsIn(JsonDocument document, Consumer<Anchor> sink);
}
