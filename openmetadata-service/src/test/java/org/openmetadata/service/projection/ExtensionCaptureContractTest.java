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
package org.openmetadata.service.projection;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.time.Clock;
import java.util.List;
import java.util.Set;
import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.sqlobject.Handler;
import org.jdbi.v3.sqlobject.statement.SqlBatch;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityExtensionDAO;
import org.openmetadata.service.jdbi3.EntityDAO;
import org.openmetadata.service.jdbi3.locator.ConnectionType;

class ExtensionCaptureContractTest {
  private final Jdbi jdbi = Jdbi.create("jdbc:unused");
  private final ProjectionJournal journal =
      new ProjectionJournal(jdbi, Clock.systemUTC(), Set.of(ProjectionTarget.SEARCH));
  private final ExtensionSnapshotStore snapshots =
      new ExtensionSnapshotStore(jdbi, journal, ConnectionType.POSTGRES);
  private final ExtensionMutationCapture capture = new ExtensionMutationCapture(journal, snapshots);

  @Test
  void unknownFormatsAndUnboundedPagesAreRejected() {
    assertThrows(IllegalArgumentException.class, () -> new ExtensionMutation(2, null));
    assertEquals(MutationFacts.Kind.EXTENSIONS, new ExtensionMutation(1, null).kind());
    for (final int limit : new int[] {-1, 0, 1001}) {
      assertThrows(IllegalArgumentException.class, () -> snapshots.page(1, 0, limit));
    }
    assertThrows(IllegalArgumentException.class, () -> snapshots.page(0, 0, 10));
    assertThrows(IllegalArgumentException.class, () -> snapshots.page(1, -1, 10));
  }

  @Test
  void unknownWritesFailBeforeExecutingButOtherFamiliesAndWrappersRemainAvailable()
      throws Exception {
    final Handler base = (target, arguments, supplier) -> null;
    final Handler unknown =
        capture.decorateHandler(
            base, NewExtensionWrites.class, NewExtensionWrites.class.getMethod("batch"));
    assertThrows(
        UnsupportedOperationException.class,
        () -> unknown.invoke((Object) null, new Object[0], null));
    assertSame(
        base,
        capture.decorateHandler(base, EntityDAO.class, EntityDAO.class.getMethod("getTableName")));
    assertSame(
        base,
        capture.decorateHandler(
            base,
            EntityExtensionDAO.class,
            EntityExtensionDAO.class.getMethod("deleteAllBatch", List.class)));
  }

  public interface NewExtensionWrites extends EntityExtensionDAO {
    @SqlBatch("DELETE FROM entity_extension")
    void batch();
  }
}
