/*
 *  Copyright 2024 Collate.
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
  Avatar,
  Box,
  Grid,
  Typography,
} from '@openmetadata/ui-core-components';
import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NO_DATA_PLACEHOLDER } from '../../../../../constants/constants';
import { DataProduct } from '../../../../../generated/entity/domains/dataProduct';
import { Domain } from '../../../../../generated/entity/domains/domain';
import { isDescriptionContentEmpty } from '../../../../../utils/BlockEditorPureUtils';
import { getEntityName } from '../../../../../utils/EntityNameUtils';
import { getEntityAvatarProps } from '../../../../../utils/IconUtils';
import { renderBreakableTooltip } from '../../../../../utils/TooltipUtils';
import { OwnerLabel } from '../../../OwnerLabel/OwnerLabel.component';
import RichTextEditorPreviewerV1 from '../../../RichTextEditor/RichTextEditorPreviewerV1';
import {
  CARD_NAME_CLIP_CLASS,
  CLIPPED_NAME_CLASS,
  renderDomainClassificationTagsCell,
  renderDomainGlossaryTagsCell,
  renderDomainOwnersCell,
  renderDomainTypeCell,
} from './domainFieldRenderers';

// The one color change on this card: labels render in the primary (darker) text
// color instead of the lighter default. Typography's `color` prop only covers
// 'secondary' | 'success' | 'warning' | 'danger' (no 'primary'), so this goes
// through className directly.
const DATA_PRODUCT_LABEL_CLASS = 'tw:text-primary';

/**
 * Description field for the Data Product grid card: a 2-line-clamped plain-text
 * preview, with a "View more" affordance shown only when the text actually
 * overflows 2 lines. Clicking it does nothing on its own — it relies on the
 * card's own onClick (wired in EntityCardView) to navigate into the Data
 * Product, same as clicking anywhere else on the card.
 */
const DataProductDescriptionField = ({
  description,
}: {
  description?: string;
}) => {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const [isTruncated, setIsTruncated] = useState(false);

  const checkTruncation = useCallback(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    // The clamp CSS below targets the nested `.markdown-parser` node that
    // RichTextEditorPreviewerV1/BlockEditor renders into, not this wrapper -
    // measure that node (falling back to the wrapper), matching the same
    // technique FieldCard.tsx already uses for this exact problem.
    const measureNode =
      container.querySelector<HTMLElement>('.markdown-parser') ?? container;
    setIsTruncated(measureNode.scrollHeight > measureNode.clientHeight + 1);
  }, []);

  useEffect(() => {
    checkTruncation();
  }, [description, checkTruncation]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') {
      return;
    }
    // RichTextEditorPreviewerV1 renders its BlockEditor lazily (React.lazy +
    // Suspense), so the real content - and its real height - can land a tick
    // after this component mounts. The effect above can catch a stale
    // (pre-load) measurement; this observer re-checks whenever the rendered
    // height actually changes, which is what BlockEditor's async mount does.
    const observer = new ResizeObserver(checkTruncation);
    observer.observe(container);

    return () => observer.disconnect();
  }, [checkTruncation]);

  if (isDescriptionContentEmpty(description ?? '')) {
    return <Typography size="text-sm">{NO_DATA_PLACEHOLDER}</Typography>;
  }

  return (
    <Box direction="col" gap={1}>
      <div
        className="tw:[&_.markdown-parser]:line-clamp-2 tw:[&_.markdown-parser]:text-sm tw:[&_.markdown-parser]:break-words"
        ref={containerRef}>
        <RichTextEditorPreviewerV1
          enableSeeMoreVariant={false}
          markdown={description ?? ''}
        />
      </div>
      {isTruncated && (
        <Typography className="tw:text-brand-secondary" size="text-xs">
          {t('label.view-more')}
        </Typography>
      )}
    </Box>
  );
};

