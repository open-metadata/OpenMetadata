package org.openmetadata.it.tests.repositories;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import java.util.List;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.openmetadata.it.util.OssTestServer;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.BoundedListFilter;
import org.openmetadata.service.jdbi3.CollectionDAO;

/**
 * Regression for issue #30192: multi-reader reindexing reads each entity type through an
 * upper-bounded keyset filter ({@link BoundedListFilter}), whose condition references
 * {@code :reindexEndName} / {@code :reindexEndId}. {@link CollectionDAO.TestSuiteDAO} overrides
 * {@code listAfter}/{@code listBefore} to splice the filter condition in via {@code @Define}, so
 * those queries must also bind the filter's query params. Before the fix they did not, and JDBI
 * threw {@code Missing named parameter 'reindexEndName'} — the reindex failed at the {@code
 * testSuite} entity type with {@code successCount: 0}.
 *
 * <p>Exercises the exact DAO call {@code EntityRepository.listAfterKeyset} makes during reindex.
 * Embedded-only: it needs the in-JVM DAO.
 */
class TestSuiteKeysetReindexIT {

  private static final String MAX_ID = "ffffffff-ffff-ffff-ffff-ffffffffffff";
  private static final String MAX_NAME = "\uffff";

  @BeforeAll
  static void setup() {
    OssTestServer.defaultHandle();
    SdkClients.adminClient();
  }

  @Test
  void boundedKeysetReadOfTestSuitesBindsUpperBoundParams() {
    assumeTrue(
        !OssTestServer.isExternalMode(),
        "reindex reads test suites through the in-JVM DAO with a BoundedListFilter; external mode "
            + "has no in-process DAO");

    CollectionDAO.TestSuiteDAO dao = Entity.getCollectionDAO().testSuiteDAO();
    BoundedListFilter filter = new BoundedListFilter(Include.ALL, MAX_NAME, MAX_ID);

    // The forward page is exactly what EntityRepository.listAfterKeyset issues during reindex; both
    // overrides splice the bounded condition via @Define and so must bind reindexEndName/EndId.
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
