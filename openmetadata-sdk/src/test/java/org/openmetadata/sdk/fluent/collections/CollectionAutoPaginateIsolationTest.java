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
package org.openmetadata.sdk.fluent.collections;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.MockitoAnnotations;
import org.mockito.stubbing.Answer;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.models.AllModels;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;
import org.openmetadata.sdk.services.dataassets.PipelineService;
import org.openmetadata.sdk.services.dataassets.TableService;
import org.openmetadata.sdk.services.databases.DatabaseSchemaService;
import org.openmetadata.sdk.services.databases.DatabaseService;
import org.openmetadata.sdk.services.glossary.GlossaryService;
import org.openmetadata.sdk.services.glossary.GlossaryTermService;
import org.openmetadata.sdk.services.teams.TeamService;
import org.openmetadata.sdk.services.teams.UserService;

/**
 * Regression tests pinning that each {@code iterator()} / {@code stream()} / {@code all()} call on
 * an auto-paginating {@code *Collection} yields an <em>independent</em> traversal of all pages,
 * even when multiple traversals of the same collection are open at once.
 *
 * <p>Before the fix, {@code AutoPaginatingIterator} was a non-static inner class that drove cursor
 * state stored on the outer collection ({@code currentPage} / {@code nextPageToken} / {@code
 * hasMore}). Opening or advancing a second iterator called {@code reset()} + {@code
 * loadNextPage()} on the collection and clobbered the position of any other live iterator; against
 * a mocked paginated server this duplicated page 1, skipped intermediate pages and mis-delivered
 * entities across consumers.
 *
 * <p>The fix gives each {@code AutoPaginatingIterator} its own {@code nextPageToken} / {@code
 * hasMore} and fetches pages via a shared, side-effect-free {@code fetchPage(cursor)} helper, so
 * the collection-level cursor is left exclusively to the manual-pagination API ({@code
 * getCurrentPage()} / {@code hasNextPage()} / {@code nextPage()} / {@code reset()}).
 *
 * <p>These tests guard the bug class across all eight affected collection classes
 * ({@link UserCollection}, {@link TableCollection}, {@link DatabaseCollection}, {@link
 * DatabaseSchemaCollection}, {@link PipelineCollection}, {@link GlossaryCollection}, {@link
 * GlossaryTermCollection}, {@link TeamCollection}) so a future refactor of any one of them cannot
 * silently re-introduce the shared-cursor defect.
 */
class CollectionAutoPaginateIsolationTest {

  private OpenMetadataClient client;
  private UserService userService;
  private TableService tableService;
  private DatabaseService databaseService;
  private DatabaseSchemaService databaseSchemaService;
  private PipelineService pipelineService;
  private GlossaryService glossaryService;
  private GlossaryTermService glossaryTermService;
  private TeamService teamService;

  @BeforeEach
  void setUp() {
    MockitoAnnotations.openMocks(this);
    client = mock(OpenMetadataClient.class);
    userService = mock(UserService.class);
    tableService = mock(TableService.class);
    databaseService = mock(DatabaseService.class);
    databaseSchemaService = mock(DatabaseSchemaService.class);
    pipelineService = mock(PipelineService.class);
    glossaryService = mock(GlossaryService.class);
    glossaryTermService = mock(GlossaryTermService.class);
    teamService = mock(TeamService.class);
    when(client.users()).thenReturn(userService);
    when(client.tables()).thenReturn(tableService);
    when(client.databases()).thenReturn(databaseService);
    when(client.databaseSchemas()).thenReturn(databaseSchemaService);
    when(client.pipelines()).thenReturn(pipelineService);
    when(client.glossaries()).thenReturn(glossaryService);
    when(client.glossaryTerms()).thenReturn(glossaryTermService);
    when(client.teams()).thenReturn(teamService);
  }

