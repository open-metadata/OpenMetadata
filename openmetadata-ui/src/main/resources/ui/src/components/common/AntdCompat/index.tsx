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

import type { DropdownProps } from 'antd';
import type { AutoCompleteProps } from 'antd/lib/auto-complete';
import type { PopoverProps } from 'antd/lib/popover';
import type { SelectProps } from 'antd/lib/select';
import type { TooltipProps } from 'antd/lib/tooltip';
import type { TreeSelectProps } from 'antd/lib/tree-select';
import {
  AutoComplete as AutoComplete5,
  ConfigProvider,
  Dropdown as Dropdown5,
  Popover as Popover5,
  Select as Select5,
  theme,
  Tooltip as Tooltip5,
  TreeSelect as TreeSelect5,
} from 'antd5';
import React from 'react';

// Get brand colors from CSS variables at runtime
const getBrandColor = (varName: string, fallback: string): string => {
  if (typeof window !== 'undefined') {
    const computed = getComputedStyle(document.documentElement)
      .getPropertyValue(varName)
      .trim();
    
    return computed || fallback;
  }
  
  return fallback;
};

// Minimal theme with brand colors and essential overrides
const getV4CompatTheme = () => ({
  algorithm: theme.defaultAlgorithm,
  token: {
    // Brand colors from CSS variables
    colorPrimary: getBrandColor('--ant-primary-color', '#1890ff'),
    colorSuccess: getBrandColor('--ant-success-color', '#52c41a'),
    colorWarning: getBrandColor('--ant-warning-color', '#faad14'),
    colorError: getBrandColor('--ant-error-color', '#f5222d'),
    colorInfo: getBrandColor('--ant-info-color', '#1890ff'),
  },
  components: {
    Select: {
      // Match existing Less styles
      optionSelectedBg: getBrandColor('--ant-primary-1', '#e6f7ff'),
      controlItemBgHover: '#f5f5f5',
      controlItemBgActive: getBrandColor('--ant-primary-1', '#e6f7ff'),
    },
    Dropdown: {
      controlItemBgHover: '#f5f5f5',
      controlItemBgActive: '#f5f5f5',
    },
    Tooltip: {
      colorBgSpotlight: 'rgba(0, 0, 0, 0.75)',
      colorTextLightSolid: '#fff',
    },
    TreeSelect: {
      nodeSelectedBg: getBrandColor('--ant-primary-1', '#e6f7ff'),
    },
    Popover: {
      // Popover inherits from Tooltip
    },
    AutoComplete: {
      // AutoComplete inherits from Select
    },
  },
});

// TreeSelect wrapper with v4 to v5 prop compatibility
interface TreeSelectWrapperProps extends Omit<TreeSelectProps<any>, 'ref'> {
  visible?: boolean;
  onVisibleChange?: (visible: boolean) => void;
  dropdownClassName?: string;
}

const TreeSelectWrapper: React.FC<TreeSelectWrapperProps> = (props) => {
  // Handle v4 to v5 prop changes
  const { visible, onVisibleChange, dropdownClassName, dropdownStyle, ...restProps } = props;
  
  const v5Props = {
    ...restProps,
    open: restProps.open ?? visible,
    onOpenChange: restProps.onOpenChange ?? onVisibleChange,
    popupClassName: restProps.popupClassName ?? dropdownClassName,
    // Default dropdown styles from Less
    dropdownStyle: {
      border: '1px solid #d5d7da', // @grey-300
      ...dropdownStyle,
    },
  };

  return (
    <ConfigProvider theme={getV4CompatTheme()}>
      <TreeSelect5 {...v5Props} />
    </ConfigProvider>
  );
};

// Create the exported component with static properties
export const TreeSelect = Object.assign(TreeSelectWrapper, {
  SHOW_CHILD: TreeSelect5.SHOW_CHILD,
  SHOW_PARENT: TreeSelect5.SHOW_PARENT,
  SHOW_ALL: TreeSelect5.SHOW_ALL,
}) as React.FC<TreeSelectWrapperProps> & {
  SHOW_CHILD: typeof TreeSelect5.SHOW_CHILD;
  SHOW_PARENT: typeof TreeSelect5.SHOW_PARENT;
  SHOW_ALL: typeof TreeSelect5.SHOW_ALL;
};

// Select wrapper
interface SelectWrapperProps extends Omit<SelectProps<any>, 'ref'> {
  visible?: boolean;
  onVisibleChange?: (visible: boolean) => void;
  dropdownClassName?: string;
}

