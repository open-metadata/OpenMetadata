package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.ws.rs.core.Response;
import java.util.UUID;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.openmetadata.schema.api.context.CreateContextMemory;
import org.openmetadata.schema.api.data.CreateContextFile;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.context.ContextMemorySourceType;
import org.openmetadata.schema.entity.data.ContextFile;
import org.openmetadata.schema.entity.data.ProcessingStatus;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.test.util.RestClient;
import org.openmetadata.sdk.test.util.TestNamespace;
import org.openmetadata.sdk.test.util.TestNamespaceExtension;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.ContextMemoryRepository;

/**
 * End-to-end regression guard for the {@code sourceEntity} read-tiebreak divergence between the
 * single path (detail GET, {@code getSourceEntity}) and the bulk path (plain JDBI list,
 * {@code batchFetchSources}).
 *
 * <p>A reused memory can carry more than one {@code MENTIONED_IN} source edge; {@code sourceEntity}
 * is a singular projection over that edge set. Both read paths must tiebreak identically (entity
 * name sort, via {@link org.openmetadata.service.util.EntityUtil#compareEntityReference}), so the
 * plain list and the detail GET return the same source id. This test seeds a two-source memory
 * (mirroring what {@code ContextMemoryReconciler.linkExtractedMemory} produces) and asserts list vs
 * detail agreement, plus that neither source edge is silently dropped.
 */
@ExtendWith(TestNamespaceExtension.class)
class ContextMemorySourceEntityTiebreakIT {

  private static final String FILE_PATH = "v1/contextCenter/drive/files";
  private static final String MEMORY_PATH = "v1/contextCenter/memories";

  private ContextFile createFile(RestClient rest, String name) throws HttpResponseException {
    return rest.create(
        FILE_PATH,
        new CreateContextFile().withName(name).withProcessingStatus(ProcessingStatus.Uploaded),
        ContextFile.class);
  }

  private ContextMemory createExtractedMemory(RestClient rest, String name, ContextFile file)
      throws HttpResponseException {
    return rest.create(
        MEMORY_PATH,
        new CreateContextMemory()
            .withName(name)
            .withTitle(name)
            .withQuestion("What does " + name + " state?")
            .withAnswer("It states " + name + ".")
            .withSourceType(ContextMemorySourceType.FILE_EXTRACTION)
            .withSourceEntity(file.getEntityReference()),
        ContextMemory.class);
  }

  /**
   * Detail GET (single path) and the plain JDBI list (bulk path) must report the same
   * {@code sourceEntity.id} for a multi-source memory, and both source edges must survive. The
   * names are chosen so file A ("...alpha") sorts before file B ("...beta") under entity-name
   * order; both paths must therefore resolve {@code sourceEntity} to A.
   */
  @Test
  void listAndDetailAgreeOnSourceEntityForMultiSourceMemory(TestNamespace ns) throws Exception {
    RestClient rest = RestClient.admin();

    ContextFile fileA = createFile(rest, ns.prefix("source-alpha"));
    ContextFile fileB = createFile(rest, ns.prefix("source-beta"));
    // Sanity: the entity-name tiebreak is deterministic and A sorts first.
    assertTrue(
        fileA.getName().compareTo(fileB.getName()) < 0,
        "alpha source must sort before beta source by name");

    // Create the pill extracted from A (one MENTIONED_IN edge: fileA).
    ContextMemory memory = createExtractedMemory(rest, ns.prefix("shared-pill"), fileA);
    UUID memoryId = memory.getId();

    // Seed the multi-source state the way the reconciler does: link fileB as a second
    // MENTIONED_IN source via the public repository method (server runs in-process).
    ContextMemoryRepository repo =
        (ContextMemoryRepository) Entity.getEntityRepository(Entity.CONTEXT_MEMORY);
    EntityReference sourceB = fileB.getEntityReference();
    repo.linkExtractedMemory(memoryId, sourceB);

    // Detail GET (single path) -> name-first source = A.
    ContextMemory detail =
        rest.getById(MEMORY_PATH, memoryId, "sourceEntity,sourceFile", ContextMemory.class);
    assertNotNull(detail.getSourceEntity(), "detail GET must resolve a sourceEntity");
    assertEquals(
        fileA.getId(),
        detail.getSourceEntity().getId(),
        "detail GET (single path) must pick the name-first source (fileA)");

    // Plain JDBI list filtered by sourceEntityId=A with fields=sourceEntity,sourceFile (the
    // ExtractedMemoriesCard request shape: sourceEntityId filter, no offset/q/sortBy) -> bulk path.
    String listQueryParam =
        "?sourceEntityId=" + fileA.getId() + "&fields=sourceEntity,sourceFile&limit=200";
    JsonNode bulkEntity;
    try (Response response = rest.rawGet(MEMORY_PATH + listQueryParam)) {
      assertEquals(200, response.getStatus());
      JsonNode root = JsonUtils.readTree(response.readEntity(String.class));
      bulkEntity = null;
      for (JsonNode node : root.get("data")) {
        if (node.get("id").asText().equals(memoryId.toString())) {
          bulkEntity = node;
          break;
        }
      }
    }
    assertNotNull(bulkEntity, "plain list filtered by fileA must include the shared memory");
    assertTrue(bulkEntity.has("sourceEntity"), "bulk list must populate sourceEntity");
    assertEquals(
        fileA.getId().toString(),
        bulkEntity.get("sourceEntity").get("id").asText(),
        "plain JDBI list (bulk path) must pick the name-first source, matching detail GET");
    assertEquals(
        detail.getSourceEntity().getId().toString(),
        bulkEntity.get("sourceEntity").get("id").asText(),
        "list (bulk) and detail (single) must agree on sourceEntity id");

    // Neither source edge was silently dropped: the memory still appears under fileB's listing.
    String listByBQueryParam =
        "?sourceEntityId=" + fileB.getId() + "&fields=sourceEntity&limit=200";
    boolean stillUnderB;
    try (Response response = rest.rawGet(MEMORY_PATH + listByBQueryParam)) {
      assertEquals(200, response.getStatus());
      JsonNode root = JsonUtils.readTree(response.readEntity(String.class));
      stillUnderB = false;
      for (JsonNode node : root.get("data")) {
        if (node.get("id").asText().equals(memoryId.toString())) {
          stillUnderB = true;
          break;
        }
      }
    }
    assertTrue(stillUnderB, "fileB's MENTIONED_IN edge must survive linking (no silent data loss)");
    assertFalse(
        detail.getSourceEntity().getId().equals(fileB.getId()), "sanity: detail picked A, not B");
  }
}