  @Test
  void userCollection_twoInterleavedIteratorsEachSeeAllEntities() {
    // The bug-report scenario: two iterators from the SAME autoPaginate() collection, advanced
    // in interleaved fashion, must each see every entity exactly once, in order. Before the fix
    // it1 saw [u1..u4] and it2 saw [u1,u2,u5].
    stubUsers(
        pages(users("u1", "u2"), users("u3", "u4"), users("u5")), cursors("tok1", "tok2", null));

    UserCollection c = new UserCollection(client).autoPaginate();
    List<String> from1 = drainInterleaved(c.iterator(), c.iterator(), User::getName);

    assertEquals(Arrays.asList("u1", "u2", "u3", "u4", "u5"), from1, "iterator 1 lost/duplicated");
  }

  @Test
  void userCollection_interleavedIteratorsIssueIndependentPageRequests() {
    // Pins the call log: each iterator independently fetches page 1 (after=null), page 2
    // (after=tok1) and page 3 (after=tok2), for 6 list() calls total — no page duplicated to one
    // consumer and none skipped. Before the fix only 4 calls happened and pages were mis-delivered.
    stubUsers(
        pages(users("u1", "u2"), users("u3", "u4"), users("u5")), cursors("tok1", "tok2", null));

    UserCollection c = new UserCollection(client).autoPaginate();
    drainInterleaved(c.iterator(), c.iterator(), User::getName);

    List<ListParams> calls = captureUsers(6);
    Map<String, Integer> counts = new HashMap<>();
    for (ListParams p : calls) {
      counts.merge(p.getAfter() == null ? "<null>" : p.getAfter(), 1, Integer::sum);
    }
    assertEquals(
        2, counts.get("<null>"), "page 1 (after=null) must be requested once per iterator");
    assertEquals(2, counts.get("tok1"), "page 2 (after=tok1) must be requested once per iterator");
    assertEquals(2, counts.get("tok2"), "page 3 (after=tok2) must be requested once per iterator");
  }

  @Test
  void userCollection_nestedForEachIteratesAllPairs() {
    // Classic nested-loop usage: for (User a : users) for (User b : users) ...
    // The inner for-each must start an independent traversal; before the fix the shared cursor
    // truncated the inner loop and only 6 of 9 pairs were produced.
    stubUsers(pages(users("u1", "u2"), users("u3")), cursors("tok1", null));

    UserCollection c = new UserCollection(client).autoPaginate();
    List<String> pairs = new ArrayList<>();
    for (User a : c) {
      for (User b : c) {
        pairs.add(a.getName() + "/" + b.getName());
      }
    }
    assertEquals(
        Arrays.asList(
            "u1/u1", "u1/u2", "u1/u3", "u2/u1", "u2/u2", "u2/u3", "u3/u1", "u3/u2", "u3/u3"),
        pairs);
  }

  @Test
  void userCollection_streamInsideForEachIteratesAllPairs() {
    // Mix: a for-each loop with a users.stream() opened inside the body — guards that stream()
    // (which wraps a fresh AutoPaginatingIterator in a Spliterator) is independent of the
    // outer for-each, not of any shared collection cursor.
    stubUsers(pages(users("u1", "u2"), users("u3")), cursors("tok1", null));

    UserCollection c = new UserCollection(client).autoPaginate();
    List<String> pairs = new ArrayList<>();
    for (User a : c) {
      c.stream().forEach(b -> pairs.add(a.getName() + "/" + b.getName()));
    }
    assertEquals(
        Arrays.asList(
            "u1/u1", "u1/u2", "u1/u3", "u2/u1", "u2/u2", "u2/u3", "u3/u1", "u3/u2", "u3/u3"),
        pairs);
  }

