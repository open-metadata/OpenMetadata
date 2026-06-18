/*
 * Copyright 2024 Collate.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package org.openmetadata.service.drive.ontology;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

class OntologyDerivationTest {

  @Test
  void parsesVerdictJsonLeniently() throws Exception {
    String json =
        "{\"termVerdict\":{\"action\":\"CREATE\",\"name\":\"Churn\",\"description\":\"Customer churn\",\"newGlossaryName\":\"Business\"},"
            + "\"metricVerdict\":{\"action\":\"SKIP\"},\"unknownField\":123}";
    OntologyDerivation d = new ObjectMapper().readValue(json, OntologyDerivation.class);
    assertEquals("CREATE", d.termVerdict().action());
    assertEquals("Churn", d.termVerdict().name());
    assertEquals("SKIP", d.metricVerdict().action());
  }
}
