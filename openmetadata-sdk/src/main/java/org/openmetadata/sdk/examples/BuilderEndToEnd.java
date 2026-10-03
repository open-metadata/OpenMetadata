package org.openmetadata.sdk.examples;

public class BuilderEndToEnd {

  public static void main(String[] args) {
    // 6) Export/Import Glossary via CSV using fluent API
    String glossaryName = "Business Glossary"; // FQN with space as shown in UI
    try {
      String csv = org.openmetadata.sdk.fluent.Glossaries.exportCsv(glossaryName).toCsv();
      System.out.printf("Exported glossary '%s' CSV length=%d%n", glossaryName, csv.length());

      String dryRun =
          org.openmetadata.sdk.fluent.Glossaries.importCsv(glossaryName)
              .withData(csv)
              .dryRun()
              .execute();
      System.out.println("Glossary dry-run response: " + dryRun);

      String applied =
          org.openmetadata.sdk.fluent.Glossaries.importCsv(glossaryName).withData(csv).execute();
      System.out.println("Glossary import applied: " + applied);

      // Async export example (fluent)
      // Async export with fluent WebSocket support
      java.util.concurrent.CompletableFuture<String> job =
          org.openmetadata.sdk.fluent.Glossaries.exportCsv(glossaryName)
              .async()
              .withWebSocket() // prefer WS; falls back to polling automatically
              .waitForCompletion(30) // wait up to 30s for completion
              .onComplete(
                  result -> {
                    // When waiting, this callback receives the CSV content (or status string)
                    System.out.println(
                        "Async export completed. CSV preview:\n"
                            + result.substring(0, Math.min(result.length(), 200))
                            + (result.length() > 200 ? "..." : ""));
                  })
              .onError(err -> System.out.println("Async export error: " + err.getMessage()))
              .executeAsync();

      // Joining returns the CSV content (or status) when waiting for completion
      String asyncResult = job.join();
      System.out.println("Async export result : " + (asyncResult != null ? asyncResult : ""));
    } catch (Exception e) {
      System.out.println("Glossary export/import skipped or failed: " + e.getMessage());
    }
  }
}