const SelectWrapper: React.FC<SelectWrapperProps> = (props) => {
  const { visible, onVisibleChange, dropdownClassName, dropdownStyle, ...restProps } = props;
  
  const v5Props = {
    ...restProps,
    open: restProps.open ?? visible,
    onOpenChange: restProps.onOpenChange ?? onVisibleChange,
    popupClassName: restProps.popupClassName ?? dropdownClassName,
    dropdownStyle: {
      border: '1px solid #d5d7da',
      ...dropdownStyle,
    },
  };

  return (
    <ConfigProvider theme={getV4CompatTheme()}>
      <Select5 {...v5Props} />
    </ConfigProvider>
  );
};

// Create the exported component with static properties
export const Select = Object.assign(SelectWrapper, {
  Option: Select5.Option,
  OptGroup: Select5.OptGroup,
}) as React.FC<SelectWrapperProps> & {
  Option: typeof Select5.Option;
  OptGroup: typeof Select5.OptGroup;
};

// Dropdown wrapper
interface DropdownWrapperProps extends DropdownProps {
  visible?: boolean;
  onVisibleChange?: (visible: boolean) => void;
  destroyPopupOnHide?: boolean; // v4 prop that maps to destroyOnHidden
}

export const Dropdown: React.FC<DropdownWrapperProps> = (props) => {
  const { visible, onVisibleChange, destroyPopupOnHide, ...restProps } = props;
  
  const v5Props = {
    ...restProps,
    open: restProps.open ?? visible,
    onOpenChange: restProps.onOpenChange ?? onVisibleChange,
    // Map v4's destroyPopupOnHide to v5's destroyOnHidden
    destroyOnHidden: restProps.destroyOnHidden ?? destroyPopupOnHide,
  };

  return (
    <ConfigProvider theme={getV4CompatTheme()}>
      <Dropdown5 {...v5Props} />
    </ConfigProvider>
  );
};

// Tooltip wrapper
interface TooltipWrapperProps extends Omit<TooltipProps, 'ref'> {
  visible?: boolean;
  onVisibleChange?: (visible: boolean) => void;
}

export const Tooltip: React.FC<TooltipWrapperProps> = (props) => {
  const { visible, onVisibleChange, ...restProps } = props;
  
  const v5Props = {
    ...restProps,
    open: restProps.open ?? visible,
    onOpenChange: restProps.onOpenChange ?? onVisibleChange,
    arrow: { pointAtCenter: true },
  };

  return (
    <ConfigProvider theme={getV4CompatTheme()}>
      <Tooltip5 {...v5Props} />
    </ConfigProvider>
  );
};

// Popover wrapper
interface PopoverWrapperProps extends Omit<PopoverProps, 'ref'> {
  visible?: boolean;
  onVisibleChange?: (visible: boolean) => void;
  destroyTooltipOnHide?: boolean;
}

export const Popover: React.FC<PopoverWrapperProps> = (props) => {
  const { visible, onVisibleChange, destroyTooltipOnHide, ...restProps } = props;
  
  const v5Props = {
    ...restProps,
    open: restProps.open ?? visible,
    // Handle both v4 and v5 onOpenChange signatures
    onOpenChange: restProps.onOpenChange ?? (onVisibleChange ? 
      (open: boolean) => onVisibleChange(open) : undefined),
    arrow: { pointAtCenter: true },
    // Map v4's destroyTooltipOnHide to v5's destroyOnHidden
    destroyOnHidden: restProps.destroyOnHidden ?? destroyTooltipOnHide,
  };

  return (
    <ConfigProvider theme={getV4CompatTheme()}>
      <Popover5 {...v5Props} />
    </ConfigProvider>
  );
};

// AutoComplete wrapper
interface AutoCompleteWrapperProps extends Omit<AutoCompleteProps, 'ref'> {
  visible?: boolean;
  onVisibleChange?: (visible: boolean) => void;
  dropdownClassName?: string;
}

export const AutoComplete: React.FC<AutoCompleteWrapperProps> = (props) => {
  const { visible, onVisibleChange, dropdownClassName, dropdownStyle, ...restProps } = props;
  
  const v5Props = {
    ...restProps,
    open: restProps.open ?? visible,
    onOpenChange: restProps.onOpenChange ?? onVisibleChange,
    popupClassName: restProps.popupClassName ?? dropdownClassName,
    dropdownStyle: {
      border: '1px solid #d5d7da',
      ...dropdownStyle,
    },
  };

  return (
    <ConfigProvider theme={getV4CompatTheme()}>
      <AutoComplete5 {...v5Props} />
    </ConfigProvider>
  );
};