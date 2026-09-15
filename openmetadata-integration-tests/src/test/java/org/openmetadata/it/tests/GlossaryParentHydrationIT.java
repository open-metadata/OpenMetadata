package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.List;
import org.apache.commons.lang3.tuple.ImmutablePair;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.factories.GlossaryTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.SqlQueryCounter;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateGlossaryTerm;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.GlossaryTermRepository;

@Isolated("Reproduces an old parent cached by a reader racing a glossary rename")
@ExtendWith(TestNamespaceExtension.class)
class GlossaryParentHydrationIT {
  @Test
  void bulkHydrationDoesNotOverwriteFreshParentWithCachedReference(TestNamespace ns) {
    final var client = SdkClients.adminClient();
    final var glossary = GlossaryTestFactory.createSimple(ns);
    final var parent =
        client
            .glossaryTerms()
            .create(
                new CreateGlossaryTerm()
                    .withName(ns.prefix("parent"))
                    .withGlossary(glossary.getFullyQualifiedName())
                    .withDescription("Parent"));
    final var child =
        client
            .glossaryTerms()
            .create(
                new CreateGlossaryTerm()
                    .withName(ns.prefix("child"))
                    .withGlossary(glossary.getFullyQualifiedName())
                    .withParent(parent.getFullyQualifiedName())
                    .withDescription("Child"));
    final var repository =
        (GlossaryTermRepository) Entity.getEntityRepository(Entity.GLOSSARY_TERM);
    final String oldParent =
        JsonUtils.pojoToJson(repository.find(parent.getId(), Include.ALL, false));
    final String renamed = ns.prefix("renamed");
    final var rename = JsonUtils.getObjectNode();
    rename.put("op", "replace").put("path", "/name").put("value", renamed);
    client.glossaries().patch(glossary.getId(), JsonUtils.valueToTree(List.of(rename)));
    final var key = new ImmutablePair<>(Entity.GLOSSARY_TERM, parent.getId());
    try (var queries = new SqlQueryCounter(Entity.getJdbi(), "from entity_relationship")) {
      EntityRepository.CACHE_WITH_ID.put(key, oldParent);
      final List<GlossaryTerm> hydrated =
          repository.get(
              null, List.of(child.getId()), repository.getFields("parent,glossary"), Include.ALL);
      assertEquals(
          renamed + "." + parent.getName(),
          hydrated.getFirst().getParent().getFullyQualifiedName());
      assertEquals(renamed, hydrated.getFirst().getGlossary().getFullyQualifiedName());
      assertEquals(2, queries.count(), "Parent and glossary edges are fetched once per batch");
    } finally {
      EntityRepository.CACHE_WITH_ID.invalidate(key);
    }
  }
}
