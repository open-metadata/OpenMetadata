package org.openmetadata.service.search.vector;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.StreamSupport;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.ContextMemoryRepository;
import org.openmetadata.service.resources.context.ContextMemoryDocumentAccess;
import org.openmetadata.service.resources.context.ContextMemoryVisibility;
import org.openmetadata.service.search.indexes.ContextMemoryIndex;
import org.openmetadata.service.search.security.ContextMemorySearchVisibility;
import org.openmetadata.service.search.vector.AbstractVectorIndexService.MemoryKind;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

/** Indexed visibility is only a candidate filter; memory revocation must survive failed vector writes. */
@Slf4j
final class VectorMemoryAdmission {
  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final List<String> DOCUMENT_LINKS =
      List.of("sourceFile", "sourceEntity", "primaryEntity", "relatedEntities");

  private VectorMemoryAdmission() {}

  static JsonNode retain(JsonNode hits, VectorSearchParameters parameters) {
    Map<UUID, ContextMemory> current = currentMemories(hits, parameters);
    ArrayNode admitted = MAPPER.createArrayNode();
    for (JsonNode hit : hits) {
      JsonNode source = hit.path("_source");
      if (!isMemory(source)) admitted.add(hit);
      else {
        ContextMemory memory = current.get(parentId(hit));
        if (memory != null && matchesSnapshot(source, memory))
          admitted.add(redacted(hit, memory, parameters.subjectContext()));
      }
    }
    return admitted;
  }

  private static Map<UUID, ContextMemory> currentMemories(
      JsonNode hits, VectorSearchParameters parameters) {
    Map<UUID, ContextMemory> current = new HashMap<>();
    List<UUID> ids = memoryIds(hits);
    if (!ids.isEmpty()) {
      try {
        for (ContextMemory memory : visibleMemories(ids, parameters)) {
          if (searchable(memory, parameters, callerName(parameters.subjectContext())))
            current.put(memory.getId(), memory);
        }
      } catch (RuntimeException failure) {
        LOG.warn("Hiding vector memories whose current access could not be established", failure);
        current.clear();
      }
    }
    return current;
  }

  private static List<UUID> memoryIds(JsonNode hits) {
    return StreamSupport.stream(hits.spliterator(), false)
        .filter(hit -> isMemory(hit.path("_source")))
        .map(VectorMemoryAdmission::parentId)
        .filter(Objects::nonNull)
        .distinct()
        .toList();
  }

  private static List<ContextMemory> visibleMemories(
      List<UUID> ids, VectorSearchParameters parameters) {
    ContextMemoryRepository repository =
        (ContextMemoryRepository) Entity.getEntityRepository(Entity.CONTEXT_MEMORY);
    String fields =
        ContextMemoryVisibility.guardFields(
            Entity.CONTEXT_MEMORY,
            String.join(",", new ContextMemoryIndex(null).getRequiredReindexFields()));
    List<ContextMemory> memories =
        repository.get(null, ids, repository.getOnlySupportedFields(fields), Include.NON_DELETED);
    boolean admin = parameters.subjectContext() != null && parameters.subjectContext().isAdmin();
    return ContextMemoryVisibility.filterByVisibility(
        memories, callerName(parameters.subjectContext()), admin);
  }

  private static boolean searchable(
      ContextMemory memory, VectorSearchParameters parameters, String caller) {
    return !Boolean.TRUE.equals(memory.getDeleted())
        && (ContextMemorySearchVisibility.SEARCHABLE_STATUSES.contains(memory.getEntityStatus())
            || (ContextMemorySearchVisibility.ownerStatuses(parameters.filters())
                    .contains(memory.getEntityStatus())
                && ContextMemoryVisibility.isOwnedBy(memory, caller)));
  }

  private static boolean matchesSnapshot(JsonNode source, ContextMemory memory) {
    return VectorDocBuilder.computeFingerprintForEntity(memory)
            .equals(source.path("fingerprint").asText(null))
        && Objects.equals(
            ContextMemoryIndex.statusValue(memory),
            source.path(ContextMemoryIndex.FIELD_STATUS).asText(null))
        && Objects.equals(
            ContextMemoryIndex.anchorId(memory),
            source.path(ContextMemoryIndex.FIELD_ANCHOR_ID).asText(null))
        && MemoryKind.of(memory).equals(MemoryKind.read(source));
  }

  private static JsonNode redacted(JsonNode hit, ContextMemory memory, SubjectContext subject) {
    ContextMemory copy = JsonUtils.deepCopy(memory, ContextMemory.class);
    ContextMemoryDocumentAccess.redactDocumentsAs(
        List.of(copy), callerName(subject), subject != null && subject.isAdmin());
    ObjectNode result = hit.deepCopy();
    ObjectNode source = (ObjectNode) result.path("_source");
    JsonNode current = MAPPER.valueToTree(copy);
    for (String field : DOCUMENT_LINKS) {
      if (source.has(field)) {
        if (current.hasNonNull(field)) source.set(field, current.get(field));
        else source.remove(field);
      }
    }
    return result;
  }

  private static boolean isMemory(JsonNode source) {
    return Entity.CONTEXT_MEMORY.equals(source.path("entityType").asText());
  }

  private static UUID parentId(JsonNode hit) {
    UUID id = null;
    try {
      id = UUID.fromString(hit.path("_source").path("parentId").asText(hit.path("_id").asText()));
    } catch (IllegalArgumentException ignored) {
      /* A malformed parent cannot authorize a memory. */
    }
    return id;
  }

  private static String callerName(SubjectContext subject) {
    return subject == null || subject.user() == null ? null : subject.user().getName();
  }
}
