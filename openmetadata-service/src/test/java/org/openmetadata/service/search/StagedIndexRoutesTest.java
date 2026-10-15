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

package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.jdbi3.SearchReindexDAOs.SearchIndexWriteRouteDAO;
import org.openmetadata.service.jdbi3.SearchReindexDAOs.SearchIndexWriteRouteDAO.WriteRoute;

class StagedIndexRoutesTest {
  private static final String TABLES = "table_search_index";
  private static final String TABLES_REBUILT = "table_search_index_rebuild_1";
  private static final String TOPICS = "topic_search_index";
  private static final String TOPICS_REBUILT = "topic_search_index_rebuild_1";

  private final RouteTable routeTable = new RouteTable();
  private long now = 1_000_000L;

  @Test
  void aRouteRegisteredOnOneServerReachesAnotherOnceItRefreshes() {
    final StagedIndexRoutes reindexingServer = server("a");
    final StagedIndexRoutes otherServer = server("b");

    reindexingServer.register(TABLES, TABLES_REBUILT);

    assertEquals(Optional.empty(), otherServer.stagedIndexFor(TABLES));
    otherServer.refresh();
    assertEquals(Optional.of(TABLES_REBUILT), otherServer.stagedIndexFor(TABLES));
  }

  @Test
  void aRouteItsOwnerRemovesStopsApplyingEverywhere() {
    final StagedIndexRoutes reindexingServer = server("a");
    final StagedIndexRoutes otherServer = server("b");
    reindexingServer.register(TABLES, TABLES_REBUILT);
    otherServer.refresh();

    reindexingServer.unregister(TABLES, TABLES_REBUILT);
    otherServer.refresh();

    assertEquals(Optional.empty(), reindexingServer.stagedIndexFor(TABLES));
    assertEquals(Optional.empty(), otherServer.stagedIndexFor(TABLES));
  }

  @Test
  void aRouteLapsesWhenItsOwnerStopsRenewingIt() {
    server("a").register(TABLES, TABLES_REBUILT);
    final StagedIndexRoutes otherServer = server("b");

    now += StagedIndexRoutes.LEASE_MS + 1;
    otherServer.refresh();

    assertEquals(Optional.empty(), otherServer.stagedIndexFor(TABLES));
  }

  @Test
  void anOwnerThatKeepsRefreshingKeepsItsRoutesAlive() {
    final StagedIndexRoutes reindexingServer = server("a");
    final StagedIndexRoutes otherServer = server("b");
    reindexingServer.register(TABLES, TABLES_REBUILT);

    now += StagedIndexRoutes.LEASE_MS - 1;
    reindexingServer.refresh();
    now += StagedIndexRoutes.LEASE_MS - 1;
    otherServer.refresh();

    assertEquals(Optional.of(TABLES_REBUILT), otherServer.stagedIndexFor(TABLES));
  }

  @Test
  void everyServersStagedIndexesAreFannedOutTo() {
    final StagedIndexRoutes reindexingServer = server("a");
    final StagedIndexRoutes otherServer = server("b");
    reindexingServer.register(TABLES, TABLES_REBUILT);
    otherServer.register(TOPICS, TOPICS_REBUILT);

    reindexingServer.refresh();

    assertEquals(Set.of(TABLES_REBUILT, TOPICS_REBUILT), reindexingServer.stagedIndexes());
  }

  @Test
  void aServerThatCannotReachTheRouteTableStillFollowsItsOwnRoutes() {
    final StagedIndexRoutes isolated = new StagedIndexRoutes(() -> null, () -> "a", () -> now);

    isolated.register(TABLES, TABLES_REBUILT);
    isolated.refresh();

    assertEquals(Optional.of(TABLES_REBUILT), isolated.stagedIndexFor(TABLES));
  }

  private StagedIndexRoutes server(final String serverId) {
    return new StagedIndexRoutes(() -> routeTable, () -> serverId, () -> now);
  }

  /** The search_index_write_route table, in memory. */
  private static final class RouteTable implements SearchIndexWriteRouteDAO {
    private record Row(String stagedIndex, String ownerId, long leaseExpiresAt) {}

    private final Map<String, Row> rows = new ConcurrentHashMap<>();

    @Override
    public void upsert(
        final String canonicalIndex,
        final String stagedIndex,
        final String ownerId,
        final long leaseExpiresAt) {
      rows.put(canonicalIndex, new Row(stagedIndex, ownerId, leaseExpiresAt));
    }

    @Override
    public int renew(final List<String> stagedIndexes, final long leaseExpiresAt) {
      final List<String> renewed = new ArrayList<>();
      rows.replaceAll(
          (canonical, row) -> {
            final boolean owned = stagedIndexes.contains(row.stagedIndex());
            if (owned) {
              renewed.add(canonical);
            }
            return owned ? new Row(row.stagedIndex(), row.ownerId(), leaseExpiresAt) : row;
          });
      return renewed.size();
    }

    @Override
    public int delete(final String canonicalIndex, final String stagedIndex) {
      final Row row = rows.get(canonicalIndex);
      final boolean routed = row != null && row.stagedIndex().equals(stagedIndex);
      return routed && rows.remove(canonicalIndex, row) ? 1 : 0;
    }

    @Override
    public List<WriteRoute> listLive(final long now) {
      return rows.entrySet().stream()
          .filter(entry -> entry.getValue().leaseExpiresAt() > now)
          .map(entry -> new WriteRoute(entry.getKey(), entry.getValue().stagedIndex()))
          .toList();
    }
  }
}