  @Test
  void userCollection_autoIteratorDoesNotCorruptManualPaginationApi() {
    stubUsers(
        pages(users("u1", "u2"), users("u3", "u4"), users("u5")), cursors("tok1", "tok2", null));

    UserCollection c = new UserCollection(client).autoPaginate();
    Iterator<User> it = c.iterator();
    // Advance the auto-iterator across two pages.
    assertEquals("u1", it.next().getName());
    assertEquals("u2", it.next().getName());
    assertEquals("u3", it.next().getName());

    // The collection-level manual-pagination cursor must be untouched by the iterator.
    assertTrue(c.hasNextPage(), "collection cursor untouched by iterator");
    assertEquals(
        Arrays.asList("u1", "u2"),
        namesOf(c.getCurrentPage()),
        "getCurrentPage fetches page 1 fresh");
    assertTrue(c.nextPage(), "collection.nextPage() advances the collection cursor to page 2");
    assertEquals(Arrays.asList("u3", "u4"), namesOf(c.getCurrentPage()));

    // Draining the rest of the still-open iterator is independent and yields u4, u5.
    List<String> rest = new ArrayList<>();
    it.forEachRemaining(u -> rest.add(u.getName()));
    assertEquals(Arrays.asList("u4", "u5"), rest);
  }

  @Test
  void userCollection_manualPaginationApiDoesNotCorruptAutoIterator() {
    stubUsers(
        pages(users("u1", "u2"), users("u3", "u4"), users("u5")), cursors("tok1", "tok2", null));

    UserCollection c = new UserCollection(client).autoPaginate();
    // Drive the manual-pagination API to advance the collection cursor to page 2.
    c.getCurrentPage(); // fetches page 1
    assertTrue(c.nextPage()); // fetches page 2; collection cursor now at tok2/page 2
    assertEquals(Arrays.asList("u3", "u4"), namesOf(c.getCurrentPage()));

    // An auto-iterator opened afterwards must start fresh from page 1, not from page 2,
    // and must see every entity in order. Before the fix the iterator's initialize() called
    // reset() on the collection, so the collection cursor was destroyed.
    List<String> seen = drain(c.iterator(), User::getName);
    assertEquals(Arrays.asList("u1", "u2", "u3", "u4", "u5"), seen);

    // The collection cursor is preserved (the iterator must NOT have called reset() on it).
    assertEquals(
        Arrays.asList("u3", "u4"), namesOf(c.getCurrentPage()), "collection cursor preserved");
    assertTrue(c.nextPage(), "collection.nextPage() advances to page 3 from where it left off");
    assertEquals(Arrays.asList("u5"), namesOf(c.getCurrentPage()));
    assertFalse(c.hasNextPage());
  }

  @Test
  void allEightCollections_interleavedIterationIsIndependent() {
    // Smoke matrix: every one of the 8 fixed collection classes must yield all entities to two
    // interleaved iterators over the SAME autoPaginate() instance. Guards against a future
    // refactor re-introducing the shared cursor in any one of the eight files.
    stubUsers(pages(users("u1", "u2"), users("u3")), cursors("tok1", null));
    stubTables(pages(tables("t1", "t2"), tables("t3")), cursors("tok1", null));
    stubDatabases(pages(databases("d1", "d2"), databases("d3")), cursors("tok1", null));
    stubDatabaseSchemas(pages(schemas("s1", "s2"), schemas("s3")), cursors("tok1", null));
    stubPipelines(pages(pipelines("p1", "p2"), pipelines("p3")), cursors("tok1", null));
    stubGlossaries(pages(glossaries("g1", "g2"), glossaries("g3")), cursors("tok1", null));
    stubGlossaryTerms(pages(terms("gt1", "gt2"), terms("gt3")), cursors("tok1", null));
    stubTeams(pages(teams("tm1", "tm2"), teams("tm3")), cursors("tok1", null));

    assertEquals(
        Arrays.asList("u1", "u2", "u3"),
        drainInterleaved(
            new UserCollection(client).autoPaginate().iterator(),
            new UserCollection(client).autoPaginate().iterator(),
            User::getName));
    assertEquals(
        Arrays.asList("t1", "t2", "t3"),
        drainInterleaved(
            new TableCollection(client).autoPaginate().iterator(),
            new TableCollection(client).autoPaginate().iterator(),
            Table::getName));
    assertEquals(
        Arrays.asList("d1", "d2", "d3"),
        drainInterleaved(
            new DatabaseCollection(client).autoPaginate().iterator(),
            new DatabaseCollection(client).autoPaginate().iterator(),
            Database::getName));
    assertEquals(
        Arrays.asList("s1", "s2", "s3"),
        drainInterleaved(
            new DatabaseSchemaCollection(client).autoPaginate().iterator(),
            new DatabaseSchemaCollection(client).autoPaginate().iterator(),
            DatabaseSchema::getName));
    assertEquals(
        Arrays.asList("p1", "p2", "p3"),
        drainInterleaved(
            new PipelineCollection(client).autoPaginate().iterator(),
            new PipelineCollection(client).autoPaginate().iterator(),
            Pipeline::getName));
    assertEquals(
        Arrays.asList("g1", "g2", "g3"),
        drainInterleaved(
            new GlossaryCollection(client).autoPaginate().iterator(),
            new GlossaryCollection(client).autoPaginate().iterator(),
            Glossary::getName));
    assertEquals(
        Arrays.asList("gt1", "gt2", "gt3"),
        drainInterleaved(
            new GlossaryTermCollection(client).autoPaginate().iterator(),
            new GlossaryTermCollection(client).autoPaginate().iterator(),
            GlossaryTerm::getName));
    assertEquals(
        Arrays.asList("tm1", "tm2", "tm3"),
        drainInterleaved(
            new TeamCollection(client).autoPaginate().iterator(),
            new TeamCollection(client).autoPaginate().iterator(),
            Team::getName));
  }

