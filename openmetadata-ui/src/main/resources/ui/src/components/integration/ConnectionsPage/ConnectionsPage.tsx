/*
 *  Copyright 2025 Collate.
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
  Button,
  ButtonGroup,
  ButtonGroupItem,
  Input,
} from '@openmetadata/ui-core-components';
import { LayoutGrid01, List, SearchLg } from '@untitledui/icons';
import { debounce } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { ReactComponent as ConnectorsIcon } from '../../../assets/svg/ask-collate-nav-bar/ai-connections.svg';
import LimitWrapper from '../../../hoc/LimitWrapper';
import {
  EXTENSION_POINTS,
  SlotContribution,
} from '../../../utils/ExtensionPointTypes';
import HeaderShell from '../../common/HeaderShell/HeaderShell.component';
import { useApplicationsProvider } from '../../Settings/Applications/ApplicationsProvider/ApplicationsProvider';
import { useSlotInset } from '../hooks/useSlotInset';
import ConnectionsListView from './ConnectionsListView';
import {
  CATEGORY_CONFIGS,
  CATEGORY_PARAM,
  ConnectionsServiceCategory,
  SEARCH_PARAM,
} from './ConnectionsPage.constants';
import { useAddServiceAction } from './useAddServiceAction';
import { ConnectionsCategory } from './useConnectionsData';
import { useConnectionsViewMode } from './useConnectionsViewMode';

const SERVICE_CATEGORIES = new Set(CATEGORY_CONFIGS.map(({ key }) => key));

const isServiceCategory = (
  value: string | null
): value is ConnectionsServiceCategory =>
  value !== null && SERVICE_CATEGORIES.has(value as ConnectionsServiceCategory);

const ConnectionsPage: React.FC = () => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { setViewMode, viewMode } = useConnectionsViewMode();
  const { extensionRegistry } = useApplicationsProvider();

  // The AI plugin fills this region with its own composer (e.g. an "ask anything" prompt); OSS
  // core has nothing of its own to put here, so it renders only what is contributed and reserves
  // no space when nothing is.
  const { ref: footerRef, inset: footerInset } = useSlotInset();
  const footerContributions =
    extensionRegistry.getContributions<SlotContribution>(
      EXTENSION_POINTS.CONNECTIONS_PAGE_FOOTER
    );
  const urlSearchTerm = searchParams.get(SEARCH_PARAM) ?? '';
  // Local state keeps typing responsive; the URL is the source of truth and is written on the
  // same debounce as the query, so a filtered view is shareable and survives reload.
  const [searchInput, setSearchInput] = useState(urlSearchTerm);
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(urlSearchTerm);

  const categoryParam = searchParams.get(CATEGORY_PARAM);
  const selectedCategory: ConnectionsCategory = isServiceCategory(categoryParam)
    ? categoryParam
    : 'all';

  const commitSearchTerm = useCallback(
    (value: string) => {
      setDebouncedSearchTerm(value);
      setSearchParams(
        (current) => {
          const params = new URLSearchParams(current);
          if (value) {
            params.set(SEARCH_PARAM, value);
          } else {
            params.delete(SEARCH_PARAM);
          }

          return params;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  const updateDebouncedSearchTerm = useMemo(
    () => debounce(commitSearchTerm, 500),
    [commitSearchTerm]
  );

  useEffect(
    () => () => updateDebouncedSearchTerm.cancel(),
    [updateDebouncedSearchTerm]
  );

  // Follow the URL when it changes from outside the input — browser back/forward, or a link into
  // an already-filtered view. Guarded on the committed term so it cannot fight the debounce and
  // undo what is being typed.
  useEffect(() => {
    if (urlSearchTerm !== debouncedSearchTerm) {
      updateDebouncedSearchTerm.cancel();
      setSearchInput(urlSearchTerm);
      setDebouncedSearchTerm(urlSearchTerm);
    }
    // Intentionally keyed on the URL alone: reacting to debouncedSearchTerm would re-run this
    // for our own writes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlSearchTerm]);

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchInput(value);
      updateDebouncedSearchTerm(value);
    },
    [updateDebouncedSearchTerm]
  );

  const handleCategoryChange = useCallback(
    (category: ConnectionsCategory) => {
      setSearchParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          next.set(CATEGORY_PARAM, category);

          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  // Scoped to the tab in view: from the Drive tab the header button opens the drive wizard, not the
  // database one, and it is absent when the user cannot create that kind of service.
  const { addService, canAddService } = useAddServiceAction(selectedCategory);

  const viewToggle = (
    <ButtonGroup
      className="tw:h-10"
      selectedKeys={[viewMode]}
      selectionMode="single"
      size="sm"
      onSelectionChange={(keys) => {
        const selected = [...keys][0] as 'grid' | 'list';
        if (selected) {
          setViewMode(selected);
        }
      }}>
      <ButtonGroupItem
        className="tw:size-10! tw:justify-center tw:p-0! tw:selected:bg-brand-50 tw:selected:text-brand-600"
        data-testid="grid-view-toggle"
        iconLeading={<LayoutGrid01 height={18} width={18} />}
        id="grid"
      />
      <ButtonGroupItem
        className="tw:size-10! tw:justify-center tw:p-0! tw:selected:bg-brand-50 tw:selected:text-brand-600"
        data-testid="list-view-toggle"
        iconLeading={<List height={18} width={18} />}
        id="list"
      />
    </ButtonGroup>
  );

  return (
    <div
      className="tw:relative tw:flex tw:h-full tw:flex-col tw:overflow-hidden tw:p-2"
      style={{ fontFamily: 'Inter, sans-serif' }}>
      <HeaderShell
        actions={
          <div className="tw:flex tw:items-center tw:gap-3">
            <div className="tw:w-[280px]">
              <Input
                fontSize="sm"
                icon={SearchLg}
                iconClassName="tw:size-[18px]!"
                inputClassName="tw:h-11! tw:py-0! tw:text-[15px]!"
                inputDataTestId="search-connections-input"
                placeholder={t('label.search-entity', {
                  entity: t('label.connection-plural'),
                })}
                size="md"
                value={searchInput}
                wrapperClassName="tw:h-11!"
                onChange={handleSearchChange}
              />
            </div>
            {canAddService && (
              <LimitWrapper resource="dataAssets">
                <Button
                  className="tw:h-11! tw:px-4! tw:text-sm! tw:font-semibold!"
                  color="primary"
                  data-testid="connections-add-service"
                  size="md"
                  onPress={addService}>
                  {t('label.add-new-entity', { entity: t('label.service') })}
                </Button>
              </LimitWrapper>
            )}
          </div>
        }
        className="tw:mb-0! tw:px-8! tw:py-[18px]!"
        leading={<ConnectorsIcon className="tw:size-12" />}
        padding="comfortable"
        subtitle={t('message.connections-subtitle')}
        title={t('label.connection-plural')}
        variant="gradient"
      />

      {/* The browse view owns its own scrolling so the secondary nav, page header and filter row
          stay put; scrolling here would carry all three away with the list. */}
      <div className="tw:relative tw:flex-1 tw:overflow-hidden">
        <ConnectionsListView
          bottomInset={footerInset}
          category={selectedCategory}
          searchTerm={searchInput}
          viewMode={viewMode}
          viewToggle={viewToggle}
          onCategoryChange={handleCategoryChange}
        />
      </div>

      {footerContributions.length > 0 && (
        <div
          className="tw:absolute tw:bottom-0 tw:left-0 tw:right-0 tw:z-10 tw:overflow-hidden tw:rounded-b-card"
          ref={footerRef}>
          {footerContributions.map((contribution) => (
            <contribution.component key={contribution.key} />
          ))}
        </div>
      )}
    </div>
  );
};

export default ConnectionsPage;
