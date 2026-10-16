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

package org.openmetadata.service.alerting;

import static com.tngtech.archunit.base.DescribedPredicate.alwaysTrue;
import static com.tngtech.archunit.base.DescribedPredicate.not;
import static com.tngtech.archunit.core.domain.JavaClass.Predicates.belongToAnyOf;
import static com.tngtech.archunit.core.domain.JavaClass.Predicates.resideInAPackage;
import static com.tngtech.archunit.core.domain.JavaClass.Predicates.resideInAnyPackage;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;
import static com.tngtech.archunit.library.Architectures.layeredArchitecture;
import static com.tngtech.archunit.library.dependencies.SlicesRuleDefinition.slices;

import com.tngtech.archunit.base.DescribedPredicate;
import com.tngtech.archunit.core.domain.JavaClass;
import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchRule;
import org.openmetadata.service.OpenMetadataApplication;
import org.openmetadata.service.alerting.audience.AddressDirectory;
import org.openmetadata.service.alerting.audience.EmailRecipient;
import org.openmetadata.service.alerting.audience.Recipient;
import org.openmetadata.service.alerting.audience.WebhookRecipient;
import org.openmetadata.service.apps.ApplicationHandler;
import org.openmetadata.service.apps.bundles.dataRetention.DataRetention;
import org.openmetadata.service.jdbi3.EventSubscriptionRepository;
import org.openmetadata.service.jdbi3.NotificationTemplateRepository;
import org.openmetadata.service.resources.events.NotificationTemplateResource;
import org.openmetadata.service.resources.events.subscription.EventSubscriptionMapper;
import org.openmetadata.service.resources.events.subscription.EventSubscriptionResource;
import org.openmetadata.service.security.policyevaluator.ExpressionValidator;
import org.openmetadata.service.util.OpenMetadataOperations;

/**
 * Where alerting code may reach. Alerts and notifications live under {@code alerting}, on top of
 * the consumer runtime in {@code events.consumer}, and each layer uses only the layers below it.
 */
@AnalyzeClasses(
    packages = "org.openmetadata.service",
    importOptions = ImportOption.DoNotIncludeTests.class)
class AlertingArchitectureTest {
  private static final String ALERTING = "org.openmetadata.service.alerting";
  private static final String CONSUMER = "org.openmetadata.service.events.consumer";

  /** What a channel provider implements against: the channel package and the types it hands out. */
  private static final DescribedPredicate<JavaClass> CHANNEL_SPI =
      resideInAPackage(ALERTING + ".channel")
          .or(
              belongToAnyOf(
                  AddressDirectory.class,
                  Recipient.class,
                  EmailRecipient.class,
                  WebhookRecipient.class));

  /** The core classes that reach alerting beyond its channel SPI, each on purpose. */
  private static final DescribedPredicate<JavaClass> ADAPTERS =
      belongToAnyOf(
          EventSubscriptionRepository.class,
          EventSubscriptionResource.class,
          EventSubscriptionMapper.class,
          NotificationTemplateRepository.class,
          NotificationTemplateResource.class,
          OpenMetadataApplication.class,
          ApplicationHandler.class,
          DataRetention.class,
          OpenMetadataOperations.class,
          ExpressionValidator.class);

  @ArchTest
  static final ArchRule eachLayerUsesOnlyTheLayersBelowIt =
      layeredArchitecture()
          .consideringOnlyDependenciesInLayers()
          .layer("Alerting")
          .definedBy(ALERTING)
          .layer("Delivery")
          .definedBy(ALERTING + ".delivery..")
          .layer("Channels")
          .definedBy(ALERTING + ".channel.*..")
          .layer("ChannelSpi")
          .definedBy(ALERTING + ".channel")
          .layer("Content")
          .definedBy(ALERTING + ".content..")
          .layer("Audience")
          .definedBy(ALERTING + ".audience..")
          .layer("Definition")
          .definedBy(ALERTING + ".definition..")
          .layer("Matching")
          .definedBy(ALERTING + ".matching..")
          .whereLayer("Alerting")
          .mayNotBeAccessedByAnyLayer()
          .whereLayer("Delivery")
          .mayOnlyBeAccessedByLayers("Alerting")
          .whereLayer("Channels")
          .mayOnlyBeAccessedByLayers("Alerting", "Delivery")
          .whereLayer("ChannelSpi")
          .mayOnlyBeAccessedByLayers("Alerting", "Delivery", "Channels")
          .whereLayer("Content")
          .mayOnlyBeAccessedByLayers("Alerting", "Delivery", "Channels", "ChannelSpi")
          .whereLayer("Audience")
          .mayOnlyBeAccessedByLayers("Alerting", "Delivery", "Channels", "ChannelSpi")
          .whereLayer("Definition")
          .mayOnlyBeAccessedByLayers("Alerting", "Delivery")
          .whereLayer("Matching")
          .mayOnlyBeAccessedByLayers(
              "Alerting",
              "Delivery",
              "Channels",
              "ChannelSpi",
              "Content",
              "Audience",
              "Definition");

  @ArchTest
  static final ArchRule alertingPackagesDoNotImportInACircle =
      slices().matching(ALERTING + ".(**)").should().beFreeOfCycles();

  /**
   * A channel stands on the SPI alone. The built-in list names every channel, and the chat channels
   * post through the webhook channel's HTTP sending, addresses and rules.
   */
  @ArchTest
  static final ArchRule channelsDoNotUseEachOther =
      slices()
          .matching(ALERTING + ".channel.(*)..")
          .should()
          .notDependOnEachOther()
          .ignoreDependency(resideInAPackage(ALERTING + ".channel.builtin.."), alwaysTrue())
          .ignoreDependency(
              resideInAnyPackage(
                  ALERTING + ".channel.slack..",
                  ALERTING + ".channel.teams..",
                  ALERTING + ".channel.gchat.."),
              resideInAPackage(ALERTING + ".channel.webhook.."));

  @ArchTest
  static final ArchRule theConsumerRuntimeKnowsNothingOfAlerting =
      noClasses()
          .that()
          .resideInAPackage(CONSUMER + "..")
          .should()
          .dependOnClassesThat()
          .resideInAPackage(ALERTING + "..");

  @ArchTest
  static final ArchRule coreReachesAlertingThroughItsSpiOrAnAdapter =
      noClasses()
          .that()
          .resideOutsideOfPackages(ALERTING + "..", CONSUMER + "..")
          .and(not(ADAPTERS))
          .should()
          .dependOnClassesThat(resideInAPackage(ALERTING + "..").and(not(CHANNEL_SPI)));
}
