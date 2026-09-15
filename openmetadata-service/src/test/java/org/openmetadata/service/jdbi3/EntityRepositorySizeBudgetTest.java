package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertAll;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.sun.source.tree.MethodTree;
import com.sun.source.util.JavacTask;
import com.sun.source.util.TreeScanner;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import javax.lang.model.element.Modifier;
import javax.tools.ToolProvider;
import org.junit.jupiter.api.Test;

class EntityRepositorySizeBudgetTest {
  private static final int LINE_BUDGET = 13251;
  private static final int PROTECTED_HOOK_BUDGET = 141;
  private static final int IMPORT_METHOD_BUDGET = 9;

  @Test
  void repositoryAndExtensionSurfaceOnlyShrink() throws IOException {
    final Path source = sourcePath();
    final var hooks = new HashSet<String>();
    final var imports = new HashSet<String>();
    collectMethods(source, hooks, imports);
    assertAll(
        () -> assertTrue(Files.readAllLines(source).size() <= LINE_BUDGET, "Line budget exceeded"),
        () -> assertTrue(hooks.size() <= PROTECTED_HOOK_BUDGET, "Protected hooks: " + hooks.size()),
        () ->
            assertTrue(
                imports.size() <= IMPORT_METHOD_BUDGET, "Import methods: " + imports.size()));
  }

  private static Path sourcePath() {
    final Path relative =
        Path.of("src/main/java/org/openmetadata/service/jdbi3/EntityRepository.java");
    return Files.isRegularFile(relative)
        ? relative
        : Path.of("openmetadata-service").resolve(relative);
  }

  private static void collectMethods(Path source, Set<String> hooks, Set<String> imports)
      throws IOException {
    final var compiler = ToolProvider.getSystemJavaCompiler();
    try (var files = compiler.getStandardFileManager(null, null, null)) {
      final var parser =
          (JavacTask)
              compiler.getTask(
                  null,
                  files,
                  null,
                  List.of("-proc:none"),
                  null,
                  files.getJavaFileObjectsFromPaths(List.of(source)));
      for (var unit : parser.parse()) {
        new TreeScanner<Void, Void>() {
          @Override
          public Void visitMethod(MethodTree method, Void unused) {
            final String name = method.getName().toString();
            if (method.getModifiers().getFlags().contains(Modifier.PROTECTED)) {
              hooks.add(name);
            }
            if (name.contains("ForImport")) {
              imports.add(name);
            }
            return super.visitMethod(method, unused);
          }
        }.scan(unit, null);
      }
    }
  }
}
