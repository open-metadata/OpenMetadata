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

package org.openmetadata.service.util;

import io.github.classgraph.ClassGraph;
import io.github.classgraph.ScanResult;
import java.lang.annotation.Annotation;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

public final class ClasspathScanIndex {
  private static final String[] ACCEPTED_PACKAGES = {"org.openmetadata", "io.collate"};

  private final ScanResult scanResult;
  private final Map<Class<? extends Annotation>, List<Class<?>>> classesByAnnotation =
      new ConcurrentHashMap<>();
  private final Map<Class<? extends Annotation>, List<Class<?>>> classesByMethodAnnotation =
      new ConcurrentHashMap<>();

  private ClasspathScanIndex() {
    scanResult =
        new ClassGraph()
            .enableAnnotationInfo()
            .enableMethodInfo()
            .acceptPackages(ACCEPTED_PACKAGES)
            .scan();
  }

  public static ClasspathScanIndex getInstance() {
    return Holder.INSTANCE;
  }

  public List<Class<?>> getClassesWithAnnotation(Class<? extends Annotation> annotationClass) {
    return classesByAnnotation.computeIfAbsent(
        annotationClass,
        annotation -> List.copyOf(scanResult.getClassesWithAnnotation(annotation).loadClasses()));
  }

  public List<Class<?>> getClassesWithMethodAnnotation(
      Class<? extends Annotation> annotationClass) {
    return classesByMethodAnnotation.computeIfAbsent(
        annotationClass,
        annotation ->
            List.copyOf(scanResult.getClassesWithMethodAnnotation(annotation).loadClasses()));
  }

  private static class Holder {
    private static final ClasspathScanIndex INSTANCE = new ClasspathScanIndex();
  }
}
