package org.openmetadata.sdk.fluent.builders;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Supplier;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.openmetadata.schema.api.data.CreateTable;

/**
 * Regression coverage for the silent-drop bug introduced in commit {@code bb1395fc72} (PR
 * #23239), where every fluent create builder defined {@code extension(Object)} as a no-op that
 * returned {@code this} without ever calling {@code request.setExtension(extension)}. The fix
 * propagates the payload onto the underlying {@code Create*} request object for builders whose
 * request schema supports {@code extension}, and removes the silent no-op stub from the remaining
 * builders so that callers fail at compile time instead of silently losing data.
 */
class BuilderExtensionTest {

  private static final Map<String, Object> EXTENSION =
      Map.of("customProp", "important-value", "num", 42);

  /**
   * Each entry pairs a builder's display name with a supplier that exercises the full
   * {@code .extension(EXTENSION).build().getExtension()} round-trip for every builder whose
   * underlying {@code Create*} request object declares {@code setExtension(Object)}.
   */
  @SuppressWarnings("unchecked") // raw Supplier cast for compact argument literals
  static Stream<Arguments> extensionSupportingBuilders() {
    return Stream.of(
        Arguments.of(
            "ChartBuilder",
            (Supplier<Object>)
                () -> new ChartBuilder(null).name("c").extension(EXTENSION).build().getExtension()),
        Arguments.of(
            "ContainerBuilder",
            (Supplier<Object>)
                () ->
                    new ContainerBuilder(null)
                        .name("c")
                        .extension(EXTENSION)
                        .build()
                        .getExtension()),
        Arguments.of(
            "DashboardBuilder",
            (Supplier<Object>)
                () ->
                    new DashboardBuilder(null)
                        .name("d")
                        .extension(EXTENSION)
                        .build()
                        .getExtension()),
        Arguments.of(
            "DashboardDataModelBuilder",
            (Supplier<Object>)
                () ->
                    new DashboardDataModelBuilder(null)
                        .name("dm")
                        .extension(EXTENSION)
                        .build()
                        .getExtension()),
        Arguments.of(
            "DataProductBuilder",
            (Supplier<Object>)
                () ->
                    new DataProductBuilder(null)
                        .name("dp")
                        .extension(EXTENSION)
                        .build()
                        .getExtension()),
        Arguments.of(
            "DatabaseBuilder",
            (Supplier<Object>)
                () ->
                    new DatabaseBuilder(null)
                        .name("db")
                        .serviceName("svc")
                        .extension(EXTENSION)
                        .build()
                        .getExtension()),
        Arguments.of(
            "DatabaseSchemaBuilder",
            (Supplier<Object>)
                () ->
                    new DatabaseSchemaBuilder(null)
                        .name("ds")
                        .databaseName("db")
                        .extension(EXTENSION)
                        .build()
                        .getExtension()),
        Arguments.of(
            "DomainBuilder",
            (Supplier<Object>)
                () ->
                    new DomainBuilder(null)
                        .name("dom")
                        .extension(EXTENSION)
                        .build()
                        .getExtension()),
        Arguments.of(
            "GlossaryBuilder",
            (Supplier<Object>)
                () ->
                    new GlossaryBuilder(null)
                        .name("g")
                        .extension(EXTENSION)
                        .build()
                        .getExtension()),
        Arguments.of(
            "GlossaryTermBuilder",
            (Supplier<Object>)
                () ->
                    new GlossaryTermBuilder(null)
                        .name("gt")
                        .extension(EXTENSION)
                        .build()
                        .getExtension()),
        Arguments.of(
            "MetricBuilder",
            (Supplier<Object>)
                () ->
                    new MetricBuilder(null).name("m").extension(EXTENSION).build().getExtension()),
        Arguments.of(
            "MlModelBuilder",
            (Supplier<Object>)
                () ->
                    new MlModelBuilder(null)
                        .name("mm")
                        .extension(EXTENSION)
                        .build()
                        .getExtension()),
        Arguments.of(
            "PipelineBuilder",
            (Supplier<Object>)
                () ->
                    new PipelineBuilder(null)
                        .name("p")
                        .serviceFQN("svc")
                        .extension(EXTENSION)
                        .build()
                        .getExtension()),
        Arguments.of(
            "SearchIndexBuilder",
            (Supplier<Object>)
                () ->
                    new SearchIndexBuilder(null)
                        .name("si")
                        .extension(EXTENSION)
                        .build()
                        .getExtension()),
        Arguments.of(
            "StoredProcedureBuilder",
            (Supplier<Object>)
                () ->
                    new StoredProcedureBuilder(null)
                        .name("sp")
                        .extension(EXTENSION)
                        .build()
                        .getExtension()),
        Arguments.of(
            "TableBuilder",
            (Supplier<Object>)
                () ->
                    new TableBuilder(null)
                        .name("t")
                        .schemaFQN("s.c.p")
                        .extension(EXTENSION)
                        .build()
                        .getExtension()),
        Arguments.of(
            "TeamBuilder",
            (Supplier<Object>)
                () ->
                    new TeamBuilder(null).name("team").extension(EXTENSION).build().getExtension()),
        Arguments.of(
            "TopicBuilder",
            (Supplier<Object>)
                () -> new TopicBuilder(null).name("t").extension(EXTENSION).build().getExtension()),
        Arguments.of(
            "UserBuilder",
            (Supplier<Object>)
                () -> new UserBuilder(null).name("u").extension(EXTENSION).build().getExtension()));
  }

