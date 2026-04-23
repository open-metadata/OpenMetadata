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

import type {
  CSSProperties,
  FC,
  KeyboardEvent as ReactKeyboardEvent,
  ReactNode,
} from 'react';
import {
  createElement,
  isValidElement,
  useEffect,
  useRef,
  useState,
} from 'react';
import type { Key } from 'react-aria-components';
import { normalizeHexColor } from '@/colors/colorValidation';
import { Tabs } from '@/components/application/tabs/tabs';
import { Box } from '@/components/base/box/box';
import { Button } from '@/components/base/buttons/button';
import { Input } from '@/components/base/input/input';
import { Typography } from '@/components/foundations/typography';
import { cx } from '@/utils/cx';
import { isReactComponent } from '@/utils/is-react-component';
import type {
  FormSelectItem,
  IconPickerFieldLabels,
} from '../form-field.types';
import { DEFAULT_COLOR_OPTIONS } from './color-picker-field';

const renderSelectItemIcon = (
  icon: FormSelectItem['icon'],
  className: string,
  {
    size = 20,
    style,
  }: {
    size?: number;
    style?: CSSProperties;
  } = {}
) => {
  if (isReactComponent(icon)) {
    return createElement(icon, {
      'aria-hidden': true,
      className,
      size,
      style,
    });
  }

  return isValidElement(icon) ? icon : null;
};

const ICON_STYLE: CSSProperties = {
  color: 'white',
  display: 'block',
  strokeWidth: 1.25,
};

const getDefaultIconPreview = (
  items: FormSelectItem[],
  defaultIcon?: { component: FC }
): ReactNode => {
  if (defaultIcon && isReactComponent(defaultIcon.component)) {
    return renderSelectItemIcon(
      defaultIcon.component,
      'tw:size-5 tw:text-white',
      { size: 20, style: ICON_STYLE }
    );
  }

  return renderSelectItemIcon(items[0]?.icon, 'tw:size-5 tw:text-white', {
    size: 20,
    style: ICON_STYLE,
  });
};

export interface IconPickerFieldProps {
  allowUrl?: boolean;
  ariaLabel?: string;
  backgroundColor?: string;
  'data-testid'?: string;
  defaultIcon?: { component: FC };
  disabled?: boolean;
  id?: string;
  items: FormSelectItem[];
  labels?: IconPickerFieldLabels;
  name: string;
  onBlur?: () => void;
  onChange?: (value: string) => void;
  onSelectionChange?: (key: Key | null) => void;
  placeholder?: string;
  value: string;
}

