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
  Button,
  EmptyPlaceholder,
  PaginationCardWithControls,
  Table,
  Toggle,
  Typography,
} from '@openmetadata/ui-core-components';
import React, { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { SERVICE_EMPTY_STATE_ICON_CLASS } from '../../../constants/ServiceEmptyState.constant';
import { ServiceHealth } from '../../../generated/api/services/servicesOverview';
import { TagSource } from '../../../generated/type/tagLabel';
import LimitWrapper from '../../../hoc/LimitWrapper';
import connectionsRouterClassBase from '../../../utils/ConnectionsRouterClassBase';
import { getEntityName } from '../../../utils/EntityNameUtils';
import {
  EXTENSION_POINTS,
  SlotContribution,
} from '../../../utils/ExtensionPointTypes';
import { stopPropagationIfInteractive } from '../../../utils/InteractiveTargetUtils';
import serviceUtilClassBase from '../../../utils/ServiceUtilClassBase';
import { OwnerLabel } from '../../common/OwnerLabel/OwnerLabel.component';
import { useApplicationsProvider } from '../../Settings/Applications/ApplicationsProvider/ApplicationsProvider';
import TagsContainerV2 from '../../Tag/TagsContainerV2/TagsContainerV2';
import ConnectionsFilterButton from './ConnectionsFilterButton';
import {
  CATEGORY_CONFIGS,
  DELETED_PARAM,
  ENTITY_TYPE_TO_CATEGORY,
  getConnectionsEmptyState,
  GRID_PAGE_SIZE_OPTIONS,
  HEALTH_PARAM,
  LIST_PAGE_SIZE_OPTIONS,
  SERVICE_TYPE_PARAM,
} from './ConnectionsPage.constants';
import ConnectionsPageSkeleton from './ConnectionsPageSkeleton';
import ConnectionsSecondaryNav from './ConnectionsSecondaryNav';
import ServiceConnectionCard from './ServiceConnectionCard';
import { useAddServiceAction } from './useAddServiceAction';
import {
  ConnectionsCategory,
  ConnectionsListRow,
  useConnectionsData,
} from './useConnectionsData';
import { ConnectionsViewMode } from './useConnectionsViewMode';

const HEALTH_LABEL_KEYS: Record<ServiceHealth, string> = {
  [ServiceHealth.Failed]: 'label.failed',
  [ServiceHealth.NotRun]: 'label.not-ran',
  [ServiceHealth.PartialSuccess]: 'label.warning',
  [ServiceHealth.Success]: 'label.healthy',
};

/**
 * Every state is always offered, in the severity order the API's worst-wins reduction uses, rather
 * than only the states the health aggregation happens to return. A state with no services still has
 * to be selectable: the Platform Health widget deep-links `?health=failing`, which expands to
 * failed + partialSuccess, and an unofferable selection leaves the trigger showing "2 selected" with
 * one state ticked — then drops the other as soon as the menu is touched, because the write-back
 * only sees the keys the menu offered.
 */
const HEALTH_FILTER_ORDER: ServiceHealth[] = [
  ServiceHealth.Failed,
  ServiceHealth.PartialSuccess,
  ServiceHealth.NotRun,
  ServiceHealth.Success,
];

// The landing Platform Health widget links to buckets, two of which map to a single state and one
// of which ("failing") is the union of failed and partialSuccess.
const LEGACY_HEALTH_ALIASES: Record<string, ServiceHealth[]> = {
  failing: [ServiceHealth.Failed, ServiceHealth.PartialSuccess],
  healthy: [ServiceHealth.Success],
  notRun: [ServiceHealth.NotRun],
};

const parseCsvParam = (value: string | null): string[] =>
  (value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

const parseHealthParam = (value: string | null): ServiceHealth[] => {
  const raw = parseCsvParam(value);
  const expanded = raw.flatMap(
    (entry) => LEGACY_HEALTH_ALIASES[entry] ?? [entry as ServiceHealth]
  );

  return expanded.filter((state) => state in HEALTH_LABEL_KEYS);
};

/**
 * The pagination control bar ships its own `border-x`/`border-b`, which would sit 1px inside the
 * card border we already draw and read as a doubled edge. Exported so the integration spec can
 * assert against the real core component that this actually suppresses them — the class only works
 * because the component merges consumer classes with `twMerge`.
 */
export const PAGINATION_BORDER_SUPPRESSOR = 'tw:border-0';

/**
 * Column widths for the list view, on the headers because react-aria's Table builds its own child
 * collection and silently drops a raw `<colgroup>`.
 *
 * Every column is sized rather than leaving the name to soak up the remainder: under
 * `table-layout: fixed` the browser's distribution of unclaimed width gave the name the same share
 * as everything else, so a long service name still had nowhere to ellipsize. The name gets the
 * largest share because it is the only column whose content has no natural bound.
 */
export const NAME_COLUMN_WIDTH = 'tw:w-2/5';
export const SECONDARY_COLUMN_WIDTH = {
  all: 'tw:w-[15%]',
  scoped: 'tw:w-1/5',
} as const;

interface ConnectionsListViewProps {
  /** Height of the footer region overlaying the bottom of the page, measured by its owner. */
  bottomInset?: number;
  category: ConnectionsCategory;
  searchTerm: string;
  viewMode: ConnectionsViewMode;
  viewToggle?: React.ReactNode;
  onCategoryChange: (category: ConnectionsCategory) => void;
}

const ConnectionsListView: React.FC<ConnectionsListViewProps> = ({
  bottomInset = 0,
  category,
  searchTerm,
  viewMode,
  viewToggle,
  onCategoryChange,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { extensionRegistry } = useApplicationsProvider();

  const pageSizeOptions =
    viewMode === 'grid' ? GRID_PAGE_SIZE_OPTIONS : LIST_PAGE_SIZE_OPTIONS;

  // Both selections live in the URL so they survive reload and back/forward, like ?category=.
  const selectedServiceTypes = useMemo(
    () => parseCsvParam(searchParams.get(SERVICE_TYPE_PARAM)),
    [searchParams]
  );
  const selectedHealth = useMemo(
    () => parseHealthParam(searchParams.get(HEALTH_PARAM)),
    [searchParams]
  );

  // Scrolling belongs to the results, so switching tab or page has to return it to the top —
  // otherwise a new, shorter list opens part-way down with no indication why.
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const showDeleted = searchParams.get(DELETED_PARAM) === 'true';
  const hasFilters =
    selectedServiceTypes.length > 0 || selectedHealth.length > 0;
  // An empty result under a search, filter or the deleted toggle says nothing about whether the
  // estate is empty, so the two cases get different placeholders.
  const isNarrowed = Boolean(searchTerm) || hasFilters || showDeleted;

  const { icon: EmptyStateIcon, ...emptyState } =
    getConnectionsEmptyState(category);
  const { addService, canAddService } = useAddServiceAction(category);

  const setShowDeleted = (next: boolean) => {
    setSearchParams(
      (current) => {
        const params = new URLSearchParams(current);
        if (next) {
          params.set(DELETED_PARAM, 'true');
        } else {
          params.delete(DELETED_PARAM);
        }

        return params;
      },
      { replace: true }
    );
  };

  // Clears the two dropdowns but deliberately not the search box: the search is typed and
  // visible, so wiping it would discard something the user can see they still want.
  const clearFilters = () => {
    setSearchParams(
      (current) => {
        const params = new URLSearchParams(current);
        params.delete(SERVICE_TYPE_PARAM);
        params.delete(HEALTH_PARAM);

        return params;
      },
      { replace: true }
    );
  };

  const setCsvParam = (param: string, values: string[]) => {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (values.length === 0) {
          next.delete(param);
        } else {
          next.set(param, values.join(','));
        }

        return next;
      },
      { replace: true }
    );
  };

  const {
    categoryCounts,
    countsLoading,
    isCountReady,
    isError,
    isLoading,
    isRefreshing,
    page,
    pageSize,
    rows,
    serviceTypeOptions: availableServiceTypes,
    serviceTypesInTab,
    healthOptions,
    setPage,
    setPageSize,
    sortOrder,
    toggleSortOrder,
    totalConnections,
    totalRows,
  } = useConnectionsData({
    category,
    healthStates: selectedHealth,
    pageSizeOptions,
    searchTerm,
    serviceTypes: selectedServiceTypes,
    showDeleted,
  });

  // Only connectors that are actually deployed. This dropdown used to list every connector
  // OpenMetadata supports — 59 for databases alone — so most choices returned an empty list.
  const serviceTypeOptions = useMemo(() => {
    const deployed = serviceUtilClassBase.filterUnsupportedServiceType(
      availableServiceTypes.map((option) => option.value)
    );

    return availableServiceTypes
      .filter((option) => deployed.includes(option.value))
      .map((option) => ({
        label: option.value,
        supportingText: String(option.count),
        value: option.value,
      }));
  }, [availableServiceTypes]);

  const healthFilterOptions = useMemo(() => {
    const counts = new Map(
      healthOptions.map((option) => [option.value, option.count])
    );

    return HEALTH_FILTER_ORDER.map((state) => ({
      label: t(HEALTH_LABEL_KEYS[state]),
      supportingText: String(counts.get(state) ?? 0),
      value: state,
    }));
  }, [healthOptions, t]);

  const tabServiceTypeKey = serviceTypesInTab.join(',');
  const selectedServiceTypeKey = selectedServiceTypes.join(',');

  // Drop a selected connector the current tab has no services for, rather than silently showing
  // an empty list. Pruning to empty degrades to "no filter", the non-destructive outcome.
  //
  // Deliberately keyed on the tab's connectors ignoring the search term: pruning against the
  // search-narrowed list would delete the selection as soon as a search excluded it, and clearing
  // the search would not bring it back — a filter silently destroyed by typing.
  useEffect(() => {
    const available = tabServiceTypeKey ? tabServiceTypeKey.split(',') : [];
    const pruned = selectedServiceTypes.filter((value) =>
      available.includes(value)
    );
    if (available.length > 0 && pruned.length !== selectedServiceTypes.length) {
      setCsvParam(SERVICE_TYPE_PARAM, pruned);
    }
  }, [tabServiceTypeKey, selectedServiceTypeKey]);

  useEffect(() => {
    if (scrollContainerRef.current) {
      // scrollTop rather than scrollTo: jumping is what a tab change wants, and scrollTo is not
      // implemented in jsdom so the tests could not cover this.
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [category, page, searchTerm, selectedServiceTypeKey, showDeleted]);

  // The landing Platform Health widget still deep-links ?health=failing|healthy|notRun. Rewrite
  // those to the precise states once, so the rest of the page deals with one vocabulary.
  const rawHealthParam = searchParams.get(HEALTH_PARAM);
  useEffect(() => {
    if (rawHealthParam && LEGACY_HEALTH_ALIASES[rawHealthParam]) {
      setCsvParam(HEALTH_PARAM, LEGACY_HEALTH_ALIASES[rawHealthParam]);
    }
  }, [rawHealthParam]);

  // On a specific category tab the category is fixed for every row, so the category
  // badge (cards) and Category column (table) are redundant — shown only on All.
  const isAllTab = category === 'all';
  const activeCategoryConfig = CATEGORY_CONFIGS.find(
    (config) => config.key === category
  );
  const title =
    category === 'all'
      ? t('label.all-connections')
      : t(activeCategoryConfig?.titleKey ?? 'label.connection-plural');
  const getCategorySubtitle = (config: (typeof CATEGORY_CONFIGS)[number]) =>
    config.descriptionKey
      ? t(config.descriptionKey)
      : t('message.connections-service-type-description', {
          serviceType: t(config.titleKey),
        });
  const subtitle = activeCategoryConfig
    ? getCategorySubtitle(activeCategoryConfig)
    : t('message.connections-all-description');

  const openService = (service: ConnectionsListRow) => {
    const serviceCategory = ENTITY_TYPE_TO_CATEGORY[service.entityType];
    if (!serviceCategory) {
      return;
    }

    navigate(
      connectionsRouterClassBase.getServiceDetailsPath(
        serviceCategory,
        service.fullyQualifiedName || service.name
      )
    );
  };

  const renderRow = (service: ConnectionsListRow) => {
    const serviceLogo = serviceUtilClassBase.getServiceLogo(
      service.serviceType as string
    );
    const serviceCategory = ENTITY_TYPE_TO_CATEGORY[service.entityType];
    const categoryTitleKey = CATEGORY_CONFIGS.find(
      (config) => config.key === serviceCategory
    )?.titleKey;

    return (
      <Table.Row
        className="tw:h-16! tw:cursor-pointer"
        data-testid={`connections-list-row-${service.name}`}
        id={service.id}
        key={service.id}
        onAction={() => openService(service)}>
        <Table.Cell>
          <div className="tw:flex tw:min-w-0 tw:items-center tw:gap-3">
            {/* Neutral rather than brand: the connector logos carry their own colours, and a
                brand-tinted tile behind them reads as a selected state. */}
            <div className="tw:flex tw:size-9 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-lg tw:bg-tertiary">
              {serviceLogo && (
                <img
                  alt={service.serviceType as string}
                  className="tw:size-[22px] tw:object-contain"
                  src={serviceLogo}
                />
              )}
            </div>
            {/* Native `title` rather than a core Tooltip: this renders once per row on every page,
                and a react-aria Tooltip per row is real overhead for a name that is usually not
                even truncated. The cards, which are fewer and larger, use the core Tooltip. */}
            <span
              className="tw:min-w-0 tw:truncate tw:text-sm tw:font-semibold tw:leading-5 tw:text-primary"
              title={getEntityName(service)}>
              {getEntityName(service)}
            </span>
          </div>
        </Table.Cell>
        <Table.Cell>
          <Typography className="tw:text-secondary">
            {service.serviceType as string}
          </Typography>
        </Table.Cell>
        {isAllTab && (
          <Table.Cell>
            <Typography className="tw:text-secondary">
              {categoryTitleKey ? t(categoryTitleKey) : t('label.service')}
            </Typography>
          </Table.Cell>
        )}
        <Table.Cell>
          {/* Owner avatars are links with their own popovers, and the row navigates on
              activation — so those clicks have to stay with the avatar. Only those: an
              unconditional stopPropagation here also swallowed clicks on the cell's padding and
              on the "no owners" dash, making the column look unclickable. `showLabel` is dropped
              because it only applies to the non-compact layout. */}
          <div role="presentation" onClick={stopPropagationIfInteractive}>
            <OwnerLabel
              isCompactView
              showDashPlaceholder
              maxVisibleOwners={1}
              owners={service.owners}
            />
          </div>
        </Table.Cell>
        <Table.Cell>
          <TagsContainerV2
            permission={false}
            selectedTags={service.tags ?? []}
            sizeCap={2}
            tagType={TagSource.Classification}
          />
        </Table.Cell>
      </Table.Row>
    );
  };

  // A plugin (e.g. an AI onboarding checklist) contributes a component for the empty/first-run
  // region; OSS core does not know what an "onboarding checklist" is, or who counts as a first-run
  // admin — that decision lives entirely inside the contributed component. When nothing is
  // contributed the generic empty-state placeholder below covers this region instead.
  const onboardingContributions =
    extensionRegistry.getContributions<SlotContribution>(
      EXTENSION_POINTS.CONNECTIONS_LIST_ONBOARDING
    );

  // Settled data only, so the chrome cannot flicker out mid-load or vanish behind a failed fetch.
  const isEmptyUnnarrowedEstate =
    !isNarrowed && !isLoading && !isError && rows.length === 0;

  // An empty estate is the one case where the page can hand the region to a contributed onboarding
  // experience — it stands in for the whole browse view, since a zero count and filters over
  // nothing are noise in front of it. Narrowed views keep the placeholder: they are empty by the
  // user's own choice.
  const hasOnboardingContribution =
    isEmptyUnnarrowedEstate && onboardingContributions.length > 0;

  const serviceList = useMemo(() => {
    if (isLoading) {
      return <ConnectionsPageSkeleton variant={viewMode} />;
    }

    // A failed fetch is not an empty estate. Falling through to "no data available" would tell
    // the user they have no services when the truth is we could not load them.
    if (isError) {
      return (
        <div
          className="tw:relative tw:min-h-[400px]"
          data-testid="connections-list-error-wrapper">
          <EmptyPlaceholder
            data-testid="connections-list-error"
            title={t('message.something-went-wrong')}
            variant="blank"
          />
        </div>
      );
    }

    if (hasOnboardingContribution) {
      return (
        <div
          className="tw:flex tw:justify-center tw:px-4 tw:py-8"
          data-testid="connections-list-onboarding-wrapper">
          <div className="tw:w-full tw:max-w-175">
            {onboardingContributions.map((contribution) => (
              <contribution.component key={contribution.key} />
            ))}
          </div>
        </div>
      );
    }

    return rows.length === 0 ? (
      <div
        className="tw:relative tw:min-h-[400px]"
        data-testid="connections-list-empty-wrapper">
        <EmptyPlaceholder
          data-testid="connections-list-empty-first-run"
          description={!isNarrowed && t(emptyState.descriptionKey)}
          // `footer` rather than `actions` so the button keeps the LimitWrapper the header button
          // has — service creation is limit-gated wherever the action appears.
          footer={
            canAddService && (
              <LimitWrapper resource="dataAssets">
                <Button
                  color="primary"
                  data-testid="connections-list-empty-add-service"
                  size="md"
                  onPress={addService}>
                  {t('label.add-new-entity', { entity: t('label.service') })}
                </Button>
              </LimitWrapper>
            )
          }
          icon={<EmptyStateIcon className={SERVICE_EMPTY_STATE_ICON_CLASS} />}
          title={
            isNarrowed
              ? t('message.no-data-available-for-selected-filter')
              : t(emptyState.titleKey)
          }
          variant="blank"
        />
      </div>
    ) : (
      <div
        aria-busy={isRefreshing}
        className={`tw:overflow-hidden tw:rounded-xl tw:border tw:border-secondary tw:bg-primary tw:shadow-xs tw:transition-opacity ${
          isRefreshing ? 'tw:opacity-60' : ''
        }`}
        data-testid="connections-results">
        {viewMode === 'list' ? (
          <div data-testid="connections-list-view">
            <Table
              // Remount when the column set changes (Category column toggles with the
              // tab) so react-aria rebuilds the collection instead of reconciling a
              // header/row column-count mismatch mid-transition.
              aria-label={t('label.service-plural')}
              // `tw:table-fixed`, not an arbitrary `[table-layout:fixed]`: with the Tailwind v4
              // prefix the variant has to lead (`tw:[...]`), so the hand-written form generated no
              // CSS at all and the table silently stayed `auto` — sizing the name column to its
              // longest value and leaving `truncate` nothing to truncate against.
              className="tw:table-fixed"
              containerStyle={{ overflow: 'hidden' }}
              data-testid="connections-list-table"
              key={isAllTab ? 'columns-all' : 'columns-scoped'}
              size="sm"
              sortDescriptor={{
                column: 'name',
                direction: sortOrder === 'asc' ? 'ascending' : 'descending',
              }}
              onSortChange={(descriptor) => {
                const nextSortOrder =
                  descriptor.direction === 'descending' ? 'desc' : 'asc';
                if (nextSortOrder !== sortOrder) {
                  toggleSortOrder();
                }
              }}>
              <Table.Header>
                <Table.Head
                  allowsSorting
                  isRowHeader
                  className={NAME_COLUMN_WIDTH}
                  data-testid="connections-list-name-header"
                  id="name"
                  label={t('label.name')}
                />
                <Table.Head
                  className={
                    SECONDARY_COLUMN_WIDTH[isAllTab ? 'all' : 'scoped']
                  }
                  id="connector"
                  label={t('label.connector')}
                />
                {isAllTab && (
                  <Table.Head
                    className={SECONDARY_COLUMN_WIDTH.all}
                    id="category"
                    label={t('label.category')}
                  />
                )}
                <Table.Head
                  className={
                    SECONDARY_COLUMN_WIDTH[isAllTab ? 'all' : 'scoped']
                  }
                  id="owner"
                  label={t('label.owner')}
                />
                <Table.Head
                  className={
                    SECONDARY_COLUMN_WIDTH[isAllTab ? 'all' : 'scoped']
                  }
                  id="tags"
                  label={t('label.tag-plural')}
                />
              </Table.Header>
              <Table.Body items={rows}>{renderRow}</Table.Body>
            </Table>
          </div>
        ) : (
          <div
            className="tw:grid tw:grid-cols-[repeat(auto-fill,minmax(268px,1fr))] tw:gap-4 tw:p-5"
            data-testid="connections-grid-view">
            {rows.map((service) => {
              const serviceCategory =
                ENTITY_TYPE_TO_CATEGORY[service.entityType];

              return serviceCategory ? (
                <ServiceConnectionCard
                  categoryKey={serviceCategory}
                  key={service.id}
                  service={service}
                  showCategory={isAllTab}
                />
              ) : null;
            })}
          </div>
        )}

        <PaginationCardWithControls
          className={PAGINATION_BORDER_SUPPRESSOR}
          page={page}
          pageSize={pageSize}
          pageSizeOptions={pageSizeOptions}
          total={Math.max(1, Math.ceil(totalRows / pageSize))}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      </div>
    );
  }, [
    addService,
    canAddService,
    emptyState,
    EmptyStateIcon,
    isNarrowed,
    isLoading,
    isError,
    isRefreshing,
    rows,
    viewMode,
    sortOrder,
    toggleSortOrder,
    renderRow,
    page,
    pageSize,
    pageSizeOptions,
    totalRows,
    setPage,
    setPageSize,
    category,
    isAllTab,
    hasOnboardingContribution,
    onboardingContributions,
  ]);

  return (
    <div
      className="tw:flex tw:h-full tw:w-full tw:overflow-hidden"
      data-testid="connections-browse-view">
      {!hasOnboardingContribution && (
        <ConnectionsSecondaryNav
          category={category}
          categoryCounts={categoryCounts}
          isCountLoading={countsLoading}
          total={totalConnections}
          onCategoryChange={onCategoryChange}
        />
      )}

      <main className="tw:flex tw:min-w-0 tw:flex-1 tw:flex-col tw:overflow-hidden tw:px-8 tw:pt-6">
        {!hasOnboardingContribution && (
          <>
            <div className="tw:mb-[18px]">
              <Typography
                className="tw:m-0"
                data-testid="connections-page-title"
                size="text-lg"
                weight="semibold">
                {/* Gated so the count can never be shown for the previous tab: the number is
                  derived, but on a server-mode tab change it genuinely is not known yet. */}
                {isCountReady ? `${title} (${totalRows})` : title}
              </Typography>
              <Typography
                className="tw:mt-1 tw:text-tertiary"
                data-testid="connections-page-subtitle"
                size="text-sm">
                {subtitle}
              </Typography>
            </div>

            <div
              className="tw:mb-4 tw:flex tw:min-h-10 tw:items-center tw:gap-2.5"
              data-testid="connections-filter-row">
              <ConnectionsFilterButton
                multiple
                searchable
                label={t('label.all-service-types')}
                options={serviceTypeOptions}
                testId="connections-service-type-filter"
                value={selectedServiceTypes}
                onChange={(values) => setCsvParam(SERVICE_TYPE_PARAM, values)}
              />
              <ConnectionsFilterButton
                multiple
                label={t('label.all-entity', {
                  entity: t('label.status-plural'),
                })}
                options={healthFilterOptions}
                testId="connections-health-filter"
                value={selectedHealth}
                onChange={(values) => setCsvParam(HEALTH_PARAM, values)}
              />
              {hasFilters && (
                <Button
                  color="link-color"
                  data-testid="connections-clear-filters"
                  size="sm"
                  onClick={clearFilters}>
                  {t('label.clear-all')}
                </Button>
              )}
              <div className="tw:ml-auto tw:flex tw:items-center tw:gap-4">
                <Toggle
                  data-testid="connections-show-deleted"
                  id="connections-show-deleted"
                  isSelected={showDeleted}
                  label={t('label.deleted')}
                  size="sm"
                  onChange={setShowDeleted}
                />
                {viewToggle}
              </div>
            </div>
          </>
        )}

        <div
          className="tw:min-h-0 tw:flex-1 tw:overflow-y-auto tw:pb-4"
          data-testid="connections-scroll-container"
          ref={scrollContainerRef}
          // Reserve the contributed footer's measured height so the pagination bar can be
          // scrolled clear of it.
          style={{ paddingBottom: bottomInset || undefined }}>
          {serviceList}
        </div>
      </main>
    </div>
  );
};

export default ConnectionsListView;
