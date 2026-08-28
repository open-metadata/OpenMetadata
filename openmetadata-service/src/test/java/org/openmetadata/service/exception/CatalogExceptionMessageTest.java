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
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.TagLabel;

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
}
