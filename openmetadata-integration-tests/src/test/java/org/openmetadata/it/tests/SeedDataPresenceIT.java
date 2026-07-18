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

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.CollectionDAO.SystemDAO;

class SeedDataPresenceIT {
  private static final String TABLE_TYPE = "table";
  private static final String ORGANIZATION_POLICY = "OrganizationPolicy";
  private static final String DATA_CONSUMER_ROLE = "DataConsumer";
  private static final String MISSING_SEED_NAME = "missing-seed-row";

  @Test
  void countsOnlyPresentRequiredSeedRows() {
    TestSuiteBootstrap.getJdbi()
        .useExtension(
            CollectionDAO.class,
            collectionDAO -> {
              SystemDAO systemDAO = collectionDAO.systemDAO();
              assertEquals(
                  3,
                  systemDAO.countRequiredSeedData(
                      List.of(TABLE_TYPE),
                      List.of(ORGANIZATION_POLICY),
                      List.of(DATA_CONSUMER_ROLE)));
              assertEquals(
                  2,
                  systemDAO.countRequiredSeedData(
                      List.of(MISSING_SEED_NAME),
                      List.of(ORGANIZATION_POLICY),
                      List.of(DATA_CONSUMER_ROLE)));
              assertEquals(
                  2,
                  systemDAO.countRequiredSeedData(
                      List.of(TABLE_TYPE),
                      List.of(MISSING_SEED_NAME),
                      List.of(DATA_CONSUMER_ROLE)));
              assertEquals(
                  2,
                  systemDAO.countRequiredSeedData(
                      List.of(TABLE_TYPE),
                      List.of(ORGANIZATION_POLICY),
                      List.of(MISSING_SEED_NAME)));
            });
  }
}
