package org.openmetadata.it.perf;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.openmetadata.it.perf.EntityBenchmarkManifest.Workload;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.JsonUtils;

class EntityBenchmarkManifestUpgradeTest {
  @TempDir Path directory;

  @Test
  void addsTheSameColumnPagesWithoutChangingTheOriginalFixtureOrPrincipals() throws Exception {
    final var complete = new ArrayList<Workload>();
    for (final int width : List.of(3, 100, 1000)) {
      final var table =
          new Table()
              .withId(UUID.randomUUID())
              .withFullyQualifiedName("service.db.schema.table_" + width)
              .withDatabaseSchema(
                  new EntityReference().withFullyQualifiedName("service.db.schema"));
      complete.addAll(EntityBenchmarkReadWorkloads.create(table, width, "reader-token"));
    }
    final var original =
        new EntityBenchmarkManifest(
            "http://127.0.0.1:8585",
            "admin-token",
            complete.stream()
                .filter(workload -> !workload.name().startsWith("columns.page."))
                .toList());
    final Path input = directory.resolve("original.json");
    final Path output = directory.resolve("upgraded.json");
    final String originalJson = JsonUtils.pojoToJson(original);
    Files.writeString(input, originalJson);
    EntityBenchmarkManifestUpgrade.main(new String[] {input.toString(), output.toString()});
    final var upgraded =
        JsonUtils.readValue(Files.readString(output), EntityBenchmarkManifest.class);
    assertEquals(originalJson, Files.readString(input));
    assertEquals(original.token(), upgraded.token());
    assertEquals(original.baseUrl(), upgraded.baseUrl());
    assertEquals(original.workloads().size() + 36, upgraded.workloads().size());
    assertEquals(
        complete.stream().filter(workload -> workload.name().startsWith("columns.page.")).toList(),
        upgraded.workloads().subList(original.workloads().size(), upgraded.workloads().size()));
    final Path duplicate = directory.resolve("duplicate.json");
    assertThrows(
        IllegalArgumentException.class,
        () ->
            EntityBenchmarkManifestUpgrade.main(
                new String[] {output.toString(), duplicate.toString()}));
    assertFalse(Files.exists(duplicate));
  }

  @Test
  void incompleteOriginalFixturesCannotProduceAPartialUpgrade() throws Exception {
    final Path input = directory.resolve("original.json");
    final Path output = directory.resolve("upgraded.json");
    Files.writeString(
        input,
        JsonUtils.pojoToJson(
            new EntityBenchmarkManifest("http://127.0.0.1:8585", "admin-token", List.of())));
    assertThrows(
        IllegalArgumentException.class,
        () ->
            EntityBenchmarkManifestUpgrade.main(
                new String[] {input.toString(), output.toString()}));
    assertFalse(Files.exists(output));
  }
}
