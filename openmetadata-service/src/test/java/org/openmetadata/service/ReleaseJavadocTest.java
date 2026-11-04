/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service;

import static java.nio.charset.StandardCharsets.UTF_8;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import javax.lang.model.SourceVersion;
import javax.tools.Diagnostic;
import javax.tools.DiagnosticCollector;
import javax.tools.DocumentationTool;
import javax.tools.JavaFileObject;
import javax.tools.StandardJavaFileManager;
import javax.tools.StandardLocation;
import javax.tools.ToolProvider;
import jdk.javadoc.doclet.Doclet;
import jdk.javadoc.doclet.DocletEnvironment;
import jdk.javadoc.doclet.Reporter;
import org.junit.jupiter.api.Test;

/**
 * Javadoc runs only in the {@code release} build, which publishes to Maven Central after merge, and
 * it runs no annotation processors. A Lombok-generated type named in a signature, such as the
 * builder class of a {@code @Builder}, compiles everywhere else and breaks only that build.
 *
 * <p>With doclint off, as in that build, doc-comment problems are warnings: javadoc fails only when
 * it cannot resolve the declarations, which it does before running a doclet. So this runs javadoc
 * over the main sources with a doclet that writes nothing.
 */
class ReleaseJavadocTest {
  private static final Path MAIN_SOURCES = Path.of("src/main/java");
  private static final String JAVA_SOURCE_SUFFIX = ".java";
  private static final String CLASSPATH_PROPERTY = "java.class.path";
  private static final List<String> JAVADOC_OPTIONS = List.of("-quiet");

  @Test
  void javadocResolvesEveryMainSourceDeclaration() throws IOException {
    DiagnosticCollector<JavaFileObject> diagnostics = new DiagnosticCollector<>();

    boolean succeeded = runJavadoc(diagnostics);

    assertTrue(succeeded, () -> "javadoc fails as the release build will:\n" + errors(diagnostics));
  }

  private static boolean runJavadoc(DiagnosticCollector<JavaFileObject> diagnostics)
      throws IOException {
    DocumentationTool javadoc = ToolProvider.getSystemDocumentationTool();
    try (StandardJavaFileManager fileManager =
        javadoc.getStandardFileManager(diagnostics, Locale.ROOT, UTF_8)) {
      fileManager.setLocationFromPaths(StandardLocation.CLASS_PATH, testClasspath());
      Iterable<? extends JavaFileObject> sources =
          fileManager.getJavaFileObjectsFromPaths(mainSources());
      return javadoc
          .getTask(null, fileManager, diagnostics, NoOutputDoclet.class, JAVADOC_OPTIONS, sources)
          .call();
    }
  }

  private static List<Path> mainSources() throws IOException {
    try (Stream<Path> paths = Files.walk(MAIN_SOURCES)) {
      return paths.filter(path -> path.toString().endsWith(JAVA_SOURCE_SUFFIX)).toList();
    }
  }

  private static List<Path> testClasspath() {
    return Stream.of(System.getProperty(CLASSPATH_PROPERTY).split(File.pathSeparator))
        .map(Path::of)
        .toList();
  }

  private static String errors(DiagnosticCollector<JavaFileObject> diagnostics) {
    return diagnostics.getDiagnostics().stream()
        .filter(diagnostic -> diagnostic.getKind() == Diagnostic.Kind.ERROR)
        .map(Diagnostic::toString)
        .collect(Collectors.joining("\n"));
  }

  /** Lets javadoc resolve the sources without generating any documentation. */
  public static class NoOutputDoclet implements Doclet {
    @Override
    public void init(Locale locale, Reporter reporter) {}

    @Override
    public String getName() {
      return getClass().getSimpleName();
    }

    @Override
    public Set<? extends Option> getSupportedOptions() {
      return Set.of();
    }

    @Override
    public SourceVersion getSupportedSourceVersion() {
      return SourceVersion.latest();
    }

    @Override
    public boolean run(DocletEnvironment environment) {
      return true;
    }
  }
}
