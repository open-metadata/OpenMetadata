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

package org.openmetadata.service.datacontract.odcs;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.ArrayList;
import java.util.IdentityHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import org.openmetadata.schema.api.data.ContractSLA;
import org.openmetadata.schema.api.data.RefreshFrequency;
import org.openmetadata.schema.entity.data.DataContract;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSQualityRule;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.datacontract.odcs.ODCSRuleOutcome.SlaOutcome;
import org.openmetadata.service.datacontract.odcs.ODCSRuleOutcome.TestCaseOutcome;
import org.openmetadata.service.datacontract.odcs.ODCSRuleOutcome.UnsupportedOutcome;

/**
 * Makes the ODCS quality rules of an imported contract run in OpenMetadata: rules with an OpenMetadata test
 * equivalent become test cases linked as the contract's quality expectations, and freshness rules
 * become the contract's refresh-frequency SLA. The rules themselves stay on the contract so the
 * ODCS document can be exported again unchanged.
 */
public final class ODCSQualityRuleImporter {

  /**
   * @param ownedTestCaseIds test cases the contract links today, which the import may update
   */
  public record Request(
      DataContract contract,
      Set<UUID> ownedTestCaseIds,
      ODCSTestCaseMaterializer.WriteGuard guard,
      String user) {}

  private final ODCSTestCaseMaterializer materializer;
  private final Function<EntityReference, Table> tableLoader;

  public ODCSQualityRuleImporter(
      ODCSTestCaseMaterializer materializer, Function<EntityReference, Table> tableLoader) {
    this.materializer = materializer;
    this.tableLoader = tableLoader;
  }

  /**
   * Updates the contract in place and returns what became of each rule. Quality expectations are
   * only supported on tables, so for any other entity nothing is created.
   */
  public List<ODCSRuleOutcome> apply(Request request) {
    return isRunnable(request.contract()) ? importRules(request) : List.of();
  }

  /**
   * What {@link #apply} would do, without creating test cases. The contract's SLA is updated as
   * {@link #apply} would, so pass a contract that is not stored.
   */
  public List<ODCSRuleOutcome> preview(Request request) {
    return isRunnable(request.contract()) ? previewRules(request) : List.of();
  }

  /**
   * Points the SLA's refresh-time column, which the ODCS document names by the column's own name, at
   * the table's column, and drops it when the table has no such column.
   *
   * @return whether the contract named a column the table does not have
   */
  public boolean resolveSlaColumn(DataContract contract) {
    ContractSLA sla = contract.getSla();
    boolean dropped = false;
    if (sla != null && sla.getColumnName() != null && isTable(contract)) {
      ODCSSlaColumn.resolve(sla, ODCSTableTarget.of(tableLoader.apply(contract.getEntity())));
      dropped = sla.getColumnName() == null;
    }
    return dropped;
  }

  private static boolean isTable(DataContract contract) {
    return contract.getEntity() != null && Entity.TABLE.equals(contract.getEntity().getType());
  }

  private List<ODCSRuleOutcome> importRules(Request request) {
    List<ODCSRuleOutcome> outcomes = mapRules(request.contract());
    ODCSTestCaseMaterializer.Result result =
        materializer.materialize(materializationRequest(request, outcomes));
    request.contract().setQualityExpectations(result.testCases());
    return withSkipped(outcomes, result.skipped());
  }

  private List<ODCSRuleOutcome> previewRules(Request request) {
    List<ODCSRuleOutcome> outcomes = mapRules(request.contract());
    return withSkipped(outcomes, materializer.conflicts(materializationRequest(request, outcomes)));
  }

  private List<ODCSRuleOutcome> mapRules(DataContract contract) {
    ODCSTableTarget target = ODCSTableTarget.of(tableLoader.apply(contract.getEntity()));
    return applyFreshness(
        contract, ODCSQualityRuleMapper.map(contract.getOdcsQualityRules(), target));
  }

  private static ODCSTestCaseMaterializer.Request materializationRequest(
      Request request, List<ODCSRuleOutcome> outcomes) {
    return new ODCSTestCaseMaterializer.Request(
        testCaseOutcomes(outcomes), request.ownedTestCaseIds(), request.guard(), request.user());
  }

  private static boolean isRunnable(DataContract contract) {
    return isTable(contract) && !nullOrEmpty(contract.getOdcsQualityRules());
  }

  /**
   * Freshness rules set the SLA's refresh frequency. Once the contract's own SLA properties or an
   * earlier rule has set it, a rule that agrees counts as applied and one that does not is reported.
   */
  private static List<ODCSRuleOutcome> applyFreshness(
      DataContract contract, List<ODCSRuleOutcome> outcomes) {
    List<ODCSRuleOutcome> applied = new ArrayList<>();
    for (ODCSRuleOutcome outcome : outcomes) {
      applied.add(
          outcome instanceof SlaOutcome freshness ? applyToSla(contract, freshness) : outcome);
    }
    return applied;
  }

  private static ODCSRuleOutcome applyToSla(DataContract contract, SlaOutcome freshness) {
    ContractSLA sla =
        contract.getSla() == null ? new ContractSLA().withTimezone(null) : contract.getSla();
    RefreshFrequency declared = sla.getRefreshFrequency();
    ODCSRuleOutcome outcome = freshness;
    if (declared != null
        && !ODCSFreshness.isSameFrequency(declared, freshness.refreshFrequency())) {
      outcome = conflictWithTheSla(declared, freshness);
    } else {
      sla.setRefreshFrequency(freshness.refreshFrequency());
      if (sla.getColumnName() == null) {
        sla.setColumnName(freshness.columnName());
      }
      contract.setSla(sla);
    }
    return outcome;
  }

  private static UnsupportedOutcome conflictWithTheSla(
      RefreshFrequency declared, SlaOutcome freshness) {
    return new UnsupportedOutcome(
        freshness.rule(),
        String.format(
            "The contract SLA already sets a refresh frequency of %s, which this rule's %s would"
                + " change.",
            ODCSFreshness.describe(declared),
            ODCSFreshness.describe(freshness.refreshFrequency())));
  }

  private static List<TestCaseOutcome> testCaseOutcomes(List<ODCSRuleOutcome> outcomes) {
    return outcomes.stream()
        .filter(TestCaseOutcome.class::isInstance)
        .map(TestCaseOutcome.class::cast)
        .toList();
  }

  private static List<ODCSRuleOutcome> withSkipped(
      List<ODCSRuleOutcome> outcomes, List<UnsupportedOutcome> skipped) {
    Map<ODCSQualityRule, UnsupportedOutcome> skippedByRule = new IdentityHashMap<>();
    skipped.forEach(outcome -> skippedByRule.put(outcome.rule(), outcome));
    return outcomes.stream()
        .<ODCSRuleOutcome>map(
            outcome ->
                skippedByRule.containsKey(outcome.rule())
                    ? skippedByRule.get(outcome.rule())
                    : outcome)
        .toList();
  }
}
