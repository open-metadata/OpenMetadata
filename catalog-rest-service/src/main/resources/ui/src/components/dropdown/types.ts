import React from 'react';

export enum DropDownType {
  LINK = 'link',
  Text = 'text',
  CHECKBOX = 'checkbox',
}

export type DropDownListItem = {
  name: string;
  value?: string;
  group?: string;
  to?: string;
  disabled?: boolean;
  method?: () => void;
} & Record<string, string | number | boolean | undefined | Function>;

export type DropDownListProp = {
  dropDownList: Array<DropDownListItem>;
  horzPosRight?: boolean;
  listGroups?: Array<string>;
  searchString?: string;
  selectedItems?: Array<string>;
  showSearchBar?: boolean;
  value?: string;
  onSelect?: (
    event: React.MouseEvent<HTMLElement, MouseEvent>,
    value?: string
  ) => void;
  setIsOpen?: (value: boolean) => void;
};

export type DropDownProp = {
  label?: string;
  type: string;
  icon?: React.ElementType | string;
} & DropDownListProp;
