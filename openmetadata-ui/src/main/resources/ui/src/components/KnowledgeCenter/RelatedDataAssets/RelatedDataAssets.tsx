/*
 *  Copyright 2026 Collate.
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
  Tooltip,
  Typography,
} from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { isEmpty } from 'lodash';
import { FC, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  WidgetEditButton,
  WidgetPlusButton,
} from '../../../components/common/WidgetActionButton/WidgetActionButton';
import WidgetCard from '../../../components/common/WidgetCard/WidgetCard';
import { DataAssetOption } from '../../../components/DataAssets/DataAssetAsyncSelectList/DataAssetAsyncSelectList.interface';
import { EntityReference } from '../../../generated/entity/type';
import { KnowledgePage } from '../../../interface/knowledge-center.interface';
import { getEntityName } from '../../../utils/EntityNameUtils';
import entityUtilClassBase from '../../../utils/EntityUtilClassBase';
import { getEntityIcon } from '../../../utils/TableUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import { RelatedDataAssetsForm } from './RelatedDataAssetsForm';

interface RelatedDataAssetsProps {
  hasPermission: boolean;
  relatedDataAssets: KnowledgePage['relatedEntities'];
  onRelatedDataAssetsUpdate?: (
    data: KnowledgePage['relatedEntities']
  ) => Promise<void>;
}

const RelatedDataAssets: FC<RelatedDataAssetsProps> = ({
  relatedDataAssets = [],
  onRelatedDataAssetsUpdate,
  hasPermission,
}) => {
  const { t } = useTranslation();
  const [isEdit, setIsEdit] = useState(false);
  const [isShowMore, setIsShowMore] = useState(false);

  const {
    filteredRelatedDataAssets,
    defaultValue,
    initialOptions,
    restRelatedDataAssets,
  } = useMemo(() => {
    const { filteredRelatedDataAssets, restRelatedDataAssets } =
      relatedDataAssets.reduce(
        (acc, item) => {
          // filter out team and user as they are not data assets
          if (!['team', 'user'].includes(item.type)) {
            acc.filteredRelatedDataAssets.push(item);
          } else {
            acc.restRelatedDataAssets.push(item);
          }

          return acc;
        },
        {
          filteredRelatedDataAssets: [] as EntityReference[],
          restRelatedDataAssets: [] as EntityReference[],
        }
      );

    const initialOptions: DataAssetOption[] = filteredRelatedDataAssets.map(
      (item) => ({
        displayName: getEntityName(item),
        reference: item,
        label: getEntityName(item),
        value: item.id,
      })
    );

    const defaultValue = filteredRelatedDataAssets.map((item) => item.id);

    return {
      initialOptions,
      defaultValue,
      filteredRelatedDataAssets,
      restRelatedDataAssets,
    };
  }, [relatedDataAssets]);

  const { visibleDataAssets, hiddenDataAssets } = useMemo(() => {
    const visibleDataAssets = filteredRelatedDataAssets.slice(0, 5);
    const hiddenDataAssets = filteredRelatedDataAssets.slice(5);

    return { visibleDataAssets, hiddenDataAssets };
  }, [filteredRelatedDataAssets]);

  const showMoreLessElement = useMemo(
    () => (
      <Typography
        className="tw:cursor-pointer tw:text-brand-secondary tw:underline"
        data-testid={`show-${isShowMore ? 'less' : 'more'}`}
        size="text-xs"
        onClick={() => setIsShowMore(!isShowMore)}>
        {isShowMore ? t('label.show-less') : t('label.show-more')}
      </Typography>
    ),
    [isShowMore, hiddenDataAssets]
  );

  const getDataAssetListing = useCallback((dataAssets: EntityReference[]) => {
    return dataAssets.map((item) => (
      <Box
        align='center'
        className="right-panel-list-item tw:min-w-0"
        data-testid={getEntityName(item)}
        justify='between'
        key={item.id}>
        <Box align='center' className="tw:min-w-0 tw:w-full">
          <Tooltip title={getEntityName(item)}>
            <Link
              className="font-medium tw:min-w-0 tw:w-full tw:block"
              to={entityUtilClassBase.getEntityLink(
                item.type,
                item.fullyQualifiedName ?? ''
              )}>
              <Button
                ellipsis
                className="tw:w-full tw:justify-start"
                color="tertiary"
                title={getEntityName(item)}>
                <Box align="center" className="tw:min-w-0 tw:w-full" gap={2}>
                  {getEntityIcon(item.type, 'tw:h-4 tw:w-4 tw:shrink-0')}
                  <div className="tw:min-w-0 tw:flex-1">
                    <Typography
                      ellipsis
                      className="tw:text-left"
                      size="text-xs">
                      {getEntityName(item)}
                    </Typography>
                  </div>
                </Box>
              </Button>
            </Link>
          </Tooltip>
        </Box>
      </Box>
    ));
  }, []);

  const handleAssetsUpdate = useCallback(
    async (updatedAssets: DataAssetOption[]) => {
      try {
        const updatedRelatedDataAssets = updatedAssets.map(
          (item) => item.reference
        );
        await onRelatedDataAssetsUpdate?.([
          ...restRelatedDataAssets,
          ...updatedRelatedDataAssets,
        ]);
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setIsEdit(false);
      }
    },
    [onRelatedDataAssetsUpdate, restRelatedDataAssets]
  );

  const headerExtra = useMemo(() => {
    if (isEdit || !hasPermission) {
      return null;
    }

    return isEmpty(filteredRelatedDataAssets) ? (
      <WidgetPlusButton
        data-testid="add-data-assets-container"
        title={t('label.add-entity', {
          entity: t('label.data-asset-plural'),
        })}
        onClick={() => setIsEdit(true)}
      />
    ) : (
      <WidgetEditButton
        data-testid="edit-data-assets"
        title={t('label.edit-entity', {
          entity: t('label.data-asset-plural'),
        })}
        onClick={() => setIsEdit(true)}
      />
    );
  }, [isEdit, hasPermission, filteredRelatedDataAssets]);

  const content = useMemo(() => {
    if (isEdit) {
      return (
        <RelatedDataAssetsForm
          defaultValue={defaultValue}
          initialOptions={initialOptions}
          onCancel={() => setIsEdit(false)}
          onSubmit={handleAssetsUpdate}
        />
      );
    }

    return isEmpty(filteredRelatedDataAssets) ? null : (
      <div
        className="data-assets-list-body"
        data-testid="data-assets-list-body">
        {getDataAssetListing(visibleDataAssets)}
        {isShowMore && getDataAssetListing(hiddenDataAssets)}
        {!isEmpty(hiddenDataAssets) && showMoreLessElement}
      </div>
    );
  }, [
    isEdit,
    hasPermission,
    filteredRelatedDataAssets,
    isShowMore,
    visibleDataAssets,
    hiddenDataAssets,
  ]);

  if (isEmpty(filteredRelatedDataAssets) && !hasPermission) {
    return null;
  }

  return (
    <WidgetCard
      forceExpand={isEdit}
      headerExtra={headerExtra}
      isExpandDisabled={isEmpty(filteredRelatedDataAssets) && !isEdit}
      title={t('label.data-asset-plural')}>
      {content}
    </WidgetCard>
  );
};

export default RelatedDataAssets;
