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
import { getEntityName } from 'utils/EntityUtils';
import { EntityReference } from '../../generated/api/services/createPipelineService';

interface AddPipeLineModalType {
  showAddPipelineModal: boolean;
  pipelineSearchValue: string;
  selectedPipelineId: string | undefined;
  pipelineOptions: EntityReference[];
  onModalCancel: () => void;
  onSave: () => void;
  onClear: () => void;
  onRemoveEdgeClick: (evt: React.MouseEvent<HTMLButtonElement>) => void;
  onSearch: (value: string) => void;
  onSelect: (value: string) => void;
}

const AddPipeLineModal = ({
  showAddPipelineModal,
  pipelineOptions,
  pipelineSearchValue,
  selectedPipelineId,
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
      data-testid="add-pipeline-modal"
      footer={[
        <Button
          className="tw-mr-2"
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
      title={isUndefined(selectedPipelineId) ? 'Add Pipeline' : 'Edit Pipeline'}
      visible={showAddPipelineModal}
      onCancel={onModalCancel}>
      <Select
        allowClear
        showSearch
        className="tw-w-full"
        data-testid="field-select"
        defaultActiveFirstOption={false}
        filterOption={false}
        notFoundContent={false}
        options={pipelineOptions.map((option) => ({
          label: getEntityName(option),
          value: option.id,
        }))}
        placeholder="Search to Select Pipeline"
        searchValue={pipelineSearchValue}
        showArrow={false}
        value={selectedPipelineId}
        onClear={onClear}
        onSearch={onSearch}
        onSelect={onSelect}
      />
    </Modal>
  );
};

export default AddPipeLineModal;
