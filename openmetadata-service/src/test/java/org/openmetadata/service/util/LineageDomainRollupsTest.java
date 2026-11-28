package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.util.LineageDomainRollups.DomainMove;
import org.openmetadata.service.util.LineageDomainRollups.DomainPair;
import org.openmetadata.service.util.LineageDomainRollups.DomainPairTally;

class LineageDomainRollupsTest {

  private static final EntityReference D1 = domain("d1");
  private static final EntityReference D2 = domain("d2");
  private static final EntityReference D3 = domain("d3");

  @Test
  void tallySkipsPairsWhoseEndsShareADomain() {
    DomainPairTally tally = new DomainPairTally();

    tally.add(List.of(D1, D2), List.of(D2), 1);

    assertEquals(Map.of(pair(D1, D2), 1), tally.counts());
  }

  @Test
  void tallyNetsAMoveToMinusBeforePlusAfter() {
    DomainPairTally tally = new DomainPairTally();

    tally.add(List.of(D1), List.of(D2), -1);
    tally.add(List.of(D3), List.of(D2), 1);
    tally.add(List.of(D3), List.of(D2), 1);

    assertEquals(Map.of(pair(D1, D2), -1, pair(D3, D2), 2), tally.counts());
    assertEquals(D3, tally.domain(D3.getId()));
  }

  @Test
  void tallyCountsEachDirectionOfACycle() {
    DomainPairTally tally = new DomainPairTally();

    tally.add(List.of(D1), List.of(D2), 1);
    tally.add(List.of(D2), List.of(D1), 1);

    assertEquals(Map.of(pair(D1, D2), 1, pair(D2, D1), 1), tally.counts());
  }

  @Test
  void domainMoveIgnoresOrderAndDuplicates() {
    EntityReference table = new EntityReference().withId(UUID.randomUUID()).withType(Entity.TABLE);

    DomainMove move = new DomainMove(table, List.of(D1, D2), List.of(D2, D1, D1));

    assertFalse(move.changes());
    assertEquals(List.of(D2, D1), move.after());
    assertTrue(new DomainMove(table, List.of(D1), List.of(D1, D3)).changes());
    assertTrue(new DomainMove(table, null, List.of(D1)).changes());
  }

  @Test
  void rollupRowsDoNotRollUp() {
    assertTrue(LineageDomainRollups.isRollup("{\"source\":\"ChildAssets\",\"assetEdges\":2}"));
    assertFalse(LineageDomainRollups.isRollup("{\"source\":\"Manual\",\"assetEdges\":2}"));
    assertFalse(LineageDomainRollups.isRollup("{}"));
    assertFalse(LineageDomainRollups.isRollup(null));
  }

  private static DomainPair pair(EntityReference from, EntityReference to) {
    return new DomainPair(from.getId(), to.getId());
  }

  private static EntityReference domain(String name) {
    return new EntityReference()
        .withId(UUID.randomUUID())
        .withType(Entity.DOMAIN)
        .withName(name)
        .withFullyQualifiedName(name);
  }
}
