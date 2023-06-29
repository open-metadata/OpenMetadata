/*
 *  Copyright 2023 Collate.
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
import { Space, Typography } from 'antd';
import { ConstraintType, Table } from 'generated/entity/data/table';
import { isUndefined, map } from 'lodash';
import React, { FC, Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import ForeignKeyConstraint from './ForeignKeyConstraint';
import PrimaryKeyConstraint from './PrimaryKeyConstraint';
import './table-constraints.less';

interface TableConstraintsProps {
  constraints: Table['tableConstraints'];
}

const TableConstraints: FC<TableConstraintsProps> = ({ constraints }) => {
  const { t } = useTranslation();

  if (isUndefined(constraints)) {
    return null;
  }

  return (
    <Space className="p-b-sm" direction="vertical">
      <Typography.Text className="right-panel-label">
        {t('label.table-constraint')}
      </Typography.Text>
      {constraints.map(({ constraintType, columns, referredColumns }) => {
        if (constraintType === ConstraintType.PrimaryKey) {
          const columnsLength = (columns?.length ?? 0) - 1;

          return (
            <Space className="constraint-columns">
              {columns?.map((column, index) => (
                <Fragment key={column}>
                  <Typography.Text>{column}</Typography.Text>
                  {index < columnsLength ? <PrimaryKeyConstraint /> : null}
                </Fragment>
              ))}
            </Space>
          );
        }
        if (constraintType === ConstraintType.ForeignKey) {
          return (
            <Space className="constraint-columns">
              <ForeignKeyConstraint />
              <Space direction="vertical" size={16}>
                <Typography.Text>{columns?.join(', ')}</Typography.Text>
                <div data-testid="referred-column-name">
                  {map(referredColumns, (referredColumn) => (
                    <Typography.Text className="truncate referred-column-name">
                      {referredColumn}
                    </Typography.Text>
                  ))}
                </div>
              </Space>
            </Space>
          );
        }

        return null;
      })}
    </Space>
  );
};

export default TableConstraints;