export const IconPickerField = ({
  allowUrl = false,
  ariaLabel,
  backgroundColor: backgroundColorProp,
  'data-testid': dataTestId,
  defaultIcon,
  disabled = false,
  id,
  items,
  labels,
  name,
  onBlur,
  onChange,
  onSelectionChange,
  placeholder,
  value,
}: IconPickerFieldProps) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'icons' | 'url'>('icons');
  const selectedItem = items.find((item) => item.id === value);
  const backgroundColor =
    (backgroundColorProp ? normalizeHexColor(backgroundColorProp) : null) ??
    DEFAULT_COLOR_OPTIONS[6];
  const hasCustomImage = allowUrl && value !== '' && !selectedItem;
  const onBlurRef = useRef(onBlur);
  onBlurRef.current = onBlur;

  useEffect(() => {
    if (!isOpen) {
      setActiveTab(allowUrl && hasCustomImage ? 'url' : 'icons');
    }
  }, [allowUrl, hasCustomImage, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !wrapperRef.current?.contains(event.target)
      ) {
        setIsOpen(false);
        onBlurRef.current?.();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        onBlurRef.current?.();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const handleIconSelection = (item: FormSelectItem) => {
    onBlur?.();
    onChange?.(item.id);
    onSelectionChange?.(item.id);
    setIsOpen(false);
  };

  const triggerPreview = (() => {
    if (selectedItem) {
      return renderSelectItemIcon(
        selectedItem.icon,
        'tw:size-5 tw:text-white',
        { size: 20, style: ICON_STYLE }
      );
    }

    if (hasCustomImage) {
      return (
        <img
          alt=""
          className="tw:h-7 tw:w-7 tw:rounded-sm tw:object-contain"
          src={value}
        />
      );
    }

    return (
      getDefaultIconPreview(items, defaultIcon) ?? (
        <Typography className="tw:text-white" size="text-sm" weight="semibold">
          ?
        </Typography>
      )
    );
  })();

  const togglePicker = () => {
    if (disabled) {
      return;
    }

    setActiveTab(allowUrl && hasCustomImage ? 'url' : 'icons');
    setIsOpen((current) => !current);
  };

  const iconGrid = (
    <div className="tw:p-4">
      {items.length > 0 ? (
        <div className="tw:grid tw:grid-cols-6 tw:gap-4">
          {items.map((item) => {
            const isSelected = selectedItem?.id === item.id;
            const previewIcon = renderSelectItemIcon(
              item.icon,
              'tw:size-5 tw:text-primary',
              {
                size: 20,
                style: {
                  color: 'currentColor',
                  display: 'block',
                  strokeWidth: 1.25,
                },
              }
            );

            const commonButtonProps = {
              'aria-label': item.label ?? item.id,
              'aria-pressed': isSelected,
              className: cx(
                'tw:size-9 tw:rounded-lg tw:p-0! tw:ring-1 tw:ring-secondary_alt tw:transition tw:duration-150',
                isSelected
                  ? 'tw:bg-primary_hover tw:ring-brand'
                  : 'tw:bg-primary tw:hover:bg-primary_hover',
                'tw:focus-visible:ring-2 tw:focus-visible:ring-brand'
              ),
              color: 'tertiary' as const,
              size: 'sm' as const,
              onClick: () => handleIconSelection(item),
            };

            return previewIcon ? (
              <Button
                {...commonButtonProps}
                iconLeading={previewIcon}
                key={item.id}
              />
            ) : (
              <Button {...commonButtonProps} key={item.id}>
                <Typography
                  className="tw:text-primary"
                  size="text-sm"
                  weight="semibold">
                  {(item.label ?? item.id).slice(0, 1).toUpperCase()}
                </Typography>
              </Button>
            );
          })}
        </div>
      ) : (
        <Typography className="tw:text-tertiary" size="text-sm">
          {labels?.emptyState ?? 'No icons available'}
        </Typography>
      )}
    </div>
  );

  const urlPanel = (
    <Box className="tw:p-4" direction="col" gap={2}>
      <Typography className="tw:text-tertiary" size="text-xs" weight="medium">
        {labels?.customIconUrl ?? 'Custom icon URL'}
      </Typography>
      <Input
        autoFocus
        aria-label={placeholder ?? labels?.enterIconUrl ?? 'Enter icon URL'}
        name={name}
        placeholder={placeholder ?? labels?.enterIconUrl ?? 'Enter icon URL'}
        value={selectedItem ? '' : value}
        onBlur={() => onBlur?.()}
        onChange={(v) => onChange?.(v)}
      />
    </Box>
  );

  return (
    <div className="tw:relative tw:w-fit" ref={wrapperRef}>
      <Button
        aria-label={
          ariaLabel ?? placeholder ?? labels?.emptyState ?? 'Select icon'
        }
        className={cx(
          'tw:size-[34px] tw:rounded-[10px] tw:p-0! tw:shadow-xs tw:ring-1 tw:ring-black/5 tw:transition tw:duration-150',
          !disabled && 'tw:hover:scale-[1.02]',
          disabled && 'tw:opacity-50',
          'tw:focus-visible:ring-2 tw:focus-visible:ring-brand tw:focus-visible:ring-offset-2',
          isOpen && 'tw:ring-2 tw:ring-brand tw:ring-offset-2'
        )}
        color="tertiary"
        data-testid={dataTestId}
        iconLeading={triggerPreview ?? undefined}
        id={id}
        isDisabled={disabled}
        size="sm"
        style={{ backgroundColor }}
        onBlur={() => onBlur?.()}
        onClick={togglePicker}
        onKeyDown={(event: ReactKeyboardEvent<HTMLButtonElement>) => {
          if (!disabled && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault();
            togglePicker();
          }
        }}
      />

      {isOpen && (
        <div className="tw:absolute tw:top-[calc(100%+8px)] tw:left-0 tw:z-50 tw:w-[22rem] tw:max-w-[calc(100vw-2rem)] tw:rounded-xl tw:bg-primary tw:shadow-lg tw:ring-1 tw:ring-secondary_alt">
          {allowUrl ? (
            <Tabs
              selectedKey={activeTab}
              onSelectionChange={(key) =>
                setActiveTab(key === 'url' ? 'url' : 'icons')
              }>
              <Tabs.List
                fullWidth
                className="tw:border-b tw:border-secondary_alt tw:p-1"
                size="sm"
                type="button-minimal">
                <Tabs.Item id="icons" label={labels?.iconsTab ?? 'Icons'} />
                <Tabs.Item id="url" label={labels?.urlTab ?? 'URL'} />
              </Tabs.List>
              <Tabs.Panel id="icons">{iconGrid}</Tabs.Panel>
              <Tabs.Panel id="url">{urlPanel}</Tabs.Panel>
            </Tabs>
          ) : (
            iconGrid
          )}
        </div>
      )}
    </div>
  );
};
