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
import { Badge, Typography } from '@openmetadata/ui-core-components';
import { isEmpty } from 'lodash';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EntityType } from '../../../enums/entity.enum';
import { Metric } from '../../../generated/entity/data/metric';
import { EntityAttachmentProvider } from '../../common/EntityDescription/EntityAttachmentProvider/EntityAttachmentProvider';
import RichTextEditorPreviewNew from '../../common/RichTextEditor/RichTextEditorPreviewNew';
import { WidgetEditButton } from '../../common/WidgetActionButton/WidgetActionButton';
import WidgetCard from '../../common/WidgetCard/WidgetCard';
import { useGenericContext } from '../../Customization/GenericProvider/GenericContext';
import { ModalWithMarkdownEditor } from '../../Modals/ModalWithMarkdownEditor/ModalWithMarkdownEditor';
import {
  MetricSemanticItem,
  MetricSemanticListProps,
} from './MetricSemanticList.interface';

const VISIBLE_ITEM_COUNT = 5;

const MetricSemanticList = <T extends MetricSemanticItem>({
  items,
  title,
  fieldKey,
  entityLabel,
  entityLabelLowercase,
  dataTestId,
  getBadge,
}: MetricSemanticListProps<T>) => {
  const { t } = useTranslation();
  const [isShowMore, setIsShowMore] = useState(false);
  const [selectedItem, setSelectedItem] = useState<T | undefined>();

  const {
    data: metricDetails,
    onUpdate,
    permissions,
  } = useGenericContext<Metric>();

  const hasEditPermission = useMemo(
    () =>
      (permissions.EditAll || permissions.EditDescription) &&
      !metricDetails.deleted,
    [permissions, metricDetails.deleted]
  );

  const visibleItems = useMemo(
    () => (isShowMore ? items : items.slice(0, VISIBLE_ITEM_COUNT)),
    [items, isShowMore]
  );

  const handleDescriptionSave = useCallback(
    async (value: string) => {
      const updatedItems = items.map((item) =>
        item.name === selectedItem?.name
          ? { ...item, description: value }
          : item
      );

      const updatedMetric = {
        ...metricDetails,
        [fieldKey]: updatedItems,
      } as Metric;

      await onUpdate(updatedMetric, fieldKey);

      setSelectedItem(undefined);
    },
    [items, selectedItem, metricDetails, fieldKey, onUpdate]
  );

  const renderRow = useCallback(
    (item: T) => {
      const badge = getBadge(item);

      return (
        <div
          className="tw:flex tw:flex-col tw:gap-1 tw:border-b tw:border-border-secondary tw:py-3 tw:last:border-b-0"
          data-testid={`semantic-item-${item.name}`}
          key={item.name}>
          <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2">
            <Typography as="span" size="text-sm" weight="semibold">
              {item.name}
            </Typography>
            {badge && (
              <Badge
                color="gray"
                data-testid={`semantic-item-badge-${item.name}`}
                size="sm">
                {badge}
              </Badge>
            )}
            {item.expression && (
              <Typography
                as="code"
                className="tw:truncate tw:rounded tw:bg-bg-secondary tw:px-1.5 tw:py-0.5 tw:font-mono tw:text-tertiary"
                size="text-xs"
                title={item.expression}>
                {item.expression}
              </Typography>
            )}
          </div>
          <div className="tw:flex tw:items-start tw:gap-2">
            <div className="tw:min-w-0 tw:flex-1">
              {isEmpty(item.description) ? (
                <Typography
                  as="span"
                  className="tw:text-placeholder"
                  size="text-xs">
                  {t('label.no-description')}
                </Typography>
              ) : (
                <RichTextEditorPreviewNew markdown={item.description ?? ''} />
              )}
            </div>
            {hasEditPermission && (
              <WidgetEditButton
                data-testid={`edit-description-${item.name}`}
                title={t('label.edit-entity', {
                  entity: t('label.description'),
                })}
                onClick={() => setSelectedItem(item)}
              />
            )}
          </div>
        </div>
      );
    },
    [getBadge, hasEditPermission, t]
  );

  return (
    <WidgetCard
      dataTestId={dataTestId}
      isExpandDisabled={isEmpty(items)}
      title={title}>
      {!isEmpty(items) && (
        <div data-testid="semantic-list-body">
          {visibleItems.map(renderRow)}
          {items.length > VISIBLE_ITEM_COUNT && (
            <Typography
              as="span"
              className="tw:cursor-pointer tw:text-brand-secondary tw:underline"
              data-testid={isShowMore ? 'show-less' : 'show-more'}
              size="text-xs"
              onClick={() => setIsShowMore(!isShowMore)}>
              {isShowMore ? t('label.show-less') : t('label.show-more')}
            </Typography>
          )}
        </div>
      )}
      {selectedItem && (
        <EntityAttachmentProvider
          entityFqn={selectedItem.fullyQualifiedName}
          entityType={EntityType.METRIC}>
          <ModalWithMarkdownEditor
            visible
            header={t('label.edit-entity-name', {
              entityType: entityLabel,
              entityName: selectedItem.name,
            })}
            placeholder={t('label.enter-field-description', {
              field: entityLabelLowercase,
            })}
            value={selectedItem.description ?? ''}
            onCancel={() => setSelectedItem(undefined)}
            onSave={handleDescriptionSave}
          />
        </EntityAttachmentProvider>
      )}
    </WidgetCard>
  );
};

export default MetricSemanticList;
