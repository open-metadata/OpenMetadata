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
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  WidgetEditButton,
  WidgetPlusButton,
} from '../../../components/common/WidgetActionButton/WidgetActionButton';
import WidgetCard from '../../../components/common/WidgetCard/WidgetCard';
import { useGenericContext } from '../../../components/Customization/GenericProvider/GenericContext';
import { FQN_SEPARATOR_CHAR } from '../../../constants/char.constants';
import { EntityType, FqnPart } from '../../../enums/entity.enum';
import { ConstraintType, Table } from '../../../generated/entity/data/table';
import entityUtilClassBase from '../../../utils/EntityUtilClassBase';
import { getPartialNameFromTableFQN } from '../../../utils/FqnUtils';
import { tableConstraintRendererBasedOnType } from '../../../utils/TableUtils';
import ForeignKeyConstraint from './ForeignKeyConstraint';
import './table-constraints.less';
import TableConstraintsModal from './TableConstraintsModal/TableConstraintsModal.component';

const TableConstraints = ({
  renderAsExpandableCard = true,
}: {
  renderAsExpandableCard?: boolean;
}) => {
  const { t } = useTranslation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { data, permissions, onUpdate } = useGenericContext<Table>();

  const { deleted } = data ?? {};

  const hasPermission = useMemo(
    () => permissions?.EditAll && !deleted,
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

  const showAddConstraint = hasPermission && isEmpty(data?.tableConstraints);
  const showEditConstraint = hasPermission && !isEmpty(data?.tableConstraints);

  const headerExtra = showAddConstraint ? (
    <WidgetPlusButton
      data-testid="table-constraints-add-button"
      title={t('label.add-entity', { entity: t('label.table-constraints') })}
      onClick={handleOpenEditConstraintModal}
    />
  ) : showEditConstraint ? (
    <WidgetEditButton
      data-testid="edit-table-constraint-button"
      title={t('label.edit-entity', { entity: t('label.table-constraints') })}
      onClick={handleOpenEditConstraintModal}
    />
  ) : null;

  const content = isEmpty(data?.tableConstraints) ? null : (
    <Space className="w-full new-header-border-card" direction="vertical">
      {data?.tableConstraints?.map(
        ({ constraintType, columns, referredColumns }) => {
          if (
            constraintType &&
            [
              ConstraintType.PrimaryKey,
              ConstraintType.SortKey,
              ConstraintType.DistKey,
              ConstraintType.ClusterKey,
              ConstraintType.Unique,
            ].includes(constraintType)
          ) {
            return tableConstraintRendererBasedOnType(constraintType, columns);
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
  );

  return (
    <>
      {renderAsExpandableCard ? (
        <WidgetCard
          headerExtra={headerExtra}
          isExpandDisabled={isEmpty(data?.tableConstraints)}
          title={t('label.table-constraints')}>
          {content}
        </WidgetCard>
      ) : (
        content
      )}
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
