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
import { Settings } from 'luxon';
import { DataContractProcessedResultCharts } from '../../components/DataContract/ContractExecutionChart/ContractExecutionChart.interface';
import { DataContractResult } from '../../generated/entity/datacontract/dataContractResult';
import { ContractExecutionStatus } from '../../generated/type/contractExecutionStatus';
import {
  formatContractExecutionTick,
  generateMonthTickPositions,
  processContractExecutionData,
} from './DataContractUtils';

// These tests exercise the *real* luxon `formatMonth` (no mock) together with
// `generateMonthTickPositions`, so the two halves of the contract-execution
// axis — tick *selection* and tick *label text* — are checked in the same
// timezone, including non-UTC zones where UTC grouping previously disagreed
// with local label rendering.
//
// Both `generateMonthTickPositions` and `formatMonth` resolve to luxon's
// `Settings.defaultZone`, so forcing that zone makes the runs deterministic
// regardless of the CI runner's system timezone.
const originalDefaultZone = Settings.defaultZone;
const originalDefaultLocale = Settings.defaultLocale;

const useZone = (zone: string) => {
  Settings.defaultZone = zone;
  Settings.defaultLocale = 'en-US';
};

const restoreZone = () => {
  Settings.defaultZone = originalDefaultZone;
  Settings.defaultLocale = originalDefaultLocale;
};

const rows = (...entries: Array<[string, number]>) =>
  entries.map(
    ([name, displayTimestamp]) =>
      ({ name, displayTimestamp } as DataContractProcessedResultCharts)
  );

// The month label `formatContractExecutionTick` paints on a chosen tick.
const labelOf = (tickName: string) => formatContractExecutionTick(tickName);

