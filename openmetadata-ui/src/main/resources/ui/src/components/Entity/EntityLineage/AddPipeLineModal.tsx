/*
 *  Copyright 2022 Collate.
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

import { Button, Modal, Select } from 'antd';
import { t } from 'i18next';
import { isUndefined } from 'lodash';
import React from 'react';
import { EntityReference } from '../../../generated/entity/type';
import { getEntityName } from '../../../utils/EntityUtils';

interface AddPipeLineModalType {
  showAddEdgeModal: boolean;
  edgeSearchValue: string;
  selectedEdgeId: string | undefined;
  edgeOptions: EntityReference[];
  onModalCancel: () => void;
  onSave: () => void;
  onClear: () => void;
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
  onClear,
  onSearch,
  onSelect,
}: AddPipeLineModalType) => {
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
      <Select
        allowClear
        showSearch
        className="w-full"
        data-testid="field-select"
        defaultActiveFirstOption={false}
        filterOption={false}
        notFoundContent={false}
        options={edgeOptions.map((option) => ({
          label: getEntityName(option),
          value: option.id,
        }))}
        placeholder={t('message.search-for-edge')}
        searchValue={edgeSearchValue}
        showArrow={false}
        value={selectedEdgeId}
        onClear={onClear}
        onSearch={onSearch}
        onSelect={onSelect}
      />
    </Modal>
  );
};

export default AddPipeLineModal;
