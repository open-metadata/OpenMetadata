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
  Checkbox,
  Input,
  Tabs,
  Typography,
} from '@openmetadata/ui-core-components';
import { SearchLg } from '@openmetadata/ui-core-components/icons';
import classNames from 'classnames';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CustomProperty } from '../../../../generated/type/customProperty';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import { TYPE_ICON_TILE_CLASS } from '../CustomPropertyCard/CustomPropertyCard.constants';
import {
  getPropertyTypeMeta,
  matchesPropertySearch,
} from '../CustomPropertyCard/CustomPropertyCard.utils';
import {
  CustomPropertiesDisplayMode,
  CustomPropertiesWidgetSettings,
  LaidOutCustomProperty,
  LayoutDropTarget,
} from './CustomPropertiesWidget.types';
import {
  applyPropertyLayout,
  getSelectedPropertyNames,
  getWidgetDefaultWidth,
  moveLayoutItem,
  reorderSubset,
  toWidgetPropertyLayout,
} from './CustomPropertiesWidget.utils';
import { LayoutDragHandle, LayoutDropIndicator } from './LayoutDragParts';
import { useLayoutItemDrag, useLayoutReorder } from './useLayoutReorder';

const DRAG_TYPE = 'CUSTOM_PROPERTY_PICKER_ITEM';

/** The tab is the widget's display mode. */
type PickerTab = Extract<CustomPropertiesDisplayMode, 'all' | 'selected'>;

interface PickerRowProps {
  item: LaidOutCustomProperty;
  index: number;
  isChecked: boolean;
  isDisabled: boolean;
  dropSide?: LayoutDropTarget['side'];
  onToggle: (name: string, isChecked: boolean) => void;
  onHover: (fromIndex: number, target: LayoutDropTarget) => void;
  onDragEnd: () => void;
}

const PickerRow = ({
  item: { property },
  index,
  isChecked,
  isDisabled,
  dropSide,
  onToggle,
  onHover,
  onDragEnd,
}: PickerRowProps) => {
  const { t } = useTranslation();
  const meta = getPropertyTypeMeta(property.propertyType.name);
  const TypeIcon = meta.icon;
  const propertyLabel = getEntityName(property);
  const isDimmed = !isChecked;
  const { itemRef, handleRef, isDragging } = useLayoutItemDrag<HTMLLIElement>({
    dragType: DRAG_TYPE,
    index,
    axis: 'y',
    isDisabled,
    onHover,
    onDragEnd,
  });

  return (
    <li
      className={classNames(
        'tw:relative tw:flex tw:min-w-0 tw:items-center tw:gap-3 tw:rounded-xl tw:border tw:py-2.5 tw:pr-3 tw:pl-2',
        isDimmed ? 'tw:bg-secondary' : 'tw:bg-primary',
        isDragging
          ? 'tw:border-dashed tw:border-brand tw:opacity-50'
          : 'tw:border-secondary'
      )}
      data-testid={`picker-item-${property.name}`}
      ref={itemRef}>
      <LayoutDragHandle
        dataTestId={`picker-item-${property.name}-handle`}
        handleRef={handleRef}
        isDisabled={isDisabled}
      />
      <Checkbox
        aria-label={propertyLabel}
        data-testid={`custom-property-checkbox-${property.name}`}
        isDisabled={isDisabled}
        isSelected={isChecked}
        onChange={(checked) => onToggle(property.name, checked)}
      />
      <Box
        align="center"
        className={classNames('tw:min-w-0 tw:flex-1', {
          'tw:opacity-60': isDimmed,
        })}
        gap={3}>
        <span
          aria-hidden
          className={`tw:flex tw:size-8 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-lg ${
            TYPE_ICON_TILE_CLASS[meta.color]
          }`}>
          <TypeIcon className="tw:size-4" />
        </span>
        <Typography
          className={classNames('tw:min-w-0 tw:flex-1 tw:truncate', {
            'tw:font-medium tw:text-primary': !isDimmed,
            'tw:text-tertiary': isDimmed,
          })}
          size="text-sm">
          {propertyLabel}
        </Typography>
        <Badge color={meta.color} size="sm" type="color">
          {t(meta.labelKey)}
        </Badge>
      </Box>
      {dropSide && <LayoutDropIndicator side={dropSide} width="full" />}
    </li>
  );
};

interface CustomPropertyPickerProps {
  properties: CustomProperty[];
  value: CustomPropertiesWidgetSettings;
  isDisabled?: boolean;
  onChange: (value: CustomPropertiesWidgetSettings) => void;
}

/**
 * Picks and orders the widget's properties. Selected ticks them one by one
 * (a new widget starts with the first few); All shows every property,
 * including ones added later. Drag rows to set the order.
 */
