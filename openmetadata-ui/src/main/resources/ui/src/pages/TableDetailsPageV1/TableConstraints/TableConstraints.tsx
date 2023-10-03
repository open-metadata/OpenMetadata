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
import { Space, Tooltip, Typography } from 'antd';
import { isEmpty, map } from 'lodash';
import React, { FC, Fragment, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { FQN_SEPARATOR_CHAR } from '../../../constants/char.constants';
import { SUPPORTED_TABLE_CONSTRAINTS } from '../../../constants/Table.constants';
import { EntityType, FqnPart } from '../../../enums/entity.enum';
import { ConstraintType, Table } from '../../../generated/entity/data/table';
import { getPartialNameFromTableFQN } from '../../../utils/CommonUtils';
import { getEntityLink } from '../../../utils/TableUtils';
import ForeignKeyConstraint from './ForeignKeyConstraint';
import PrimaryKeyConstraint from './PrimaryKeyConstraint';
import './table-constraints.less';

interface TableConstraintsProps {
  constraints: Table['tableConstraints'];
}

const TableConstraints: FC<TableConstraintsProps> = ({ constraints }) => {
  const { t } = useTranslation();

  const supportedConstraints = useMemo(
    () =>
      constraints?.filter((constraint) =>
        SUPPORTED_TABLE_CONSTRAINTS.includes(
          constraint.constraintType as ConstraintType
        )
      ) ?? [],
    [constraints]
  );

  if (isEmpty(supportedConstraints)) {
    return null;
  }

  return (
    <Space className="p-b-sm" direction="vertical">
      <Typography.Text className="right-panel-label">
        {t('label.table-constraints')}
      </Typography.Text>
      {supportedConstraints.map(
        ({ constraintType, columns, referredColumns }) => {
          if (constraintType === ConstraintType.PrimaryKey) {
            return (
              <div className="d-flex constraint-columns">
                <Space
                  className="constraint-icon-container"
                  direction="vertical"
                  size={0}>
                  {columns?.map((column, index) => (
                    <Fragment key={column}>
                      {(columns?.length ?? 0) - 1 !== index ? (
                        <PrimaryKeyConstraint />
                      ) : null}
                    </Fragment>
                  ))}
                </Space>

                <Space direction="vertical" size={16}>
                  {columns?.map((column) => (
                    <Typography.Text
                      className="w-60"
                      ellipsis={{ tooltip: true }}
                      key={column}>
                      {column}
                    </Typography.Text>
                  ))}
                </Space>
              </div>
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
                      <Tooltip
                        placement="top"
                        title={referredColumn}
                        trigger="hover">
                        <Link
                          className="no-underline"
                          to={getEntityLink(
                            EntityType.TABLE,
                            getPartialNameFromTableFQN(
                              referredColumn,
                              [
                                FqnPart.Service,
                                FqnPart.Database,
                                FqnPart.Schema,
                                FqnPart.Table,
                              ],
                              FQN_SEPARATOR_CHAR
                            )
                          )}>
                          <Typography.Text className="truncate referred-column-name">
                            {referredColumn}
                          </Typography.Text>
                        </Link>
                      </Tooltip>
                    ))}
                  </div>
                </Space>
              </Space>
            );
          }

          return null;
        }
      )}
    </Space>
  );
};

export default TableConstraints;
