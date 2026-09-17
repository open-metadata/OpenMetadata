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
  Badge,
  Box,
  Button,
  Typography,
} from '@openmetadata/ui-core-components';
import { isEmpty } from 'lodash';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EntityType } from '../../../enums/entity.enum';
import { Metric } from '../../../generated/entity/data/metric';
import { getDerivedPermissionFlags } from '../../../utils/PermissionDerivation';
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
  const [selectedIndex, setSelectedIndex] = useState<number | undefined>();

  const {
    data: metricDetails,
    onUpdate,
    permissions,
  } = useGenericContext<Metric>();

  // Named-flag derivation (rule 2 — prop-consumed OperationPermission, owner is
  // MetricDetailsPage, Task 8 Batch 6). Explicit-deny-wins fix: the old raw
  // `EditAll || EditDescription` OR let EditAll grant unconditionally even when
  // EditDescription was explicitly denied; canEditDescription is prioritized (field-specific
  // wins) and already applies the same `!deleted` gating the old expression ANDed manually.
  const hasEditPermission = useMemo(
    () =>
      getDerivedPermissionFlags(permissions, metricDetails.deleted)
        .canEditDescription,
    [permissions, metricDetails.deleted]
  );

  const visibleItems = useMemo(
    () => (isShowMore ? items : items.slice(0, VISIBLE_ITEM_COUNT)),
    [items, isShowMore]
  );

  const selectedItem =
    selectedIndex === undefined ? undefined : items[selectedIndex];

  const handleDescriptionSave = useCallback(
    async (value: string) => {
      const updatedItems = items.map((item, index) =>
        index === selectedIndex ? { ...item, description: value } : item
      );

      const updatedMetric = {
        ...metricDetails,
        [fieldKey]: updatedItems,
      } as Metric;

      await onUpdate(updatedMetric, fieldKey);

      setSelectedIndex(undefined);
    },
    [items, selectedIndex, metricDetails, fieldKey, onUpdate]
  );

  const renderRow = useCallback(
    (item: T, index: number) => {
      const badge = getBadge(item);

      return (
        <Box
          className="tw:border-b tw:border-secondary tw:py-3 tw:last:border-b-0"
          data-testid={`semantic-item-${item.name}`}
          direction="col"
          gap={1}
          key={`${item.name}-${index}`}>
          <Box align="start" gap={2} justify="between">
            <Box
              align="start"
              className="tw:min-w-0 tw:max-w-1/2 tw:flex-1"
              gap={2}>
              <Typography
                as="span"
                className="tw:line-clamp-2 tw:[overflow-wrap:anywhere]"
                ellipsis={{ rows: 2 }}
                size="text-sm"
                title={item.name}
                weight="semibold">
                {item.name}
              </Typography>
              {badge && (
                <Badge
                  className="tw:shrink-0"
                  color="blue"
                  data-testid={`semantic-item-badge-${item.name}`}
                  size="sm">
                  {badge}
                </Badge>
              )}
            </Box>
            <Box align="start" className="tw:min-w-0 tw:max-w-1/2" gap={2}>
              {item.expression && (
                <Box className="tw:min-w-0 tw:max-w-xs tw:overflow-hidden tw:rounded-md tw:border tw:border-secondary tw:bg-secondary tw:px-2 tw:py-1">
                  <Typography
                    as="span"
                    className="tw:line-clamp-2 tw:[overflow-wrap:anywhere] tw:text-secondary"
                    size="text-xs"
                    title={item.expression}
                    weight="regular">
                    {item.expression}
                  </Typography>
                </Box>
              )}
              {hasEditPermission && (
                <WidgetEditButton
                  className="tw:shrink-0 tw:p-1"
                  data-testid={`edit-description-${item.name}`}
                  title={t('label.edit-entity', {
                    entity: t('label.description'),
                  })}
                  onClick={() => setSelectedIndex(index)}
                />
              )}
            </Box>
          </Box>
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
        </Box>
      );
    },
    [getBadge, hasEditPermission, t]
  );

  return (
    <WidgetCard
      dataTestId={dataTestId}
      headerExtra={
        isEmpty(items) ? undefined : (
          <Badge
            color="gray"
            data-testid="semantic-list-count"
            size="sm"
            type="color">
            {items.length}
          </Badge>
        )
      }
      isExpandDisabled={isEmpty(items)}
      title={title}>
      {!isEmpty(items) && (
        <div data-testid="semantic-list-body">
          {visibleItems.map(renderRow)}
          {items.length > VISIBLE_ITEM_COUNT && (
            <Button
              className="tw:text-xs tw:text-brand-secondary tw:underline"
              color="link-color"
              data-testid={isShowMore ? 'show-less' : 'show-more'}
              size="sm"
              onClick={() => setIsShowMore(!isShowMore)}>
              {isShowMore ? t('label.show-less') : t('label.show-more')}
            </Button>
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
            onCancel={() => setSelectedIndex(undefined)}
            onSave={handleDescriptionSave}
          />
        </EntityAttachmentProvider>
      )}
    </WidgetCard>
  );
};

export default MetricSemanticList;
