/*
 *  Copyright 2021 Collate
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

package org.openmetadata.common.utils;

import static java.nio.charset.StandardCharsets.UTF_8;

import java.io.File;
import java.io.IOException;
import java.lang.reflect.Method;
import java.net.URI;
import java.net.URISyntaxException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Base64;
import java.util.Collection;
import java.util.Collections;
import java.util.Enumeration;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.io.IOUtils;

@Slf4j
public final class CommonUtil {

  private static final List<String> JAR_NAME_FILTER = List.of("openmetadata", "collate");

  private CommonUtil() {}

  /** Get resources from jar file or directories in the class path matching pattern */
  public static List<String> getResources(Pattern pattern) throws IOException {
    ArrayList<String> resources = new ArrayList<>();
    String classPath = System.getProperty("java.class.path", ".");
    Set<String> classPathElements =
        Arrays.stream(classPath.split(File.pathSeparator))
            .filter(jarName -> JAR_NAME_FILTER.stream().anyMatch(jarName.toLowerCase()::contains))
            .collect(Collectors.toSet());

    for (String element : classPathElements) {
      File file = new File(element);
      resources.addAll(
          file.isDirectory()
              ? getResourcesFromDirectory(file, pattern)
              : getResourcesFromJarFile(file, pattern));
    }
    return resources;
  }

  /** Check if any given object falls under OM, or Collate packages */
  public static Boolean isOpenMetadataObject(Object obj) {
    return obj != null
        && JAR_NAME_FILTER.stream()
            .anyMatch(
                Arrays.stream(obj.getClass().getPackageName().split("\\.")).toList()::contains);
  }

  private static Collection<String> getResourcesFromJarFile(File file, Pattern pattern) {
    LOG.debug("Adding from file {}", file);
    ArrayList<String> retval = new ArrayList<>();
    try (ZipFile zf = new ZipFile(file)) {
      Enumeration<? extends ZipEntry> e = zf.entries();
      while (e.hasMoreElements()) {
        String fileName = e.nextElement().getName();
        if (pattern.matcher(fileName).matches()) {
          retval.add(fileName);
          LOG.debug("Adding file from jar {}", fileName);
        }
      }
    } catch (Exception ignored) {
      // Ignored exception
    }
    return retval;
  }

  public static Collection<String> getResourcesFromDirectory(File file, Pattern pattern)
      throws IOException {
    final Path root = Path.of(file.getPath());
    try (Stream<Path> paths = Files.walk(Paths.get(file.getPath()))) {
      return paths
          .filter(Files::isRegularFile)
          .filter(path -> pattern.matcher(path.toString()).matches())
          .map(
              path -> {
                String relativePath = root.relativize(path).toString();
                LOG.debug("Adding directory file {}", relativePath);
                return relativePath;
              })
          .collect(Collectors.toSet());
    }
  }

  /** Get date after {@code days} from the given date or before i{@code days} when it is negative */
  public static LocalDate getDateByOffset(LocalDate localDate, int days) {
    return localDate.plusDays(days);
  }

  /** Get date after {@code days} from the given date or before i{@code days} when it is negative */
  public static LocalDate getDateByOffset(DateTimeFormatter dateFormat, String strDate, int days) {
    LocalDate localDate;
    try {
      localDate = LocalDate.parse(strDate, dateFormat);
    } catch (DateTimeParseException e) {
      throw new IllegalArgumentException("Failed to parse date " + strDate, e);
    }
    return getDateByOffset(localDate, days);
  }

  /** Get date after {@code days} from the given date or before i{@code days} when it is negative */
  public static String getDateStringByOffset(
      DateTimeFormatter dateFormat, String strDate, int days) {
    LocalDate localDate = getDateByOffset(dateFormat, strDate, days);
    return localDate.format(dateFormat);
  }

  /** Check if given date is with in today - pastDays and today + futureDays */
  public static boolean dateInRange(
      DateTimeFormatter dateFormat, String date, int futureDays, int pastDays) {
    LocalDate today = LocalDate.now();
    LocalDate startDate = getDateByOffset(today, -pastDays);
    LocalDate endDate = getDateByOffset(today, futureDays);
    LocalDate givenDate;
    try {
      givenDate = LocalDate.parse(date, dateFormat);
    } catch (DateTimeParseException e) {
      throw new IllegalArgumentException("Failed to parse date " + date, e);
    }
    return (givenDate.isAfter(startDate) || givenDate.equals(startDate))
        && (givenDate.isBefore(endDate) || givenDate.equals(endDate));
  }

  public static final String HMAC_SHA256_ALGORITHM = "HmacSHA256";

  /** Get SHA256 Hash-based Message Authentication Code */
  public static String calculateHMAC(String secretKey, String message) {
    try {
      Mac mac = Mac.getInstance(HMAC_SHA256_ALGORITHM);
      SecretKeySpec secretKeySpec =
          new SecretKeySpec(secretKey.getBytes(StandardCharsets.UTF_8), HMAC_SHA256_ALGORITHM);
      mac.init(secretKeySpec);
      byte[] hmacSha256 = mac.doFinal(message.getBytes(StandardCharsets.UTF_8));
      return Base64.getEncoder().encodeToString(hmacSha256);
    } catch (Exception e) {
      throw new RuntimeException("Failed to calculate " + HMAC_SHA256_ALGORITHM, e);
    }
  }

  public static <T> List<T> listOrEmpty(List<T> list) {
    return Optional.ofNullable(list).orElse(Collections.emptyList());
  }

  public static <K, V> Map<K, V> collectionOrEmpty(Map<K, V> input) {
    return Optional.ofNullable(input).orElse(new HashMap<>());
  }

  public static <T> List<T> listOrEmptyMutable(List<T> list) {
    return nullOrEmpty(list) ? new ArrayList<>() : new ArrayList<>(list);
  }

  public static boolean nullOrEmpty(String string) {
    return string == null || string.isEmpty();
  }

  public static boolean nullOrEmpty(List<?> list) {
    return list == null || list.isEmpty();
  }

  public static boolean nullOrEmpty(Map<?, ?> m) {
    return m == null || m.isEmpty();
  }

  public static boolean nullOrEmpty(Object object) {
    return object == null || nullOrEmpty(object.toString());
  }

  public static List<String> uuidListToStrings(List<UUID> list) {
    return list.stream().map(UUID::toString).toList();
  }

  public static <T> T nullOrDefault(T object, T defaultValue) {
    if (object == null || (nullOrEmpty(object.toString()))) {
      return defaultValue;
    } else {
      return object;
    }
  }

  public static <T> List<T> collectionOrDefault(List<T> c, List<T> defaultValue) {
    if (nullOrEmpty(c)) {
      return defaultValue;
    } else {
      return c;
    }
  }

  public static String getResourceAsStream(ClassLoader loader, String file) throws IOException {
    return IOUtils.toString(Objects.requireNonNull(loader.getResourceAsStream(file)), UTF_8);
  }

  /** Return list of entries that are modifiable for performing sort and other operations */
  @SafeVarargs
  public static <T> List<T> listOf(T... entries) {
    if (entries == null) {
      return Collections.emptyList();
    }
    return new ArrayList<>(Arrays.asList(entries));
  }

  public static URI getUri(String uri) {
    try {
      return new URI(uri);
    } catch (URISyntaxException e) {
      LOG.error("Error creating URI ", e);
    }
    return null;
  }

  public static <T> boolean findChildren(List<?> list, String methodName, String fqn) {
    if (list == null || list.isEmpty()) return false;
    try {
      Method getChildren = list.get(0).getClass().getMethod(methodName);
      Method getFQN = list.get(0).getClass().getMethod("getFullyQualifiedName");
      return list.stream()
          .anyMatch(
              o -> {
                try {
                  return getFQN.invoke(o).equals(fqn)
                      || findChildren((List<?>) getChildren.invoke(o), methodName, fqn);
                } catch (Exception e) {
                  return false;
                }
              });
    } catch (Exception e) {
      return false;
    }
  }

  public static <T> Set<String> getChildrenNames(
      List<?> list, String methodName, String parentFqn) {
    Set<String> result = new HashSet<>();
    if (list == null || list.isEmpty()) return new HashSet();
    try {
      Method getChildren = list.get(0).getClass().getMethod(methodName);
      Method getFQN = list.get(0).getClass().getMethod("getFullyQualifiedName");
      for (int i = 0; i < list.size(); i++) {
        result.add(getFQN.invoke(list.get(i)).toString().replace(parentFqn + ".", ""));
        result.addAll(
            getChildrenNames((List<?>) getChildren.invoke(list.get(i)), methodName, parentFqn));
      }
      return result;
    } catch (Exception e) {
      return result;
    }
  }
}
