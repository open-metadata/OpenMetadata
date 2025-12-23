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
import type { CustomTabsArgs } from "../types/Tabs.types";

export const CUSTOM_TABS_DEFAULT_ARGS: CustomTabsArgs = {
  tabs: [
    { label: "Tab One", value: "tab1" },
    { label: "Tab Two", value: "tab2" },
    { label: "Tab Three", value: "tab3" },
  ],
  value: "tab1",
  variant: "standard",
  marginTop: "13px",
  "aria-label": "Custom tabs example",
  activeTextColor: undefined,
  indicatorColor: undefined,
  fontSize: undefined,
  fontWeight: undefined,
  selectedFontWeight: undefined,
  orientation: "horizontal",
  scrollButtons: false,
  allowScrollButtonsMobile: false,
  centered: false,
  selectionFollowsFocus: false,
} as CustomTabsArgs;

export const CUSTOM_TABS_ARG_TYPES = {
  variant: {
    control: "select",
    options: ["standard", "scrollable", "fullWidth"],
    description: "The variant to use",
  },
  marginTop: {
    control: "text",
    description: "Custom margin top value",
  },
  "aria-label": {
    control: "text",
    description: "Label for accessibility",
  },
  activeTextColor: {
    control: "color",
    description: "Color for active tab text",
  },
  indicatorColor: {
    control: "color",
    description: "Color for the tab indicator",
  },
  fontSize: {
    control: "text",
    description: "Font size for tab labels (e.g., '14px', '1rem', 14)",
  },
  fontWeight: {
    control: "text",
    description: "Font weight for tab labels (e.g., 400, 500, 'normal', 'bold')",
  },
  selectedFontWeight: {
    control: "text",
    description: "Font weight for selected tab label (e.g., 500, 600, 'normal', 'bold')",
  },
  orientation: {
    control: "select",
    options: ["horizontal", "vertical"],
    description: "The orientation of the tabs",
  },
  scrollButtons: {
    control: "select",
    options: [false, true, "auto"],
    description: "Determine behavior of scroll buttons when tabs are set to scroll",
  },
  allowScrollButtonsMobile: {
    control: "boolean",
    description: "If true, the scroll buttons will be present on mobile",
  },
  centered: {
    control: "boolean",
    description: "If true, the tabs will be centered",
  },
  selectionFollowsFocus: {
    control: "boolean",
    description: "If true, the selected tab changes on focus",
  },
  tabs: {
    control: "object",
    description: "Array of tab items to display",
  },
  value: {
    control: "text",
    description: "The value of the currently selected tab",
  },
  onChange: {
    action: "changed",
    description: "Callback fired when the value changes",
  },
};

