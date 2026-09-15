package org.openmetadata.service.entity.bootstrap;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;

/** Reads seed resources in discovery order while recording individual seed failures. */
@Slf4j
public final class EntitySeedResources {
  @FunctionalInterface
  public interface Finder {
    List<String> find(String pattern) throws IOException;
  }

  @FunctionalInterface
  public interface Reader {
    String read(String resource) throws IOException;
  }

  public record Source(Finder finder, Reader reader) {}

  private static final String SEPARATOR_PLACEHOLDER = "<separator>";
  private final Source source;
  private final Runnable recordFailure;

  public EntitySeedResources(final Source source, final Runnable recordFailure) {
    this.source = source;
    this.recordFailure = recordFailure;
  }

  public <T> List<T> read(final String type, final String pattern, final Class<T> entityClass)
      throws IOException {
    final List<T> entities = new ArrayList<>();
    for (final String resource : source.finder().find(pattern)) {
      try {
        final String json =
            source.reader().read(resource).replace(SEPARATOR_PLACEHOLDER, Entity.SEPARATOR);
        entities.add(JsonUtils.readValue(json, entityClass));
      } catch (IOException | RuntimeException failure) {
        recordFailure.run();
        LOG.warn("Failed to initialize the {} from file {}", type, resource, failure);
      }
    }
    return entities;
  }
}
