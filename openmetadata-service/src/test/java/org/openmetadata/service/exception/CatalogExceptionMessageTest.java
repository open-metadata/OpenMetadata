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
package org.openmetadata.service.exception;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.Entity;

class CatalogExceptionMessageTest {

  @Test
  void testMutuallyExclusiveLabels_glossarySource() {
    TagLabel tag1 =
        new TagLabel()
            .withTagFQN("glossary1.term1")
            .withSource(TagLabel.TagSource.GLOSSARY)
            .withLabelType(TagLabel.LabelType.MANUAL);
    TagLabel tag2 =
        new TagLabel()
            .withTagFQN("glossary1.term2")
            .withSource(TagLabel.TagSource.GLOSSARY)
            .withLabelType(TagLabel.LabelType.MANUAL);

    String message = CatalogExceptionMessage.mutuallyExclusiveLabels(tag1, tag2);

    assertTrue(message.contains("Glossary terms"));
    assertTrue(message.contains("mutually exclusive"));
    assertEquals(
        "Glossary terms glossary1.term1 and glossary1.term2 are mutually exclusive"
            + " and can't be assigned together",
        message);
  }

  @Test
  void testMutuallyExclusiveLabels_classificationSource() {
    TagLabel tag1 =
        new TagLabel()
            .withTagFQN("classification.tag1")
            .withSource(TagLabel.TagSource.CLASSIFICATION)
            .withLabelType(TagLabel.LabelType.MANUAL);
    TagLabel tag2 =
        new TagLabel()
            .withTagFQN("classification.tag2")
            .withSource(TagLabel.TagSource.CLASSIFICATION)
            .withLabelType(TagLabel.LabelType.MANUAL);

    String message = CatalogExceptionMessage.mutuallyExclusiveLabels(tag1, tag2);

    assertTrue(message.contains("Tag labels"));
    assertTrue(message.contains("mutually exclusive"));
  }

  /**
   * A denied domain reassignment names the domain from the JSON Patch, which carries no {@code name}
   * — reading that field alone rendered the message as "domains [null]", hiding the one detail the
   * caller needs.
   */
  @Test
  void testDomainPermissionNotAllowed_namesDomainFromFullyQualifiedNameOnly() {
    EntityReference fromPatch =
        new EntityReference().withId(UUID.randomUUID()).withType(Entity.DOMAIN);
    fromPatch.setFullyQualifiedName("Marketing");

    String message =
        CatalogExceptionMessage.domainPermissionNotAllowed(
            "bu.admin", List.of(fromPatch), List.of(MetadataOperation.EDIT_DOMAINS));

    assertTrue(message.contains("Marketing"), message);
    assertFalse(message.contains("null"), message);
  }

  @Test
  void testDomainPermissionNotAllowed_fallsBackToIdWhenUnnamed() {
    UUID id = UUID.randomUUID();
    EntityReference bare = new EntityReference().withId(id).withType(Entity.DOMAIN);

    String message =
        CatalogExceptionMessage.domainPermissionNotAllowed(
            "bu.admin", List.of(bare), List.of(MetadataOperation.EDIT_DOMAINS));

    assertTrue(message.contains(id.toString()), message);
  }
}
