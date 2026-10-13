package org.openmetadata.service.migration.utils;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import java.io.File;
import java.io.IOException;
import java.net.URI;
import java.net.URL;
import java.net.URLClassLoader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.jar.JarEntry;
import java.util.jar.JarOutputStream;
import java.util.stream.Stream;
import javax.tools.JavaCompiler;
import javax.tools.ToolProvider;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

/**
 * Compiles small migrations with the JDK compiler and fingerprints the result, so these tests see
 * the same bytecode the workflow does when it decides whether a data migration has to run again
 * (issue #33045).
 */
class MigrationCodeFingerprintTest {

  private static final String MIGRATION = "fingerprint.fixture.mysql.v1.Migration";
  private static final String HELPER = "fingerprint.fixture.utils.v1.Helper";
  private static final String UNRELATED = "fingerprint.fixture.other.Unrelated";

  private static final String ONE_STEP =
      """
      package fingerprint.fixture.mysql.v1;

      public class Migration {
        public void runDataMigration() {
          fingerprint.fixture.utils.v1.Helper.backfill();
        }
      }
      """;

  private static final String NEW_STEP_ADDED =
      """
      package fingerprint.fixture.mysql.v1;

      public class Migration {
        public void runDataMigration() {
          fingerprint.fixture.utils.v1.Helper.backfill();
          repairSettings();
        }

        private void repairSettings() {}
      }
      """;

  private static final String HELPER_SOURCE =
      """
      package fingerprint.fixture.utils.v1;

      public class Helper {
        public static void backfill() {
          System.out.println("backfill");
        }
      }
      """;

  private static final String HELPER_CHANGED =
      """
      package fingerprint.fixture.utils.v1;

      public class Helper {
        public static void backfill() {
          System.out.println("backfill in batches");
        }
      }
      """;

  private static final String UNRELATED_SOURCE =
      """
      package fingerprint.fixture.other;

      public class Unrelated {}
      """;

  @TempDir Path tempDir;

  @Test
  void addingAStepToTheMigrationChangesTheFingerprint() throws Exception {
    String before =
        fingerprint(compile("before", Map.of(MIGRATION, ONE_STEP, HELPER, HELPER_SOURCE)));
    String after =
        fingerprint(compile("after", Map.of(MIGRATION, NEW_STEP_ADDED, HELPER, HELPER_SOURCE)));

    assertNotEquals(before, after);
  }

  @Test
  void changingAHelperInTheVersionsUtilsPackageChangesTheFingerprint() throws Exception {
    String before =
        fingerprint(compile("before", Map.of(MIGRATION, ONE_STEP, HELPER, HELPER_SOURCE)));
    String after =
        fingerprint(compile("after", Map.of(MIGRATION, ONE_STEP, HELPER, HELPER_CHANGED)));

    assertNotEquals(before, after);
  }

  @Test
  void rebuildingUnchangedSourcesKeepsTheFingerprint() throws Exception {
    Map<String, String> sources = Map.of(MIGRATION, ONE_STEP, HELPER, HELPER_SOURCE);

    assertEquals(fingerprint(compile("first", sources)), fingerprint(compile("second", sources)));
  }

  @Test
  void classesOutsideTheVersionsUtilsPackageDoNotChangeTheFingerprint() throws Exception {
    String without =
        fingerprint(compile("without", Map.of(MIGRATION, ONE_STEP, HELPER, HELPER_SOURCE)));
    String with =
        fingerprint(
            compile(
                "with",
                Map.of(MIGRATION, ONE_STEP, HELPER, HELPER_SOURCE, UNRELATED, UNRELATED_SOURCE)));

    assertEquals(without, with);
  }

  @Test
  void readsTheHelpersFromAJarTheWayTheServerLoadsThem() throws Exception {
    Path classes = compile("classes", Map.of(MIGRATION, ONE_STEP, HELPER, HELPER_SOURCE));

    // A jar that yielded only the migration class would fingerprint differently from the
    // directory, which does include the helper.
    assertEquals(fingerprint(classes), fingerprint(jar(classes, "")));
  }

  @Test
  void fingerprintsTheClassAloneWhenItsLocationCannotBeWalked() throws Exception {
    Path classes = compile("classes", Map.of(MIGRATION, ONE_STEP, HELPER, HELPER_SOURCE));
    URL insideTheJar = URI.create("jar:" + jar(classes, "nested/").toUri() + "!/nested/").toURL();

    String fingerprint;
    try (URLClassLoader loader =
        new URLClassLoader(new URL[] {insideTheJar}, ClassLoader.getPlatformClassLoader())) {
      fingerprint = MigrationCodeFingerprint.of(loader.loadClass(MIGRATION));
    }

    // The helper can't be listed from inside a jar, so the fingerprint falls back to the class
    // alone rather than failing the migration.
    assertNotEquals(fingerprint(classes), fingerprint);
  }

  @Test
  void aClassWithNoReadableBytecodeIsFingerprintedByItsName() {
    Runnable generated = () -> {};

    String fingerprint = MigrationCodeFingerprint.of(generated.getClass());

    assertEquals(64, fingerprint.length());
    assertEquals(fingerprint, MigrationCodeFingerprint.of(generated.getClass()));
  }

  private String fingerprint(Path classesOrJar) throws Exception {
    try (URLClassLoader loader =
        new URLClassLoader(
            new URL[] {classesOrJar.toUri().toURL()}, ClassLoader.getPlatformClassLoader())) {
      return MigrationCodeFingerprint.of(loader.loadClass(MIGRATION));
    }
  }

  private Path compile(String name, Map<String, String> sources) throws IOException {
    JavaCompiler javac = ToolProvider.getSystemJavaCompiler();
    assertNotNull(javac, "these tests need a JDK, not a JRE");
    Path sourceRoot = tempDir.resolve(name + "-src");
    Path classes = Files.createDirectories(tempDir.resolve(name + "-classes"));
    List<String> args = new ArrayList<>(List.of("-proc:none", "-d", classes.toString()));
    for (Map.Entry<String, String> source : sources.entrySet()) {
      Path file = sourceRoot.resolve(source.getKey().replace('.', '/') + ".java");
      Files.createDirectories(file.getParent());
      Files.writeString(file, source.getValue());
      args.add(file.toString());
    }
    assertEquals(
        0, javac.run(null, null, null, args.toArray(String[]::new)), "fixture did not compile");
    return classes;
  }

  private Path jar(Path classes, String prefix) throws IOException {
    Path jar = tempDir.resolve("classes.jar");
    try (JarOutputStream out = new JarOutputStream(Files.newOutputStream(jar));
        Stream<Path> files = Files.walk(classes)) {
      for (Path file : files.filter(Files::isRegularFile).sorted().toList()) {
        String entry = classes.relativize(file).toString().replace(File.separatorChar, '/');
        out.putNextEntry(new JarEntry(prefix + entry));
        out.write(Files.readAllBytes(file));
        out.closeEntry();
      }
    }
    return jar;
  }
}
