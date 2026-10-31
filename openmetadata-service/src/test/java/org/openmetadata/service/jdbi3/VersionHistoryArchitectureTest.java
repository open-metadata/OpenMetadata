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

package org.openmetadata.service.jdbi3;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noCodeUnits;

import com.tngtech.archunit.base.DescribedPredicate;
import com.tngtech.archunit.core.domain.JavaCodeUnit;
import com.tngtech.archunit.core.domain.JavaMethodCall;
import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchCondition;
import com.tngtech.archunit.lang.ArchRule;
import com.tngtech.archunit.lang.ConditionEvents;
import com.tngtech.archunit.lang.SimpleConditionEvent;
import java.util.Set;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityExtensionDAO;
import org.openmetadata.service.util.EntityUtil;

/**
 * Every version of an entity is written by {@link EntityRepository#storeVersions}, which leaves
 * out the fields no version may show. A method that builds a version key and writes an entity
 * extension row is writing a version of its own.
 */
@AnalyzeClasses(
    packages = "org.openmetadata.service",
    importOptions = ImportOption.DoNotIncludeTests.class)
class VersionHistoryArchitectureTest {
  private static final String VERSION_WRITER = "storeVersions";
  private static final String VERSION_KEY = "getVersionExtension";
  private static final Set<String> EXTENSION_WRITES =
      Set.of("insert", "insertMany", "bulkUpsertExtensions");

  private static final DescribedPredicate<JavaCodeUnit> THE_VERSION_WRITER =
      DescribedPredicate.describe(
          "EntityRepository." + VERSION_WRITER,
          unit ->
              unit.getOwner().isEquivalentTo(EntityRepository.class)
                  && VERSION_WRITER.equals(unit.getName()));

  private static final ArchCondition<JavaCodeUnit> WRITE_A_VERSION =
      new ArchCondition<>("build a version key and write an entity extension row") {
        @Override
        public void check(final JavaCodeUnit unit, final ConditionEvents events) {
          final boolean writesAVersion =
              unit.getMethodCallsFromSelf().stream()
                      .anyMatch(VersionHistoryArchitectureTest::buildsAVersionKey)
                  && unit.getMethodCallsFromSelf().stream()
                      .anyMatch(VersionHistoryArchitectureTest::writesAnExtensionRow);
          events.add(
              new SimpleConditionEvent(
                  unit, writesAVersion, unit.getFullName() + " writes a version of its own"));
        }
      };

  @ArchTest
  static final ArchRule ONLY_STORE_VERSIONS_WRITES_A_VERSION =
      noCodeUnits().that(DescribedPredicate.not(THE_VERSION_WRITER)).should(WRITE_A_VERSION);

  private static boolean buildsAVersionKey(final JavaMethodCall call) {
    return call.getTargetOwner().isEquivalentTo(EntityUtil.class)
        && VERSION_KEY.equals(call.getName());
  }

  private static boolean writesAnExtensionRow(final JavaMethodCall call) {
    return call.getTargetOwner().isAssignableTo(EntityExtensionDAO.class)
        && EXTENSION_WRITES.contains(call.getName());
  }
}
