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

package org.openmetadata.service.rdf.inference;

/** Single-process stand-in for the cluster-wide materialization lease. */
final class InMemoryInferenceRunLock implements InferenceRunLock {
  private String holder;

  @Override
  public boolean tryAcquire(final String runId) {
    final boolean acquired = holder == null;
    if (acquired) {
      holder = runId;
    }
    return acquired;
  }

  @Override
  public boolean renew(final String runId) {
    return runId.equals(holder);
  }

  @Override
  public void release(final String runId) {
    if (runId.equals(holder)) {
      holder = null;
    }
  }

  void holdForAnotherRun() {
    holder = "another-run";
  }

  boolean isHeld() {
    return holder != null;
  }
}
