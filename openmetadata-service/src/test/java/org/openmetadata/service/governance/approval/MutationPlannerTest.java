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

package org.openmetadata.service.governance.approval;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.governance.changeRequest.MutationOp;
import org.openmetadata.schema.governance.changeRequest.MutationOpType;
import org.openmetadata.schema.utils.JsonUtils;

class MutationPlannerTest {
  private static JsonNode json(String value) {
    return JsonUtils.readTree(value.replace('\'', '"'));
  }

  @Test
  void scalarChangeBecomesSetWithBase() {
    List<MutationOp> ops =
        MutationPlanner.plan(
            json("{'description':'a'}"), json("{'description':'b'}"),
            Set.of("description"), Set.of("description"));
    assertEquals(1, ops.size());
    assertEquals(MutationOpType.SET, ops.get(0).getOp());
    assertEquals("\"a\"", ops.get(0).getBaseValue());
    assertEquals("\"b\"", ops.get(0).getValue());
    assertTrue(ops.get(0).getGated());
  }

  @Test
  void clearingScalarIsSetToNullAndApplyRemovesField() {
    List<MutationOp> ops =
        MutationPlanner.plan(
            json("{'description':'a'}"), json("{}"), Set.of("description"), Set.of("description"));
    JsonNode applied = MutationPlanner.applyTo(json("{'description':'a','name':'n'}"), ops);
    assertTrue(applied.path("description").isMissingNode());
    assertEquals("n", applied.path("name").asText());
  }

  @Test
  void referenceListDiffsByIdentity() {
    JsonNode base = json("{'owners':[{'id':'1','type':'user'},{'id':'2','type':'user'}]}");
    JsonNode proposed = json("{'owners':[{'id':'2','type':'user'},{'id':'3','type':'user'}]}");
    List<MutationOp> ops = MutationPlanner.plan(base, proposed, Set.of("owners"), Set.of("owners"));
    assertEquals(2, ops.size());
    assertTrue(
        ops.stream().anyMatch(o -> o.getOp() == MutationOpType.ADD && "3".equals(o.getKey())));
    assertTrue(
        ops.stream().anyMatch(o -> o.getOp() == MutationOpType.REMOVE && "1".equals(o.getKey())));
  }

  @Test
  void tagListUsesTagFqnAndIgnoresInherited() {
    JsonNode base =
        json("{'tags':[{'tagFQN':'PII.Sensitive'},{'tagFQN':'Tier.Tier1','inherited':true}]}");
    JsonNode proposed = json("{'tags':[{'tagFQN':'PII.Sensitive'},{'tagFQN':'PII.None'}]}");
    List<MutationOp> ops = MutationPlanner.plan(base, proposed, Set.of("tags"), Set.of("tags"));
    assertEquals(1, ops.size());
    assertEquals("PII.None", ops.get(0).getKey());
  }

  @Test
  void referenceIdentityIgnoresDisplayNameDrift() {
    List<MutationOp> ops =
        MutationPlanner.plan(
            json("{'owners':[{'id':'1','type':'user'}]}"),
            json("{'owners':[{'id':'1','type':'user'},{'id':'2','type':'user'}]}"),
            Set.of("owners"),
            Set.of("owners"));
    JsonNode current = json("{'owners':[{'id':'1','type':'user','displayName':'Renamed'}]}");
    MutationPlanner.ConflictSplit split = MutationPlanner.splitConflicts(current, ops);
    assertEquals(1, split.applicable().size());
    assertEquals(0, split.gatedConflicts().size());
    assertEquals(2, MutationPlanner.applyTo(current, split.applicable()).path("owners").size());
  }

  @Test
  void singleReferenceComparesById() {
    List<MutationOp> ops =
        MutationPlanner.plan(
            json("{'certification':{'id':'c1','displayName':'Gold'}}"),
            json("{'certification':{'id':'c1','displayName':'GOLD'}}"),
            Set.of("certification"),
            Set.of("certification"));
    assertEquals(0, ops.size());
  }

  @Test
  void gatedDriftConflictsAndNonGatedDriftIsDropped() {
    JsonNode base = json("{'description':'a','displayName':'x'}");
    JsonNode proposed = json("{'description':'b','displayName':'y'}");
    List<MutationOp> ops =
        MutationPlanner.plan(
            base, proposed, Set.of("description", "displayName"), Set.of("description"));
    MutationPlanner.ConflictSplit onlyDisplayNameMoved =
        MutationPlanner.splitConflicts(json("{'description':'a','displayName':'z'}"), ops);
    assertEquals(1, onlyDisplayNameMoved.applicable().size());
    assertEquals("displayName", onlyDisplayNameMoved.dropped().get(0).getField());
    MutationPlanner.ConflictSplit descriptionMoved =
        MutationPlanner.splitConflicts(json("{'description':'c','displayName':'x'}"), ops);
    assertEquals("description", descriptionMoved.gatedConflicts().get(0).getField());
  }

