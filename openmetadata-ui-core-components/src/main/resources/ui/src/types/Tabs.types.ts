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
import type { TabsProps as MuiTabsProps } from "@mui/material";
import React from "react";

export interface TabItem {
  label: string;
  value: string;
  disabled?: boolean;
}

export interface TabsProps
  extends Omit<
    MuiTabsProps,
    "children" | "value" | "onChange" | "indicatorColor" | "textColor"
  > {
  value: string;
  onChange?: (event: React.SyntheticEvent, newValue: string) => void;
  tabs: TabItem[];
  marginTop?: string;
  activeTextColor?: string;
  indicatorColor?: string;
  fontSize?: string | number;
  fontWeight?: number | string;
  selectedFontWeight?: number | string;
}

export interface CommonTabPanelPropsType {
  children?: React.ReactNode;
  index: string;
  value: string;
}

export type CustomTabsArgs = TabsProps;

