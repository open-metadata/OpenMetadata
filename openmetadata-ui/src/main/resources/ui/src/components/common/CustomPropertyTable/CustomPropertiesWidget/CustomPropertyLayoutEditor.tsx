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
import { Box, Tabs } from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';
import { CustomPropertyCard } from '../CustomPropertyCard/CustomPropertyCard';
import {
  CustomPropertyLayoutWidth,
  LaidOutCustomProperty,
  LayoutDropTarget,
} from './CustomPropertiesWidget.types';
import { moveLayoutItem } from './CustomPropertiesWidget.utils';
import { LayoutDragHandle, LayoutDropIndicator } from './LayoutDragParts';
import { useLayoutItemDrag, useLayoutReorder } from './useLayoutReorder';

const DRAG_TYPE = 'CUSTOM_PROPERTY_LAYOUT_CARD';
// Below the smallest core tab size: the switch sits in the card's title row.
const SIZE_TAB_CLASS = 'tw:px-2 tw:py-1 tw:text-xs';
const NO_VALUE = undefined;
const noopSave = async () => undefined;

interface LayoutCardProps {
  item: LaidOutCustomProperty;
  index: number;
  dropSide?: LayoutDropTarget['side'];
  onHover: (fromIndex: number, target: LayoutDropTarget) => void;
  onDragEnd: () => void;
  onWidthChange: (index: number, width: CustomPropertyLayoutWidth) => void;
}

/** A property card, without a value, with its size switch and drag handle. */
const LayoutCard = ({
  item: { property, width },
  index,
  dropSide,
  onHover,
  onDragEnd,
  onWidthChange,
}: LayoutCardProps) => {
  const { t } = useTranslation();
  const isHalf = width === 'half';
  const { itemRef, handleRef, isDragging } = useLayoutItemDrag<HTMLLIElement>({
    dragType: DRAG_TYPE,
    index,
    axis: isHalf ? 'x' : 'y',
    onHover,
    onDragEnd,
  });

  return (
    <li
      className={classNames('tw:relative tw:min-w-0', {
        'tw:col-span-2': !isHalf,
        'tw:opacity-50': isDragging,
      })}
      data-testid={`layout-item-${property.name}`}
      ref={itemRef}>
      <CustomPropertyCard
        hasEditPermissions={false}
        headerActions={
          <Box align="center" className="tw:shrink-0" gap={2}>
            <Tabs
              className="tw:w-auto"
              data-testid={`layout-item-${property.name}-size`}
              selectedKey={width}
              onSelectionChange={(key) =>
                onWidthChange(index, key as CustomPropertyLayoutWidth)
              }>
              <Tabs.List
                aria-label={t('label.size')}
                className="tw:rounded-lg tw:p-0.5"
                size="sm"
                type="button-border">
                <Tabs.Item className={SIZE_TAB_CLASS} id="half">
                  {t('label.small')}
                </Tabs.Item>
                <Tabs.Item className={SIZE_TAB_CLASS} id="full">
                  {t('label.large')}
                </Tabs.Item>
              </Tabs.List>
            </Tabs>
            <LayoutDragHandle
              isBordered
              dataTestId={`layout-item-${property.name}-handle`}
              handleRef={handleRef}
            />
          </Box>
        }
        isCompact={isHalf}
        property={property}
        value={NO_VALUE}
        onValueSave={noopSave}
      />
      {dropSide && <LayoutDropIndicator side={dropSide} width={width} />}
    </li>
  );
};

interface CustomPropertyLayoutEditorProps {
  items: LaidOutCustomProperty[];
  onChange: (items: LaidOutCustomProperty[]) => void;
}

/**
 * Two-column arrangement of property cards, edited in place. Drag a card by
 * its handle; a line shows where it will land. Cards keep their order: a
 * small card dropped between two large ones stays half width in its own row.
 */
export const CustomPropertyLayoutEditor = ({
  items,
  onChange,
}: CustomPropertyLayoutEditorProps) => {
  const { dropTarget, handleHover, clearDropTarget, containerRef } =
    useLayoutReorder(DRAG_TYPE, (fromIndex, toIndex) =>
      onChange(moveLayoutItem(items, fromIndex, toIndex))
    );

  const handleWidthChange = (index: number, width: CustomPropertyLayoutWidth) =>
    onChange(
      items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, width } : item
      )
    );

  return (
    <ul
      className="tw:m-0 tw:grid tw:list-none tw:grid-cols-2 tw:items-start tw:gap-3 tw:p-0"
      data-testid="custom-property-layout-editor"
      ref={containerRef}>
      {items.map((item, index) => (
        <LayoutCard
          dropSide={dropTarget?.index === index ? dropTarget.side : undefined}
          index={index}
          item={item}
          key={item.property.name}
          onDragEnd={clearDropTarget}
          onHover={handleHover}
          onWidthChange={handleWidthChange}
        />
      ))}
    </ul>
  );
};
