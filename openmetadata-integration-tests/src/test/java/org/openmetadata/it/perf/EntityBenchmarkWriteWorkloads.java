package org.openmetadata.it.perf;

import static org.openmetadata.it.perf.EntityBenchmarkManifest.Request.json;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.IntStream;
import org.openmetadata.it.perf.EntityBenchmarkManifest.Checks;
import org.openmetadata.it.perf.EntityBenchmarkManifest.Completion;
import org.openmetadata.it.perf.EntityBenchmarkManifest.Request;
import org.openmetadata.it.perf.EntityBenchmarkManifest.Workload;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.utils.JsonUtils;

/** Supplies independent mutation fixtures for each warmup and measured request. */
final class EntityBenchmarkWriteWorkloads {
  private static final String TABLES = "/v1/tables";
  private static final String BULK = TABLES + "/bulk?async=false";
  private static final int BULK_SIZE = 3;

  private enum BulkMode {
    CREATE,
    DUPLICATE,
    UNCHANGED,
    CHANGED,
    MIXED
  }

  private EntityBenchmarkWriteWorkloads() {}

  static List<Workload> create(final CreateTable template, final int columns) {
    final List<Workload> workloads = new ArrayList<>();
    workloads.add(put("put.unchanged." + columns, template, false));
    workloads.add(put("put.changed." + columns, template, true));
    workloads.add(patch("patch.description." + columns, template, "/description", false));
    workloads.add(patch("patch.column." + columns, template, "/columns/0/description", false));
    workloads.add(new Workload("create." + columns, List.of(), post(named(template, "created"))));
    for (final BulkMode mode : BulkMode.values()) workloads.add(bulk(template, columns, mode));
    workloads.add(asyncBulk(template, columns, false));
    workloads.add(asyncBulk(template, columns, true));
    workloads.add(delete(template, columns, false));
    workloads.add(delete(template, columns, true));
    workloads.add(restore(template, columns));
    workloads.add(patch("patch.conflict." + columns, template, "/description", true));
    return List.copyOf(workloads);
  }

  private static Workload put(
      final String name, final CreateTable template, final boolean changed) {
    final CreateTable create = named(template, name.replace('.', '_'));
    final Request setup = post(create);
    if (changed) create.setDescription("Changed description");
    return new Workload(
        name, List.of(setup), json("PUT", TABLES, JsonUtils.pojoToJson(create), 200));
  }

  private static Workload patch(
      final String name, final CreateTable template, final String field, final boolean conflict) {
    final CreateTable create = named(template, name.replace('.', '_'));
    final String body =
        "[{\"op\":\"add\",\"path\":\"" + field + "\",\"value\":\"Patched description\"}]";
    final Request request =
        conflict
            ? new Request(
                "PATCH",
                byName(create),
                Map.of("Content-Type", "application/json-patch+json", "If-Match", "W/\"0.0\""),
                body,
                412)
            : json("PATCH", byName(create), body, 200);
    return new Workload(name, List.of(post(create)), request);
  }

  private static Workload bulk(final CreateTable template, final int columns, final BulkMode mode) {
    final String name = "bulk." + mode.name().toLowerCase(Locale.ROOT) + "." + columns;
    final List<CreateTable> tables =
        IntStream.range(0, BULK_SIZE)
            .mapToObj(
                index ->
                    named(
                        template,
                        name.replace('.', '_') + "_" + (mode == BulkMode.DUPLICATE ? 0 : index)))
            .toList();
    final List<Request> setup = bulkSetup(tables, mode);
    if (mode == BulkMode.CHANGED) tables.forEach(table -> table.setDescription("Changed in bulk"));
    if (mode == BulkMode.MIXED) tables.getFirst().setDescription("Changed in mixed bulk");
    return new Workload(
        name,
        setup,
        json("PUT", BULK, JsonUtils.pojoToJson(tables), 200),
        new Checks(BULK_SIZE, false));
  }

  private static List<Request> bulkSetup(final List<CreateTable> tables, final BulkMode mode) {
    return switch (mode) {
      case CREATE, DUPLICATE -> List.of();
      case UNCHANGED, CHANGED -> List.of(json("PUT", BULK, JsonUtils.pojoToJson(tables), 200));
      case MIXED -> List.of(json("PUT", BULK, JsonUtils.pojoToJson(tables.subList(0, 2)), 200));
    };
  }

  private static Workload asyncBulk(
      final CreateTable template, final int columns, final boolean measureCompletion) {
    final String name = "bulk.async." + (measureCompletion ? "completion." : "accepted.") + columns;
    final List<CreateTable> tables =
        IntStream.range(0, BULK_SIZE)
            .mapToObj(index -> named(template, name.replace('.', '_') + "_" + index))
            .toList();
    final List<Request> setup = bulkSetup(tables, BulkMode.MIXED);
    tables.forEach(table -> table.setDescription("Changed asynchronously"));
    final var completion =
        new Completion(
            tables.stream().map(EntityBenchmarkWriteWorkloads::byName).toList(),
            Map.of("description", "Changed asynchronously"),
            measureCompletion,
            60_000);
    return new Workload(
        name,
        setup,
        json("PUT", TABLES + "/bulk?async=true", JsonUtils.pojoToJson(tables), 202),
        new Checks(BULK_SIZE, false, completion));
  }

  private static Workload delete(
      final CreateTable template, final int columns, final boolean hard) {
    final String name = "delete." + (hard ? "hard." : "soft.") + columns;
    final CreateTable create = named(template, name.replace('.', '_'));
    return new Workload(
        name,
        List.of(post(create)),
        json("DELETE", byName(create) + "?hardDelete=" + hard + "&recursive=true", null, 200));
  }

  private static Workload restore(final CreateTable template, final int columns) {
    final String name = "restore." + columns;
    final CreateTable create = named(template, name.replace('.', '_'));
    return new Workload(
        name,
        List.of(post(create), json("DELETE", byName(create) + "?hardDelete=false", null, 200)),
        json("PUT", TABLES + "/restore", "{\"id\":\"${entityId}\"}", 200),
        new Checks(null, true));
  }

  private static CreateTable named(final CreateTable template, final String prefix) {
    return JsonUtils.deepCopy(template, CreateTable.class).withName(prefix + "_${sequence}");
  }

  private static Request post(final CreateTable create) {
    return json("POST", TABLES, JsonUtils.pojoToJson(create), 201);
  }

  private static String byName(final CreateTable create) {
    return TABLES + "/name/" + create.getDatabaseSchema() + "." + create.getName();
  }
}
