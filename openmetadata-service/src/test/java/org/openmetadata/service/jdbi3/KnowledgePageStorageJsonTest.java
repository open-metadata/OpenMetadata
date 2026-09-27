package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.CALLS_REAL_METHODS;
import static org.mockito.Mockito.mock;

import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Article;
import org.openmetadata.schema.entity.data.Page;
import org.openmetadata.schema.entity.data.PageType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;

/**
 * editors and owners are derived from relationships (EDITED_BY and OWNS), so a copy of either in
 * the stored json is a second source of truth that setFields will hand back to any caller that did
 * not ask for the field.
 *
 * <p>owners is covered for every entity by EntityRepository's own stripped-field list; editors is
 * owned by this repository alone. Before the override, nothing persisted editors only because it is
 * absent from KNOWLEDGE_PATCH_FIELDS and so is null at store time -- a property of that field list,
 * not a guarantee, and one that would break silently if editors were ever added to it.
 */
class KnowledgePageStorageJsonTest {

  @Test
  void editorsAreStrippedFromTheStoredJson() {
    ObjectNode stored = storageJsonFor(article().withEditors(List.of(user("alice"))));

    assertFalse(stored.has("editors"), "editors is derived from EDITED_BY and must not be stored");
  }

  @Test
  void ownersAreStrippedFromTheStoredJson() {
    ObjectNode stored = storageJsonFor(article().withOwners(List.of(user("bob"))));

    assertFalse(stored.has("owners"), "owners is derived from OWNS and must not be stored");
  }

  @Test
  void theRestOfThePageIsStillStored() {
    ObjectNode stored = storageJsonFor(article().withEditors(List.of(user("alice"))));

    assertTrue(stored.has("name"), "stripping must not take the rest of the entity with it");
    assertTrue(stored.has("pageType"));
  }

  private static ObjectNode storageJsonFor(Page page) {
    KnowledgePageRepository repository = mock(KnowledgePageRepository.class, CALLS_REAL_METHODS);

    return repository.storageJsonNode(page);
  }

  private static EntityReference user(String name) {
    return new EntityReference().withId(UUID.randomUUID()).withType(Entity.USER).withName(name);
  }

  private static Page article() {
    return new Page().withName("runbook").withPageType(PageType.ARTICLE).withPage(new Article());
  }
}
