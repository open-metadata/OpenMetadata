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
package org.openmetadata.service.jdbi3;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationTest;

/**
 * Regression for issue #30192: multi-reader reindexing reads each entity type through an
 * upper-bounded keyset filter ({@link BoundedListFilter}), whose condition references {@code
 * :reindexEndName} / {@code :reindexEndId}. {@link CollectionDAO.TestSuiteDAO} overrides {@code
 * listAfter}/{@code listBefore} to splice the filter condition in via {@code @Define}, so those
 * queries must also bind the filter's query params. Before the fix they did not, and JDBI threw
 * {@code Missing named parameter 'reindexEndName'} — the reindex failed at the {@code testSuite}
 * entity type with {@code successCount: 0}.
 */
class TestSuiteReindexKeysetTest extends OpenMetadataApplicationTest {

  private static final String MAX_ID = "ffffffff-ffff-ffff-ffff-ffffffffffff";
  private static final String MAX_NAME = new String(Character.toChars(0xFFFF));

  @Test
  void boundedKeysetReadOfTestSuitesBindsUpperBoundParams() {
    CollectionDAO.TestSuiteDAO dao = Entity.getCollectionDAO().testSuiteDAO();
    BoundedListFilter filter = new BoundedListFilter(Include.ALL, MAX_NAME, MAX_ID);

    // The forward page is exactly what SearchIndexExecutor issues during reindex; both overrides
    // splice the bounded condition via @Define and so must bind reindexEndName/reindexEndId.
    List<String> afterPage = dao.listAfter(filter, 100, "", "");
    List<String> beforePage = dao.listBefore(filter, 100, MAX_NAME, MAX_ID);

    assertThat(afterPage)
        .as("bounded keyset listAfter must bind :reindexEndName/:reindexEndId")
        .isNotNull();
    assertThat(beforePage)
        .as("bounded keyset listBefore must bind :reindexEndName/:reindexEndId")
        .isNotNull();
  }
}
