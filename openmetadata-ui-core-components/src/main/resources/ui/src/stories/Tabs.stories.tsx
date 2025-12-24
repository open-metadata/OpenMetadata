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
import { Box, Tab, Tabs, ThemeProvider, Typography } from "@mui/material";
import type { TabsProps } from "@mui/material";
import type { Meta } from "@storybook/react";
import React, { useEffect, useState } from "react";
import {
  CUSTOM_TABS_ARG_TYPES,
  CUSTOM_TABS_DEFAULT_ARGS,
} from "../constants/Tabs.constants";
import type {
  CommonTabPanelPropsType,
  StorybookComponent,
  TabItem,
} from "../types/Tabs.types";
import { createMuiTheme } from "../theme/createMuiTheme";

type CustomTabsArgs = TabsProps & {
  tabs?: TabItem[];
};

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

const CustomTabsComponent: React.FC<CustomTabsArgs> = (args) => {
  const theme = createMuiTheme();
  const { tabs: tabsProp, ...tabsProps } = args;
  const tabs = tabsProp || CUSTOM_TABS_DEFAULT_ARGS.tabs || [];
  const [value, setValue] = useState<string>(
    (args.value as string) || tabs[0]?.value || "tab1"
  );

  useEffect(() => {
    if (args.value && args.value !== value) {
      setValue(args.value as string);
    }
  }, [args.value]);

  useEffect(() => {
    if (tabs.length > 0) {
      const currentTabExists = tabs.some((tab) => tab.value === value);
      if (!currentTabExists) {
        setValue(tabs[0]?.value || "tab1");
      }
    }
  }, [tabs, value]);

  return (
    <ThemeProvider theme={theme}>
      <Box sx={{ width: "100%", maxWidth: 800 }}>
        <Tabs
          {...tabsProps}
          value={value}
          onChange={(_, newValue) => {
            setValue(newValue as string);
            args.onChange?.(_, newValue);
          }}
        >
          {tabs.map((tab) => (
            <Tab
              key={tab.value}
              label={tab.label}
              value={tab.value}
              disabled={tab.disabled}
            />
          ))}
        </Tabs>
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

export const CustomTabs: StorybookComponent<CustomTabsArgs> =
  Object.assign(CustomTabsComponent, {
    args: CUSTOM_TABS_DEFAULT_ARGS,
    argTypes: CUSTOM_TABS_ARG_TYPES,
  });

// Basic Common Tabs Example
export const CommonTabsBasic = () => {
  const theme = createMuiTheme();
  const [value, setValue] = useState<string>("tab1");

  const handleChange = (_: React.SyntheticEvent, newValue: string) => {
    console.log('Tab changed to:', newValue);
    setValue(newValue);
  };

  return (
    <ThemeProvider theme={theme}>
      <Box sx={{ width: "100%", maxWidth: 800 }}>
        <Tabs
          value={value}
          onChange={handleChange}
          aria-label="Basic common tabs example"
        >
          <Tab label="Tab One" value="tab1" />
          <Tab label="Tab Two" value="tab2" />
          <Tab label="Tab Three" value="tab3" />
        </Tabs>
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
          onChange={(_, newValue) => setValue(newValue as string)}
          aria-label="Many tabs example"
        >
          {tabs.map((tab) => (
            <Tab
              key={tab.value}
              label={tab.label}
              value={tab.value}
              disabled={tab.disabled}
            />
          ))}
        </Tabs>
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

// Tabs with Disabled Tab
export const CommonTabsWithDisabled = () => {
  const theme = createMuiTheme();
  const [value, setValue] = useState<string>("tab1");

  return (
    <ThemeProvider theme={theme}>
      <Box sx={{ width: "100%", maxWidth: 800 }}>
        <Tabs
          value={value}
          onChange={(_, newValue) => setValue(newValue as string)}
          aria-label="Tabs with disabled tab example"
        >
          <Tab label="Active Tab" value="tab1" />
          <Tab label="Disabled Tab" value="tab2" disabled />
          <Tab label="Active Tab" value="tab3" />
        </Tabs>
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
          onChange={(_, newValue) => setValue(newValue as string)}
          aria-label="Tabs with custom colors example"
          sx={{
            "& .MuiTab-root": {
              "&.Mui-selected": {
                color: theme.palette.allShades.success[700],
              },
            },
            "& .MuiTabs-indicator": {
              backgroundColor: theme.palette.allShades.success[700],
            },
          }}
        >
          {tabs.map((tab) => (
            <Tab
              key={tab.value}
              label={tab.label}
              value={tab.value}
              disabled={tab.disabled}
            />
          ))}
        </Tabs>
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

// Tabs without Border
export const CommonTabsWithoutBorder = () => {
  const theme = createMuiTheme();
  const [value, setValue] = useState<string>("tab1");

  const tabs: TabItem[] = [
    { label: "Documentation", value: "tab1" },
    { label: "Sub Domains", value: "tab2" },
    { label: "Data Products", value: "tab3" },
    { label: "Activity Feeds & Tasks", value: "tab4" },
    { label: "Assets", value: "tab5" },
  ];

  return (
    <ThemeProvider theme={theme}>
      <Box sx={{ width: "100%", maxWidth: 1200 }}>
        <Tabs
          value={value}
          onChange={(_, newValue) => setValue(newValue as string)}
          aria-label="Tabs without border example"
          sx={{
            '& .MuiTabs-scroller': {
              border: 'none',
            },
          }}
        >
          {tabs.map((tab) => (
            <Tab
              key={tab.value}
              label={tab.label}
              value={tab.value}
              disabled={tab.disabled}
            />
          ))}
        </Tabs>
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

const meta = {
  title: "Components/Tabs",
  component: CustomTabs,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof CustomTabs>;

export default meta;
