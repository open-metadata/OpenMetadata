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
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ReactComponent as IconEdit } from '../../../assets/svg/edit-new.svg';
import { ReactComponent as PlusIcon } from '../../../assets/svg/plus-primary.svg';
import TagButton from '../../../components/common/TagButton/TagButton.component';
import { useGenericContext } from '../../../components/GenericProvider/GenericProvider';
import { FQN_SEPARATOR_CHAR } from '../../../constants/char.constants';
import { DE_ACTIVE_COLOR, ICON_DIMENSION } from '../../../constants/constants';
import { EntityType, FqnPart } from '../../../enums/entity.enum';
import { ConstraintType, Table } from '../../../generated/entity/data/table';
import { getPartialNameFromTableFQN } from '../../../utils/CommonUtils';
import entityUtilClassBase from '../../../utils/EntityUtilClassBase';
import { tableConstraintRendererBasedOnType } from '../../../utils/TableUtils';
import ForeignKeyConstraint from './ForeignKeyConstraint';
import './table-constraints.less';
import TableConstraintsModal from './TableConstraintsModal/TableConstraintsModal.component';

const TableConstraints = () => {
  const { t } = useTranslation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { data, permissions, onUpdate } = useGenericContext<Table>();

  const { deleted } = data ?? {};

  const hasPermission = useMemo(
    () => permissions.EditAll && !deleted,
    [permissions, deleted]
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
    await onUpdate({ ...data, tableConstraints: values });
    setIsModalOpen(false);
  };

  return (
    <>
      <Space className="p-b-sm w-full" direction="vertical">
        <Space size="middle">
          <Typography.Text className="right-panel-label">
            {t('label.table-constraints')}
          </Typography.Text>

          {hasPermission && !isEmpty(data?.tableConstraints) && (
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

        {hasPermission && isEmpty(data?.tableConstraints) && (
          <TagButton
            className="text-primary cursor-pointer"
            dataTestId="table-constraints-add-button"
            icon={<PlusIcon height={16} name="plus" width={16} />}
            label={t('label.add')}
            tooltip=""
            onClick={handleOpenEditConstraintModal}
          />
        )}

        {data?.tableConstraints?.map(
          ({ constraintType, columns, referredColumns }) => {
            if (constraintType === ConstraintType.PrimaryKey) {
              return tableConstraintRendererBasedOnType(
                ConstraintType.PrimaryKey,
                columns
              );
            }

            if (constraintType === ConstraintType.SortKey) {
              return tableConstraintRendererBasedOnType(
                ConstraintType.SortKey,
                columns
              );
            }

            if (constraintType === ConstraintType.DistKey) {
              return tableConstraintRendererBasedOnType(
                ConstraintType.DistKey,
                columns
              );
            }

            if (constraintType === ConstraintType.Unique) {
              return tableConstraintRendererBasedOnType(
                ConstraintType.Unique,
                columns
              );
            }
            if (constraintType === ConstraintType.ForeignKey) {
              return (
                <div
                  className="d-flex gap-2 constraint-columns"
                  data-testid={`${ConstraintType.ForeignKey}-container`}
                  key={ConstraintType.ForeignKey}>
                  <ForeignKeyConstraint />
                  <div className="d-flex flex-column gap-2">
                    <Typography.Text data-testid="constraint-column-name">
                      {columns?.join(', ')}
                    </Typography.Text>
                    <div data-testid="referred-column-name-fqn">
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
                  </div>
                </div>
              );
            }

            return null;
          }
        )}
      </Space>

      {isModalOpen && (
        <TableConstraintsModal
          constraint={data?.tableConstraints}
          tableDetails={data}
          onClose={handleCloseEditConstraintModal}
          onSave={handleSubmit}
        />
      )}
    </>
  );
};

export default TableConstraints;
