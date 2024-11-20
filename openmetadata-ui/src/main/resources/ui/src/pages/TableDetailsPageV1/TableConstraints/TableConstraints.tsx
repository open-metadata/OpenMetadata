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
import { Button, Space, Tooltip, Typography } from 'antd';
import { isEmpty, map } from 'lodash';
import React, { FC, Fragment, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ReactComponent as IconEdit } from '../../../assets/svg/edit-new.svg';
import { ReactComponent as PlusIcon } from '../../../assets/svg/plus-primary.svg';
import TagButton from '../../../components/common/TagButton/TagButton.component';
import { FQN_SEPARATOR_CHAR } from '../../../constants/char.constants';
import { DE_ACTIVE_COLOR, ICON_DIMENSION } from '../../../constants/constants';
import { SUPPORTED_TABLE_CONSTRAINTS } from '../../../constants/Table.constants';
import { EntityType, FqnPart } from '../../../enums/entity.enum';
import { ConstraintType, Table } from '../../../generated/entity/data/table';
import { getPartialNameFromTableFQN } from '../../../utils/CommonUtils';
import entityUtilClassBase from '../../../utils/EntityUtilClassBase';
import ForeignKeyConstraint from './ForeignKeyConstraint';
import PrimaryKeyConstraint from './PrimaryKeyConstraint';
import './table-constraints.less';
import TableConstraintsModal from './TableConstraintsModal/TableConstraintsModal.component';

interface TableConstraintsProps {
  hasPermission: boolean;
  tableDetails?: Table;
  onUpdate: (updateData: Table['tableConstraints']) => Promise<void>;
}

const TableConstraints: FC<TableConstraintsProps> = ({
  tableDetails,
  hasPermission,
  onUpdate,
}) => {
  const { t } = useTranslation();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const supportedConstraints = useMemo(
    () =>
      tableDetails?.tableConstraints?.filter((constraint) =>
        SUPPORTED_TABLE_CONSTRAINTS.includes(
          constraint.constraintType as ConstraintType
        )
      ) ?? [],
    [tableDetails?.tableConstraints]
  );

  const handleOpenEditConstraintModal = useCallback(
    () => setIsModalOpen(true),
    []
  );
  const handleCloseEditConstraintModal = useCallback(
    () => setIsModalOpen(false),
    []
  );

  const handleSubmit = async (values: Table['tableConstraints']) => {
    await onUpdate(values);
    setIsModalOpen(false);
  };

  return (
    <>
      <Space className="p-b-sm" direction="vertical">
        <Space size="middle">
          <Typography.Text className="right-panel-label">
            {t('label.table-constraints')}
          </Typography.Text>

          {hasPermission && !isEmpty(supportedConstraints) && (
            <Tooltip
              placement="right"
              title={t('label.edit-entity', {
                entity: t('label.table-constraint-plural'),
              })}>
              <Button
                className="cursor-pointer hover-cell-icon w-fit-content"
                data-testid="edit-table-constraint-button"
                style={{
                  color: DE_ACTIVE_COLOR,
                  padding: 0,
                  border: 'none',
                  background: 'transparent',
                }}
                onClick={handleOpenEditConstraintModal}>
                <IconEdit
                  style={{ color: DE_ACTIVE_COLOR, ...ICON_DIMENSION }}
                />
              </Button>
            </Tooltip>
          )}
        </Space>

        {hasPermission && supportedConstraints.length === 0 && (
          <TagButton
            className="text-primary cursor-pointer"
            dataTestId="table-constraints-add-button"
            icon={<PlusIcon height={16} name="plus" width={16} />}
            label={t('label.add')}
            tooltip=""
            onClick={handleOpenEditConstraintModal}
          />
        )}

        {supportedConstraints.map(
          ({ constraintType, columns, referredColumns }, index) => {
            if (constraintType === ConstraintType.PrimaryKey) {
              return (
                <div className="d-flex constraint-columns" key={index}>
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
                <Space className="constraint-columns" key={index}>
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
                            to={entityUtilClassBase.getEntityLink(
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

      {isModalOpen && (
        <TableConstraintsModal
          constraint={supportedConstraints}
          tableDetails={tableDetails}
          onClose={handleCloseEditConstraintModal}
          onSave={handleSubmit}
        />
      )}
    </>
  );
};

export default TableConstraints;
