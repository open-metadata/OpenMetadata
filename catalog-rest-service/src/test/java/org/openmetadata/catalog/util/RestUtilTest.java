/*
 *  Copyright 2021 Collate
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

package org.openmetadata.catalog.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.Arrays;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.Test;
import org.openmetadata.catalog.entity.data.Table;
import org.openmetadata.catalog.entity.teams.User;

@Slf4j
class RestUtilTest {
  @Test
  void testFields() {
    // Anonymous class with JsonProperties to extract
    Object entity =
        new Object() {
          @JsonProperty("attribute1")
          public int attribute1;

          @JsonProperty("attribute2")
          public String attribute2;

          @JsonProperty("relationship1")
          public User relationship1; // User is an entity class

          @JsonProperty("relationship2")
          public Table relationship2; // Table is an entity class
        };

    // Get attributes (that are fields with types that are not entity classes)
    List<String> attributes = RestUtil.getAttributes(entity.getClass());
    List<String> expectedAttributes = Arrays.asList("attribute1", "attribute2");
    assertEquals(expectedAttributes.size(), attributes.size());
    assertTrue(attributes.containsAll(expectedAttributes) && expectedAttributes.containsAll(attributes));

    // Get relationships (that are fields with types that are entity classes)
    List<String> relationships = RestUtil.getRelationships(entity.getClass());
    List<String> expectedRelationships = Arrays.asList("relationship1", "relationship2");
    assertEquals(expectedRelationships.size(), relationships.size());
    assertTrue(relationships.containsAll(expectedRelationships) && expectedRelationships.containsAll(relationships));
  }
}