export const CustomPropertyPicker = ({
  properties,
  value,
  isDisabled = false,
  onChange,
}: CustomPropertyPickerProps) => {
  const { t } = useTranslation();
  const [searchText, setSearchText] = useState('');
  const activeTab: PickerTab = value.displayMode === 'all' ? 'all' : 'selected';
  const isAllTab = activeTab === 'all';

  const ordered = useMemo(
    () =>
      applyPropertyLayout(
        properties,
        value.propertyLayout,
        getWidgetDefaultWidth
      ),
    [properties, value.propertyLayout]
  );
  const selectedNames = useMemo(
    () => new Set(getSelectedPropertyNames(properties, value)),
    [properties, value]
  );
  const checkedNames = useMemo(
    () =>
      isAllTab ? new Set(properties.map(({ name }) => name)) : selectedNames,
    [isAllTab, properties, selectedNames]
  );
  const visible = useMemo(
    () =>
      ordered.filter(({ property }) =>
        matchesPropertySearch(property, searchText)
      ),
    [ordered, searchText]
  );

  const emit = (
    tab: PickerTab,
    names: Set<string>,
    items: LaidOutCustomProperty[] = ordered
  ) =>
    onChange({
      ...value,
      displayMode: tab,
      // Kept while All is active, so going back to Selected restores it.
      propertyNames: items
        .map(({ property }) => property.name)
        .filter((name) => names.has(name)),
      propertyLayout: toWidgetPropertyLayout(items),
    });

  // Unticking a property under All leaves every other one ticked, as a selection.
  const handleToggle = (name: string, isChecked: boolean) => {
    const next = new Set(checkedNames);
    if (isChecked) {
      next.add(name);
    } else {
      next.delete(name);
    }
    emit('selected', next);
  };

  const handleMove = (fromIndex: number, toIndex: number) => {
    const visibleNames = new Set(visible.map(({ property }) => property.name));
    const items = reorderSubset(
      ordered,
      ({ property }) => visibleNames.has(property.name),
      moveLayoutItem(visible, fromIndex, toIndex)
    );
    emit(activeTab, selectedNames, items);
  };

  const { dropTarget, handleHover, clearDropTarget, containerRef } =
    useLayoutReorder(DRAG_TYPE, handleMove);

  const searchLabel = t('label.search-entity', {
    entity: t('label.property-plural'),
  });

  const renderList = () => {
    if (visible.length === 0) {
      return (
        <Typography
          className="tw:py-6 tw:text-center tw:text-tertiary"
          data-testid="no-matching-custom-properties"
          size="text-sm">
          {t('message.no-entity-found-for-name', {
            entity: t('label.property-plural'),
            name: searchText,
          })}
        </Typography>
      );
    }

    return (
      <ul
        className="tw:m-0 tw:flex tw:list-none tw:flex-col tw:gap-2 tw:p-0"
        data-testid="custom-property-checkbox-list"
        ref={containerRef}>
        {visible.map((item, index) => (
          <PickerRow
            dropSide={dropTarget?.index === index ? dropTarget.side : undefined}
            index={index}
            isChecked={checkedNames.has(item.property.name)}
            isDisabled={isDisabled}
            item={item}
            key={item.property.name}
            onDragEnd={clearDropTarget}
            onHover={handleHover}
            onToggle={handleToggle}
          />
        ))}
      </ul>
    );
  };

  return (
    <Tabs
      className="tw:gap-3"
      data-testid="custom-property-picker"
      isDisabled={isDisabled}
      selectedKey={activeTab}
      onSelectionChange={(key) => emit(key as PickerTab, selectedNames)}>
      <Box align="center" gap={3} wrap="wrap">
        <Tabs.List
          aria-label={t('label.property-plural')}
          size="sm"
          type="button-border">
          <Tabs.Item data-testid="picker-tab-all" id="all">
            {t('label.all-entity', { entity: t('label.property-plural') })}
          </Tabs.Item>
          <Tabs.Item
            badge={selectedNames.size}
            data-testid="picker-tab-selected"
            id="selected">
            {t('label.selected')}
          </Tabs.Item>
        </Tabs.List>
        <Input
          aria-label={searchLabel}
          className="tw:min-w-48 tw:flex-1"
          icon={SearchLg}
          inputDataTestId="custom-property-picker-search"
          isDisabled={isDisabled}
          placeholder={searchLabel}
          size="sm"
          value={searchText}
          onChange={setSearchText}
        />
      </Box>
      <Box align="center" justify="between">
        <Typography className="tw:text-tertiary" size="text-xs">
          {t('message.count-of-total-selected', {
            count: checkedNames.size,
            total: properties.length,
          })}
        </Typography>
        {!isAllTab && (
          <Box gap={3}>
            <Button
              color="link-color"
              data-testid="picker-select-all"
              isDisabled={isDisabled}
              size="sm"
              onPress={() =>
                emit('selected', new Set(properties.map(({ name }) => name)))
              }>
              {t('label.select-all')}
            </Button>
            <Button
              color="link-gray"
              data-testid="picker-clear"
              isDisabled={isDisabled}
              size="sm"
              onPress={() => emit('selected', new Set())}>
              {t('label.clear')}
            </Button>
          </Box>
        )}
      </Box>
      {(['all', 'selected'] as PickerTab[]).map((tab) => (
        <Tabs.Panel id={tab} key={tab}>
          {renderList()}
        </Tabs.Panel>
      ))}
    </Tabs>
  );
};
