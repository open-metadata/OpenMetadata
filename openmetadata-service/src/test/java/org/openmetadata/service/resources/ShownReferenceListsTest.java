package org.openmetadata.service.resources;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

import jakarta.json.Json;
import jakarta.json.JsonPatch;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.resources.EntityResource.ReferenceListField;
import org.openmetadata.service.resources.EntityResource.ShownReferenceLists;

/**
 * A caller shown a team's parents without a hidden one patches the parents as it was shown them,
 * and the hidden parent is written back
 * (ADR:2026-11-03-a-reference-list-names-only-entities-the-caller-may-view).
 */
class ShownReferenceListsTest {
  private static final List<ReferenceListField<Team>> PARENTS =
      List.of(new ReferenceListField<>("parents", Team::getParents, Team::setParents));

  private final EntityReference hidden = team("hidden");
  private final EntityReference shown = team("shown");
  private final EntityReference moved = team("moved");

  @Test
  void anIndexNamesTheEntryTheCallerWasShownAndTheHiddenOneStays() {
    Team written =
        write(
            storedWithParents(),
            "[{\"op\":\"replace\",\"path\":\"/parents/0\",\"value\":" + json(moved) + "}]");

    assertEquals(Set.of(hidden.getId(), moved.getId()), ids(written.getParents()));
  }

  @Test
  void removingTheWholeListKeepsTheHiddenEntries() {
    Team written = write(storedWithParents(), "[{\"op\":\"remove\",\"path\":\"/parents\"}]");

    assertEquals(Set.of(hidden.getId()), ids(written.getParents()));
  }

  @Test
  void operationsOnOtherFieldsAreWrittenAsSent() {
    Team stored = storedWithParents();
    JsonPatch patch =
        patch(
            "[{\"op\":\"add\",\"path\":\"/displayName\",\"value\":\"Renamed\"},"
                + "{\"op\":\"add\",\"path\":\"/parents/-\",\"value\":"
                + json(moved)
                + "}]");

    JsonPatch rewritten =
        ShownReferenceLists.patchOfShown(
            stored, patch, PARENTS, Set.of(hidden.getId()), Team.class);
    Team written = JsonUtils.applyPatch(stored, rewritten, Team.class);

    assertTrue(rewritten.toJsonArray().contains(patch.toJsonArray().getFirst()));
    assertEquals("Renamed", written.getDisplayName());
    assertEquals(Set.of(hidden.getId(), shown.getId(), moved.getId()), ids(written.getParents()));
  }

  @Test
  void anEntryCopiedOutOfTheListIsTheOneTheCallerWasShown() {
    Team stored = storedWithParents().withOwners(new ArrayList<>());

    Team written =
        write(stored, "[{\"op\":\"copy\",\"from\":\"/parents/0\",\"path\":\"/owners/0\"}]");

    assertEquals(
        List.of(shown.getId()), written.getOwners().stream().map(EntityReference::getId).toList());
    assertEquals(Set.of(hidden.getId(), shown.getId()), ids(written.getParents()));
  }

  @Test
  void aPatchReplacingTheDocumentIsWrittenAsSent() {
    JsonPatch patch = patch("[{\"op\":\"replace\",\"path\":\"\",\"value\":{}}]");

    assertSame(
        patch,
        ShownReferenceLists.patchOfShown(
            storedWithParents(), patch, PARENTS, Set.of(hidden.getId()), Team.class));
  }

  @Test
  void aPutKeepsEachHiddenEntryOnce() {
    List<EntityReference> written =
        ShownReferenceLists.withEntries(List.of(shown, hidden), List.of(hidden));

    assertEquals(
        List.of(shown.getId(), hidden.getId()),
        written.stream().map(EntityReference::getId).toList());
  }

  /** The hidden parent is stored first, so an index the caller sends names another stored entry. */
  private Team storedWithParents() {
    return new Team()
        .withId(UUID.randomUUID())
        .withName("child")
        .withFullyQualifiedName("child")
        .withParents(new ArrayList<>(List.of(hidden, shown)));
  }

  private Team write(Team stored, String patchJson) {
    JsonPatch rewritten =
        ShownReferenceLists.patchOfShown(
            stored, patch(patchJson), PARENTS, Set.of(hidden.getId()), Team.class);
    return JsonUtils.applyPatch(stored, rewritten, Team.class);
  }

  private static JsonPatch patch(String json) {
    return Json.createPatch(JsonUtils.readJson(json).asJsonArray());
  }

  private static String json(EntityReference reference) {
    return JsonUtils.pojoToJson(reference);
  }

  private static Set<UUID> ids(List<EntityReference> references) {
    return references.stream().map(EntityReference::getId).collect(Collectors.toSet());
  }

  private static EntityReference team(String name) {
    return new EntityReference()
        .withId(UUID.randomUUID())
        .withType("team")
        .withName(name)
        .withFullyQualifiedName(name);
  }
}