  @ParameterizedTest(name = "{0}: extension() must propagate to build().getExtension()")
  @MethodSource("extensionSupportingBuilders")
  void extensionIsPropagatedToBuildRequest(String builderName, Supplier<Object> supplier) {
    Object actual = supplier.get();
    assertEquals(
        EXTENSION,
        actual,
        builderName + ".extension(Object) must propagate the payload onto the Create* request");
  }

  /**
   * Direct reproduction of the bug-report example. Previously {@code build().getExtension()}
   * returned {@code null} because {@code TableBuilder.extension} was a no-op.
   */
  @Test
  void tableBuilderReproductionFromBugReport() {
    Map<String, Object> ext = new LinkedHashMap<>();
    ext.put("customProp", "important-value");
    ext.put("num", 42);

    CreateTable request =
        new TableBuilder(null).name("customers").schemaFQN("svc.db.public").extension(ext).build();

    assertSame(ext, request.getExtension());
    Map<?, ?> returned = (Map<?, ?>) request.getExtension();
    assertEquals("important-value", returned.get("customProp"));
    assertEquals(42, returned.get("num"));
  }

  /** {@code extension()} must return the same builder instance to preserve fluent chaining. */
  @Test
  void extensionReturnsSameBuilderForChaining() {
    TableBuilder tableBuilder = new TableBuilder(null);
    assertSame(tableBuilder, tableBuilder.extension(EXTENSION));

    PipelineBuilder pipelineBuilder = new PipelineBuilder(null);
    assertSame(pipelineBuilder, pipelineBuilder.extension(EXTENSION));

    UserBuilder userBuilder = new UserBuilder(null);
    assertSame(userBuilder, userBuilder.extension(EXTENSION));
  }

  /** Build without an {@code extension()} call must keep {@code getExtension()} null. */
  @Test
  void buildWithoutExtensionLeavesExtensionNull() {
    assertNull(new TableBuilder(null).name("t").schemaFQN("s.c.p").build().getExtension());
    assertNull(new DomainBuilder(null).name("d").build().getExtension());
    assertNull(new PipelineBuilder(null).name("p").serviceFQN("svc").build().getExtension());
  }

  /** {@code extension(null)} must not throw and must leave the payload null on the request. */
  @Test
  void extensionWithNullDoesNotThrowAndClearsExtension() {
    assertNull(
        new TableBuilder(null).name("t").schemaFQN("s.c.p").extension(null).build().getExtension());
  }

  /**
   * Builders whose {@code Create*} request schema has no {@code extension} property. The
   * previous {@code extension(Object)} implementation silently dropped the payload; the fix
   * removes the method so that callers see a compile-time error rather than losing data.
   */
  static List<Class<?>> extensionRemovedBuilders() {
    return List.of(
        ClassificationBuilder.class,
        DashboardServiceBuilder.class,
        MessagingServiceBuilder.class,
        MlModelServiceBuilder.class,
        PipelineServiceBuilder.class,
        QueryBuilder.class,
        StorageServiceBuilder.class,
        TagBuilder.class,
        TestDefinitionBuilder.class,
        TestSuiteBuilder.class);
  }

  @ParameterizedTest(name = "{0} must NOT declare extension(Object) (silent drop removed)")
  @MethodSource("extensionRemovedBuilders")
  void extensionMethodRemovedFromBuildersWithoutSchemaSupport(Class<?> builderClass) {
    assertThrows(
        NoSuchMethodException.class,
        () -> builderClass.getMethod("extension", Object.class),
        builderClass.getSimpleName()
            + " must not declare extension(Object); its Create* request has no extension"
            + " property, so a stub would silently drop user data");
  }
}
