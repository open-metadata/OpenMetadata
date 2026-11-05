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

package org.openmetadata.service.util.incidentSeverityClassifier;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.util.Collections;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.tests.type.Severity;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.Votes;

class LogisticRegressionIncidentSeverityClassifierTest {

  @Test
  void classifyIncidentSeverityPreservesFractionalWeightedScores() {
    final Table entity =
        new Table()
            .withTags(List.of(new TagLabel().withName("Tier1")))
            .withVotes(new Votes().withUpVotes(536));

    final Severity severity =
        new LogisticRegressionIncidentSeverityClassifier().classifyIncidentSeverity(entity);

    assertEquals(Severity.Severity4, severity);
  }

  @ParameterizedTest
  @CsvSource({
    "Tier1,true,0,0,Severity1",
    "Tier2,true,2170,0,Severity2",
    "Tier3,true,2790,430,Severity3",
    "Tier4,true,0,0,Severity4"
  })
  void classifyIncidentSeveritySupportsTierSpecificPredictions(
      String tier, boolean hasOwner, int followerCount, int upVotes, Severity expectedSeverity) {
    final Table entity =
        new Table()
            .withTags(List.of(new TagLabel().withName(tier)))
            .withFollowers(Collections.nCopies(followerCount, new EntityReference()))
            .withVotes(new Votes().withUpVotes(upVotes));
    if (hasOwner) {
      entity.withOwners(List.of(new EntityReference()));
    }

    assertEquals(
        expectedSeverity,
        new LogisticRegressionIncidentSeverityClassifier().classifyIncidentSeverity(entity));
  }

  @Test
  void classifyIncidentSeverityRecognizesTier5() {
    final Table entity = new Table().withTags(List.of(new TagLabel().withName("Tier5")));

    assertEquals(
        Severity.Severity5,
        new LogisticRegressionIncidentSeverityClassifier().classifyIncidentSeverity(entity));
  }

  @Test
  void classifyIncidentSeverityReturnsNullWithoutRecognizedTier() {
    final Table entity = new Table().withTags(List.of(new TagLabel().withName("TierUnknown")));

    assertNull(new LogisticRegressionIncidentSeverityClassifier().classifyIncidentSeverity(entity));
  }
}
