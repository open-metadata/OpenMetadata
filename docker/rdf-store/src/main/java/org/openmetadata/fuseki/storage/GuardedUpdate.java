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

import org.apache.jena.fuseki.servlets.HttpAction;
import org.apache.jena.fuseki.servlets.SPARQL_Update;

/** SPARQL Update that {@link StorageGuard} refuses before it reaches TDB2 on a low volume. */
public final class GuardedUpdate extends SPARQL_Update {
  private final StorageGuard guard;

  public GuardedUpdate(final StorageGuard guard) {
    this.guard = guard;
  }

  @Override
  public void execute(final HttpAction action) {
    guard.requireWritable(action);
    super.execute(action);
  }
}