describe('generateMonthTickPositions timezone consistency', () => {
  afterEach(() => {
    restoreZone();
  });

  describe('west of UTC (America/New_York, UTC-5 in winter)', () => {
    beforeEach(() => useZone('America/New_York'));

    // UTC instant -> local instant (January is EST, UTC-5):
    //   Jan 15 05:00 UTC  -> Jan 15 00:00 local  (January)
    //   Feb  1 00:30 UTC  -> Jan 31 19:30 local  (January — still locally Jan!)
    //   Feb 15 05:00 UTC  -> Feb 15 00:00 local  (February)
    it('selects the local first-of-February run, not the UTC one, and labels it Feb', () => {
      const jan15 = Date.UTC(2025, 0, 15, 5, 0);
      const feb1Utc = Date.UTC(2025, 1, 1, 0, 30); // UTC Feb, but local Jan 31
      const feb15 = Date.UTC(2025, 1, 15, 5, 0);

      const data = rows(
        [`${jan15}_0`, jan15],
        [`${feb1Utc}_1`, feb1Utc],
        [`${feb15}_2`, feb15]
      );

      const ticks = generateMonthTickPositions(data);

      expect(ticks).toEqual([`${jan15}_0`, `${feb15}_2`]);
      expect(ticks.map(labelOf)).toEqual(['Jan', 'Feb']);
      // The UTC-bucketed "first February" run is locally January: it must not be
      // a tick and must not be painted "Feb".
      expect(ticks).not.toContain(`${feb1Utc}_1`);
      expect(labelOf(`${feb1Utc}_1`)).toBe('Jan');
    });

    it('does not produce two adjacent "Jan" labels with no "Feb"', () => {
      const jan15 = Date.UTC(2025, 0, 15, 5, 0);
      const feb1Utc = Date.UTC(2025, 1, 1, 0, 30);
      const feb15 = Date.UTC(2025, 1, 15, 5, 0);

      const labels = generateMonthTickPositions(
        rows(
          [`${jan15}_0`, jan15],
          [`${feb1Utc}_1`, feb1Utc],
          [`${feb15}_2`, feb15]
        )
      ).map(labelOf);

      expect(labels).not.toEqual(['Jan', 'Jan']);
      expect(labels).toContain('Feb');
    });
  });

  describe('east of UTC (Asia/Kolkata, UTC+5:30, no DST)', () => {
    beforeEach(() => useZone('Asia/Kolkata'));

    // UTC instant -> local instant (UTC+5:30):
    //   Jan 15 18:30 UTC  -> Jan 16 00:00 local  (January)
    //   Jan 31 19:30 UTC  -> Feb  1 01:00 local  (February — locally Feb, UTC Jan!)
    //   Feb 14 18:30 UTC  -> Feb 15 00:00 local  (February)
    it('labels the local first-of-February run (UTC buckets it as January)', () => {
      const jan15 = Date.UTC(2025, 0, 15, 18, 30);
      const localFirstFeb = Date.UTC(2025, 0, 31, 19, 30); // UTC Jan, local Feb
      const feb15 = Date.UTC(2025, 1, 14, 18, 30);

      const data = rows(
        [`${jan15}_0`, jan15],
        [`${localFirstFeb}_1`, localFirstFeb],
        [`${feb15}_2`, feb15]
      );

      const ticks = generateMonthTickPositions(data);

      expect(ticks).toEqual([`${jan15}_0`, `${localFirstFeb}_1`]);
      expect(ticks.map(labelOf)).toEqual(['Jan', 'Feb']);
      // The local-first-February run must be selected — UTC grouping skipped it.
      expect(ticks).toContain(`${localFirstFeb}_1`);
    });

    it('does not drop the first local-February run from the axis', () => {
      const jan15 = Date.UTC(2025, 0, 15, 18, 30);
      const localFirstFeb = Date.UTC(2025, 0, 31, 19, 30);
      const feb15 = Date.UTC(2025, 1, 14, 18, 30);

      const ticks = generateMonthTickPositions(
        rows(
          [`${jan15}_0`, jan15],
          [`${localFirstFeb}_1`, localFirstFeb],
          [`${feb15}_2`, feb15]
        )
      );

      // UTC grouping would have skipped the local-first-February run and ticked
      // mid-February instead; that is the bug, so it must not happen.
      expect(ticks).not.toEqual([`${jan15}_0`, `${feb15}_2`]);
    });
  });

  describe('UTC (no offset, no regression)', () => {
    beforeEach(() => useZone('UTC'));

    it('labels the first run of each UTC month at a UTC month boundary', () => {
      const jan15 = Date.UTC(2025, 0, 15);
      const feb1 = Date.UTC(2025, 1, 1, 0, 30);
      const feb15 = Date.UTC(2025, 1, 15);

      const ticks = generateMonthTickPositions(
        rows([`${jan15}_0`, jan15], [`${feb1}_1`, feb1], [`${feb15}_2`, feb15])
      );

      expect(ticks).toEqual([`${jan15}_0`, `${feb1}_1`]);
      expect(ticks.map(labelOf)).toEqual(['Jan', 'Feb']);
    });

    it('starts a new tick across a year boundary', () => {
      const dec30 = Date.UTC(2021, 11, 30);
      const dec31 = Date.UTC(2021, 11, 31);
      const jan2 = Date.UTC(2022, 0, 2);

      const ticks = generateMonthTickPositions(
        rows([`${dec30}_0`, dec30], [`${dec31}_1`, dec31], [`${jan2}_2`, jan2])
      );

      expect(ticks).toEqual([`${dec30}_0`, `${jan2}_2`]);
      expect(ticks.map(labelOf)).toEqual(['Dec', 'Jan']);
    });
  });

  describe('end-to-end via processContractExecutionData', () => {
    beforeEach(() => useZone('America/New_York'));

    // In New York winter (UTC-5), the run at 2025-02-01 00:30 UTC is locally
    // 2025-01-31 19:30 — i.e. still January. The first *local* February run is
    // 2025-02-01 05:00 UTC (== 2025-02-01 00:00 local).
    it('keeps tick selection and label formatting consistent in a non-UTC zone', () => {
      const results: DataContractResult[] = [
        {
          id: 'run-Jan15',
          timestamp: Date.UTC(2025, 0, 15, 5, 0), // local Jan 15
          contractExecutionStatus: ContractExecutionStatus.Success,
        },
        {
          id: 'run-Feb1Utc',
          timestamp: Date.UTC(2025, 1, 1, 0, 30), // local Jan 31 19:30
          contractExecutionStatus: ContractExecutionStatus.Success,
        },
        {
          id: 'run-Feb1Local',
          timestamp: Date.UTC(2025, 1, 1, 5, 0), // local Feb 1 00:00
          contractExecutionStatus: ContractExecutionStatus.Success,
        },
      ] as unknown as DataContractResult[];

      const processed = processContractExecutionData(results);
      const ticks = generateMonthTickPositions(processed);
      const labels = ticks.map(labelOf);

      expect(ticks).toEqual([processed[0].name, processed[2].name]);
      expect(labels).toEqual(['Jan', 'Feb']);
      // The run that is locally-still-January carries no tick and no Feb label.
      expect(ticks).not.toContain(processed[1].name);
    });
  });
});
