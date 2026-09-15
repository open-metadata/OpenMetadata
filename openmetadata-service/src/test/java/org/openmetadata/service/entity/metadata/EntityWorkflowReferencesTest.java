package org.openmetadata.service.entity.metadata;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.entity.metadata.EntityWorkflowReferences.Rename;
import org.openmetadata.service.resources.feeds.MessageParser.EntityLink;

class EntityWorkflowReferencesTest {
  @Test
  void taskUpdatesRetainBatchOrderAndIndependentInputLists() {
    final var rows = new LinkedHashMap<String, String>();
    rows.put("first-task", "old-hash");
    rows.put("second-task", "intermediate-hash");
    final var updates = new LinkedHashMap<String, String>();
    updates.put("old-hash", "intermediate-hash");
    updates.put("intermediate-hash", "new-hash");
    final List<List<String>> submitted = new ArrayList<>();
    final var references =
        new EntityWorkflowReferences(
            (originals, replacements) -> {
              submitted.add(originals);
              submitted.add(replacements);
              for (int i = 0; i < originals.size(); i++) {
                final String original = originals.get(i);
                final String replacement = replacements.get(i);
                rows.replaceAll((id, hash) -> hash.equals(original) ? replacement : hash);
              }
              return new int[] {1, 2};
            },
            subtree -> {
              throw new AssertionError("Unexpected workflow write");
            });

    references.renameTasks(updates);
    updates.clear();
    assertEquals(Map.of("first-task", "new-hash", "second-task", "new-hash"), rows);
    assertEquals(
        List.of(List.of("old-hash", "intermediate-hash"), List.of("intermediate-hash", "new-hash")),
        submitted);
  }

  @Test
  void absentTaskUpdatesDoNoPersistenceWork() {
    final var references =
        new EntityWorkflowReferences(
            (originals, replacements) -> {
              throw new AssertionError("Unexpected task write");
            },
            subtree -> {
              throw new AssertionError("Unexpected workflow write");
            });
    references.renameTasks(null);
    references.renameTasks(Map.of());
  }

  @Test
  void workflowScopeMovesRootAndDescendantsWhilePreservingSiblingPrefixes() {
    final var rows = new LinkedHashMap<UUID, String>();
    final UUID root = UUID.randomUUID();
    final UUID child = UUID.randomUUID();
    final UUID sibling = UUID.randomUUID();
    final UUID otherType = UUID.randomUUID();
    rows.put(root, link("glossaryTerm", "a.b"));
    rows.put(child, link("glossaryTerm", "a.b.child"));
    rows.put(sibling, link("glossaryTerm", "a.bc"));
    rows.put(otherType, link("table", "a.b"));
    final List<EntityWorkflowReferences.Subtree> scopes = new ArrayList<>();
    final var references =
        new EntityWorkflowReferences(
            (originals, replacements) -> {
              throw new AssertionError("Unexpected task write");
            },
            subtree -> {
              scopes.add(subtree);
              final String prefix =
                  subtree.oldChildPrefix().substring(0, subtree.oldChildPrefix().length() - 1);
              rows.replaceAll(
                  (id, value) ->
                      value.equals(subtree.oldLink()) || value.startsWith(prefix)
                          ? value.replace(subtree.oldStem(), subtree.newStem())
                          : value);
              return 2;
            });

    references.renameInstances(new Rename("glossaryTerm", "a.b", "new.parent"));
    assertEquals(1, scopes.size());
    assertEquals(link("glossaryTerm", "new.parent"), rows.get(root));
    assertEquals(link("glossaryTerm", "new.parent.child"), rows.get(child));
    assertEquals(link("glossaryTerm", "a.bc"), rows.get(sibling));
    assertEquals(link("table", "a.b"), rows.get(otherType));
  }

  @Test
  void missingWorkflowRowsRemainAValidRename() {
    final List<EntityWorkflowReferences.Subtree> scopes = new ArrayList<>();
    final var references =
        new EntityWorkflowReferences(
            (originals, replacements) -> new int[0],
            subtree -> {
              scopes.add(subtree);
              return 0;
            });
    references.renameInstances(new Rename("glossaryTerm", "old", "new"));
    assertEquals(1, scopes.size());
    assertEquals(link("glossaryTerm", "old"), scopes.getFirst().oldLink());
  }

  @Test
  void persistenceFailuresPropagateToTheOwningTransaction() {
    final var failure = new IllegalStateException("rename failed");
    final var references =
        new EntityWorkflowReferences(
            (originals, replacements) -> {
              throw failure;
            },
            subtree -> {
              throw failure;
            });
    assertSame(
        failure,
        assertThrows(
            IllegalStateException.class, () -> references.renameTasks(Map.of("old", "new"))));
    assertSame(
        failure,
        assertThrows(
            IllegalStateException.class,
            () -> references.renameInstances(new Rename("glossaryTerm", "old", "new"))));
  }

  private String link(final String type, final String fqn) {
    return new EntityLink(type, fqn).getLinkString();
  }
}
