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
import { Button, Table } from 'antd';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as Delete } from '../../../assets/svg/delete-colored.svg';
import { ReactComponent as EditIcon } from '../../../assets/svg/edit-new.svg';
import {
  fieldValueBoostAdditionalColumns,
  fieldValueBoostBaseColumns,
} from '../../../constants/SearchSettings.constant';
import { FieldValueBoost } from '../../../generated/configuration/searchSettings';
import './field-value-boost-list.less';

interface FieldValueBoostListProps {
  entitySearchSettingsPage?: boolean;
  fieldValueBoosts: FieldValueBoost[];
  isLoading: boolean;
  dataTestId: string;
  handleEditFieldValueBoost: (record: FieldValueBoost) => void;
  handleDeleteFieldValueBoost: (field: string) => void;
}

const FieldValueBoostList: React.FC<FieldValueBoostListProps> = ({
  entitySearchSettingsPage = false,
  fieldValueBoosts,
  isLoading,
  dataTestId,
  handleEditFieldValueBoost,
  handleDeleteFieldValueBoost,
}) => {
  const { t } = useTranslation();

  const columns = useMemo(() => {
    return [
      ...fieldValueBoostBaseColumns,
      ...(!entitySearchSettingsPage
        ? [
            ...fieldValueBoostAdditionalColumns,
            {
              title: t('label.greater-than'),
              key: 'gt',
              width: 120,
              render: (record: FieldValueBoost) => (
                <span>{record.condition?.range?.gt ?? '-'}</span>
              ),
            },
            {
              title: t('label.greater-than-or-equal-to'),
              key: 'gte',
              width: 120,
              render: (record: FieldValueBoost) => (
                <span>{record.condition?.range?.gte ?? '-'}</span>
              ),
            },
            {
              title: t('label.less-than'),
              key: 'lt',
              width: 120,
              render: (record: FieldValueBoost) => (
                <span>{record.condition?.range?.lt ?? '-'}</span>
              ),
            },
            {
              title: t('label.less-than-or-equal-to'),
              key: 'lte',
              width: 120,
              render: (record: FieldValueBoost) => (
                <span>{record.condition?.range?.lte ?? '-'}</span>
              ),
            },
          ]
        : []),
      {
        title: t('label.action-plural'),
        key: 'actions',
        width: 100,
        render: (record: FieldValueBoost) => (
          <div className="d-flex items-center gap-2">
            <Button
              className="edit-field-value-boost-btn"
              data-testid="edit-field-value-boost-btn"
              icon={<Icon className="text-md" component={EditIcon} />}
              type="text"
              onClick={() => handleEditFieldValueBoost(record)}
            />
            <Button
              className="delete-field-value-boost-btn"
              data-testid="delete-field-value-boost-btn"
              icon={<Icon className="text-md" component={Delete} />}
              type="text"
              onClick={() => handleDeleteFieldValueBoost(record.field)}
            />
          </div>
        ),
      },
    ];
  }, [
    handleEditFieldValueBoost,
    handleDeleteFieldValueBoost,
    entitySearchSettingsPage,
  ]);

  return (
    <Table
      columns={columns}
      data-testid={dataTestId}
      dataSource={fieldValueBoosts?.map((boost: FieldValueBoost) => ({
        ...boost,
        key: boost.field,
      }))}
      loading={isLoading}
      pagination={false}
      rowClassName={() => 'field-value-row'}
      scroll={{ x: 'max-content' }}
      size="small"
    />
  );
};

export default FieldValueBoostList;
