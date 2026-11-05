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

package org.openmetadata.it.bench;

/**
 * One timed benchmark interaction. Receives its zero-based iteration index so a scenario that must
 * defeat the server-side scene cache can vary a request parameter per sample.
 *
 * <p>{@link java.util.function.IntConsumer} would do, except every interaction worth benchmarking
 * here issues an HTTP call and therefore throws a checked exception.
 */
@FunctionalInterface
public interface BenchmarkInteraction {
  void run(int iteration) throws Exception;
}