export const useDomainCardTemplates = () => {
  const { t } = useTranslation();

  const renderDomainCard = useCallback(
    (entity: Domain): ReactNode => (
      <Box direction="col" gap={4}>
        <Box
          align="center"
          className={CARD_NAME_CLIP_CLASS}
          direction="row"
          gap={3}>
          <Avatar size="md" {...getEntityAvatarProps(entity)} />
          <Typography
            className={CLIPPED_NAME_CLASS}
            ellipsis={{
              tooltip: renderBreakableTooltip(getEntityName(entity)),
            }}
            size="text-sm"
            weight="medium">
            {getEntityName(entity)}
          </Typography>
        </Box>

        <Grid gap="4">
          <Grid.Item span={12}>
            <Box direction="col" gap={1}>
              <Typography size="text-xs">{t('label.owner')}</Typography>
              {renderDomainOwnersCell(entity)}
            </Box>
          </Grid.Item>
          <Grid.Item span={12}>
            <Box direction="col" gap={1}>
              <Typography size="text-xs">{t('label.domain-type')}</Typography>
              {renderDomainTypeCell(entity)}
            </Box>
          </Grid.Item>
        </Grid>

        <Grid gap="4">
          <Grid.Item span={12}>
            <Box direction="col" gap={1}>
              <Typography size="text-xs">
                {t('label.glossary-term-plural')}
              </Typography>
              {renderDomainGlossaryTagsCell(entity)}
            </Box>
          </Grid.Item>
          <Grid.Item span={12}>
            <Box direction="col" gap={1}>
              <Typography size="text-xs">{t('label.tag-plural')}</Typography>
              {renderDomainClassificationTagsCell(entity)}
            </Box>
          </Grid.Item>
        </Grid>
      </Box>
    ),
    [t]
  );

  const renderDataProductCard = useCallback(
    (entity: DataProduct): ReactNode => {
      const entityName = getEntityName(entity);
      const showName =
        entity.displayName && entity.name && entity.displayName !== entity.name;

      return (
        <Box direction="col" gap={4}>
          <Box
            align="center"
            className={CARD_NAME_CLIP_CLASS}
            direction="row"
            gap={3}>
            <Avatar size="md" {...getEntityAvatarProps(entity)} />
            <Box className="tw:min-w-0" direction="col">
              <Typography
                className={CLIPPED_NAME_CLASS}
                ellipsis={{ tooltip: renderBreakableTooltip(entityName) }}
                size="text-sm"
                weight="medium">
                {entityName}
              </Typography>
              {showName && (
                <Typography
                  className={CLIPPED_NAME_CLASS}
                  ellipsis={{ tooltip: renderBreakableTooltip(entity.name) }}
                  size="text-xs">
                  {entity.name}
                </Typography>
              )}
            </Box>
          </Box>

          <Grid gap="4">
            <Grid.Item span={24}>
              <Box direction="col" gap={1}>
                <Typography
                  className={DATA_PRODUCT_LABEL_CLASS}
                  size="text-xs"
                  weight="medium">
                  {t('label.description')}
                </Typography>
                <DataProductDescriptionField description={entity.description} />
              </Box>
            </Grid.Item>
          </Grid>

          <Grid gap="4">
            <Grid.Item span={12}>
              <Box direction="col" gap={1}>
                <Typography
                  className={DATA_PRODUCT_LABEL_CLASS}
                  size="text-xs"
                  weight="medium">
                  {t('label.owner-plural')}
                </Typography>
                {renderDomainOwnersCell(entity, { showDashPlaceholder: true })}
              </Box>
            </Grid.Item>
            <Grid.Item span={12}>
              <Box direction="col" gap={1}>
                <Typography
                  className={DATA_PRODUCT_LABEL_CLASS}
                  size="text-xs"
                  weight="medium">
                  {t('label.expert-plural')}
                </Typography>
                <OwnerLabel
                  showDashPlaceholder
                  isCompactView={false}
                  maxVisibleOwners={4}
                  owners={entity.experts}
                  showLabel={false}
                />
              </Box>
            </Grid.Item>
          </Grid>

          <Grid gap="4">
            <Grid.Item span={12}>
              <Box direction="col" gap={1}>
                <Typography
                  className={DATA_PRODUCT_LABEL_CLASS}
                  size="text-xs"
                  weight="medium">
                  {t('label.glossary-term-plural')}
                </Typography>
                {renderDomainGlossaryTagsCell(entity, {
                  emptyPlaceholder: NO_DATA_PLACEHOLDER,
                })}
              </Box>
            </Grid.Item>
            <Grid.Item span={12}>
              <Box direction="col" gap={1}>
                <Typography
                  className={DATA_PRODUCT_LABEL_CLASS}
                  size="text-xs"
                  weight="medium">
                  {t('label.tag-plural')}
                </Typography>
                {renderDomainClassificationTagsCell(entity, {
                  emptyPlaceholder: NO_DATA_PLACEHOLDER,
                })}
              </Box>
            </Grid.Item>
          </Grid>
        </Box>
      );
    },
    [t]
  );

  return {
    renderDomainCard,
    renderDataProductCard,
  };
};
