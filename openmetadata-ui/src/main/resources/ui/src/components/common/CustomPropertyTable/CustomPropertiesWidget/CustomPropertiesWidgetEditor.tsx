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
import { Badge, Box, Typography } from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';
import Loader from '../../Loader/Loader';
import { CUSTOM_PROPERTIES_WIDGET_STYLE_LABEL } from './CustomPropertiesWidget.constants';
import { LaidOutCustomProperty } from './CustomPropertiesWidget.interface';
import {
  countCardSizes,
  getWidgetStyle,
  mergeShownPropertyLayout,
  moveLayoutItem,
} from './CustomPropertiesWidget.utils';
import {
  CustomPropertiesWidgetEditorProps,
  CustomPropertiesWidgetHeaderInfoProps,
  EditorRowProps,
  PreviewRowListProps,
} from './CustomPropertiesWidgetEditor.interface';
import { CustomPropertyLayoutEditor } from './CustomPropertyLayoutEditor';
import { CustomPropertyListItem } from './CustomPropertyListItem';
import { LayoutDragHandle, LayoutDropIndicator } from './LayoutDragParts';
import { useCustomPropertiesWidgetItems } from './useCustomPropertiesWidgetItems';
import { useLayoutItemDrag, useLayoutReorder } from './useLayoutReorder';

const DRAG_TYPE = 'CUSTOM_PROPERTY_WIDGET_ROW';
const NO_VALUE = undefined;
const noopSave = async () => undefined;

/** Preview style: one-line rows, reordered by their handle. */
const EditorRow = ({
  item: { property },
  index,
  dropSide,
  onHover,
  onDragEnd,
}: EditorRowProps) => {
  const { itemRef, handleRef, isDragging } = useLayoutItemDrag<HTMLLIElement>({
    dragType: DRAG_TYPE,
    index,
    axis: 'y',
    onHover,
    onDragEnd,
  });

  return (
    <CustomPropertyListItem
      actions={
        <>
          <LayoutDragHandle
            dataTestId={`layout-item-${property.name}-handle`}
            handleRef={handleRef}
          />
          {/* Positioned against the row, which is `tw:relative`. */}
          {dropSide && <LayoutDropIndicator side={dropSide} width="full" />}
        </>
      }
      className={classNames(
        'tw:relative tw:rounded-xl tw:border tw:border-secondary tw:bg-primary',
        { 'tw:opacity-50': isDragging }
      )}
      hasEditPermissions={false}
      itemRef={itemRef}
      property={property}
      value={NO_VALUE}
      onValueSave={noopSave}
    />
  );
};

const PreviewRowList = ({ items, onChange }: PreviewRowListProps) => {
  const { dropTarget, handleHover, clearDropTarget, containerRef } =
    useLayoutReorder(DRAG_TYPE, (fromIndex, toIndex) =>
      onChange(moveLayoutItem(items, fromIndex, toIndex))
    );

  return (
    <ul
      className="tw:m-0 tw:flex tw:list-none tw:flex-col tw:gap-2 tw:p-0"
      ref={containerRef}>
      {items.map((item, index) => (
        <EditorRow
          dropSide={dropTarget?.index === index ? dropTarget.side : undefined}
          index={index}
          item={item}
          key={item.property.name}
          onDragEnd={clearDropTarget}
          onHover={handleHover}
        />
      ))}
    </ul>
  );
};

/**
 * Persona-editor body of the Custom Properties widget: the entity type's
 * properties, without values, arranged in place. Drag an item to move it; in
 * the full-width style each card also switches between small and large.
 */
export const CustomPropertiesWidgetEditor = ({
  entityType,
  settings,
  onChange,
}: CustomPropertiesWidgetEditorProps) => {
  const { t } = useTranslation();
  const { items, isLoading } = useCustomPropertiesWidgetItems(
    entityType,
    settings
  );

  const saveItems = (nextItems: LaidOutCustomProperty[]) =>
    onChange({
      ...settings,
      propertyLayout: mergeShownPropertyLayout(
        nextItems,
        settings.propertyLayout
      ),
    });

  if (isLoading) {
    return <Loader size="small" />;
  }

  if (items.length === 0) {
    return (
      <Typography className="tw:text-tertiary" size="text-sm">
        {t('message.no-custom-properties-defined')}
      </Typography>
    );
  }

  return (
    <div data-testid="custom-properties-widget-editor">
      {getWidgetStyle(settings) === 'fullWidth' ? (
        <CustomPropertyLayoutEditor items={items} onChange={saveItems} />
      ) : (
        <PreviewRowList items={items} onChange={saveItems} />
      )}
    </div>
  );
};

/** Style badge and, for full width, how many cards are small and large. */
export const CustomPropertiesWidgetHeaderInfo = ({
  entityType,
  settings,
}: CustomPropertiesWidgetHeaderInfoProps) => {
  const { t } = useTranslation();
  const { items } = useCustomPropertiesWidgetItems(entityType, settings);
  const style = getWidgetStyle(settings);
  const sizes = countCardSizes(items);

  return (
    <Box align="center" className="tw:shrink-0" gap={2}>
      <Badge
        color="brand"
        data-testid="custom-properties-widget-style"
        size="sm"
        type="pill-color">
        {t(CUSTOM_PROPERTIES_WIDGET_STYLE_LABEL[style])}
      </Badge>
      {style === 'fullWidth' && items.length > 0 && (
        <Typography className="tw:text-tertiary" size="text-xs">
          {t('message.custom-property-card-size-count', sizes)}
        </Typography>
      )}
    </Box>
  );
};
