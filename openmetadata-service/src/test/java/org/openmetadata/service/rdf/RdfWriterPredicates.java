package org.openmetadata.service.rdf;

import com.sun.source.tree.BinaryTree;
import com.sun.source.tree.CompilationUnitTree;
import com.sun.source.tree.ExpressionTree;
import com.sun.source.tree.LiteralTree;
import com.sun.source.tree.MethodInvocationTree;
import com.sun.source.tree.Tree;
import com.sun.source.tree.VariableTree;
import com.sun.source.util.JavacTask;
import com.sun.source.util.TreeScanner;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import javax.tools.ToolProvider;

/** Supplements runtime fixtures with constant predicates in conditional writer branches. */
final class RdfWriterPredicates {
  private RdfWriterPredicates() {}

  static Set<String> constantPredicates() throws IOException {
    final var compiler = ToolProvider.getSystemJavaCompiler();
    try (var files = compiler.getStandardFileManager(null, null, null)) {
      final JavacTask parser =
          (JavacTask)
              compiler.getTask(
                  null,
                  files,
                  null,
                  List.of("-proc:none"),
                  null,
                  files.getJavaFileObjectsFromPaths(writerSources()));
      final List<CompilationUnitTree> units = new ArrayList<>();
      parser.parse().forEach(units::add);
      final Map<String, String> constants = constants(units);
      final Set<String> predicates = new TreeSet<>();
      for (CompilationUnitTree unit : units) {
        new TreeScanner<Void, Void>() {
          @Override
          public Void visitMethodInvocation(final MethodInvocationTree call, final Void unused) {
            if (call.getMethodSelect().toString().endsWith(".createProperty")) {
              final List<String> parts =
                  call.getArguments().stream()
                      .map(argument -> evaluate(argument, constants))
                      .toList();
              if (!parts.contains(null)) predicates.add(String.join("", parts));
            }
            return super.visitMethodInvocation(call, unused);
          }
        }.scan(unit, null);
      }
      return predicates;
    }
  }

  private static List<Path> writerSources() throws IOException {
    Path module = Path.of("").toAbsolutePath();
    if (!Files.isDirectory(module.resolve("src/main/java/org/openmetadata/service/rdf"))) {
      module = module.resolve("openmetadata-service");
    }
    final Path root = module.resolve("src/main/java/org/openmetadata/service/rdf");
    try (var paths = Files.walk(root)) {
      return paths
          .filter(path -> path.toString().endsWith(".java"))
          .filter(
              path ->
                  path.startsWith(root.resolve("translator"))
                      || Set.of("RdfRepository.java", "RdfLineage.java")
                          .contains(path.getFileName().toString()))
          .sorted()
          .toList();
    }
  }

  private static Map<String, String> constants(final List<CompilationUnitTree> units) {
    final Map<String, String> constants = new HashMap<>();
    for (CompilationUnitTree unit : units) {
      new TreeScanner<Void, Void>() {
        @Override
        public Void visitVariable(final VariableTree variable, final Void unused) {
          final String value = evaluate(variable.getInitializer(), constants);
          if (value != null) constants.put(variable.getName().toString(), value);
          return super.visitVariable(variable, unused);
        }
      }.scan(unit, null);
    }
    return constants;
  }

  private static String evaluate(
      final ExpressionTree expression, final Map<String, String> constants) {
    if (expression instanceof LiteralTree literal && literal.getValue() instanceof String value) {
      return value;
    }
    if (expression instanceof BinaryTree binary && binary.getKind() == Tree.Kind.PLUS) {
      final String left = evaluate(binary.getLeftOperand(), constants);
      final String right = evaluate(binary.getRightOperand(), constants);
      return left == null || right == null ? null : left + right;
    }
    return expression == null ? null : constants.get(expression.toString());
  }
}
