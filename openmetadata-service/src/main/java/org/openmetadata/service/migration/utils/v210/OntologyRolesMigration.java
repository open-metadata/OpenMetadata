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

package org.openmetadata.service.migration.utils.v210;

import java.io.IOException;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.PolicyRepository;
import org.openmetadata.service.jdbi3.RoleRepository;

/**
 * Gives the DataSteward role of an installed catalog the ontology author and reviewer policies
 * that new installs get from the DataSteward seed (ADR:2026-11-02-ontology-roles-are-seeded).
 *
 * <p>Seed data is created only when missing, so an existing DataSteward role never picks up a
 * policy added to its seed. Migrations also run before startup seeding, so the two policies are
 * created here first. The role-to-policy edge upserts, so a second run changes nothing, and an
 * administrator's edits to the policies or to DataSteward's other policies are left alone.
 */
@Slf4j
public final class OntologyRolesMigration {

  /** Run once per version through {@code DataMigrationStep}. */
  public static final String STEP_NAME = "ontology-roles-on-data-steward";

  static final String DATA_STEWARD_ROLE = "DataSteward";
  static final List<String> POLICIES = List.of("OntologyAuthorPolicy", "OntologyReviewerPolicy");

  private OntologyRolesMigration() {}

  public static void attachOntologyPoliciesToDataSteward(final CollectionDAO collectionDAO) {
    final RoleRepository roles = (RoleRepository) Entity.getEntityRepository(Entity.ROLE);
    final PolicyRepository policies = (PolicyRepository) Entity.getEntityRepository(Entity.POLICY);
    try {
      final Role steward = roles.findByName(DATA_STEWARD_ROLE, Include.NON_DELETED);
      for (final String name : POLICIES) {
        final Policy policy = seededPolicy(policies, name);
        collectionDAO
            .relationshipDAO()
            .insert(
                steward.getId(),
                policy.getId(),
                Entity.ROLE,
                Entity.POLICY,
                Relationship.HAS.ordinal());
        LOG.info("Attached {} to {}", name, DATA_STEWARD_ROLE);
      }
    } catch (EntityNotFoundException exception) {
      LOG.warn("{} not found, skipping ontology policy attachment", DATA_STEWARD_ROLE);
    }
  }

  private static Policy seededPolicy(final PolicyRepository policies, final String name) {
    try {
      for (final Policy seed : policies.getEntitiesFromSeedData()) {
        if (name.equals(seed.getName())) {
          policies.initializeEntity(seed);
        }
      }
    } catch (IOException exception) {
      throw new IllegalStateException("Cannot read the " + name + " seed", exception);
    }
    return policies.findByName(name, Include.NON_DELETED);
  }
}
