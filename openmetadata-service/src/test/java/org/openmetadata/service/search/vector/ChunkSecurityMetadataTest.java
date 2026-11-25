package org.openmetadata.service.search.vector;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.search.vector.client.EmbeddingClient;

class ChunkSecurityMetadataTest {
  @Test
  void domainChunksCarryTheirOwnDomainIdentityForConditionalPolicies() {
    Domain domain =
        new Domain()
            .withId(UUID.randomUUID())
            .withName("Finance")
            .withFullyQualifiedName("Finance");
    assertEquals(
        List.of(
            Map.of(
                "id",
                domain.getId().toString(),
                "name",
                "Finance",
                "fullyQualifiedName",
                "Finance")),
        ChunkSecurityMetadata.fields(domain).get("domains"));
  }

  @Test
  void everyChunkCarriesParentPolicyFieldsIncludingInlineChildTags() {
    Table table = table();
    table
        .withDomains(List.of(reference("Finance")))
        .withOwners(List.of(reference("alice")))
        .withService(reference("warehouse"))
        .withColumns(
            List.of(
                new Column()
                    .withName("account")
                    .withDataType(ColumnDataType.STRING)
                    .withTags(List.of(new TagLabel().withTagFQN("PII.Sensitive")))));
    EmbeddingClient client = mock(EmbeddingClient.class);
    when(client.isAvailable()).thenReturn(true);
    when(client.getDimension()).thenReturn(3);
    when(client.embed(anyString())).thenReturn(new float[] {1, 0, 0});

    List<Map<String, Object>> chunks = VectorDocBuilder.fromEntity(table, client);

    assertTrue(chunks.size() > 1, "exercise later passages as well as chunk zero");
    for (Map<String, Object> chunk : chunks) {
      assertEquals(ChunkSecurityMetadata.VERSION, chunk.get(ChunkSecurityMetadata.VERSION_FIELD));
      assertEquals(
          ChunkSecurityMetadata.fingerprint(table),
          chunk.get(ChunkSecurityMetadata.FINGERPRINT_FIELD));
      assertEquals(List.of("PII.Sensitive"), chunk.get("policyTags"));
      assertTrue(
          chunk
              .get("domains")
              .toString()
              .contains(table.getDomains().getFirst().getId().toString()));
      assertTrue(
          chunk.get("owners").toString().contains(table.getOwners().getFirst().getId().toString()));
      assertTrue(chunk.get("service").toString().contains(table.getService().getId().toString()));
    }
  }

  @Test
  void ownerAndDomainIdentityChangesRestampWithoutChangingEmbeddedContent() {
    Table table =
        table().withDomains(List.of(reference("Finance"))).withOwners(List.of(reference("alice")));
    String content = VectorDocBuilder.computeFingerprintForEntity(table);
    String security = ChunkSecurityMetadata.fingerprint(table);
    var header =
        new AbstractVectorIndexService.ChunkHeader(
            content, 2, VectorDocBuilder.CHUNK_DOC_VERSION, null, null, null, security);
    assertEquals(
        AbstractVectorIndexService.ChunkRefresh.NONE,
        AbstractVectorIndexService.chunkRefresh(table, content, header));

    table.withOwners(List.of(reference("alice")));
    assertEquals(content, VectorDocBuilder.computeFingerprintForEntity(table));
    assertNotEquals(security, ChunkSecurityMetadata.fingerprint(table));
    assertEquals(
        AbstractVectorIndexService.ChunkRefresh.RESTAMP,
        AbstractVectorIndexService.chunkRefresh(table, content, header));

    table.withDomains(List.of(reference("Finance")));
    assertEquals(content, VectorDocBuilder.computeFingerprintForEntity(table));
    assertEquals(
        AbstractVectorIndexService.ChunkRefresh.RESTAMP,
        AbstractVectorIndexService.chunkRefresh(table, content, header));
  }

  @Test
  void legacyChunkHeadersRequireRestampingAndReferenceOrderIsStable() {
    EntityReference first = reference("first");
    EntityReference second = reference("second");
    Table table = table().withOwners(List.of(first, second));
    String fingerprint = ChunkSecurityMetadata.fingerprint(table);
    table.withOwners(List.of(second, first));
    assertEquals(fingerprint, ChunkSecurityMetadata.fingerprint(table));
    String content = VectorDocBuilder.computeFingerprintForEntity(table);
    var legacy = new AbstractVectorIndexService.ChunkHeader(content, 2, 8, null, null, null, null);
    assertEquals(
        AbstractVectorIndexService.ChunkRefresh.RESTAMP,
        AbstractVectorIndexService.chunkRefresh(table, content, legacy));
  }

  @Test
  void reviewerIdentityIsIncludedForEntitiesThatSupportReviewers() {
    GlossaryTerm term = new GlossaryTerm().withReviewers(List.of(reference("reviewer")));
    String before = ChunkSecurityMetadata.fingerprint(term);
    assertTrue(
        ChunkSecurityMetadata.fields(term)
            .get("reviewers")
            .toString()
            .contains(term.getReviewers().getFirst().getId().toString()));
    term.withReviewers(List.of(reference("reviewer")));
    assertNotEquals(before, ChunkSecurityMetadata.fingerprint(term));
  }

  private static Table table() {
    return new Table()
        .withId(UUID.randomUUID())
        .withName("orders")
        .withFullyQualifiedName("warehouse.db.schema.orders")
        .withDescription("revenue ".repeat(900));
  }

  private static EntityReference reference(String name) {
    return new EntityReference()
        .withId(UUID.randomUUID())
        .withName(name)
        .withFullyQualifiedName(name);
  }
}
