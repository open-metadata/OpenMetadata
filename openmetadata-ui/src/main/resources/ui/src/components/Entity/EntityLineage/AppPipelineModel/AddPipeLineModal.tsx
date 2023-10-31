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

import { Button, Input, Modal } from 'antd';
import classNames from 'classnames';
import { t } from 'i18next';
import { isEmpty, isUndefined } from 'lodash';
import React, { useMemo } from 'react';
import { ERROR_PLACEHOLDER_TYPE, SIZE } from '../../../../enums/common.enum';
import { EntityReference } from '../../../../generated/entity/type';
import { getEntityName } from '../../../../utils/EntityUtils';
import Fqn from '../../../../utils/Fqn';
import { getEntityIcon } from '../../../../utils/TableUtils';
import ErrorPlaceHolder from '../../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import '../../../FeedEditor/feed-editor.less';
import './add-pipeline-modal.less';

interface AddPipeLineModalType {
  showAddEdgeModal: boolean;
  edgeSearchValue: string;
  selectedEdgeId: string | undefined;
  edgeOptions: EntityReference[];
  onModalCancel: () => void;
  onSave: () => void;
  onRemoveEdgeClick: (evt: React.MouseEvent<HTMLButtonElement>) => void;
  onSearch: (value: string) => void;
  onSelect: (value: string) => void;
}

const AddPipeLineModal = ({
  showAddEdgeModal,
  edgeOptions,
  edgeSearchValue,
  selectedEdgeId,
  onRemoveEdgeClick,
  onModalCancel,
  onSave,
  onSearch,
  onSelect,
}: AddPipeLineModalType) => {
  const errorPlaceholderEdge = useMemo(() => {
    if (isEmpty(edgeOptions)) {
      if (edgeSearchValue) {
        return (
          <ErrorPlaceHolder
            className="mt-0-important"
            size={SIZE.MEDIUM}
            type={ERROR_PLACEHOLDER_TYPE.FILTER}
          />
        );
      }

      return <ErrorPlaceHolder />;
    }

    return;
  }, [edgeOptions, edgeSearchValue]);

  return (
    <Modal
      destroyOnClose
      data-testid="add-edge-modal"
      footer={[
        <Button
          data-testid="remove-edge-button"
          key="remove-edge-btn"
          type="text"
          onClick={onRemoveEdgeClick}>
          {t('label.remove-entity', {
            entity: t('label.edge-lowercase'),
          })}
        </Button>,
        <Button
          data-testid="save-button"
          key="save-btn"
          type="primary"
          onClick={onSave}>
          {t('label.save')}
        </Button>,
      ]}
      maskClosable={false}
      open={showAddEdgeModal}
      title={t(`label.${isUndefined(selectedEdgeId) ? 'add' : 'edit'}-entity`, {
        entity: t('label.edge'),
      })}
      onCancel={onModalCancel}>
      <Input
        data-testid="field-input"
        placeholder={t('message.search-for-edge')}
        value={edgeSearchValue}
        onChange={(e) => onSearch(e.target.value)}
      />

      <div className="edge-option-container">
        {edgeOptions.map((item) => {
          const icon = getEntityIcon(item.type);
          const breadcrumb = Fqn.split(item.fullyQualifiedName).join('/');

          return (
            <div
              className={classNames('edge-option-item gap-2', {
                active: selectedEdgeId === item.id,
              })}
              key={item.id}
              onClick={() => onSelect(item.id)}>
              <div className="flex-center mention-icon-image">{icon}</div>
              <div>
                <div className="d-flex flex-wrap">
                  <span className="truncate breadcrumb">{breadcrumb}</span>
                </div>
                <div className="d-flex flex-col">
                  <span className="font-medium truncate">
                    {getEntityName(item)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}

        {errorPlaceholderEdge}
      </div>
    </Modal>
  );
};

export default AddPipeLineModal;
