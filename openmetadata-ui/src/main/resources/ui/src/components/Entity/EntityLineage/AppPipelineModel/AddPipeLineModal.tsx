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

import {
  Box,
  Button,
  Dialog,
  Input,
  Modal,
  ModalOverlay,
  Typography,
} from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import classNames from 'classnames';

import { debounce, isUndefined } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Edge } from 'reactflow';
import { PAGE_SIZE } from '../../../../constants/constants';
import { EntityType } from '../../../../enums/entity.enum';
import { SearchIndex } from '../../../../enums/search.enum';
import { EntityReference } from '../../../../generated/entity/type';
import { searchQuery } from '../../../../rest/searchAPI';
import { EntityIconSize } from '../../../../utils/EntityIconUtils';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import { getEntityReferenceFromEntity } from '../../../../utils/EntityReferenceUtils';
import Fqn from '../../../../utils/Fqn';
import searchClassBase from '../../../../utils/SearchClassBase';
import { showErrorToast } from '../../../../utils/ToastUtils';
import '../../../ActivityFeed/FeedEditor/feed-editor.less';
import NoDataPlaceholder from '../../../common/EmptyPlaceholder/NoDataPlaceholder';
import NoSearchResultsPlaceholder from '../../../common/EmptyPlaceholder/NoSearchResultsPlaceholder';

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
      const data = await searchQuery({
        query: value,
        pageNumber: 1,
        pageSize: PAGE_SIZE,
        searchIndex: [SearchIndex.PIPELINE, SearchIndex.STORED_PROCEDURE],
      });
      const edgeOptions = data.hits.hits.map((hit) =>
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
          <div className="tw:relative tw:h-full tw:w-full tw:min-h-60 tw:rounded-xl tw:bg-surface">
            <NoSearchResultsPlaceholder data-testid="search-error-placeholder" />
          </div>
        );
      }

      return (
        <div className="tw:relative tw:h-full tw:w-full tw:min-h-60 tw:rounded-xl tw:bg-surface">
          <NoDataPlaceholder data-testid="no-data-placeholder" />
        </div>
      );
    }

    return null;
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
    <ModalOverlay
      isDismissable={false}
      isOpen={showAddEdgeModal}
      onOpenChange={(isOpen) => !isOpen && onModalCancel()}>
      <Modal>
        <Dialog
          showCloseButton
          data-testid="add-edge-modal"
          title={t(
            `label.${isUndefined(selectedEdge) ? 'add' : 'edit'}-entity`,
            {
              entity: t('label.edge'),
            }
          )}
          width={520}
          onClose={onModalCancel}>
          <Dialog.Content>
            <Input
              aria-label={t('message.search-for-edge')}
              inputDataTestId="field-input"
              placeholder={t('message.search-for-edge')}
              value={edgeSearchValue}
              onChange={handleChange}
            />

            <div className="tw:mt-1.5 tw:h-[310px] tw:w-full tw:overflow-auto">
              {edgeOptions.map((item) => {
                const breadcrumb = Fqn.split(
                  item.fullyQualifiedName ?? ''
                ).join('/');

                return (
                  <Box
                    align="center"
                    className={classNames(
                      'tw:my-2 tw:cursor-pointer tw:rounded-sm tw:p-2',
                      edgeSelection?.id === item.id
                        ? 'tw:bg-utility-brand-100'
                        : 'tw:hover:bg-tertiary'
                    )}
                    data-testid={`pipeline-entry-${item.fullyQualifiedName}`}
                    gap={2}
                    key={item.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setEdgeSelection(item)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        setEdgeSelection(item);
                      }
                    }}>
                    {searchClassBase.getEntityIconWithBg(
                      item.type,
                      EntityIconSize.Size14
                    )}
                    <Box className="tw:min-w-0" direction="col">
                      <Typography
                        ellipsis
                        className="tw:text-quaternary"
                        size="text-xs">
                        {breadcrumb}
                      </Typography>
                      <Typography ellipsis size="text-sm" weight="medium">
                        {getEntityName(item)}
                      </Typography>
                    </Box>
                  </Box>
                );
              })}

              {errorPlaceholderEdge}
            </div>
          </Dialog.Content>
          <Dialog.Footer>
            <Button
              color="primary-destructive"
              data-testid="remove-edge-button"
              onClick={onRemoveEdgeClick}>
              {t('label.remove-entity', {
                entity: t('label.edge-lowercase'),
              })}
            </Button>
            <Button
              color="primary"
              data-testid="save-button"
              isLoading={loading}
              onPress={() => onSave(edgeSelection)}>
              {t('label.save')}
            </Button>
          </Dialog.Footer>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

export default AddPipeLineModal;
