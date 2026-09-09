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
  Alert,
  Badge,
  Box,
  Button,
  Dialog,
  Modal,
  ModalOverlay,
  TextArea,
  Typography,
} from '@openmetadata/ui-core-components';
import { isEmpty } from 'lodash';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import type { Metric } from '../../../generated/entity/data/metric';
import { WidgetEditButton } from '../../common/WidgetActionButton/WidgetActionButton';
import WidgetCard from '../../common/WidgetCard/WidgetCard';
import {
  MetricSemanticItem,
  MetricSemanticListProps,
} from './MetricSemanticList.interface';

const VISIBLE_ITEM_COUNT = 5;

const MetricSemanticList = <T extends MetricSemanticItem>({
  metric,
  permissions,
  onUpdate,
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
  const [descriptionDraft, setDescriptionDraft] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);

  const hasEditPermission = useMemo(
    () =>
      (permissions.EditAll || permissions.EditDescription) && !metric.deleted,
    [permissions, metric.deleted]
  );

  const visibleItems = useMemo(
    () => (isShowMore ? items : items.slice(0, VISIBLE_ITEM_COUNT)),
    [items, isShowMore]
  );

  const selectedItem =
    selectedIndex === undefined ? undefined : items[selectedIndex];

  const handleDescriptionSave = useCallback(async () => {
    const updatedItems = items.map((item, index) =>
      index === selectedIndex
        ? { ...item, description: descriptionDraft }
        : item
    );

    const updatedMetric = {
      ...metric,
      [fieldKey]: updatedItems,
    } as Metric;

    setIsSaving(true);
    setSaveError(false);
    try {
      await onUpdate(updatedMetric, fieldKey);
      setSelectedIndex(undefined);
    } catch {
      setSaveError(true);
    } finally {
      setIsSaving(false);
    }
  }, [descriptionDraft, fieldKey, items, metric, onUpdate, selectedIndex]);

  const handleEdit = useCallback(
    (index: number) => {
      setSelectedIndex(index);
      setDescriptionDraft(items[index].description ?? '');
      setSaveError(false);
    },
    [items]
  );

  const handleClose = useCallback(() => {
    if (!isSaving) {
      setSelectedIndex(undefined);
      setSaveError(false);
    }
  }, [isSaving]);

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
                  onClick={() => handleEdit(index)}
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
            <div
              className="tw:text-xs tw:text-secondary tw:[&_p]:m-0"
              data-testid="description-preview">
              <ReactMarkdown>{item.description}</ReactMarkdown>
            </div>
          )}
        </Box>
      );
    },
    [getBadge, handleEdit, hasEditPermission, t]
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
        <ModalOverlay
          isOpen
          isDismissable={!isSaving}
          onOpenChange={(isOpen) => !isOpen && handleClose()}>
          <Modal>
            <Dialog
              showCloseButton
              data-testid="semantic-description-dialog"
              title={t('label.edit-entity-name', {
                entityType: entityLabel,
                entityName: selectedItem.name,
              })}
              width={640}
              onClose={handleClose}>
              <Dialog.Content>
                <Box direction="col" gap={3}>
                  {saveError && (
                    <Alert
                      title={t('server.entity-updating-error', {
                        entityName: selectedItem.name,
                      })}
                      variant="error"
                    />
                  )}
                  <TextArea
                    data-testid="semantic-description-input"
                    isDisabled={isSaving}
                    label={t('label.description')}
                    placeholder={t('label.enter-field-description', {
                      field: entityLabelLowercase,
                    })}
                    rows={8}
                    value={descriptionDraft}
                    onChange={setDescriptionDraft}
                  />
                </Box>
              </Dialog.Content>
              <Dialog.Footer>
                <Button
                  color="secondary"
                  isDisabled={isSaving}
                  onPress={handleClose}>
                  {t('label.cancel')}
                </Button>
                <Button
                  color="primary"
                  data-testid="semantic-description-save"
                  isLoading={isSaving}
                  onPress={handleDescriptionSave}>
                  {t('label.save')}
                </Button>
              </Dialog.Footer>
            </Dialog>
          </Modal>
        </ModalOverlay>
      )}
    </WidgetCard>
  );
};

export default MetricSemanticList;
