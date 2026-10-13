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
package org.openmetadata.service.rdf;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.Entity;

class RdfIndexingFieldsTest {

  @Test
  void usesAllSupportedFieldsExceptPropertiesIgnoredByTheMapper() {
    Set<String> supportedFields =
        Set.of(
            "columns",
            "domains",
            "followers",
            "owners",
            "changeDescription",
            "testCaseResult",
            Entity.FIELD_VOTES);

    assertEquals(
        List.of("columns", "domains", "followers", "owners"),
        RdfIndexingFields.forSupportedFields(supportedFields));
  }

  @Test
  void retainsInputsOfDedicatedRdfMappers() {
    // These four are in RdfPropertyMapper's IGNORED_PROPERTIES because a dedicated mapper emits
    // them as structured RDF instead of an opaque JSON literal. Reusing that predicate to pick the
    // fields to *load* dropped them from the entity before the dedicated mappers ever ran, so
    // table constraints, profiles, pipeline status and usage never reached the graph.
    final Set<String> supportedFields =
        Set.of(
            "tableConstraints",
            "profile",
            "pipelineStatus",
            "usageSummary",
            "changeDescription",
            "testCaseResult",
            Entity.FIELD_VOTES);

    assertEquals(
        List.of("pipelineStatus", "profile", "tableConstraints", "usageSummary"),
        RdfIndexingFields.forSupportedFields(supportedFields));
  }
}
