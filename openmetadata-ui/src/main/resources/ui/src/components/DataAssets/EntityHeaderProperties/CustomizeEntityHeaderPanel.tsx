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
  Button,
  CloseButton,
  FeaturedIcon,
  Input,
  Tabs,
  Toggle,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  DotsGrid,
  Plus,
  Search,
  Sliders02,
} from '@openmetadata/ui-core-components/icons';
import classNames from 'classnames';
import { ReactNode, useId, useMemo, useState } from 'react';
import {
  Button as AriaButton,
  DropIndicator,
  GridList,
  GridListItem,
  Heading,
  Key,
  useDragAndDrop,
} from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { GlobalSettingsMenuCategory } from '../../../constants/GlobalSettings.constants';
import {
  COLLAPSED_HEADER_PROPERTY_COUNT,
  HeaderPropertyFilter,
} from '../../../constants/EntityHeaderProperties.constants';
import { EntityHeader } from '../../../generated/system/ui/page';
import { getCustomPropertyEntityPathname } from '../../../utils/CustomProperty.utils';
import entityUtilClassBase from '../../../utils/EntityUtilClassBase';
import {
  getDefaultEntityHeader,
  getPinnedHeaderProperties,
  getShownHeaderProperties,
  isCustomHeaderProperty,
  matchesHeaderPropertyFilter,
  moveHeaderProperties,
  toggleHeaderProperty,
} from '../../../utils/EntityHeaderProperties.utils';
import { getSettingPath } from '../../../utils/RouterUtils';
import {
  CustomizeEntityHeaderPanelProps,
  HeaderProperty,
} from './EntityHeaderProperties.types';

const HEADER_PROPERTY_DRAG_TYPE = 'application/x-om-header-property';

const FILTER_LABEL_KEYS: Record<HeaderPropertyFilter, string> = {
  [HeaderPropertyFilter.All]: 'label.all',
  [HeaderPropertyFilter.Standard]: 'label.standard',
  [HeaderPropertyFilter.Custom]: 'label.custom',
};

const ROW_CLASS_NAME =
  'tw:flex tw:items-center tw:gap-2 tw:rounded-lg tw:border tw:border-secondary tw:py-1.5';

const ListHeading = ({
  title,
  caption,
}: {
  title: string;
  caption?: string;
}) => (
  <div className="tw:flex tw:items-baseline tw:justify-between tw:gap-2 tw:pt-3 tw:pb-2">
    <h3 className="tw:m-0 tw:text-sm tw:font-semibold tw:text-primary">
      {title}
    </h3>
    {caption && (
      <Typography as="span" className="tw:text-quaternary" size="text-xs">
        {caption}
      </Typography>
    )}
  </div>
);

const EmptyListNote = ({ children }: { children: ReactNode }) => (
  <Typography
    as="p"
    className="tw:px-2 tw:py-2.5 tw:text-quaternary"
    size="text-sm">
    {children}
  </Typography>
);

const PropertyLabel = ({
  property,
  isPinned,
}: {
  property: HeaderProperty;
  isPinned: boolean;
}) => {
  const { t } = useTranslation();

  return (
    <span className="tw:flex tw:min-w-0 tw:flex-1 tw:items-center tw:gap-2">
      <Typography
        as="span"
        className={isPinned ? 'tw:text-primary' : 'tw:text-secondary'}
        ellipsis={{ tooltip: true }}
        size="text-sm"
        weight="medium">
        {property.label}
      </Typography>
      {isCustomHeaderProperty(property) && (
        <Badge color="purple" size="sm" type="color">
          {property.customPropertyType}
        </Badge>
      )}
      {isPinned && property.isEmpty && (
        <Typography
          as="span"
          className="tw:shrink-0 tw:text-quaternary"
          size="text-xs">
          {t('label.empty')}
        </Typography>
      )}
    </span>
  );
};

const PropertyToggle = ({
  property,
  isPinned,
  onToggle,
}: {
  property: HeaderProperty;
  isPinned: boolean;
  onToggle: (id: string) => void;
}) => {
  const { t } = useTranslation();

  return (
    <Toggle
      aria-label={t('label.show-entity-in-header', { entity: property.label })}
      data-testid={`header-property-toggle-${property.id}`}
      isSelected={isPinned}
      size="sm"
      onChange={() => onToggle(property.id)}
    />
  );
};

