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
import Icon from '@ant-design/icons';
import { ColumnsType } from 'antd/lib/table';
import classNames from 'classnames';
import { ReactComponent as FilterIcon } from '../assets/svg/ic-filter.svg';
import { OwnerLabel } from '../components/common/OwnerLabel/OwnerLabel.component';
import { TABLE_COLUMNS_KEYS } from '../constants/TableKeys.constants';
import { EntityReference } from '../generated/type/entityReference';
import i18n from './i18next/LocalUtil';

export const columnFilterIcon = (filtered: boolean) => (
  <Icon
    className={classNames('filter-icon', {
      'filter-icon-active': filtered,
    })}
    component={FilterIcon}
    data-testid="filter-icon"
  />
);

export const ownerTableObject = <
  T extends { owners?: EntityReference[] }
>(): ColumnsType<T> => [
  {
    title: i18n.t('label.owner-plural').toString(),
    dataIndex: TABLE_COLUMNS_KEYS.OWNERS,
    key: TABLE_COLUMNS_KEYS.OWNERS,
    width: 180,
    filterIcon: columnFilterIcon,
    render: (owners: EntityReference[]) => (
      <OwnerLabel
        isCompactView={false}
        maxVisibleOwners={4}
        owners={owners}
        showLabel={false}
      />
    ),
  },
];
