package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertAll;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
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
import java.util.stream.Collectors;
import javax.lang.model.element.Modifier;
import javax.tools.Diagnostic;
import javax.tools.DiagnosticCollector;
import javax.tools.JavaFileObject;
import javax.tools.ToolProvider;
import org.junit.jupiter.api.Test;

class EntityRepositorySizeBudgetTest {
  private static final int LINE_BUDGET = 13730;

  /**
   * Counted as erased signatures, so these are declarations rather than distinct names. Name-keyed,
   * the same source measures 141 hooks and 13 {@code *ForImport} methods — the difference is 30
   * protected overloads and 6 import overloads that a name-keyed budget could never see.
   */
  private static final int PROTECTED_HOOK_BUDGET = 171;

  private static final int IMPORT_METHOD_BUDGET = 19;

  /**
   * Lines move by a few on edits that are not extractions — a reformat, an added import — so the
   * lower bound on the line budget carries slack. Hooks and {@code *ForImport} methods are sets of
   * distinct names: they change only when a method is genuinely added or removed, so their lower
   * bound is exact.
   */
  private static final int LINE_SLACK = 50;

  @Test
  void repositoryAndExtensionSurfaceOnlyShrink() throws IOException {
    final Path source = sourcePath();
    final var hooks = new HashSet<String>();
    final var imports = new HashSet<String>();
    collectMethods(source, hooks, imports);
    assertAll(
        () -> assertRatchet("Lines", Files.readAllLines(source).size(), LINE_BUDGET, LINE_SLACK),
        () -> assertRatchet("Protected hooks", hooks.size(), PROTECTED_HOOK_BUDGET, 0),
        () -> assertRatchet("*ForImport methods", imports.size(), IMPORT_METHOD_BUDGET, 0));
  }

  /**
   * A ratchet, not a ceiling. The upper bound stops the class growing; the lower bound is what makes
   * it a ratchet — shrink the class and you must lower the constant in the same diff, so the
   * headroom you created cannot be spent silently by the next PR.
   *
   * <p>The lower bound matters most for the hook count. #28778 "shrank" this class by moving code
   * into collaborators that kept a back-reference to it, which reduces lines while leaving the
   * coupling surface exactly where it was. A hook budget that is only ever an upper bound records
   * that as progress; one that must be lowered to match forces the question of whether the surface
   * actually shrank.
   */
  private static void assertRatchet(
      final String label, final int actual, final int budget, final int slack) {
    assertTrue(
        actual <= budget,
        () ->
            label
                + " grew to "
                + actual
                + ", above the budget of "
                + budget
                + ". EntityRepository only shrinks: extract the addition rather than raising the"
                + " budget to fit it.");
    assertTrue(
        actual >= budget - slack,
        () ->
            label
                + " fell to "
                + actual
                + ", below the budget of "
                + budget
                + (slack > 0 ? " (slack " + slack + ")" : "")
                + ". Lower the constant to "
                + actual
                + " in this same diff so the ratchet keeps its grip.");
  }

  private static String signature(final MethodTree method) {
    return method.getParameters().stream()
        .map(parameter -> parameter.getType().toString())
        .collect(Collectors.joining(",", method.getName() + "(", ")"));
  }

  private static Path sourcePath() {
    final Path relative =
        Path.of("src/main/java/org/openmetadata/service/jdbi3/EntityRepository.java");
    final Path resolved =
        Files.isRegularFile(relative)
            ? relative
            : Path.of("openmetadata-service").resolve(relative);
    // A ratchet that cannot find its source is a ratchet that passes. Moving or splitting
    // EntityRepository.java must fail here rather than quietly measure nothing.
    assertTrue(
        Files.isRegularFile(resolved),
        () -> "EntityRepository source not found at " + resolved.toAbsolutePath());
    return resolved;
  }

  private static void collectMethods(Path source, Set<String> hooks, Set<String> imports)
      throws IOException {
    final var compiler = ToolProvider.getSystemJavaCompiler();
    assertNotNull(
        compiler, "A JDK is required to parse EntityRepository; this is running on a JRE");
    final var diagnostics = new DiagnosticCollector<JavaFileObject>();
    try (var files = compiler.getStandardFileManager(diagnostics, null, null)) {
      final var parser =
          (JavacTask)
              compiler.getTask(
                  null,
                  files,
                  diagnostics,
                  List.of("-proc:none"),
                  null,
                  files.getJavaFileObjectsFromPaths(List.of(source)));
      int units = 0;
      for (var unit : parser.parse()) {
        units++;
        new TreeScanner<Void, Void>() {
          @Override
          public Void visitMethod(MethodTree method, Void unused) {
            final String name = method.getName().toString();
            // Keyed on the erased signature, not the name. Keyed on names, adding an overload of an
            // existing protected hook or *ForImport method leaves the count unchanged and grows the
            // surface this test exists to freeze.
            final String signature = signature(method);
            if (method.getModifiers().getFlags().contains(Modifier.PROTECTED)) {
              hooks.add(signature);
            }
            if (name.contains("ForImport")) {
              imports.add(signature);
            }
            return super.visitMethod(method, unused);
          }
        }.scan(unit, null);
      }
      // Discarding parse diagnostics would let a parse failure present as an empty surface, and
      // "zero hooks" satisfies every upper bound in this file.
      assertTrue(
          diagnostics.getDiagnostics().stream()
              .noneMatch(d -> d.getKind() == Diagnostic.Kind.ERROR),
          () -> "Parsing EntityRepository reported errors: " + diagnostics.getDiagnostics());
      assertEquals(1, units, "Expected exactly one compilation unit");
    }
    assertFalse(hooks.isEmpty(), "Parsed no protected hooks — the ratchet is measuring nothing");
    assertFalse(
        imports.isEmpty(), "Parsed no *ForImport methods — the ratchet is measuring nothing");
  }
}
