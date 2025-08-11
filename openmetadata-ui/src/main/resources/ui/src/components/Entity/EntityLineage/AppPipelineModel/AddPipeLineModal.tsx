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
import { AxiosError } from 'axios';
import classNames from 'classnames';

import { debounce, isUndefined } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Edge } from 'reactflow';
import { PAGE_SIZE } from '../../../../constants/constants';
import { ERROR_PLACEHOLDER_TYPE, SIZE } from '../../../../enums/common.enum';
import { EntityType } from '../../../../enums/entity.enum';
import { SearchIndex } from '../../../../enums/search.enum';
import { EntityReference } from '../../../../generated/entity/type';
import { searchData } from '../../../../rest/miscAPI';
import {
  getEntityName,
  getEntityReferenceFromEntity,
} from '../../../../utils/EntityUtils';
import Fqn from '../../../../utils/Fqn';
import searchClassBase from '../../../../utils/SearchClassBase';
import { showErrorToast } from '../../../../utils/ToastUtils';
import '../../../ActivityFeed/FeedEditor/feed-editor.less';
import ErrorPlaceHolder from '../../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import './add-pipeline-modal.less';

interface AddPipeLineModalType {
  showAddEdgeModal: boolean;
  selectedEdge?: Edge;
  loading?: boolean;
  onModalCancel: () => void;
  onSave: (value?: EntityReference) => void;
  onRemoveEdgeClick: (evt: React.MouseEvent<HTMLButtonElement>) => void;
}

const AddPipeLineModal = ({
  showAddEdgeModal,
  selectedEdge,
  onRemoveEdgeClick,
  onModalCancel,
  onSave,
  loading,
}: AddPipeLineModalType) => {
  const defaultPipeline = selectedEdge?.data.edge.pipeline;
  const currentPipeline = defaultPipeline
    ? getEntityReferenceFromEntity(
        defaultPipeline,
        defaultPipeline?.pipelineEntityType ?? EntityType.PIPELINE
      )
    : undefined;
  const [edgeSearchValue, setEdgeSearchValue] = useState<string>('');
  const [edgeSelection, setEdgeSelection] = useState<
    EntityReference | undefined
  >(currentPipeline);
  const [edgeOptions, setEdgeOptions] = useState<EntityReference[]>([]);
  const { t } = useTranslation();

  const getSearchResults = async (value = '*') => {
    try {
      const data = await searchData(value, 1, PAGE_SIZE, '', '', '', [
        SearchIndex.PIPELINE,
        SearchIndex.STORED_PROCEDURE,
      ]);

      const edgeOptions = data.data.hits.hits.map((hit) =>
        getEntityReferenceFromEntity(
          hit._source,
          hit._source.entityType as EntityType
        )
      );

      setEdgeOptions(edgeOptions);
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.entity-fetch-error', {
          entity: t('label.suggestion-lowercase-plural'),
        })
      );
    }
  };

  const errorPlaceholderEdge = useMemo(() => {
    if (isUndefined(selectedEdge)) {
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
  }, [selectedEdge, edgeSearchValue]);

  const debounceOnSearch = useCallback(debounce(getSearchResults, 300), []);

  const handleChange = (value: string): void => {
    setEdgeSearchValue(value);
    debounceOnSearch(value);
  };

  useEffect(() => {
    getSearchResults(edgeSearchValue);
  }, []);

  return (
    <Modal
      destroyOnClose
      data-testid="add-edge-modal"
      footer={[
        <Button
          danger
          data-testid="remove-edge-button"
          key="remove-edge-btn"
          type="primary"
          onClick={onRemoveEdgeClick}>
          {t('label.remove-entity', {
            entity: t('label.edge-lowercase'),
          })}
        </Button>,
        <Button
          data-testid="save-button"
          key="save-btn"
          loading={loading}
          type="primary"
          onClick={() => onSave(edgeSelection)}>
          {t('label.save')}
        </Button>,
      ]}
      maskClosable={false}
      open={showAddEdgeModal}
      title={t(`label.${isUndefined(selectedEdge) ? 'add' : 'edit'}-entity`, {
        entity: t('label.edge'),
      })}
      onCancel={onModalCancel}>
      <Input
        data-testid="field-input"
        placeholder={t('message.search-for-edge')}
        value={edgeSearchValue}
        onChange={(e) => handleChange(e.target.value)}
      />

      <div className="edge-option-container">
        {edgeOptions.map((item) => {
          const icon = searchClassBase.getEntityIcon(item.type);
          const breadcrumb = Fqn.split(item.fullyQualifiedName ?? '').join('/');

          return (
            <div
              className={classNames('edge-option-item gap-2', {
                active: edgeSelection?.id === item.id,
              })}
              data-testid={`pipeline-entry-${item.fullyQualifiedName}`}
              key={item.id}
              onClick={() => setEdgeSelection(item)}>
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