  // =========================================================================
  // Helpers
  // =========================================================================

  /** Interleave two iterators one element at a time, fully draining both; return it1's names. */
  private static <T> List<String> drainInterleaved(
      Iterator<T> it1, Iterator<T> it2, Function<T, String> nameFn) {
    List<String> from1 = new ArrayList<>();
    List<String> from2 = new ArrayList<>();
    while (it1.hasNext() || it2.hasNext()) {
      if (it1.hasNext()) {
        from1.add(nameFn.apply(it1.next()));
      }
      if (it2.hasNext()) {
        from2.add(nameFn.apply(it2.next()));
      }
    }
    assertEquals(from1, from2, "interleaved iterators must produce identical results");
    return from1;
  }

  private static <T> List<String> drain(Iterator<T> it, Function<T, String> nameFn) {
    List<String> out = new ArrayList<>();
    while (it.hasNext()) {
      out.add(nameFn.apply(it.next()));
    }
    return out;
  }

  private static List<String> namesOf(List<User> users) {
    return users.stream().map(User::getName).collect(Collectors.toList());
  }

  /** Stub a service's {@code list(ListParams)} to behave like a real paginated server. */
  private static <T> Answer<ListResponse<T>> cursorPager(
      List<List<T>> pages, List<String> nextCursors, String... startCursors) {
    Map<String, List<T>> byAfter = new HashMap<>();
    byAfter.put(null, pages.get(0));
    for (String sc : startCursors) {
      byAfter.put(sc, pages.get(0));
    }
    for (int i = 0; i < nextCursors.size(); i++) {
      String cur = nextCursors.get(i);
      if (cur != null && i + 1 < pages.size()) {
        byAfter.put(cur, pages.get(i + 1));
      }
    }
    return invocation -> {
      ListParams p = invocation.getArgument(0);
      List<T> data = byAfter.get(p.getAfter());
      if (data == null) {
        throw new AssertionError("unexpected 'after' cursor in list() request: " + p.getAfter());
      }
      int idx = pages.indexOf(data);
      return response(data, nextCursors.get(idx));
    };
  }

  private static <T> ListResponse<T> response(List<T> data, String nextCursor) {
    return nextCursor == null
        ? new ListResponse<>(data)
        : new ListResponse<>(data, new AllModels.Paging().withAfter(nextCursor));
  }

  @SafeVarargs
  private static <T> List<List<T>> pages(List<T>... ps) {
    return Arrays.asList(ps);
  }

