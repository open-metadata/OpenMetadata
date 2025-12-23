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
import { Box, ThemeProvider, Typography } from "@mui/material";
import type { Meta } from "@storybook/react";
import React, { useEffect, useState } from "react";
import { createMuiTheme } from "../../theme/createMuiTheme";
import { Tabs, type TabsProps, type TabItem } from "./MuiTabs";

interface CommonTabPanelPropsType {
  children?: React.ReactNode;
  index: string;
  value: string;
}

function CommonTabPanel(props: CommonTabPanelPropsType) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`common-tabpanel-${index}`}
      aria-labelledby={`common-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

type CustomTabsArgs = TabsProps;

export const CustomTabs = (args: CustomTabsArgs) => {
  const theme = createMuiTheme();
  const [value, setValue] = useState<string>(args.value || args.tabs[0]?.value || "tab1");

  useEffect(() => {
    if (args.value) {
      setValue(args.value);
    } else if (args.tabs.length > 0) {
      const currentTabExists = args.tabs.some((tab) => tab.value === value);
      if (!currentTabExists) {
        setValue(args.tabs[0]?.value || "tab1");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [args.value, args.tabs]);

  return (
    <ThemeProvider theme={theme}>
      <Box sx={{ width: "100%", maxWidth: 800 }}>
        <Tabs
          {...args}
          value={value}
          onChange={(_, newValue) => {
            setValue(newValue);
            args.onChange?.(_, newValue);
          }}
        />
        {args.tabs.map((tab) => (
          <CommonTabPanel key={tab.value} value={value} index={tab.value}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              {tab.label}
            </Typography>
            <Typography>Content for {tab.label} tab</Typography>
          </CommonTabPanel>
        ))}
      </Box>
    </ThemeProvider>
  );
};

CustomTabs.args = {
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

CustomTabs.argTypes = {
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

// Basic Common Tabs Example
export const CommonTabsBasic = () => {
  const theme = createMuiTheme();
  const [value, setValue] = useState<string>("tab1");

  const tabs: TabItem[] = [
    { label: "Tab One", value: "tab1" },
    { label: "Tab Two", value: "tab2" },
    { label: "Tab Three", value: "tab3" },
  ];

  return (
    <ThemeProvider theme={theme}>
      <Box sx={{ width: "100%", maxWidth: 800 }}>
        <Tabs
          value={value}
          onChange={(_, newValue) => setValue(newValue)}
          tabs={tabs}
          aria-label="Basic common tabs example"
        />
        <CommonTabPanel value={value} index="tab1">
          Content for Tab One
        </CommonTabPanel>
        <CommonTabPanel value={value} index="tab2">
          Content for Tab Two
        </CommonTabPanel>
        <CommonTabPanel value={value} index="tab3">
          Content for Tab Three
        </CommonTabPanel>
      </Box>
    </ThemeProvider>
  );
};


// Common Tabs with Many Tabs
export const CommonTabsManyTabs = () => {
  const theme = createMuiTheme();
  const [value, setValue] = useState<string>("tab1");

  const tabs: TabItem[] = [
    { label: "Overview", value: "tab1" },
    { label: "Details", value: "tab2" },
    { label: "History", value: "tab3" },
    { label: "Analytics", value: "tab4" },
    { label: "Settings", value: "tab5" },
  ];

  return (
    <ThemeProvider theme={theme}>
      <Box sx={{ width: "100%", maxWidth: 800 }}>
        <Tabs
          value={value}
          onChange={(_, newValue) => setValue(newValue)}
          tabs={tabs}
          aria-label="Many tabs example"
        />
        {tabs.map((tab) => (
          <CommonTabPanel key={tab.value} value={value} index={tab.value}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              {tab.label}
            </Typography>
            <Typography>Content for {tab.label} tab</Typography>
          </CommonTabPanel>
        ))}
      </Box>
    </ThemeProvider>
  );
};

// Common Tabs with Custom Margin
export const CommonTabsWithMargin = () => {
  const theme = createMuiTheme();
  const [value, setValue] = useState<string>("tab1");

  const tabs: TabItem[] = [
    { label: "First Tab", value: "tab1" },
    { label: "Second Tab", value: "tab2" },
  ];

  return (
    <ThemeProvider theme={theme}>
      <Box sx={{ width: "100%", maxWidth: 800 }}>
        <Tabs
          value={value}
          onChange={(_, newValue) => setValue(newValue)}
          tabs={tabs}
          aria-label="Custom margin tabs example"
          marginTop="24px"
        />
        <CommonTabPanel value={value} index="tab1">
          Content for First Tab (with custom margin top)
        </CommonTabPanel>
        <CommonTabPanel value={value} index="tab2">
          Content for Second Tab
        </CommonTabPanel>
      </Box>
    </ThemeProvider>
  );
};

// Tabs with Disabled Tab
export const CommonTabsWithDisabled = () => {
  const theme = createMuiTheme();
  const [value, setValue] = useState<string>("tab1");

  const tabs: TabItem[] = [
    { label: "Active Tab", value: "tab1" },
    { label: "Disabled Tab", value: "tab2", disabled: true },
    { label: "Active Tab", value: "tab3" },
  ];

  return (
    <ThemeProvider theme={theme}>
      <Box sx={{ width: "100%", maxWidth: 800 }}>
        <Tabs
          value={value}
          onChange={(_, newValue) => setValue(newValue)}
          tabs={tabs}
          aria-label="Tabs with disabled tab example"
        />
        <CommonTabPanel value={value} index="tab1">
          Content for Active Tab
        </CommonTabPanel>
        <CommonTabPanel value={value} index="tab2">
          This content should not be visible (tab is disabled)
        </CommonTabPanel>
        <CommonTabPanel value={value} index="tab3">
          Content for Active Tab
        </CommonTabPanel>
      </Box>
    </ThemeProvider>
  );
};

// Tabs with Custom Colors
export const CommonTabsWithCustomColors = () => {
  const theme = createMuiTheme();
  const [value, setValue] = useState<string>("tab1");

  const tabs: TabItem[] = [
    { label: "Tab One", value: "tab1" },
    { label: "Tab Two", value: "tab2" },
    { label: "Tab Three", value: "tab3" },
  ];

  return (
    <ThemeProvider theme={theme}>
      <Box sx={{ width: "100%", maxWidth: 800 }}>
        <Tabs
          value={value}
          onChange={(_, newValue) => setValue(newValue)}
          tabs={tabs}
          aria-label="Tabs with custom colors example"
          activeTextColor="#10B981"
          indicatorColor="#10B981"
        />
        {tabs.map((tab) => (
          <CommonTabPanel key={tab.value} value={value} index={tab.value}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              {tab.label}
            </Typography>
            <Typography>
              This tab uses custom green color for active text and indicator.
            </Typography>
          </CommonTabPanel>
        ))}
      </Box>
    </ThemeProvider>
  );
};

const meta = {
  title: "Components/Tabs",
  component: CustomTabs,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof CustomTabs>;

export default meta;