const FitMarker = () => {
  const { t } = useTranslation();

  return (
    <div
      className="tw:my-2 tw:flex tw:items-center tw:gap-2 tw:px-2"
      data-testid="header-properties-fit-marker"
      role="note">
      <span className="tw:flex-1 tw:border-t tw:border-dashed tw:border-brand" />
      <Typography
        as="span"
        className="tw:shrink-0 tw:text-brand-secondary"
        size="text-xs"
        weight="medium">
        {t('message.header-properties-fit-in-one-line')}
      </Typography>
      <span className="tw:flex-1 tw:border-t tw:border-dashed tw:border-brand" />
    </div>
  );
};

const ShowEmptyOption = ({
  isSelected,
  onChange,
}: {
  isSelected: boolean;
  onChange: (isSelected: boolean) => void;
}) => {
  const { t } = useTranslation();
  const labelId = useId();
  const hintId = useId();

  return (
    <div className="tw:mt-3 tw:flex tw:items-center tw:gap-3">
      <div className="tw:min-w-0 tw:flex-1">
        <Typography
          as="span"
          className="tw:block tw:text-primary"
          id={labelId}
          size="text-sm"
          weight="medium">
          {t('label.show-empty-property-plural')}
        </Typography>
        <Typography
          as="span"
          className="tw:block tw:text-quaternary"
          id={hintId}
          size="text-xs">
          {t('message.show-empty-header-properties-description')}
        </Typography>
      </div>
      <Toggle
        aria-describedby={hintId}
        aria-labelledby={labelId}
        data-testid="show-empty-header-properties"
        isSelected={isSelected}
        size="sm"
        onChange={onChange}
      />
    </div>
  );
};

const CreateCustomPropertyLink = ({
  entityType,
  entityLabel,
}: {
  entityType: CustomizeEntityHeaderPanelProps['entityType'];
  entityLabel: string;
}) => {
  const { t } = useTranslation();

  return (
    <Link
      className="tw:mt-2.5 tw:flex tw:items-center tw:gap-2.5 tw:rounded-lg tw:border tw:border-dashed tw:border-primary tw:px-3 tw:py-2.5 tw:text-primary tw:no-underline tw:hover:bg-primary_hover"
      data-testid="create-custom-property-link"
      to={getSettingPath(
        GlobalSettingsMenuCategory.CUSTOM_PROPERTIES,
        getCustomPropertyEntityPathname(entityType)
      )}>
      <span className="tw:flex tw:size-7 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-lg tw:bg-utility-purple-50 tw:text-utility-purple-700">
        <Plus aria-hidden size={16} />
      </span>
      <span className="tw:min-w-0">
        <Typography
          as="span"
          className="tw:block"
          size="text-sm"
          weight="semibold">
          {t('label.create-entity', { entity: t('label.custom-property') })}
        </Typography>
        <Typography
          as="span"
          className="tw:block tw:text-quaternary"
          size="text-xs">
          {t('message.create-custom-property-description', {
            entity: entityLabel,
          })}
        </Typography>
      </span>
    </Link>
  );
};

