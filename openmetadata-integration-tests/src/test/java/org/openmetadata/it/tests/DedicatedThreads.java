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

package org.openmetadata.it.tests;

import java.util.concurrent.Executor;

/**
 * Starts a test's concurrent database work on its own thread. JUnit's parallel workers are
 * ForkJoin threads, and one that joins a future can run pending common-pool tasks itself,
 * including the work it just submitted. A hook in that work that waits for the test thread to
 * release it then deadlocks until its timeout.
 */
final class DedicatedThreads {
  static final Executor EXECUTOR =
      command -> Thread.ofPlatform().daemon().name("capture-it-concurrent-write").start(command);

  private DedicatedThreads() {}
}
