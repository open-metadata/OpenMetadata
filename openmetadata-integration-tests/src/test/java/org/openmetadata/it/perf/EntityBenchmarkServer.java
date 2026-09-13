package org.openmetadata.it.perf;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.nio.file.attribute.PosixFilePermissions;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.stream.IntStream;
import org.openmetadata.it.auth.JwtAuthProvider;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.perf.EntityBenchmarkManifest.Workload;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.tests.CustomMetric;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.fluent.DatabaseSchemas;
import org.openmetadata.sdk.fluent.DatabaseServices;
import org.openmetadata.sdk.fluent.Databases;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.TableRepository;
import org.openmetadata.service.util.FullyQualifiedName;

/** Starts a standalone server and deterministic fixtures for a separate HTTP load generator. */
public final class EntityBenchmarkServer {
  private EntityBenchmarkServer() {}

  public static void main(String[] args) throws Exception {
    if (args.length != 1 || !Boolean.getBoolean("dbDurable")) {
      throw new IllegalArgumentException("Use -DdbDurable=true and pass the output manifest path");
    }
    TestSuiteBootstrap bootstrap = new TestSuiteBootstrap();
    bootstrap.launcherSessionOpened(null);
    Runtime.getRuntime().addShutdownHook(new Thread(() -> bootstrap.launcherSessionClosed(null)));
    EntityBenchmarkManifest manifest = createFixtures();
    Path target = Path.of(args[0]).toAbsolutePath();
    Files.createDirectories(target.getParent());
    Path temporary =
        Files.createTempFile(
            target.getParent(),
            "benchmark-",
            ".json",
            PosixFilePermissions.asFileAttribute(PosixFilePermissions.fromString("rw-------")));
    Files.writeString(temporary, JsonUtils.pojoToJson(manifest));
    Files.move(
        temporary, target, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
    new CountDownLatch(1).await();
  }

  private static EntityBenchmarkManifest createFixtures() throws IOException {
    SdkClients.adminClient();
    var service =
        DatabaseServices.builder()
            .name("entity_benchmark")
            .connection(
                DatabaseServices.postgresConnection()
                    .hostPort("localhost:5432")
                    .username("test")
                    .build())
            .create();
    var database =
        Databases.create().name("benchmark").in(service.getFullyQualifiedName()).execute();
    var owner = SdkClients.adminClient().users().getByName("admin");
    final String readerToken = createReader();
    List<Workload> workloads = new ArrayList<>();
    for (int columnCount : List.of(3, 100, 1000)) {
      var schema =
          DatabaseSchemas.create()
              .name("columns_" + columnCount)
              .in(database.getFullyQualifiedName())
              .execute();
      List<Column> columns =
          IntStream.range(0, columnCount)
              .mapToObj(
                  index -> new Column().withName("c" + index).withDataType(ColumnDataType.BIGINT))
              .toList();
      CreateTable create =
          new CreateTable()
              .withName("table")
              .withDatabaseSchema(schema.getFullyQualifiedName())
              .withColumns(columns)
              .withOwners(List.of(owner.getEntityReference()));
      Table table = SdkClients.adminClient().tables().create(create);
      ((TableRepository) Entity.getEntityRepository(Entity.TABLE))
          .addFollower("admin", table.getId(), owner.getId());
      populateMetadata(table);
      seedHistory(table);
      workloads.addAll(EntityBenchmarkReadWorkloads.create(table, columnCount, readerToken));
      final var writeSchema =
          DatabaseSchemas.create()
              .name("writes_" + columnCount)
              .in(database.getFullyQualifiedName())
              .execute();
      final CreateTable writeTemplate =
          JsonUtils.deepCopy(create, CreateTable.class)
              .withDatabaseSchema(writeSchema.getFullyQualifiedName());
      workloads.addAll(EntityBenchmarkWriteWorkloads.create(writeTemplate, columnCount));
      final Table csvTemplate =
          SdkClients.adminClient()
              .tables()
              .create(
                  JsonUtils.deepCopy(writeTemplate, CreateTable.class).withName("csv_template"));
      final String csv =
          ((TableRepository) Entity.getEntityRepository(Entity.TABLE))
              .exportToCsv(csvTemplate.getFullyQualifiedName(), "admin", false);
      workloads.addAll(EntityBenchmarkCsvWorkloads.create(writeTemplate, columnCount, csv));
    }
    return new EntityBenchmarkManifest(
        SdkClients.baseUrl(), SdkClients.getAdminToken(), List.copyOf(workloads));
  }

  private static void seedHistory(final Table table) {
    for (int version = 0; version < 5; version++) {
      SdkClients.adminClient()
          .tables()
          .patch(
              table.getId(),
              JsonUtils.readTree(
                  "[{\"op\":\"add\",\"path\":\"/description\",\"value\":\"history_"
                      + version
                      + "\"}]"),
              "*");
    }
  }

  private static void populateMetadata(Table table) {
    Entity.getCollectionDAO()
        .inTransaction(
            ignored -> {
              var extensions = Entity.getCollectionDAO().entityExtensionDAO();
              extensions.insert(
                  table.getId(),
                  "customMetrics.table.table.count",
                  "customMetric",
                  JsonUtils.pojoToJson(
                      new CustomMetric().withName("count").withExpression("count(*)")));
              extensions.insert(
                  table.getId(),
                  "customMetrics.table.column.sum",
                  "customMetric",
                  JsonUtils.pojoToJson(
                      new CustomMetric()
                          .withName("sum")
                          .withColumnName("c0")
                          .withExpression("sum(c0)")));
              for (Column column : table.getColumns()) {
                extensions.insert(
                    table.getId(),
                    FullyQualifiedName.buildHash(column.getFullyQualifiedName()),
                    "columnExtension",
                    "{\"note\":\"benchmark\"}");
              }
              return null;
            });
  }

  private static String createReader() {
    final String name = "entity_benchmark_reader";
    final String email = name + "@open-metadata.org";
    final var role = SdkClients.adminClient().roles().getByName("DataConsumer");
    SdkClients.adminClient()
        .users()
        .create(
            new CreateUser()
                .withName(name)
                .withEmail(email)
                .withIsAdmin(false)
                .withRoles(List.of(role.getId())));
    return JwtAuthProvider.tokenFor(name, email, null, Duration.ofDays(1).toSeconds());
  }
}
