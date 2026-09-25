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

package org.openmetadata.service.datacontract.sla;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.time.Clock;
import java.util.function.Function;
import org.openmetadata.schema.api.data.ContractSLA;
import org.openmetadata.schema.entity.data.DataContract;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.datacontract.SlaValidation;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.datacontract.odcs.ODCSTableTarget;

/**
 * Checks a data contract's SLA against when its table's data was last refreshed. The refresh time
 * comes from what OpenMetadata already records about the table, so a requirement nothing recorded
 * can decide is reported as not evaluated rather than missed.
 */
public final class ContractSlaValidator {
  static final String TABLES_ONLY = "Not evaluated: SLA checks run only for tables.";
  static final String NO_REFRESH_TIME =
      "Not evaluated: nothing records when this table's data was refreshed. Profile the SLA"
          + " column, or collect the table's system metrics or life cycle.";

  private final Clock clock;
  private final Function<EntityReference, Table> tableLoader;
  private final RefreshHistoryLoader historyLoader;

  /**
   * @param tableLoader loads the contract's table with its columns and life cycle
   */
  public ContractSlaValidator(
      Clock clock,
      Function<EntityReference, Table> tableLoader,
      RefreshHistoryLoader historyLoader) {
    this.clock = clock;
    this.tableLoader = tableLoader;
    this.historyLoader = historyLoader;
  }

  /**
   * @return the SLA's validation, or null when the contract states no SLA requirement that can be
   *     checked (refresh frequency, maximum latency or availability time)
   */
  public SlaValidation validate(DataContract contract) {
    ContractSLA sla = contract.getSla();
    SlaValidation validation = null;
    if (sla != null && hasCheckableRequirement(sla)) {
      validation =
          isTable(contract)
              ? validateTable(contract, sla)
              : new SlaValidation().withMessage(TABLES_ONLY);
    }
    return validation;
  }

  private SlaValidation validateTable(DataContract contract, ContractSLA sla) {
    Table table = tableLoader.apply(contract.getEntity());
    SlaCheck check = new SlaCheck(sla, clock.instant());
    return historyLoader
        .load(table, slaColumnFqn(table, sla), check.since(), check.zone())
        .map(check::evaluate)
        .orElseGet(() -> new SlaValidation().withMessage(NO_REFRESH_TIME));
  }

  /** The SLA column's FQN; contracts may name it by FQN or, from older imports, by name. */
  private static String slaColumnFqn(Table table, ContractSLA sla) {
    return sla.getColumnName() == null
        ? null
        : ODCSTableTarget.of(table).resolveColumnFqn(sla.getColumnName()).orElse(null);
  }

  private static boolean hasCheckableRequirement(ContractSLA sla) {
    return sla.getRefreshFrequency() != null
        || sla.getMaxLatency() != null
        || !nullOrEmpty(sla.getAvailabilityTime());
  }

  private static boolean isTable(DataContract contract) {
    return contract.getEntity() != null && Entity.TABLE.equals(contract.getEntity().getType());
  }
}
