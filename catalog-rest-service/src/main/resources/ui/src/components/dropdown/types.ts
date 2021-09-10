/*
  * Licensed to the Apache Software Foundation (ASF) under one or more
  * contributor license agreements. See the NOTICE file distributed with
  * this work for additional information regarding copyright ownership.
  * The ASF licenses this file to You under the Apache License, Version 2.0
  * (the "License"); you may not use this file except in compliance with
  * the License. You may obtain a copy of the License at

  * http://www.apache.org/licenses/LICENSE-2.0

  * Unless required by applicable law or agreed to in writing, software
  * distributed under the License is distributed on an "AS IS" BASIS,
  * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  * See the License for the specific language governing permissions and
  * limitations under the License.
*/

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
  icon?: React.ReactElement;
  isOpenNewTab?: boolean;
} & Record<
  string,
  string | number | boolean | undefined | Function | React.ReactElement
>;

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
  className?: string;
  label?: string;
  type: string;
  icon?: React.ElementType | string;
} & DropDownListProp;
