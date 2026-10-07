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

import { Button, Typography } from '@openmetadata/ui-core-components';
import { Sort } from '@openmetadata/ui-core-components/icons';
import React, { lazy, useCallback, useMemo, useState } from 'react';
import { Layout } from 'react-grid-layout';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../../../constants/constants';
import { CURATED_ASSETS_WIDGET_DEFAULT_VALUES } from '../../../../constants/CustomizeMyDataPage.constants';
import {
  CuratedAssetsSource,
  useCuratedAssets,
} from '../../../../hooks/useCuratedAssets';
import {
  WidgetCommonProps,
  WidgetConfig,
} from '../../../../interface/customization.interface';
import { DEFAULT_CURATED_RULE } from '../../../../utils/curatedRule';
import withSuspenseFallback from '../../../AppRouter/withSuspenseFallback';
import { AdvanceSearchProvider } from '../../../Explore/AdvanceSearchProvider/AdvanceSearchProvider.component';
import TopicCard from '../Common/TopicWidget/TopicCard';
import { TopicKey } from '../Common/TopicWidget/topics.types';
import CuratedAssetRows from './CuratedAssetRows';
import CuratedRuleSummary from './CuratedRuleSummary';

const CuratedAssetsModal = withSuspenseFallback(
  lazy(
    () => import('../CuratedAssetsWidget/CuratedAssetsModal/CuratedAssetsModal')
  )
);

const TONE = {
  icon: Sort,
  tile: 'tw:bg-utility-indigo-50 tw:text-utility-indigo-600',
};

export type CuratedAssetsSummaryWidgetProps = WidgetCommonProps;

/** The assets matching a saved rule, e.g. certified Tier-1 tables. */
const CuratedAssetsSummaryWidgetContent: React.FC<
  CuratedAssetsSummaryWidgetProps
> = ({
  widgetKey,
  isEditView,
  handleRemoveWidget,
  currentLayout,
  handleLayoutUpdate,
  handleSaveLayout,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Read off the layout, not the `widgetConfig` prop: `getWidgetFromKey` — the
  // single entry point for both the live page and the persona editor — passes
  // `currentLayout` and `widgetKey` but not the entry itself, so a widget that
  // trusts that prop sees an undefined config forever and can never show a
  // saved rule. This is the lookup the previous Curated Assets widget did.
  const config = useMemo(
    () => currentLayout?.find((widget) => widget.i === widgetKey)?.config,
    [currentLayout, widgetKey]
  );

  // An admin-saved advanced filter wins over the built-in chip rule — see
  // CuratedAssetsSource. Memoised because it is part of the query key.
  const source = useMemo<CuratedAssetsSource>(
    () => ({
      queryFilter: config?.queryFilter as string | undefined,
      resources: config?.resources as string[] | undefined,
      rule: DEFAULT_CURATED_RULE,
    }),
    [config]
  );
  const hasSavedFilter = Boolean(source.queryFilter);
  const savedTitle = config?.title as string | undefined;

  const { assets, totalCount, isError, isLoading } = useCuratedAssets(source);

  // Writing the config back onto this widget's layout entry is the only way it
  // is persisted -- the rule lives on the persona's page layout, not on an
  // entity of its own.
  const handleSave = useCallback(
    async (config: WidgetConfig['config']) => {
      const isAlreadyInLayout = currentLayout?.some(
        (widget) => widget.i === widgetKey
      );

      const updatedLayout = isAlreadyInLayout
        ? (currentLayout ?? []).map((widget) =>
            widget.i === widgetKey ? { ...widget, config } : widget
          )
        : [
            ...(currentLayout ?? []),
            { ...CURATED_ASSETS_WIDGET_DEFAULT_VALUES, config, i: widgetKey },
          ];

      handleLayoutUpdate?.(updatedLayout as Layout[]);
      await handleSaveLayout?.(updatedLayout as WidgetConfig[]);

      setIsModalOpen(false);
    },
    [currentLayout, widgetKey, handleLayoutUpdate, handleSaveLayout]
  );

  const closeModal = useCallback(() => setIsModalOpen(false), []);
  const openModal = useCallback(() => setIsModalOpen(true), []);

  // Only the persona editor can define the rule, so the prompt to do so belongs
  // in edit view alone -- a reader seeing "Create" could not act on it.
  const isUnconfigured = isEditView && !hasSavedFilter;

  // Chips describe the built-in rule only; a saved advanced filter is arbitrary
  // JSON that cannot be rendered back as `<field> is <value>` clauses.
  const ruleClauses = hasSavedFilter ? [] : DEFAULT_CURATED_RULE;
  const ruleText = ruleClauses
    .map((clause) => `${t(clause.labelKey)} is ${clause.displayValue}`)
    .join(', ');
  const remaining = Math.max(0, totalCount - assets.length);

  return (
    <>
      <TopicCard
        action={{
          label: t('label.view-all-entity', {
            entity: t('label.match-plural'),
          }),
          onPress: () => navigate(ROUTES.EXPLORE),
        }}
        handleRemoveWidget={handleRemoveWidget}
        isEditView={isEditView}
        isLoading={isLoading}
        meta={
          remaining > 0
            ? t('message.count-more-assets-match-rule', { count: remaining })
            : undefined
        }
        status={{
          color: 'gray',
          label: t('message.count-assets-match-rule', { count: totalCount }),
        }}
        summary={
          isError
            ? t('message.something-went-wrong')
            : [
                t('message.count-assets-match-rule', { count: totalCount }),
                ruleText,
              ]
                .filter(Boolean)
                .join(' · ')
        }
        title={savedTitle || t('label.curated-assets')}
        tone={TONE}
        topicKey={TopicKey.CURATED_ASSETS}
        widgetKey={widgetKey}>
        {isUnconfigured && (
          <div
            className="tw:flex tw:flex-col tw:items-start tw:gap-3"
            data-testid="widget-empty-state">
            <Typography className="tw:text-text-secondary!" size="text-sm">
              {t('message.no-curated-assets')}
            </Typography>
            <Button color="primary" size="sm" onPress={openModal}>
              {t('label.create')}
            </Button>
          </div>
        )}

        <CuratedRuleSummary clauses={ruleClauses} />

        <CuratedAssetRows assets={assets} />

        {isEditView && hasSavedFilter && (
          <div className="tw:mt-4 tw:flex tw:justify-start">
            <Button
              color="secondary"
              data-testid="edit-curated-assets"
              size="sm"
              onPress={openModal}>
              {t('label.edit')}
            </Button>
          </div>
        )}
      </TopicCard>
      {isEditView && (
        <CuratedAssetsModal
          curatedAssetsConfig={config}
          isOpen={isModalOpen}
          onCancel={closeModal}
          onSave={handleSave}
        />
      )}
    </>
  );
};

/**
 * The persona editor's filter builder reads the advanced-search context, so the
 * provider has to sit above the widget even though the read-only card has no
 * use for it.
 */
const CuratedAssetsSummaryWidget: React.FC<CuratedAssetsSummaryWidgetProps> = (
  props
) => (
  <AdvanceSearchProvider isExplorePage={false} updateURL={false}>
    <CuratedAssetsSummaryWidgetContent {...props} />
  </AdvanceSearchProvider>
);

export default CuratedAssetsSummaryWidget;
