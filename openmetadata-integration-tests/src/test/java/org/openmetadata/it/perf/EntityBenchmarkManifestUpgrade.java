package org.openmetadata.it.perf;

import java.io.IOException;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.PosixFilePermissions;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.openmetadata.it.perf.EntityBenchmarkManifest.Request;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.JsonUtils;

/** Adds the shared column-page requests to an older fixture manifest without changing its server. */
public final class EntityBenchmarkManifestUpgrade {
  private static final String COLUMN_PAGE_PREFIX = "columns.page.";

  private EntityBenchmarkManifestUpgrade() {}

  public static void main(final String[] args) throws IOException {
    if (args.length != 2) {
      throw new IllegalArgumentException("Expected original-manifest.json new-manifest.json");
    }
    final var original =
        JsonUtils.readValue(Files.readString(Path.of(args[0])), EntityBenchmarkManifest.class);
    final var upgraded = addColumnPages(original);
    final Path output = Path.of(args[1]);
    Files.createFile(
        output, PosixFilePermissions.asFileAttribute(PosixFilePermissions.fromString("rw-------")));
    Files.writeString(output, JsonUtils.pojoToJson(upgraded));
  }

  private static EntityBenchmarkManifest addColumnPages(final EntityBenchmarkManifest manifest) {
    if (manifest.workloads().stream()
        .anyMatch(workload -> workload.name().startsWith(COLUMN_PAGE_PREFIX))) {
      throw new IllegalArgumentException("Column pages are already present");
    }
    final var workloads = new ArrayList<>(manifest.workloads());
    for (final int width : List.of(3, 100, 1000)) {
      final String authorization =
          request(manifest, "get.reader.minimal.id." + width).headers().get("Authorization");
      if (authorization == null || !authorization.startsWith("Bearer ")) {
        throw new IllegalArgumentException("The original reader token is required");
      }
      workloads.addAll(
          EntityBenchmarkReadWorkloads.create(
                  table(manifest, width), width, authorization.substring("Bearer ".length()))
              .stream()
              .filter(workload -> workload.name().startsWith(COLUMN_PAGE_PREFIX))
              .toList());
    }
    return new EntityBenchmarkManifest(manifest.baseUrl(), manifest.token(), workloads);
  }

  private static Table table(final EntityBenchmarkManifest manifest, final int width) {
    final String id =
        request(manifest, "get.minimal.id." + width).path().substring("/v1/tables/".length());
    final String encodedName =
        request(manifest, "get.minimal.name." + width)
            .path()
            .substring("/v1/tables/name/".length());
    final String name = URLDecoder.decode(encodedName, StandardCharsets.UTF_8);
    return new Table()
        .withId(UUID.fromString(id))
        .withFullyQualifiedName(name)
        .withDatabaseSchema(
            new EntityReference().withFullyQualifiedName(name.substring(0, name.lastIndexOf('.'))));
  }

  private static Request request(final EntityBenchmarkManifest manifest, final String name) {
    return manifest.workloads().stream()
        .filter(workload -> name.equals(workload.name()))
        .findFirst()
        .orElseThrow(() -> new IllegalArgumentException("Missing fixture request: " + name))
        .request();
  }
}
