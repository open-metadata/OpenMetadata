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

import java.util.EnumMap;
import java.util.Map;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;

@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@Execution(ExecutionMode.SAME_THREAD)
abstract class FieldRelationshipCaptureTestBase {
  private final Map<RdfTestDatabase.Backend, FieldRelationshipCaptureFixture> databases =
      new EnumMap<>(RdfTestDatabase.Backend.class);

  @BeforeAll
  void startDatabases() {
    for (final var backend : RdfTestDatabase.backends().toList()) {
      databases.put(backend, new FieldRelationshipCaptureFixture(backend));
    }
  }

  @AfterAll
  void stopDatabases() {
    databases.values().forEach(FieldRelationshipCaptureFixture::close);
    databases.clear();
  }

  @BeforeEach
  void clearRows() {
    databases.values().forEach(FieldRelationshipCaptureFixture::clear);
  }

  final FieldRelationshipCaptureFixture fixture(final RdfTestDatabase.Backend backend) {
    return databases.get(backend);
  }
}
