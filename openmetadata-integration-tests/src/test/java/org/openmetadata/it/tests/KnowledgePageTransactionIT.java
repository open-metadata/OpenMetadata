package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import jakarta.json.Json;
import java.io.StringReader;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.tests.EntityTransactionBoundaryIT.TransactionCounter;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.SqlFailureProbe;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreatePage;
import org.openmetadata.schema.entity.data.Article;
import org.openmetadata.schema.entity.data.Page;
import org.openmetadata.schema.entity.data.PageType;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.service.Entity;
import org.openmetadata.service.entity.write.EntityCommandActor;
import org.openmetadata.service.entity.write.EntityPatchService;
import org.openmetadata.service.jdbi3.KnowledgePageRepository;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.RequestEntityCache;

@Isolated("Counts owning transactions and fails a real page history write after a parent move")
@ExtendWith(TestNamespaceExtension.class)
class KnowledgePageTransactionIT {
  @Test
  void parentMoveCommitsOnceWithItsRelationshipsAndVersion(TestNamespace ns) {
    final var fixture = fixture(ns);
    final Page moved;
    try (var transactions = new TransactionCounter(Entity.getJdbi())) {
      moved = move(fixture);
      assertEquals(1, transactions.commits());
      assertEquals(0, transactions.rollbacks());
    }
    assertEquals(fixture.newName(), moved.getFullyQualifiedName());
    assertEquals(0, parentLinks(fixture.first(), fixture.child()));
    assertEquals(1, parentLinks(fixture.second(), fixture.child()));
    assertAliases(moved, fixture.second());
  }

  @Test
  void failedHistoryWriteRollsBackTheParentAndFqn(TestNamespace ns) {
    final var fixture = fixture(ns);
    try (var transactions = new TransactionCounter(Entity.getJdbi());
        var failure =
            new SqlFailureProbe(
                Entity.getJdbi(),
                "into entity_extension",
                () -> new IllegalStateException("Failure after page history insertion"))) {
      assertThrows(RuntimeException.class, () -> move(fixture));
      assertEquals(0, transactions.commits());
      assertEquals(1, transactions.rollbacks());
    }
    assertUnchanged(fixture);
  }

  @Test
  void enclosingTransactionOwnsTheMoveAndItsRollback(TestNamespace ns) {
    final var fixture = fixture(ns);
    try (var transactions = new TransactionCounter(Entity.getJdbi())) {
      assertThrows(
          IllegalStateException.class,
          () ->
              repository()
                  .executeInTransaction(
                      () -> {
                        move(fixture);
                        assertEquals(
                            fixture.newName(), stored(fixture.child()).getFullyQualifiedName());
                        assertEquals(1, parentLinks(fixture.second(), fixture.child()));
                        throw new IllegalStateException("Failure in enclosing page transaction");
                      }));
      assertEquals(0, transactions.commits());
      assertEquals(1, transactions.rollbacks());
    }
    assertUnchanged(fixture);
  }

  private Fixture fixture(TestNamespace ns) {
    final var pages = SdkClients.adminClient().pages();
    final var first = pages.create(request(ns.prefix("parentA")));
    final var second = pages.create(request(ns.prefix("parentB")));
    final var child =
        pages.create(request(ns.prefix("child")).withParent(first.getEntityReference()));
    assertAliases(child, first);
    return new Fixture(first, second, child);
  }

  private CreatePage request(String name) {
    return new CreatePage().withName(name).withPageType(PageType.ARTICLE).withPage(new Article());
  }

  private Page move(Fixture fixture) {
    final String patch =
        JsonUtils.pojoToJson(
            List.of(
                Map.of(
                    "op",
                    "add",
                    "path",
                    "/parent",
                    "value",
                    fixture.second().getEntityReference())));
    RequestEntityCache.clear();
    try (var reader = Json.createReader(new StringReader(patch))) {
      return repository()
          .patches()
          .patch(
              new EntityPatchService.Target.Id(fixture.child().getId()),
              Json.createPatch(reader.readArray()),
              new EntityCommandActor("admin", null),
              null,
              new EntityPatchService.Options(null, null))
          .entity();
    } finally {
      RequestEntityCache.clear();
    }
  }

  private void assertUnchanged(Fixture fixture) {
    final var stored = stored(fixture.child());
    assertEquals(fixture.child().getFullyQualifiedName(), stored.getFullyQualifiedName());
    assertEquals(fixture.child().getVersion(), stored.getVersion());
    assertEquals(1, parentLinks(fixture.first(), fixture.child()));
    assertEquals(0, parentLinks(fixture.second(), fixture.child()));
    assertAliases(fixture.child(), fixture.first());
    final var pages = SdkClients.adminClient().pages();
    assertEquals(1, pages.getVersionList(fixture.child().getId()).getVersions().size());
    assertEquals(
        404,
        assertThrows(OpenMetadataException.class, () -> pages.getByName(fixture.newName()))
            .getStatusCode());
  }

  private void assertAliases(Page expected, Page parent) {
    final var pages = SdkClients.adminClient().pages();
    for (final Page actual :
        List.of(
            pages.get(expected.getId().toString(), "parent"),
            pages.getByName(expected.getFullyQualifiedName(), "parent"))) {
      assertEquals(expected.getId(), actual.getId());
      assertEquals(expected.getFullyQualifiedName(), actual.getFullyQualifiedName());
      assertEquals(expected.getVersion(), actual.getVersion());
      assertEquals(parent.getId(), actual.getParent().getId());
    }
  }

  private Page stored(Page page) {
    final String json =
        Entity.getJdbi()
            .withHandle(
                handle ->
                    handle
                        .createQuery("SELECT json FROM knowledge_center WHERE id = :id")
                        .bind("id", page.getId().toString())
                        .mapTo(String.class)
                        .one());
    return JsonUtils.readValue(json, Page.class);
  }

  private long parentLinks(Page parent, Page child) {
    return Entity.getJdbi()
        .withHandle(
            handle ->
                handle
                    .createQuery(
                        "SELECT COUNT(*) FROM entity_relationship WHERE fromId = :parent AND toId = :child AND relation = :relation")
                    .bind("parent", parent.getId().toString())
                    .bind("child", child.getId().toString())
                    .bind("relation", Relationship.CONTAINS.ordinal())
                    .mapTo(Long.class)
                    .one());
  }

  private KnowledgePageRepository repository() {
    return (KnowledgePageRepository) Entity.getEntityRepository("page");
  }

  private record Fixture(Page first, Page second, Page child) {
    String newName() {
      return FullyQualifiedName.add(second.getFullyQualifiedName(), child.getName());
    }
  }
}
