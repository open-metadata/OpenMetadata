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

import static com.tngtech.archunit.base.DescribedPredicate.not;
import static com.tngtech.archunit.core.domain.JavaClass.Predicates.resideInAnyPackage;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.methods;

import com.tngtech.archunit.core.domain.JavaMethod;
import com.tngtech.archunit.core.domain.JavaMethodCall;
import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchCondition;
import com.tngtech.archunit.lang.ArchRule;
import com.tngtech.archunit.lang.ConditionEvents;
import com.tngtech.archunit.lang.SimpleConditionEvent;
import java.util.Set;
import org.openmetadata.service.jdbi3.SystemTokenDAOs.SystemDAO;

/**
 * A setting's value reaches the database only through the write step of {@link SystemRepository},
 * which validates it against the value it replaces (the IdP certificate check among others). The
 * methods listed here are the only ones that call the DAO writes of a setting's value; each gets the
 * JSON it writes from that step, except where the comment says otherwise. A new caller fails this
 * test, so a new way to write a setting is reviewed instead of skipping the step silently.
 * ADR:2026-11-20-the-stored-saml-idp-certificate-is-standard-pem
 */
@AnalyzeClasses(
    packages = "org.openmetadata.service",
    importOptions = ImportOption.DoNotIncludeTests.class)
class SettingsWriteFunnelTest {

  /** The {@link SystemDAO} methods that write the value of a setting. */
  private static final Set<String> VALUE_WRITES =
      Set.of(
          "insertSettings",
          "insertSettingsIfAbsent",
          "updateSettingsIfCurrent",
          "updateSecuritySettingsIfCurrent",
          "updateSettingsWithSnapshotIfCurrent",
          "updateGlossaryTermRelationSettingsIfCurrent");

  private static final Set<String> REVIEWED_WRITERS =
      Set.of(
          "SystemRepository.storeSecurityConfiguration",
          "SystemRepository.updateSecurityConfigurationIfCurrent",
          // Puts back the rows a refused security save replaced, as they were read: they passed
          // the write step when they were stored.
          "SystemRepository.restoreSecurityConfigurationIfCurrent",
          "SystemRepository.updateSetting",
          "SystemRepository.updateSettingIfCurrent",
          // Glossary term relation settings: validated and normalized by their own utility.
          "SystemRepository.patchGlossaryTermRelationSettings",
          // The deployment reconciler writes the JSON SystemRepository.prepareSeed and
          // prepareReconciled return.
          "DeploymentConfigReconciler.insertSeed",
          "DeploymentConfigReconciler.storeMerged");

  /** Data migrations rewrite stored rows on purpose and carry their own logic. */
  private static final String MIGRATIONS = "org.openmetadata.service.migration..";

  @ArchTest
  static final ArchRule settingValuesAreWrittenOnlyByReviewedMethods =
      methods()
          .that()
          .areDeclaredInClassesThat(not(resideInAnyPackage(MIGRATIONS)))
          .and()
          .areNotDeclaredIn(SystemDAO.class)
          .should(onlyWriteSettingValuesWhenReviewed())
          .as(
              "Only the reviewed methods write a setting's value, after SystemRepository's write step");

  private static ArchCondition<JavaMethod> onlyWriteSettingValuesWhenReviewed() {
    return new ArchCondition<>("write a setting's value only from a reviewed method") {
      @Override
      public void check(final JavaMethod method, final ConditionEvents events) {
        final String writer = method.getOwner().getSimpleName() + "." + method.getName();
        for (final JavaMethodCall call : method.getMethodCallsFromSelf()) {
          final boolean writesValue =
              call.getTargetOwner().isAssignableTo(SystemDAO.class)
                  && VALUE_WRITES.contains(call.getName());
          if (writesValue && !REVIEWED_WRITERS.contains(writer)) {
            events.add(SimpleConditionEvent.violated(method, writer + " calls " + call.getName()));
          }
        }
      }
    };
  }
}
