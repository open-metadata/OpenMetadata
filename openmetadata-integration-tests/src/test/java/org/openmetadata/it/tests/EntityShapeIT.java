/*
 *  Copyright 2024 Collate.
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

import static org.junit.jupiter.api.Assertions.fail;

import java.util.Optional;
import java.util.stream.Stream;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.openmetadata.it.search.SearchClient;
import org.openmetadata.it.search.shape.AcceptedLimits;
import org.openmetadata.it.search.shape.EntityShapeRegistry;
import org.openmetadata.it.search.shape.Outcome;
import org.openmetadata.it.search.shape.PlannedCase;
import org.openmetadata.it.search.shape.ShapeCanary;
import org.openmetadata.it.util.OssTestServer;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Execution(ExecutionMode.SAME_THREAD)
class EntityShapeIT {
  private static final Logger LOG = LoggerFactory.getLogger(EntityShapeIT.class);

  private static ShapeCanary canary;

  @BeforeAll
  static void setupAll() {
    SdkClients.adminClient();
    final SearchRepository searchRepository = Entity.getSearchRepository();
    canary = new ShapeCanary(searchRepository, new SearchClient(OssTestServer.defaultHandle()));
  }

  static Stream<Arguments> cases() {
    return new EntityShapeRegistry().plannedCases().stream().map(Arguments::of);
  }

  @ParameterizedTest(name = "{0}")
  @MethodSource("cases")
  void sweep(final PlannedCase plannedCase) {
    final Outcome observed =
        canary.index(plannedCase.entityType(), plannedCase.entity().get(), plannedCase.probe());
    final Optional<AcceptedLimits.Accepted> accepted =
        AcceptedLimits.find(
            plannedCase.entityType(), plannedCase.dimension(), plannedCase.rung().label());
    final boolean tolerated = accepted.map(a -> a.outcome() == observed).orElse(false);
    if (observed != Outcome.OK && tolerated) {
      LOG.info(
          "ACCEPTED {} -> {} — {}", plannedCase.label(), observed, accepted.orElseThrow().reason());
    } else if (observed != Outcome.OK) {
      fail(
          plannedCase.label()
              + " must index + be queryable but got "
              + observed
              + ". Fix the cause, or opt-in via AcceptedLimits if this limit is acceptable.");
    }
  }
}
