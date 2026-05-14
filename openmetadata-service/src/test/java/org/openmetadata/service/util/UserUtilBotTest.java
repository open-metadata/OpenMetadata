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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationTest;
import org.openmetadata.service.jdbi3.UserRepository;

/**
 * Regression coverage for the boot-time team-strip loop on bot users.
 *
 * <p>Bots are persisted with {@code teams = [Organization]} (the default parent every user gets
 * when no explicit team is given). On every OM boot, {@code UserUtil.addOrUpdateBotUser} was
 * called with an in-memory {@link User} that did not carry the existing {@code teams} field. The
 * PUT path on {@code userRepository.createOrUpdate} then ran {@code UserUpdater.updateTeams},
 * which executed {@code deleteTo + assignTeams(null)} and wiped the bot's team membership. The
 * change description recorded
 * {@code fieldsDeleted=[FieldChange[name=teams, oldValue=[Organization], newValue=null]]} on
 * every boot, each one triggering an Elasticsearch reindex of the bot user.
 */
@Slf4j
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class UserUtilBotTest extends OpenMetadataApplicationTest {

  @Test
  void addOrUpdateBotUserDoesNotStripTeams() throws Exception {
    UserRepository userRepository =
        (UserRepository) Entity.getEntityRepository(Entity.USER);

    String suffix = String.valueOf(System.currentTimeMillis());
    String botName = "bot-team-strip-regression-" + suffix;
    String email = botName + "@open-metadata.org";

    // Create a real (non-Organization) team and assign the bot to it. Organization is a
    // virtual default that UserRepository.getTeams adds back whenever there are zero stored
    // relationships, so a test that only checks for Organization can't tell whether the
    // upsert wiped real team membership. With this real team, a wipe is observable.
    org.openmetadata.service.jdbi3.TeamRepository teamRepository =
        (org.openmetadata.service.jdbi3.TeamRepository)
            Entity.getEntityRepository(Entity.TEAM);
    org.openmetadata.schema.entity.teams.Team realTeam =
        teamRepository.create(
            null,
            new org.openmetadata.schema.entity.teams.Team()
                .withId(UUID.randomUUID())
                .withName("bot-strip-team-" + suffix)
                .withTeamType(org.openmetadata.schema.api.teams.CreateTeam.TeamType.GROUP)
                .withUpdatedBy("admin")
                .withUpdatedAt(System.currentTimeMillis()));

    // Build the initial bot the same way the boot path does: via UserUtil.user(...). Both
    // initial create and the simulated boot upsert below construct the in-memory User this
    // way, so scalar fields (displayName, description) line up and the short-circuit guard
    // can actually fire on the second pass. Override teams with the real team for the
    // initial create only.
    User initialBot =
        UserUtil.user(botName, "open-metadata.org", botName)
            .withIsBot(true)
            .withTeams(new java.util.ArrayList<>(List.of(realTeam.getEntityReference())));
    User stored = userRepository.create(null, initialBot);

    // Sanity-check the bot really is in the real team.
    User beforeBoot =
        userRepository.getByName(null, botName, userRepository.getFields("teams"));
    List<EntityReference> teamsBefore = beforeBoot.getTeams();
    assertNotNull(teamsBefore, "Setup failed: bot should have at least one team");
    assertTrue(
        teamsBefore.stream().anyMatch(t -> realTeam.getName().equals(t.getName())),
        "Setup failed: bot should be in real team before upsert. Got: " + teamsBefore);

    // Simulate the bootstrap path: a fresh User object describing the same bot, without the
    // teams field populated. This is exactly what UserUtil.addOrUpdateBotUser is called with
    // on every OM boot — the in-memory User from configuration carries id/name/email and a
    // few scalar fields, but never teams.
    // Build the in-memory User the same way BotResource.initialize does on boot:
    // UserUtil.user(name, domain, updatedBy).withIsBot(true). Note that the result does NOT
    // have `teams` populated.
    User boundary = UserUtil.user(botName, "open-metadata.org", botName).withIsBot(true);

    // The call under test.
    UserUtil.addOrUpdateBotUser(boundary);

    // After the boot upsert the bot MUST still be a member of the Organization team. With the
    // bug present, this fails with teams=null (or empty), exactly matching the production logs
    // we observed (fieldsDeleted=[teams: oldValue=[Organization], newValue=null]).
    User afterBoot =
        userRepository.getByName(null, botName, userRepository.getFields("teams"));
    List<EntityReference> teamsAfter = afterBoot.getTeams();
    assertNotNull(
        teamsAfter,
        "Boot upsert stripped the bot's teams (teams field is null after addOrUpdateBotUser)");
    assertTrue(
        teamsAfter.stream().anyMatch(t -> realTeam.getName().equals(t.getName())),
        "Boot upsert removed the bot's real team membership. Got: " + teamsAfter);
  }
}