  @Test
  void unrelatedFieldDriftIsNotAConflict() {
    List<MutationOp> ops =
        MutationPlanner.plan(
            json("{'description':'a'}"),
            json("{'description':'b'}"),
            Set.of("description"),
            Set.of("description"));
    JsonNode current = json("{'description':'a','displayName':'changed by someone'}");
    MutationPlanner.ConflictSplit split = MutationPlanner.splitConflicts(current, ops);
    assertEquals(1, split.applicable().size());
    assertEquals(
        "changed by someone", MutationPlanner.applyTo(current, ops).path("displayName").asText());
  }

  @Test
  void addAndRemoveAreIdempotentOnApply() {
    List<MutationOp> ops =
        MutationPlanner.plan(
            json("{'tags':[]}"), json("{'tags':[{'tagFQN':'A'}]}"), Set.of("tags"), Set.of("tags"));
    JsonNode alreadyHasA = json("{'tags':[{'tagFQN':'A'},{'tagFQN':'B'}]}");
    assertEquals(2, MutationPlanner.applyTo(alreadyHasA, ops).path("tags").size());
  }

  @Test
  void rebaseRestatesAMovedFieldAgainstThePublishedValue() {
    List<MutationOp> carried =
        MutationPlanner.plan(
            json("{'description':'a','displayName':'x'}"),
            json("{'description':'b','displayName':'y'}"),
            Set.of("description", "displayName"),
            Set.of("description", "displayName"));
    JsonNode current = json("{'displayName':'x'}");

    List<MutationOp> rebased = MutationPlanner.rebase(current, carried);

    MutationOp description =
        rebased.stream().filter(o -> "description".equals(o.getField())).findFirst().orElseThrow();
    assertEquals("null", description.getBaseValue());
    assertEquals("\"b\"", description.getValue());
    assertTrue(MutationPlanner.splitConflicts(current, rebased).gatedConflicts().isEmpty());
    assertEquals(
        carried.stream().filter(o -> "displayName".equals(o.getField())).findFirst().orElseThrow(),
        rebased.stream().filter(o -> "displayName".equals(o.getField())).findFirst().orElseThrow());
  }

  @Test
  void rebaseLeavesOutAChangeThePublishedAssetAlreadyShows() {
    List<MutationOp> carried =
        MutationPlanner.plan(
            json("{'description':'a'}"),
            json("{'description':'b'}"),
            Set.of("description"),
            Set.of("description"));

    assertTrue(MutationPlanner.rebase(json("{'description':'b'}"), carried).isEmpty());
  }

  @Test
  void mergeIsCumulativeAndNextWins() {
    List<MutationOp> prior =
        MutationPlanner.plan(
            json("{'description':'a','owners':[]}"),
            json("{'description':'b','owners':[{'id':'1'}]}"),
            Set.of("description", "owners"),
            Set.of("description", "owners"));
    List<MutationOp> next =
        MutationPlanner.plan(
            json("{'description':'a'}"),
            json("{'description':'c'}"),
            Set.of("description"),
            Set.of("description"));
    List<MutationOp> merged = MutationPlanner.merge(prior, next);
    assertEquals(2, merged.size());
    assertTrue(merged.stream().anyMatch(o -> "\"c\"".equals(o.getValue())));
    assertTrue(merged.stream().anyMatch(o -> "owners".equals(o.getField())));
  }

  @Test
  void digestIsOrderIndependentAndContentSensitive() {
    List<MutationOp> ops =
        MutationPlanner.plan(
            json("{'description':'a','displayName':'x'}"),
            json("{'description':'b','displayName':'y'}"),
            Set.of("description", "displayName"),
            Set.of("description"));
    assertEquals(
        MutationPlanner.digest(ops), MutationPlanner.digest(List.of(ops.get(1), ops.get(0))));
    assertNotEquals(MutationPlanner.digest(ops), MutationPlanner.digest(ops.subList(0, 1)));
  }

  @Test
  void differsIgnoresHydratedReferenceNoise() {
    assertTrue(
        !MutationPlanner.differs(
            json("{'id':'s1','type':'glossary'}"),
            json("{'id':'s1','type':'glossary','name':'g','fullyQualifiedName':'g'}")));
    assertTrue(MutationPlanner.differs(json("'a'"), json("'b'")));
  }
}
