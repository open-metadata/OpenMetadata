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
import { ReactComponent as SkippedIcon } from '../assets/svg/ic-aborted.svg';
import { ReactComponent as FailedIcon } from '../assets/svg/ic-fail.svg';
import { ReactComponent as SuccessIcon } from '../assets/svg/ic-successful.svg';
import { StatusData } from '../components/DataQuality/ChartWidgets/StatusCardWidget/StatusCardWidget.interface';
import { DataQualityDimensions } from '../generated/tests/testDefinition';

export const TEST_CASE_STATUS_ICON = {
  Aborted: SkippedIcon,
  Failed: FailedIcon,
  Queued: SkippedIcon,
  Success: SuccessIcon,
};

const moveItemsToEnd = <T>(arr: T[], predicate: (item: T) => boolean): T[] => {
  const keep: T[] = [];
  const move: T[] = [];
  for (const item of arr) {
    if (predicate(item)) {
      move.push(item);
    } else {
      keep.push(item);
    }
  }

  return [...keep, ...move];
};

export const NO_DIMENSION = 'No Dimension';
export const DIMENSIONS_DATA = moveItemsToEnd(
  Object.values(DataQualityDimensions),
  (dimension: DataQualityDimensions) =>
    dimension === DataQualityDimensions.NoDimension
);

export const DEFAULT_DIMENSIONS_DATA = DIMENSIONS_DATA.reduce((acc, item) => {
  return {
    ...acc,
    [item]: {
      title: item,
      success: 0,
      failed: 0,
      aborted: 0,
      total: 0,
    },
  };
}, {} as { [key: string]: StatusData });

export const DATA_QUALITY_DASHBOARD_HEADER = {
  dataHealth: {
    header: 'label.data-health',
    subHeader: 'message.data-health-sub-header',
  },
  dataDimensions: {
    header: 'label.data-dimensions',
    subHeader: 'message.data-dimensions-sub-header',
  },
  testCasesStatus: {
    header: 'label.test-case-status',
    subHeader: 'message.test-case-status-sub-header',
  },
  incidentMetrics: {
    header: 'label.incident-metrics',
    subHeader: 'message.incident-metrics-sub-header',
  },
};

export const DQ_FILTER_KEYS = {
  OWNER: 'owner',
  TIER: 'tier',
  TAGS: 'tags',
  GLOSSARY_TERMS: 'glossaryTerms',
  DATA_PRODUCTS: 'dataProducts',
} as const;
