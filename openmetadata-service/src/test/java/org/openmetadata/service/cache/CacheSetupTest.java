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

package org.openmetadata.service.cache;

import static org.junit.jupiter.api.Assertions.*;

import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;

/**
 * Simple test to verify cache setup is working correctly
 */
@Slf4j
public class CacheSetupTest extends CachedOpenMetadataApplicationResourceTest {

  @Test
  @DisplayName("Test that cache is properly configured and DAOs are wrapped")
  public void testCacheSetup() {
    // Check if cache is available
    assertTrue(isCacheAvailable(), "Cache should be available");

    // Check if CollectionDAO is properly wrapped
    CollectionDAO dao = Entity.getCollectionDAO();
    assertNotNull(dao, "CollectionDAO should not be null");

    LOG.info("CollectionDAO type: {}", dao.getClass().getSimpleName());

    // Check if TagUsageDAO is wrapped
    CollectionDAO.TagUsageDAO tagUsageDAO = dao.tagUsageDAO();
    assertNotNull(tagUsageDAO, "TagUsageDAO should not be null");

    LOG.info("TagUsageDAO type: {}", tagUsageDAO.getClass().getSimpleName());

    // If cache is available, the TagUsageDAO should be cached
    if (isCacheAvailable()) {
      assertTrue(
          tagUsageDAO instanceof CachedTagUsageDAO,
          "TagUsageDAO should be an instance of CachedTagUsageDAO when cache is available");
    }

    LOG.info("Cache setup test passed");
  }
}
