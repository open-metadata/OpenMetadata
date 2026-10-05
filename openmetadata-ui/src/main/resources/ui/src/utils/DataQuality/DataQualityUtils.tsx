/*
 *  Copyright 2024 Collate.
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
import { Typography } from '@openmetadata/ui-core-components';
import { t } from 'i18next';
import { ReactComponent as ColumnIcon } from '../../assets/svg/entity/column.svg';
import { ReactComponent as TableIcon } from '../../assets/svg/ic-table-test.svg';
import type { SelectionOption } from '../../components/common/SelectionCardGroup/SelectionCardGroup.interface';
import { TestCaseType } from '../../enums/TestSuite.enum';

export const TEST_LEVEL_OPTIONS: SelectionOption[] = [
  {
    value: TestCaseType.table,
    label: t('label.table-level'),
    description: t('label.test-applied-on-entity', {
      entity: t('label.table-lowercase'),
    }),
    icon: <TableIcon />,
  },
  {
    value: TestCaseType.column,
    label: t('label.column-level'),
    description: t('label.test-applied-on-entity', {
      entity: t('label.column-lowercase'),
    }),
    icon: <ColumnIcon />,
  },
];

export const getPieChartLabel = (label: string, value = 0) => {
  return (
    <div className="tw:flex tw:flex-col tw:items-center">
      <Typography color="secondary" size="text-xs" weight="medium">
        {label}
      </Typography>
      <Typography className="tw:text-primary" size="text-xl" weight="semibold">
        {value}
      </Typography>
    </div>
  );
};
