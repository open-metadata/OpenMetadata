package org.openmetadata.service.rdf.extension;

import java.util.List;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.configuration.rdf.CustomOntology;

/**
 * In-memory registry of user-authored ontology extensions. Each extension is keyed by its
 * {@code name}. Reads are lock-free; writes are synchronized.
 *
 * <p>Persistence is intentionally deferred — admin writes that pass {@link
 * CustomOntologyValidator#validate(CustomOntology)} are upserted into this registry, and the
 * registry is rebuilt on server restart from any DB-backed store added in a future phase.
 */
@Slf4j
public final class CustomOntologyRegistry {

  private static final CustomOntologyRegistry INSTANCE = new CustomOntologyRegistry();

  public static CustomOntologyRegistry getInstance() {
    return INSTANCE;
  }

  // ConcurrentHashMap supports lock-free reads while writes mutate concurrently. Iteration order
  // is not preserved; {@link #list()} returns in whatever order ConcurrentHashMap chooses, which
  // is acceptable since the only stable contract here is "all current extensions".
  private final ConcurrentMap<String, CustomOntology> extensions = new ConcurrentHashMap<>();

  private CustomOntologyRegistry() {}

  /** @return all extensions; iteration order is not guaranteed. */
  public List<CustomOntology> list() {
    return List.copyOf(extensions.values());
  }

  public Optional<CustomOntology> get(String name) {
    return Optional.ofNullable(extensions.get(name));
  }

  /**
   * Insert or replace an extension. The caller is responsible for validation; this method does
   * none. Returns the previous extension at that name (if any).
   */
  public synchronized Optional<CustomOntology> upsert(CustomOntology extension) {
    return Optional.ofNullable(extensions.put(extension.getName(), extension));
  }

  /** @return true if the extension was removed. */
  public synchronized boolean delete(String name) {
    return extensions.remove(name) != null;
  }

  /** Visible for tests. */
  synchronized void resetForTests() {
    extensions.clear();
  }
}