  private static List<String> cursors(String... cs) {
    return Arrays.asList(cs);
  }

  private static List<User> users(String... names) {
    List<User> out = new ArrayList<>();
    for (String n : names) {
      out.add(new User().withName(n));
    }
    return out;
  }

  private static List<Table> tables(String... names) {
    List<Table> out = new ArrayList<>();
    for (String n : names) {
      out.add(new Table().withName(n));
    }
    return out;
  }

  private static List<Database> databases(String... names) {
    List<Database> out = new ArrayList<>();
    for (String n : names) {
      out.add(new Database().withName(n));
    }
    return out;
  }

  private static List<DatabaseSchema> schemas(String... names) {
    List<DatabaseSchema> out = new ArrayList<>();
    for (String n : names) {
      out.add(new DatabaseSchema().withName(n));
    }
    return out;
  }

  private static List<Pipeline> pipelines(String... names) {
    List<Pipeline> out = new ArrayList<>();
    for (String n : names) {
      out.add(new Pipeline().withName(n));
    }
    return out;
  }

  private static List<Glossary> glossaries(String... names) {
    List<Glossary> out = new ArrayList<>();
    for (String n : names) {
      out.add(new Glossary().withName(n));
    }
    return out;
  }

  private static List<GlossaryTerm> terms(String... names) {
    List<GlossaryTerm> out = new ArrayList<>();
    for (String n : names) {
      out.add(new GlossaryTerm().withName(n));
    }
    return out;
  }

  private static List<Team> teams(String... names) {
    List<Team> out = new ArrayList<>();
    for (String n : names) {
      out.add(new Team().withName(n));
    }
    return out;
  }

  private void stubUsers(List<List<User>> pages, List<String> nextCursors, String... startCursors) {
    when(userService.list(any(ListParams.class)))
        .thenAnswer(cursorPager(pages, nextCursors, startCursors));
  }

  private void stubTables(
      List<List<Table>> pages, List<String> nextCursors, String... startCursors) {
    when(tableService.list(any(ListParams.class)))
        .thenAnswer(cursorPager(pages, nextCursors, startCursors));
  }

  private void stubDatabases(
      List<List<Database>> pages, List<String> nextCursors, String... startCursors) {
    when(databaseService.list(any(ListParams.class)))
        .thenAnswer(cursorPager(pages, nextCursors, startCursors));
  }

  private void stubDatabaseSchemas(
      List<List<DatabaseSchema>> pages, List<String> nextCursors, String... startCursors) {
    when(databaseSchemaService.list(any(ListParams.class)))
        .thenAnswer(cursorPager(pages, nextCursors, startCursors));
  }

  private void stubPipelines(
      List<List<Pipeline>> pages, List<String> nextCursors, String... startCursors) {
    when(pipelineService.list(any(ListParams.class)))
        .thenAnswer(cursorPager(pages, nextCursors, startCursors));
  }

  private void stubGlossaries(
      List<List<Glossary>> pages, List<String> nextCursors, String... startCursors) {
    when(glossaryService.list(any(ListParams.class)))
        .thenAnswer(cursorPager(pages, nextCursors, startCursors));
  }

  private void stubGlossaryTerms(
      List<List<GlossaryTerm>> pages, List<String> nextCursors, String... startCursors) {
    when(glossaryTermService.list(any(ListParams.class)))
        .thenAnswer(cursorPager(pages, nextCursors, startCursors));
  }

  private void stubTeams(List<List<Team>> pages, List<String> nextCursors, String... startCursors) {
    when(teamService.list(any(ListParams.class)))
        .thenAnswer(cursorPager(pages, nextCursors, startCursors));
  }

  private List<ListParams> captureUsers(int expectedCalls) {
    ArgumentCaptor<ListParams> captor = ArgumentCaptor.forClass(ListParams.class);
    verify(userService, times(expectedCalls)).list(captor.capture());
    return captor.getAllValues();
  }
}
