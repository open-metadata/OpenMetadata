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
  ButtonUtility,
  Divider,
  Input,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  ArrowUpRight,
  SearchLg,
  XClose,
} from '@openmetadata/ui-core-components/icons';
import classNames from 'classnames';
import { Fragment, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { CustomProperty } from '../../../../generated/type/customProperty';
import withSuspenseFallback from '../../../AppRouter/withSuspenseFallback';
import WidgetCard from '../../WidgetCard/WidgetCard';
import { CustomPropertyCard } from '../CustomPropertyCard/CustomPropertyCard';
import { matchesPropertySearch } from '../CustomPropertyCard/CustomPropertyCard.utils';
import {
  CUSTOM_PROPERTIES_WIDGET_DEFAULT_SIZE,
  CUSTOM_PROPERTIES_WIDGET_MAX_HEIGHT,
} from './CustomPropertiesWidget.constants';
import {
  CustomPropertiesWidgetSettings,
  LaidOutCustomProperty,
} from './CustomPropertiesWidget.types';
import {
  applyPropertyLayout,
  getWidgetDefaultWidth,
} from './CustomPropertiesWidget.utils';
import { CustomPropertyListItem } from './CustomPropertyListItem';

const PropertyValue = withSuspenseFallback(
  lazy(() =>
    import('../PropertyValue').then((m) => ({ default: m.PropertyValue }))
  )
);

interface CustomPropertiesRightPanelProps {
  properties: CustomProperty[];
  extension?: Record<string, unknown>;
  versionDataKeys?: string[];
  widgetSettings?: CustomPropertiesWidgetSettings;
  /** Link to the Custom Properties tab, set when the widget hides properties. */
  viewAllPath?: string;
  hasEditPermissions: boolean;
  isVersionView?: boolean;
  onExtensionUpdate: (extension?: Record<string, unknown>) => Promise<void>;
  onValueSave: (property: CustomProperty, value: unknown) => Promise<void>;
}

/** Custom properties rendered as a side widget (right panel or persona tab). */
export const CustomPropertiesRightPanel = ({
  properties,
  extension,
  versionDataKeys,
  widgetSettings,
  viewAllPath,
  hasEditPermissions,
  isVersionView,
  onExtensionUpdate,
  onValueSave,
}: CustomPropertiesRightPanelProps) => {
  const { t } = useTranslation();
  const [searchText, setSearchText] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchWrapperRef = useRef<HTMLDivElement>(null);
  const searchButtonWrapperRef = useRef<HTMLSpanElement>(null);
  const restoreSearchFocusRef = useRef(false);
  // Persona widgets scroll instead of linking out to the full tab.
  const scrollStyle = widgetSettings
    ? { maxHeight: CUSTOM_PROPERTIES_WIDGET_MAX_HEIGHT }
    : undefined;
  const laidOut = useMemo(
    () =>
      applyPropertyLayout(
        properties,
        widgetSettings?.propertyLayout ?? [],
        getWidgetDefaultWidth
      ),
    [properties, widgetSettings?.propertyLayout]
  );
  const visibleItems = useMemo(
    () =>
      laidOut.filter(({ property }) =>
        matchesPropertySearch(property, searchText)
      ),
    [laidOut, searchText]
  );
  const searchLabel = t('label.search-entity', {
    entity: t('label.property-plural'),
  });

  // Core Input and ButtonUtility drop `ref` under React 18, so focus goes
  // through wrappers. Focus returns to the trigger only on an explicit close.
  useEffect(() => {
    if (isSearchOpen) {
      searchWrapperRef.current?.querySelector('input')?.focus();
    } else if (restoreSearchFocusRef.current) {
      restoreSearchFocusRef.current = false;
      searchButtonWrapperRef.current?.querySelector('button')?.focus();
    }
  }, [isSearchOpen]);

  const closeSearch = () => {
    restoreSearchFocusRef.current = true;
    setSearchText('');
    setIsSearchOpen(false);
  };

  // Small rows sit flush inside the widget card; without the header they need
  // their own border. Large items are full cards in both cases.
  const defaultSize =
    widgetSettings?.size ?? CUSTOM_PROPERTIES_WIDGET_DEFAULT_SIZE;

  const renderItem = (
    { property, width, size = defaultSize }: LaidOutCustomProperty,
    isBordered: boolean
  ) => {
    const spanClass = { 'tw:col-span-2': width === 'full' };

    if (size === 'small') {
      return (
        <CustomPropertyListItem
          className={classNames(spanClass, {
            'tw:rounded-xl tw:border tw:border-secondary tw:bg-primary':
              isBordered,
          })}
          hasEditPermissions={hasEditPermissions}
          key={property.name}
          property={property}
          value={extension?.[property.name]}
          onValueSave={onValueSave}
        />
      );
    }

    return (
      <li
        className={classNames('tw:min-w-0', spanClass, {
          'tw:px-4 tw:py-2': !isBordered,
        })}
        key={property.name}>
        <CustomPropertyCard
          hasEditPermissions={hasEditPermissions}
          isCompact={width === 'half'}
          property={property}
          value={extension?.[property.name]}
          onValueSave={onValueSave}
        />
      </li>
    );
  };

  if (isVersionView) {
    return (
      <WidgetCard
        className="no-scrollbar"
        headerExtra={
          viewAllPath && (
            <Link className="text-sm" to={viewAllPath}>
              {t('label.view-all')}
            </Link>
          )
        }
        title={t('label.custom-property-plural')}>
        <div className="custom-property-right-panel-container">
          {properties.map((record, index) => (
            <Fragment key={record.name}>
              <div
                className={classNames(
                  'custom-property-right-panel-card tw:py-3.5',
                  {
                    'top-border-radius': index === 0,
                    'bottom-border-radius': index === properties.length - 1,
                  }
                )}>
                <PropertyValue
                  isRenderedInRightPanel
                  isVersionView
                  extension={extension}
                  hasEditPermissions={hasEditPermissions}
                  property={record}
                  versionDataKeys={versionDataKeys}
                  onExtensionUpdate={onExtensionUpdate}
                />
              </div>
              {index !== properties.length - 1 && <Divider />}
            </Fragment>
          ))}
        </div>
      </WidgetCard>
    );
  }

  if (widgetSettings && !widgetSettings.showHeader) {
    return (
      <ul
        className="tw:m-0 tw:grid tw:list-none tw:grid-cols-2 tw:items-start tw:gap-4 tw:overflow-y-auto tw:p-0"
        data-testid="custom-properties-widget-cards"
        style={scrollStyle}>
        {laidOut.map((item) => renderItem(item, true))}
      </ul>
    );
  }

  const searchField = isSearchOpen ? (
    <div className="tw:w-full" ref={searchWrapperRef}>
      <Input
        aria-label={searchLabel}
        className="tw:w-full"
        icon={SearchLg}
        inputDataTestId="custom-properties-widget-search"
        placeholder={searchLabel}
        size="sm"
        trailingSlot={
          <ButtonUtility
            className="tw:mr-2 tw:p-1"
            color="tertiary"
            data-testid="custom-properties-widget-search-close"
            icon={XClose}
            size="xs"
            tooltip={t('label.close')}
            onClick={closeSearch}
          />
        }
        value={searchText}
        onBlur={() => !searchText && setIsSearchOpen(false)}
        onChange={setSearchText}
        onKeyDown={(event) => event.key === 'Escape' && closeSearch()}
      />
    </div>
  ) : undefined;

  return (
    <WidgetCard
      contentClassName="tw:p-0"
      dataTestId="custom-properties-widget"
      forceExpand={isSearchOpen}
      headerActions={
        <>
          {viewAllPath && (
            <ButtonUtility
              className="tw:p-1"
              color="tertiary"
              data-testid="custom-properties-widget-view-all"
              href={viewAllPath}
              icon={ArrowUpRight}
              size="xs"
              tooltip={t('label.view-all')}
            />
          )}
          <span className="tw:flex" ref={searchButtonWrapperRef}>
            <ButtonUtility
              className="tw:p-1"
              color="tertiary"
              data-testid="custom-properties-widget-search-button"
              icon={SearchLg}
              size="xs"
              tooltip={searchLabel}
              onClick={() => setIsSearchOpen(true)}
            />
          </span>
        </>
      }
      headerContent={searchField}
      title={t('label.custom-property-plural')}>
      {visibleItems.length ? (
        <ul
          className="tw:m-0 tw:grid tw:list-none tw:grid-cols-2 tw:overflow-y-auto tw:p-0"
          data-testid="custom-properties-widget-list"
          style={scrollStyle}>
          {visibleItems.map((item) => renderItem(item, false))}
        </ul>
      ) : (
        <Typography
          className="tw:px-4 tw:pb-4 tw:text-center tw:text-tertiary"
          data-testid="no-matching-custom-properties"
          size="text-sm">
          {t('message.no-entity-found-for-name', {
            entity: t('label.property-plural'),
            name: searchText,
          })}
        </Typography>
      )}
    </WidgetCard>
  );
};
