package org.openmetadata.service.security.policyevaluator;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.Entity;
import org.openmetadata.service.cache.CacheInvalidationPubSub;
import org.openmetadata.service.jdbi3.EntityDAO;
import org.openmetadata.service.security.policyevaluator.SubjectCachePeerSync.WatchedTable;

class SubjectCachePeerSyncTest {
  private static final UUID USER_ID = UUID.randomUUID();
  private static final UUID ROLE_ID = UUID.randomUUID();
  private static final UUID DOMAIN_ID = UUID.randomUUID();

  private final AtomicLong clock = new AtomicLong(1_000_000L);
  private final List<String> evicted = new ArrayList<>();
  private final AtomicInteger domainRenames = new AtomicInteger();
  private EntityDAO<?> userDao;
  private EntityDAO<?> roleDao;
  private EntityDAO<?> domainDao;
  private SubjectCachePeerSync sync;

  @BeforeEach
  void setUp() {
    userDao = dao("user_entity", 0);
    roleDao = dao("role_entity", 3);
    domainDao = dao("domain_entity", 0);
    rows(domainDao, DOMAIN_ID + "|" + clock.get() + "|Finance");
    sync =
        new SubjectCachePeerSync(
            List.of(new WatchedTable(Entity.USER, userDao), new WatchedTable(Entity.ROLE, roleDao)),
            domainDao,
            List.of((type, id, fqn) -> evicted.add(type + ":" + id + ":" + fqn)),
            domainRenames::incrementAndGet,
            clock::get);
    sync.start();
  }

  @AfterEach
  void tearDown() {
    sync.stop();
  }

  @Test
  void changedUserIsEvictedOnceUntilItChangesAgain() {
    rows(userDao, USER_ID + "|" + clock.get() + "|john.doe");
    sync.sync();
    sync.sync();
    rows(userDao, USER_ID + "|" + (clock.get() + 1) + "|john.doe");
    sync.sync();

    String expected = Entity.USER + ":" + USER_ID + ":\"john.doe\"";
    assertEquals(List.of(expected, expected), evicted);
  }

  @Test
  void eachPollRescansTheOverlapWindowBehindThePreviousPoll() {
    long firstPoll = clock.addAndGet(5_000);
    sync.sync();
    clock.addAndGet(5_000);
    sync.sync();

    verify(userDao).listChangedSince("user_entity", firstPoll - SubjectCachePeerSync.OVERLAP_MS);
  }

  @Test
  void hardDeletedRoleEvictsWithoutAnEntityReference() {
    when(roleDao.listTotalCount()).thenReturn(2);
    sync.sync();

    assertEquals(List.of(Entity.ROLE + ":null:null"), evicted);
  }

  @Test
  void changedRoleRowIsEvictedWithItsReference() {
    rows(roleDao, ROLE_ID + "|" + clock.get() + "|DataSteward");
    sync.sync();

    assertEquals(List.of(Entity.ROLE + ":" + ROLE_ID + ":DataSteward"), evicted);
  }

  @Test
  void renamedDomainDropsEveryUserContext() {
    rows(domainDao, DOMAIN_ID + "|" + (clock.get() + 1) + "|FinanceOps");
    sync.sync();

    assertEquals(1, domainRenames.get());
  }

  @Test
  void domainEditThatKeepsTheNameDropsNothing() {
    rows(domainDao, DOMAIN_ID + "|" + (clock.get() + 1) + "|Finance");
    sync.sync();

    assertEquals(0, domainRenames.get());
  }

  @Test
  void pollsUnlessRedisPubSubIsRunning() {
    CacheInvalidationPubSub running = mock(CacheInvalidationPubSub.class);
    when(running.isRunning()).thenReturn(true);
    CacheInvalidationPubSub failedToStart = mock(CacheInvalidationPubSub.class);

    assertTrue(SubjectCachePeerSync.isNeeded(null));
    assertTrue(SubjectCachePeerSync.isNeeded(failedToStart));
    assertFalse(SubjectCachePeerSync.isNeeded(running));
  }

  private static EntityDAO<?> dao(String table, int count) {
    EntityDAO<?> dao = mock(EntityDAO.class);
    when(dao.getTableName()).thenReturn(table);
    when(dao.listTotalCount()).thenReturn(count);
    when(dao.listChangedSince(anyString(), anyLong())).thenReturn(List.of());
    return dao;
  }

  private static void rows(EntityDAO<?> dao, String... rows) {
    when(dao.listChangedSince(anyString(), anyLong())).thenReturn(List.of(rows));
  }
}
