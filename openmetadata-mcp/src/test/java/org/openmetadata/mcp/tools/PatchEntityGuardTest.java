package org.openmetadata.mcp.tools;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mockStatic;

import jakarta.json.Json;
import jakarta.json.JsonArray;
import java.io.StringReader;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.domains.DataProduct;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.Entity;

/**
 * The one thing {@code patch_entity} does not do blindly.
 *
 * <p>A JSONPatch is applied exactly as written, which is the contract callers want and the REST API
 * offers. The exception is a path that silently empties a list: {@code /owners} and {@code
 * /owners/-} differ by two characters and mean opposite things, and getting it wrong deleted owners
 * during testing while returning success.
 */
class PatchEntityGuardTest {

  private static final String TYPE = "table";
  private static final String FQN = "svc.db.schema.orders";

  private final ArgumentCaptor<String> fields = ArgumentCaptor.forClass(String.class);

  private static JsonArray patch(String json) {
    return Json.createReader(new StringReader(json)).readArray();
  }

  private static Table owned() {
    Table table = new Table().withName("orders");
    table.setOwners(List.of(new EntityReference().withName("alice").withType("user")));
    table.setTags(List.of(new TagLabel().withTagFQN("Tier.Tier1")));
    return table;
  }

  private static void guard(String json, Map<String, Object> params, Table stored) {
    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      entity
          .when(() -> Entity.getEntityByName(anyString(), anyString(), anyString(), any()))
          .thenReturn(stored);
      PatchEntityTool.guardArrayReplacement(TYPE, FQN, patch(json), params);
    }
  }

  @Test
  void replacingAPopulatedOwnerListIsRefused() {
    IllegalArgumentException failure =
        assertThrows(
            IllegalArgumentException.class,
            () ->
                guard(
                    "[{\"op\":\"replace\",\"path\":\"/owners\",\"value\":[{\"id\":\"x\"}]}]",
                    Map.of(),
                    owned()));

    assertTrue(
        failure.getMessage().contains("/owners/-"),
        "the error has to carry the path that appends, or the caller cannot act on it. Was: "
            + failure.getMessage());
    assertTrue(
        failure.getMessage().contains("Nothing was changed"),
        "the caller must know the write did not happen before retrying");
  }

  @Test
  void anAddToTheWholeArrayIsRefusedToo() {
    // 'add' with the array itself as the path replaces the array; only '/owners/-' extends it.
    // This is the exact shape that wiped owners in testing, and it does not read as destructive.
    assertThrows(
        IllegalArgumentException.class,
        () ->
            guard(
                "[{\"op\":\"add\",\"path\":\"/owners\",\"value\":[{\"id\":\"x\"}]}]",
                Map.of(),
                owned()));
  }

  @Test
  void appendingToTheEndIsLeftAlone() {
    assertDoesNotThrow(
        () ->
            guard(
                "[{\"op\":\"add\",\"path\":\"/owners/-\",\"value\":{\"id\":\"x\"}}]",
                Map.of(),
                owned()));
  }

  @Test
  void removingOneEntryByIndexIsLeftAlone() {
    assertDoesNotThrow(
        () -> guard("[{\"op\":\"remove\",\"path\":\"/owners/0\"}]", Map.of(), owned()));
  }

  @Test
  void anOrdinaryFieldEditNeverReadsTheEntity() {
    // No Entity mock at all: a patch that touches no guarded array must not look the entity up.
    assertDoesNotThrow(
        () ->
            PatchEntityTool.guardArrayReplacement(
                TYPE,
                FQN,
                patch("[{\"op\":\"replace\",\"path\":\"/description\",\"value\":\"d\"}]"),
                Map.of()));
  }

  @Test
  void replacingAnEmptyListIsNotWorthInterrupting() {
    Table empty = new Table().withName("orders");
    empty.setOwners(List.of());

    assertDoesNotThrow(
        () ->
            guard(
                "[{\"op\":\"replace\",\"path\":\"/owners\",\"value\":[{\"id\":\"x\"}]}]",
                Map.of(),
                empty));
  }

  @Test
  void aDeliberateReplacementIsAllowedThrough() {
    assertDoesNotThrow(
        () ->
            guard(
                "[{\"op\":\"replace\",\"path\":\"/owners\",\"value\":[{\"id\":\"x\"}]}]",
                Map.of("confirmReplace", true),
                owned()));
  }

  @ParameterizedTest
  @ValueSource(strings = {"owners", "tags", "reviewers", "domains", "experts", "dataProducts"})
  void everyGuardedArrayIsActuallyFetchedBeforeItIsJudged(String field) {
    // The guard has to READ the array to know it holds anything. Naming six arrays but requesting
    // three meant reviewers, experts and dataProducts came back empty, read as "nothing to lose",
    // and were wiped silently - the exact loss the guard exists to stop.
    DataProduct stored = new DataProduct().withName("orders");
    stored.setExperts(List.of(new EntityReference().withName("alice").withType("user")));

    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      entity
          .when(() -> Entity.getEntityByName(anyString(), anyString(), fields.capture(), any()))
          .thenReturn(stored);
      try {
        PatchEntityTool.guardArrayReplacement(
            TYPE,
            FQN,
            patch("[{\"op\":\"replace\",\"path\":\"/" + field + "\",\"value\":[]}]"),
            Map.of());
      } catch (IllegalArgumentException expected) {
        // Refusing is fine - what matters is which fields were requested.
      }
      assertTrue(
          fields.getValue().contains(field),
          "the guard judged '"
              + field
              + "' without asking for it; requested: "
              + fields.getValue());
    }
  }

  @Test
  void replacingTagsWholesaleIsGuardedBecauseItCarriesTheTier() {
    IllegalArgumentException failure =
        assertThrows(
            IllegalArgumentException.class,
            () ->
                guard("[{\"op\":\"replace\",\"path\":\"/tags\",\"value\":[]}]", Map.of(), owned()));

    assertTrue(failure.getMessage().contains("tags"), failure.getMessage());
  }
}
