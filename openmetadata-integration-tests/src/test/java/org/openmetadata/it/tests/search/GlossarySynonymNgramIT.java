package org.openmetadata.it.tests.search;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.openmetadata.it.factories.GlossaryTestFactory;
import org.openmetadata.it.search.IndexAliasInspector;
import org.openmetadata.it.search.SearchClient;
import org.openmetadata.it.server.ServerHandle;
import org.openmetadata.it.util.OssTestServer;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateGlossaryTerm;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.service.Entity;

/**
 * {@code synonyms.ngram} on the glossary term index indexes the 3–20-character n-grams of each
 * synonym but analyzes the query as whole words. A word inside a synonym still matches, and a query
 * costs one clause per word instead of one per n-gram. N-gramming the query as well took the
 * composite-alias search past the engine's 1024-clause limit on the glossary term shard, which
 * {@link SearchCountConsistencyIT} caught.
 */
@ExtendWith(TestNamespaceExtension.class)
class GlossarySynonymNgramIT {

  // An 80-letter word has 1,251 n-grams of 3–20 characters, more than the 1024 clauses a shard
  // accepts.
  private static final int LONG_WORD_LENGTH = 80;

  @Test
  void wordInsideSynonymMatchesAndLongQueryStaysUnderClauseLimit(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    ServerHandle server = OssTestServer.defaultHandle();
    String index = new IndexAliasInspector(server).indexNameFor(Entity.GLOSSARY_TERM);
    SearchClient search = new SearchClient(server);

    String word = RankingSupport.uniqueTerm(ns);
    String termId =
        client
            .glossaryTerms()
            .create(
                new CreateGlossaryTerm()
                    .withName(ns.prefix("synonym_term"))
                    .withGlossary(GlossaryTestFactory.createSimple(ns).getFullyQualifiedName())
                    .withDescription("synonyms.ngram coverage")
                    .withSynonyms(List.of("quarterly " + word + " forecast")))
            .getId()
            .toString();

    String fragment = word.substring(2, word.length() - 1);
    assertTrue(
        RankingSupport.awaitTrue(() -> matchingTerms(search, index, termId, fragment) == 1),
        "'" + fragment + "' is part of the synonym word '" + word + "' and must match it");

    String longWord =
        word.repeat(LONG_WORD_LENGTH / word.length() + 1).substring(0, LONG_WORD_LENGTH);
    assertThatCode(() -> matchingTerms(search, index, termId, longWord))
        .as(
            "an %d-letter query on synonyms.ngram must not exceed the clause limit",
            LONG_WORD_LENGTH)
        .doesNotThrowAnyException();
  }

  private static long matchingTerms(
      SearchClient search, String index, String termId, String query) {
    String body =
        "{\"size\":0,\"track_total_hits\":true,\"query\":{\"bool\":{"
            + "\"filter\":[{\"term\":{\"id.keyword\":\""
            + termId
            + "\"}}],"
            + "\"must\":[{\"match\":{\"synonyms.ngram\":\""
            + query
            + "\"}}]}}}";
    return search.search(index, body).path("hits").path("total").path("value").asLong();
  }
}