const CustomizeEntityHeaderPanel = ({
  entityType,
  personaName = '',
  properties,
  entityHeader,
  onApply,
  onClose,
}: CustomizeEntityHeaderPanelProps) => {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<EntityHeader>(entityHeader);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState(HeaderPropertyFilter.All);

  const isFiltered = filter !== HeaderPropertyFilter.All || query.trim() !== '';
  const entityLabel = entityUtilClassBase.getFormattedEntityType(entityType);

  const { pinned, unpinned, rankById, fittingIds, lastFittingId } =
    useMemo(() => {
      const pinnedProperties = getPinnedHeaderProperties(properties, draft);
      const pinnedIds = new Set(pinnedProperties.map(({ id }) => id));
      const shownIds = getShownHeaderProperties(properties, draft).map(
        ({ id }) => id
      );
      const fitting = shownIds.slice(0, COLLAPSED_HEADER_PROPERTY_COUNT);
      const matches = (property: HeaderProperty) =>
        matchesHeaderPropertyFilter(property, filter, query);

      return {
        pinned: pinnedProperties.filter(matches),
        unpinned: properties.filter(
          (property) => !pinnedIds.has(property.id) && matches(property)
        ),
        rankById: new Map(pinnedProperties.map(({ id }, i) => [id, i + 1])),
        fittingIds: new Set(fitting),
        lastFittingId:
          shownIds.length > fitting.length ? fitting.at(-1) : undefined,
      };
    }, [properties, draft, filter, query]);

  const filterCounts = useMemo(
    () =>
      Object.values(HeaderPropertyFilter).map((value) => ({
        value,
        count: properties.filter((property) =>
          matchesHeaderPropertyFilter(property, value, '')
        ).length,
      })),
    [properties]
  );

  const searchLabel = t('label.search-entity', {
    entity: t('label.property-plural'),
  });

  const handleToggle = (id: string) =>
    setDraft((current) => toggleHeaderProperty(current, id));

  const { dragAndDropHooks } = useDragAndDrop({
    getItems: (keys) =>
      [...keys].map((key) => ({ [HEADER_PROPERTY_DRAG_TYPE]: String(key) })),
    onReorder: ({ keys, target }) =>
      setDraft((current) =>
        moveHeaderProperties(
          current,
          [...keys].map(String),
          String(target.key),
          target.dropPosition
        )
      ),
    renderDropIndicator: (target) => (
      <DropIndicator
        className={({ isDropTarget }) =>
          isDropTarget ? 'tw:h-0.5 tw:rounded-full tw:bg-brand-solid' : ''
        }
        target={target}
      />
    ),
  });

  return (
    <>
      <div className="tw:flex tw:h-18 tw:shrink-0 tw:items-center tw:gap-3 tw:border-b tw:border-secondary tw:pr-4 tw:pl-6">
        <FeaturedIcon color="gray" icon={Sliders02} size="md" theme="modern" />
        <div className="tw:min-w-0 tw:flex-1">
          <Heading
            className="tw:m-0 tw:text-md tw:font-semibold tw:text-primary"
            slot="title">
            {t('label.customize-entity', { entity: t('label.header') })}
          </Heading>
          <Typography
            as="p"
            className="tw:text-tertiary"
            ellipsis={{ tooltip: true }}
            size="text-sm">
            {t('message.customize-entity-header-description', {
              entity: entityLabel,
              persona: personaName,
            })}
          </Typography>
        </div>
        <CloseButton onPress={onClose} />
      </div>

      <div className="tw:flex tw:shrink-0 tw:flex-col tw:gap-3 tw:border-b tw:border-secondary tw:px-6 tw:pt-6 tw:pb-5">
        <Input
          aria-label={searchLabel}
          icon={Search}
          inputDataTestId="header-property-search"
          placeholder={searchLabel}
          value={query}
          onChange={setQuery}
        />

        <Tabs
          selectedKey={filter}
          onSelectionChange={(key: Key) =>
            setFilter(key as HeaderPropertyFilter)
          }>
          <Tabs.List
            fullWidth
            aria-label={t('label.filter-plural')}
            size="sm"
            type="button-border">
            {filterCounts.map(({ value, count }) => (
              <Tabs.Item
                data-testid={`header-property-filter-${value}`}
                id={value}
                key={value}>
                {t(FILTER_LABEL_KEYS[value])}
                <span className="tw:text-xs tw:font-medium tw:text-quaternary tw:tabular-nums">
                  {count}
                </span>
              </Tabs.Item>
            ))}
          </Tabs.List>
        </Tabs>

        <ShowEmptyOption
          isSelected={draft.showEmptyProperties ?? true}
          onChange={(showEmptyProperties) =>
            setDraft((current) => ({ ...current, showEmptyProperties }))
          }
        />
      </div>

      <div className="tw:min-h-0 tw:flex-1 tw:overflow-y-auto tw:px-6 tw:pt-2 tw:pb-6">
        <ListHeading
          caption={t('message.drag-to-set-priority')}
          title={t('label.in-header')}
        />
        <GridList
          aria-label={t('label.in-header')}
          className="tw:flex tw:flex-col tw:gap-0.5"
          data-testid="pinned-header-properties"
          dependencies={[rankById, fittingIds, lastFittingId, isFiltered]}
          dragAndDropHooks={dragAndDropHooks}
          items={pinned}
          renderEmptyState={() => (
            <EmptyListNote>
              {t('label.no-entity-found', {
                entity: t('label.property-plural'),
              })}
            </EmptyListNote>
          )}>
          {(property) => (
            <GridListItem
              className={({ isDragging, isFocusVisible }) =>
                classNames('tw:rounded-lg tw:outline-none', {
                  'tw:opacity-50': isDragging,
                  'tw:outline-2 tw:outline-focus-ring': isFocusVisible,
                })
              }
              data-testid={`pinned-header-property-${property.id}`}
              id={property.id}
              textValue={property.label}>
              <div
                className={classNames(
                  ROW_CLASS_NAME,
                  'tw:bg-primary_alt tw:px-2'
                )}>
                <AriaButton
                  aria-label={t('label.move-the-entity', {
                    entity: property.label,
                  })}
                  className="tw:flex tw:h-6 tw:w-5 tw:cursor-grab tw:items-center tw:justify-center tw:rounded tw:text-fg-quaternary"
                  slot="drag">
                  <DotsGrid size={16} />
                </AriaButton>
                <span
                  className={classNames(
                    'tw:flex tw:size-5.5 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-md tw:text-xs tw:font-semibold tw:tabular-nums',
                    fittingIds.has(property.id)
                      ? 'tw:bg-brand-primary tw:text-brand-secondary'
                      : 'tw:bg-secondary tw:text-tertiary'
                  )}>
                  {rankById.get(property.id)}
                </span>
                <PropertyLabel isPinned property={property} />
                <PropertyToggle
                  isPinned
                  property={property}
                  onToggle={handleToggle}
                />
              </div>
              {!isFiltered && property.id === lastFittingId && <FitMarker />}
            </GridListItem>
          )}
        </GridList>

        <ListHeading
          caption={t('message.still-on-custom-properties-tab')}
          title={t('label.not-in-header')}
        />
        <ul
          className="tw:m-0 tw:flex tw:list-none tw:flex-col tw:gap-0.5 tw:p-0"
          data-testid="unpinned-header-properties">
          {unpinned.map((property) => (
            <li
              className={classNames(
                ROW_CLASS_NAME,
                'tw:bg-secondary_subtle tw:pr-2 tw:pl-3'
              )}
              data-testid={`unpinned-header-property-${property.id}`}
              key={property.id}>
              <PropertyLabel isPinned={false} property={property} />
              <PropertyToggle
                isPinned={false}
                property={property}
                onToggle={handleToggle}
              />
            </li>
          ))}
        </ul>
        {unpinned.length === 0 && (
          <EmptyListNote>
            {t('label.no-entity-found', {
              entity: t('label.property-plural'),
            })}
          </EmptyListNote>
        )}

        <CreateCustomPropertyLink
          entityLabel={entityLabel}
          entityType={entityType}
        />
      </div>

      <div className="tw:flex tw:h-18 tw:shrink-0 tw:items-center tw:gap-3 tw:border-t tw:border-secondary tw:px-6">
        <Typography
          as="span"
          className="tw:min-w-0 tw:flex-1 tw:text-quaternary"
          size="text-sm">
          {t('message.entity-header-applies-after-save', {
            persona: personaName,
          })}
        </Typography>
        <Button
          color="tertiary"
          data-testid="reset-header-properties"
          onPress={() => setDraft(getDefaultEntityHeader(properties))}>
          {t('label.reset')}
        </Button>
        <Button color="secondary" onPress={onClose}>
          {t('label.cancel')}
        </Button>
        <Button
          color="primary"
          data-testid="apply-header-properties"
          onPress={() => onApply(draft)}>
          {t('label.apply')}
        </Button>
      </div>
    </>
  );
};

export default CustomizeEntityHeaderPanel;
