package org.openmetadata.service.rdf.generator;

import java.io.IOException;
import java.nio.file.*;
import java.util.concurrent.TimeUnit;
import lombok.extern.slf4j.Slf4j;

/**
 * Watches JSON schema files for changes and automatically regenerates RDF models.
 * This ensures RDF contexts and ontology stay in sync during development.
 */
@Slf4j
public class RdfSchemaWatcher {

  private final Path schemaPath;
  private final Path outputPath;
  private final WatchService watchService;
  private volatile boolean running = true;

  public RdfSchemaWatcher(String schemaPath, String outputPath) throws IOException {
    this.schemaPath = Paths.get(schemaPath);
    this.outputPath = Paths.get(outputPath);
    this.watchService = FileSystems.getDefault().newWatchService();
  }

  /**
   * Start watching for schema changes
   */
  public void start() throws IOException {
    // Register directories to watch
    registerDirectories(schemaPath);

    LOG.info("Started watching schemas at: {}", schemaPath);
    LOG.info("RDF models will be generated to: {}", outputPath);

    // Initial generation
    regenerateModels();

    // Watch for changes
    while (running) {
      try {
        WatchKey key = watchService.poll(1, TimeUnit.SECONDS);
        if (key != null) {
          processEvents(key);
          key.reset();
        }
      } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
        break;
      }
    }
  }

  /**
   * Stop watching
   */
  public void stop() {
    running = false;
    try {
      watchService.close();
    } catch (IOException e) {
      LOG.error("Error closing watch service", e);
    }
  }

  private void registerDirectories(Path root) throws IOException {
    Files.walk(root)
        .filter(Files::isDirectory)
        .forEach(
            dir -> {
              try {
                dir.register(
                    watchService,
                    StandardWatchEventKinds.ENTRY_CREATE,
                    StandardWatchEventKinds.ENTRY_DELETE,
                    StandardWatchEventKinds.ENTRY_MODIFY);
              } catch (IOException e) {
                LOG.error("Failed to register directory: {}", dir, e);
              }
            });
  }

  private void processEvents(WatchKey key) {
    boolean schemaChanged = false;

    for (WatchEvent<?> event : key.pollEvents()) {
      WatchEvent.Kind<?> kind = event.kind();

      if (kind == StandardWatchEventKinds.OVERFLOW) {
        continue;
      }

      @SuppressWarnings("unchecked")
      WatchEvent<Path> ev = (WatchEvent<Path>) event;
      Path filename = ev.context();

      if (filename.toString().endsWith(".json")) {
        LOG.info("Schema change detected: {} - {}", kind.name(), filename);
        schemaChanged = true;
      }
    }

    if (schemaChanged) {
      // Debounce - wait a bit for multiple changes to settle
      try {
        Thread.sleep(1000);
      } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
        return;
      }

      regenerateModels();
    }
  }

  private void regenerateModels() {
    try {
      LOG.info("Regenerating RDF models...");
      long startTime = System.currentTimeMillis();

      RdfModelGenerator generator =
          new RdfModelGenerator(schemaPath.toString(), outputPath.toString());
      generator.generateAll();

      long duration = System.currentTimeMillis() - startTime;
      LOG.info("RDF model generation completed in {} ms", duration);
    } catch (IOException e) {
      LOG.error("Failed to regenerate RDF models", e);
    }
  }

  /**
   * Main method to run the watcher standalone
   */
  public static void main(String[] args) throws IOException {
    if (args.length < 2) {
      System.err.println("Usage: RdfSchemaWatcher <schema-path> <output-path>");
      System.exit(1);
    }

    RdfSchemaWatcher watcher = new RdfSchemaWatcher(args[0], args[1]);

    // Add shutdown hook
    Runtime.getRuntime()
        .addShutdownHook(
            new Thread(
                () -> {
                  LOG.info("Shutting down schema watcher...");
                  watcher.stop();
                }));

    watcher.start();
  }
}
