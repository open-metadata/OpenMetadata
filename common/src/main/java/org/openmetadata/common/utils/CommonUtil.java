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

import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.text.DateFormat;
import java.text.ParseException;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Calendar;
import java.util.Collection;
import java.util.Date;
import java.util.Enumeration;
import java.util.List;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import lombok.extern.slf4j.Slf4j;

@Slf4j
public final class CommonUtil {

  private CommonUtil() {}

  /** Get resources from jar file or directories in the class path matching pattern */
  public static List<String> getResources(Pattern pattern) throws IOException {
    ArrayList<String> resources = new ArrayList<>();
    String classPath = System.getProperty("java.class.path", ".");
    String[] classPathElements = classPath.split(File.pathSeparator);

    for (String element : classPathElements) {
      File file = new File(element);
      resources.addAll(
          file.isDirectory() ? getResourcesFromDirectory(file, pattern) : getResourcesFromJarFile(file, pattern));
    }
    return resources;
  }

  private static Collection<String> getResourcesFromJarFile(File file, Pattern pattern) {
    ArrayList<String> retval = new ArrayList<>();
    try (ZipFile zf = new ZipFile(file)) {
      Enumeration<? extends ZipEntry> e = zf.entries();
      while (e.hasMoreElements()) {
        String fileName = e.nextElement().getName();
        if (pattern.matcher(fileName).matches()) {
          retval.add(fileName);
          LOG.info("Adding file from jar {}", fileName);
        }
      }
    } catch (Exception ignored) {
      // Ignored exception
    }
    return retval;
  }

  public static Collection<String> getResourcesFromDirectory(File file, Pattern pattern) throws IOException {
    final Path root = Path.of(file.getPath());
    try (Stream<Path> paths = Files.walk(Paths.get(file.getPath()))) {
      return paths
          .filter(Files::isRegularFile)
          .filter(path -> pattern.matcher(path.toString()).matches())
          .map(
              path -> {
                String relativePath = root.relativize(path).toString();
                LOG.info("Adding directory file {}", relativePath);
                return relativePath;
              })
          .collect(Collectors.toSet());
    }
  }

  /** Get date after {@code days} from the given date or before i{@code days} when it is negative */
  public static Date getDateByOffset(Date date, int days) throws ParseException {
    Calendar calendar = Calendar.getInstance();
    calendar.setTime(date);
    calendar.add(Calendar.DATE, days);
    return calendar.getTime();
  }

  /** Get date after {@code days} from the given date or before i{@code days} when it is negative */
  public static Date getDateByOffsetSeconds(Date date, int seconds) throws ParseException {
    Calendar calendar = Calendar.getInstance();
    calendar.setTime(date);
    calendar.add(Calendar.SECOND, seconds);
    return calendar.getTime();
  }

  /** Get date after {@code days} from the given date or before i{@code days} when it is negative */
  public static Date getDateByOffset(DateFormat dateFormat, String strDate, int days) throws ParseException {
    Date date = dateFormat.parse(strDate);
    return getDateByOffset(date, days);
  }

  /** Get date after {@code days} from the given date or before i{@code days} when it is negative */
  public static String getDateStringByOffset(DateFormat dateFormat, String strDate, int days) throws ParseException {
    return dateFormat.format(getDateByOffset(dateFormat, strDate, days));
  }

  /** Check if given date is with in today - pastDays and today + futureDays */
  public static boolean dateInRange(DateFormat dateFormat, String date, int futureDays, int pastDays)
      throws ParseException {
    Date today = new Date();
    Date startDate = getDateByOffset(today, -pastDays);
    Date endDate = getDateByOffset(today, futureDays);
    Date givenDate = dateFormat.parse(date);
    return givenDate.after(startDate) && givenDate.before(endDate);
  }

  /** Parse a date using given DataFormat */
  public static Date parseDate(String date, DateFormat dateFormat) {
    try {
      return dateFormat.parse(date);
    } catch (ParseException e) {
      throw new RuntimeException(e);
    }
  }

  public static final String HMAC_SHA256_ALGORITHM = "HmacSHA256";

  /** Get SHA256 Hash-based Message Authentication Code */
  public static String calculateHMAC(String secretKey, String message) {
    //    return message;
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
}
