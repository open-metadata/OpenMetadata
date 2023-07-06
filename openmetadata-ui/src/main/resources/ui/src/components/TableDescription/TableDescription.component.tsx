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

import { Button, Space } from 'antd';
import RichTextEditorPreviewer from 'components/common/rich-text-editor/RichTextEditorPreviewer';
import { DE_ACTIVE_COLOR } from 'constants/constants';
import EntityTaskDescription from 'pages/TasksPage/EntityTaskDescription/EntityTaskDescription.component';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as EditIcon } from '../../assets/svg/edit-new.svg';
import { TableDescriptionProps } from './TableDescription.interface';

const TableDescription = ({
  index,
  columnData,
  entityFqn,
  isReadOnly,
  onClick,
  entityType,
  hasEditPermission,
  entityFieldThreads,
  onThreadLinkSelect,
}: TableDescriptionProps) => {
  const { t } = useTranslation();

  return (
    <Space
      className="w-full tw-group cursor-pointer"
      data-testid="description"
      id={`field-description-${index}`}>
      <div>
        {columnData.description ? (
          <RichTextEditorPreviewer markdown={columnData.description} />
        ) : (
          <span className="text-grey-muted">
            {t('label.no-entity', {
              entity: t('label.description'),
            })}
          </span>
        )}
      </div>
      <div className="d-flex tw--mt-1.5">
        {!isReadOnly ? (
          <>
            {hasEditPermission && (
              <Button
                className="p-0 tw-self-start flex-center w-7 h-7 d-flex-none hover-cell-icon"
                data-testid="edit-button"
                icon={
                  <EditIcon
                    height={14}
                    name={t('label.edit')}
                    style={{ color: DE_ACTIVE_COLOR }}
                    width={14}
                  />
                }
                type="text"
                onClick={onClick}
              />
            )}

            <EntityTaskDescription
              data={columnData}
              entityFieldThreads={entityFieldThreads}
              entityFqn={entityFqn}
              entityType={entityType}
              onThreadLinkSelect={onThreadLinkSelect}
            />
          </>
        ) : null}
      </div>
    </Space>
  );
};

export default TableDescription;
