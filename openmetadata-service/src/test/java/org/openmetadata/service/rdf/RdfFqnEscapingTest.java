package org.openmetadata.service.rdf;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.Test;

public class RdfFqnEscapingTest {

  @Test
  void testFqnEscaping() {
    // Test various FQN patterns that appear in the failing tests
    String[] testFqns = {
      "simple.fqn.test",
      "\"quoted.fqn\".test",
      "\"databaseService_'-.&()[]司TableResourceTestb\".\"database_'+#- .()$𣿵TableResourceTest\".\"table\"",
      "test.\"component.with.dots\".table"
    };

    for (String fqn : testFqns) {
      System.out.println("Original FQN: " + fqn);

      // Test the escaping logic used in RdfTestUtils
      String escaped = fqn.replace("\\", "\\\\").replace("\"", "\\\"");
      System.out.println("Escaped FQN: " + escaped);

      // Build SPARQL snippet
      String sparqlSnippet = String.format("om:fullyQualifiedName \"%s\"", escaped);
      System.out.println("SPARQL snippet: " + sparqlSnippet);
      System.out.println("---");
    }
  }
}
