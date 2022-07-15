/*
 *  Copyright 2021 Collate
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

import { Modal, Select } from 'antd';
import { isUndefined } from 'lodash';
import React from 'react';
import { EntityReference } from '../../generated/api/services/createPipelineService';
import { getEntityName } from '../../utils/CommonUtils';
import { Button } from '../buttons/Button/Button';

interface AddPipeLineModalType {
  showAddPipelineModal: boolean;
  pipelineSearchValue: string;
  selectedPipelineId: string | undefined;
  pipelineOptions: EntityReference[];
  handleModalCancel: () => void;
  handleModalSave: () => void;
  onClear: () => void;
  handleRemoveEdgeClick: (evt: React.MouseEvent<HTMLButtonElement>) => void;
  onSearch: (value: string) => void;
  onSelect: (value: string) => void;
}

const AddPipeLineModal = ({
  showAddPipelineModal,
  pipelineOptions,
  pipelineSearchValue,
  selectedPipelineId,
  handleRemoveEdgeClick,
  handleModalCancel,
  handleModalSave,
  onClear,
  onSearch,
  onSelect,
}: AddPipeLineModalType) => {
  const Footer = () => {
    return (
      <div className="tw-justify-end" data-testid="footer">
        <Button
          className="tw-mr-2"
          data-testid="remove-edge-button"
          size="regular"
          theme="primary"
          variant="text"
          onClick={handleRemoveEdgeClick}>
          Remove Edge
        </Button>

        <Button
          className="tw-h-8 tw-px-3 tw-py-2 tw-rounded-md"
          data-testid="save-button"
          size="custom"
          theme="primary"
          variant="contained"
          onClick={handleModalSave}>
          Save
        </Button>
      </div>
    );
  };

  return (
    <Modal
      destroyOnClose
      data-testid="add-pipeline-modal"
      footer={Footer()}
      title={isUndefined(selectedPipelineId) ? 'Add Pipeline' : 'Edit Pipeline'}
      visible={showAddPipelineModal}
      onCancel={handleModalCancel}>
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
