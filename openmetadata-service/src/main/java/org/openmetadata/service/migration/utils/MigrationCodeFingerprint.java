package org.openmetadata.service.migration.utils;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.net.URISyntaxException;
import java.nio.charset.StandardCharsets;
import java.nio.file.FileSystemNotFoundException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.CodeSource;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Collections;
import java.util.HexFormat;
import java.util.Map;
import java.util.TreeMap;
import java.util.jar.JarEntry;
import java.util.jar.JarFile;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;
import lombok.extern.slf4j.Slf4j;

/**
 * Fingerprint of the compiled code behind a version's Java data migration: the migration class
 * itself and, when it follows the {@code migration.<dialect>.vXYZ} layout, every class in the
 * version's {@code migration.utils.vXYZ} package. Adding a step to the migration, or changing a
 * helper in that package, changes the fingerprint; rebuilding unchanged sources with the same
 * toolchain does not.
 */
@Slf4j
public final class MigrationCodeFingerprint {
  private static final Pattern VERSION_PACKAGE =
      Pattern.compile("(.+)\\.(?:mysql|postgres)\\.(v\\d+)");

  private MigrationCodeFingerprint() {}

  public static String of(Class<?> migrationClass) {
    Map<String, byte[]> classes = new TreeMap<>(helperClasses(migrationClass));
    classes.put(classFile(migrationClass.getName()), classBytes(migrationClass));
    MessageDigest digest = sha256();
    classes.forEach(
        (name, bytes) -> {
          digest.update(name.getBytes(StandardCharsets.UTF_8));
          digest.update(bytes);
        });
    return HexFormat.of().formatHex(digest.digest());
  }

  private static byte[] classBytes(Class<?> type) {
    try (InputStream in = type.getResourceAsStream("/" + classFile(type.getName()))) {
      if (in != null) {
        return in.readAllBytes();
      }
    } catch (IOException e) {
      LOG.warn("Could not read the bytecode of {}", type.getName(), e);
    }
    // A class with no readable bytecode, such as a generated proxy or mock, is fingerprinted by
    // its name alone.
    return new byte[0];
  }

  private static Map<String, byte[]> helperClasses(Class<?> migrationClass) {
    Matcher version = VERSION_PACKAGE.matcher(migrationClass.getPackageName());
    CodeSource codeSource = migrationClass.getProtectionDomain().getCodeSource();
    if (!version.matches() || codeSource == null) {
      return Map.of();
    }
    String helperDir = (version.group(1) + ".utils." + version.group(2)).replace('.', '/') + "/";
    try {
      Path root = Path.of(codeSource.getLocation().toURI());
      return Files.isDirectory(root) ? fromDirectory(root, helperDir) : fromJar(root, helperDir);
    } catch (IOException
        | URISyntaxException
        | IllegalArgumentException
        | FileSystemNotFoundException e) {
      LOG.warn(
          "Could not read the data migration helpers of {}; fingerprinting the class alone",
          migrationClass.getName(),
          e);
      return Map.of();
    }
  }

  private static Map<String, byte[]> fromDirectory(Path root, String helperDir) throws IOException {
    Map<String, byte[]> classes = new TreeMap<>();
    Path dir = root.resolve(helperDir);
    if (Files.isDirectory(dir)) {
      try (Stream<Path> files = Files.walk(dir)) {
        for (Path file : files.filter(f -> f.toString().endsWith(".class")).toList()) {
          String name = root.relativize(file).toString().replace(File.separatorChar, '/');
          classes.put(name, Files.readAllBytes(file));
        }
      }
    }
    return classes;
  }

  private static Map<String, byte[]> fromJar(Path jarPath, String helperDir) throws IOException {
    Map<String, byte[]> classes = new TreeMap<>();
    try (JarFile jar = new JarFile(jarPath.toFile())) {
      for (JarEntry entry : Collections.list(jar.entries())) {
        if (entry.getName().startsWith(helperDir) && entry.getName().endsWith(".class")) {
          try (InputStream in = jar.getInputStream(entry)) {
            classes.put(entry.getName(), in.readAllBytes());
          }
        }
      }
    }
    return classes;
  }

  private static String classFile(String className) {
    return className.replace('.', '/') + ".class";
  }

  private static MessageDigest sha256() {
    try {
      return MessageDigest.getInstance("SHA-256");
    } catch (NoSuchAlgorithmException e) {
      throw new IllegalStateException("SHA-256 is required by every Java runtime", e);
    }
  }
}
