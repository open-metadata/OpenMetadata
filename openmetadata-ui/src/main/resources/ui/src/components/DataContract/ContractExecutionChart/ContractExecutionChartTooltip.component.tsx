/*
 *  Copyright 2025 Collate.
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
import { DQTooltipContent } from '../../../utils/DataQuality/CustomDQTooltip.component';
import { formatDateTimeLong } from '../../../utils/date-time/DateTimeUtils';
import { DataContractProcessedResultCharts } from './ContractExecutionChart.interface';

export interface ContractExecutionChartTooltipProps {
  datum: DataContractProcessedResultCharts;
  /** Translated `label.contract-execution-status`. */
  label: string;
  /** Translated name of the run's status. */
  statusLabel: string;
  /** Swatch colour: the bar's palette colour. */
  color: string;
}

/** One run. Rendered through core `tooltip.render`, so it holds no hooks. */
const ContractExecutionChartTooltip = ({
  datum,
  label,
  statusLabel,
  color,
}: ContractExecutionChartTooltipProps) => (
  <DQTooltipContent
    header={formatDateTimeLong(datum.displayTimestamp)}
    rows={[
      {
        key: 'contract-execution-status',
        name: label,
        value: statusLabel,
        color,
      },
    ]}
    transformLabel={false}
  />
);

export default ContractExecutionChartTooltip;
