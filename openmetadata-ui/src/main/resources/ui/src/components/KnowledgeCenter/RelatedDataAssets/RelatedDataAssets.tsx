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
import { Button, Space, Typography } from 'antd';
import { AxiosError } from 'axios';
import { isEmpty } from 'lodash';
import { KnowledgePage } from '../../../interface/knowledge-center.interface';

import { FC, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import ExpandableCard from '../../../components/common/ExpandableCard/ExpandableCard';
import {
  EditIconButton,
  PlusIconButton,
} from '../../../components/common/IconButtons/EditIconButton';
import { DataAssetOption } from '../../../components/DataAssets/DataAssetAsyncSelectList/DataAssetAsyncSelectList.interface';
import { EntityReference } from '../../../generated/entity/type';
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
      (item) => {
        return {
          displayName: getEntityName(item),
          reference: item,
          label: getEntityName(item),
          value: item.id,
        };
      }
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

  const showMoreLessElement = useMemo(() => {
    return (
      <Typography.Text
        className="cursor-pointer text-xs text-primary underline"
        data-testid={`show-${isShowMore ? 'less' : 'more'}`}
        onClick={() => setIsShowMore(!isShowMore)}>
        {isShowMore ? t('label.show-less') : t('label.show-more')}
      </Typography.Text>
    );
  }, [isShowMore, hiddenDataAssets]);

  const getDataAssetListing = useCallback((dataAssets: EntityReference[]) => {
    return dataAssets.map((item) => {
      return (
        <div
          className="right-panel-list-item flex items-center justify-between"
          data-testid={getEntityName(item)}
          key={item.id}>
          <div className="flex items-center">
            <Link
              className="font-medium"
              to={entityUtilClassBase.getEntityLink(
                item.type,
                item.fullyQualifiedName ?? ''
              )}>
              <Button
                className="data-asset-button flex-center p-0 m--ml-1"
                icon={
                  <div className="entity-button-icon m-r-xs">
                    {getEntityIcon(item.type)}
                  </div>
                }
                title={getEntityName(item)}
                type="text">
                <Typography.Text
                  className="w-72 text-left text-xs"
                  ellipsis={{ tooltip: true }}>
                  {getEntityName(item)}
                </Typography.Text>
              </Button>
            </Link>
          </div>
        </div>
      );
    });
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

  const header = useMemo(() => {
    return (
      <Space className="w-full items-center">
        <Typography.Text
          className="text-sm font-medium"
          data-testid="header-label">
          {t('label.data-asset-plural')}
        </Typography.Text>
        {!isEdit &&
          hasPermission &&
          (isEmpty(filteredRelatedDataAssets) ? (
            <PlusIconButton
              data-testid="add-data-assets-container"
              size="small"
              title={t('label.add-entity', {
                entity: t('label.data-asset-plural'),
              })}
              onClick={() => setIsEdit(true)}
            />
          ) : (
            <EditIconButton
              newLook
              data-testid="edit-data-assets"
              size="small"
              title={t('label.edit-entity', {
                entity: t('label.data-asset-plural'),
              })}
              onClick={() => setIsEdit(true)}
            />
          ))}
      </Space>
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
    <ExpandableCard
      cardProps={{
        title: header,
      }}
      isExpandDisabled={isEmpty(filteredRelatedDataAssets)}>
      {content}
    </ExpandableCard>
  );
};

export default RelatedDataAssets;
