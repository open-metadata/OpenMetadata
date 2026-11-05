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
import org.openmetadata.schema.Function;
import org.openmetadata.service.jdbi3.Repository;
import org.openmetadata.service.resources.Collection;

public final class ClasspathScanIndex {
  private static final String[] ACCEPTED_PACKAGES = {"org.openmetadata", "io.collate"};

  private final Map<Class<? extends Annotation>, List<Class<?>>> classesByAnnotation;
  private final Map<Class<? extends Annotation>, List<Class<?>>> classesByMethodAnnotation;

  private ClasspathScanIndex() {
    this(scanClasspath());
  }

  ClasspathScanIndex(ScanResult scanResult) {
    try (scanResult) {
      classesByAnnotation =
          Map.of(
              Repository.class, loadClassesWithAnnotation(scanResult, Repository.class),
              Collection.class, loadClassesWithAnnotation(scanResult, Collection.class));
      classesByMethodAnnotation =
          Map.of(Function.class, loadClassesWithMethodAnnotation(scanResult, Function.class));
    }
  }

  public static ClasspathScanIndex getInstance() {
    return Holder.INSTANCE;
  }

  public List<Class<?>> getClassesWithAnnotation(Class<? extends Annotation> annotationClass) {
    return getIndexedClasses(classesByAnnotation, annotationClass);
  }

  public List<Class<?>> getClassesWithMethodAnnotation(
      Class<? extends Annotation> annotationClass) {
    return getIndexedClasses(classesByMethodAnnotation, annotationClass);
  }

  private static ScanResult scanClasspath() {
    return new ClassGraph()
        .enableAnnotationInfo()
        .enableMethodInfo()
        .acceptPackages(ACCEPTED_PACKAGES)
        .scan();
  }

  private static List<Class<?>> loadClassesWithAnnotation(
      ScanResult scanResult, Class<? extends Annotation> annotationClass) {
    return List.copyOf(scanResult.getClassesWithAnnotation(annotationClass).loadClasses());
  }

  private static List<Class<?>> loadClassesWithMethodAnnotation(
      ScanResult scanResult, Class<? extends Annotation> annotationClass) {
    return List.copyOf(scanResult.getClassesWithMethodAnnotation(annotationClass).loadClasses());
  }

  private static List<Class<?>> getIndexedClasses(
      Map<Class<? extends Annotation>, List<Class<?>>> index,
      Class<? extends Annotation> annotationClass) {
    List<Class<?>> classes = index.get(annotationClass);
    if (classes == null) {
      throw new IllegalArgumentException("Annotation is not indexed: " + annotationClass.getName());
    }
    return classes;
  }

  private static class Holder {
    private static final ClasspathScanIndex INSTANCE = new ClasspathScanIndex();
  }
}
