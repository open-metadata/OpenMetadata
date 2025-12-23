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
import {
  Phone,
  Favorite,
  PersonPin,
} from "@mui/icons-material";
import type { TabsProps, TabProps } from "@mui/material";
import {
  Box,
  ThemeProvider,
  Typography,
  Tabs,
  Tab,
} from "@mui/material";
import type { Meta } from "@storybook/react";
import React, { useState } from "react";
import { createMuiTheme } from "../../theme/createMuiTheme";

type TabVariants = "standard" | "scrollable" | "fullWidth";
type TabOrientation = "horizontal" | "vertical";

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

function a11yProps(index: number) {
  return {
    id: `simple-tab-${index}`,
    "aria-controls": `simple-tabpanel-${index}`,
  };
}

type CustomTabsArgs = TabsProps & {
  tabCount?: number;
  showIcons?: boolean;
  showIconLabels?: boolean;
  disabledTabIndex?: number;
  wrappedLabels?: boolean;
};

export const CustomTabs = (args: CustomTabsArgs) => {
  const theme = createMuiTheme();
  const [value, setValue] = useState(0);
  const {
    tabCount = 3,
    showIcons = false,
    showIconLabels = false,
    disabledTabIndex,
    wrappedLabels = false,
    ...tabsProps
  } = args;

  const handleChange = (_event: React.SyntheticEvent, newValue: number) => {
    setValue(newValue);
  };

  const getTabLabel = (index: number) => {
    if (wrappedLabels && index === 0) {
      return "New Arrivals in the Longest Text of Nonfiction that should appear in the next line";
    }
    return `Item ${index + 1}`;
  };

  const getTabIcon = (index: number) => {
    const icons = [<Phone key="phone" />, <Favorite key="favorite" />, <PersonPin key="person" />];
    return icons[index % icons.length];
  };

  return (
    <ThemeProvider theme={theme}>
      <Box sx={{ width: "100%", maxWidth: 600 }}>
        <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
          <Tabs value={value} onChange={handleChange} {...tabsProps}>
            {Array.from({ length: tabCount }).map((_, index) => (
              <Tab
                key={index}
                label={showIconLabels ? undefined : getTabLabel(index)}
                icon={showIcons || showIconLabels ? getTabIcon(index) : undefined}
                iconPosition={showIconLabels ? "top" : undefined}
                disabled={disabledTabIndex === index}
                wrapped={wrappedLabels && index === 0}
                {...a11yProps(index)}
              />
            ))}
          </Tabs>
        </Box>
        {Array.from({ length: tabCount }).map((_, index) => (
          <TabPanel key={index} value={value} index={index}>
            {getTabLabel(index)}
          </TabPanel>
        ))}
      </Box>
    </ThemeProvider>
  );
};

CustomTabs.args = {
  variant: "standard",
  orientation: "horizontal",
  textColor: "primary",
  indicatorColor: "primary",
  centered: false,
  scrollButtons: "auto",
  allowScrollButtonsMobile: false,
  tabCount: 3,
  showIcons: false,
  showIconLabels: false,
  wrappedLabels: false,
};

CustomTabs.argTypes = {
  variant: {
    control: "select",
    options: ["standard", "scrollable", "fullWidth"],
    description: "The variant of the tabs",
  },
  orientation: {
    control: "select",
    options: ["horizontal", "vertical"],
    description: "The orientation of the tabs",
  },
  textColor: {
    control: "select",
    options: ["primary", "secondary", "inherit"],
    description: "The color of the tab text",
  },
  indicatorColor: {
    control: "select",
    options: ["primary", "secondary"],
    description: "The color of the tab indicator",
  },
  centered: {
    control: "boolean",
    description: "Whether tabs are centered",
  },
  scrollButtons: {
    control: "select",
    options: [false, true, "auto"],
    description: "Whether to show scroll buttons",
  },
  allowScrollButtonsMobile: {
    control: "boolean",
    description: "Allow scroll buttons on mobile",
  },
  tabCount: {
    control: { type: "number", min: 1, max: 10 },
    description: "Number of tabs to display",
  },
  showIcons: {
    control: "boolean",
    description: "Show icons on tabs",
  },
  showIconLabels: {
    control: "boolean",
    description: "Show icons with labels",
  },
  wrappedLabels: {
    control: "boolean",
    description: "Enable wrapped labels",
  },
  disabledTabIndex: {
    control: { type: "number", min: 0, max: 9 },
    description: "Index of disabled tab (leave empty for none)",
  },
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

// Basic Tabs Examples
const BasicTabsExample = ({
  variant,
  title,
}: {
  variant: TabVariants;
  title: string;
}) => {
  const [value, setValue] = useState(0);

  const handleChange = (_event: React.SyntheticEvent, newValue: number) => {
    setValue(newValue);
  };

  return (
    <Box sx={{ width: "100%", maxWidth: 600 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>
        {title}
      </Typography>
      <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
        <Tabs value={value} onChange={handleChange} variant={variant}>
          <Tab label="Item One" {...a11yProps(0)} />
          <Tab label="Item Two" {...a11yProps(1)} />
          <Tab label="Item Three" {...a11yProps(2)} />
        </Tabs>
      </Box>
      <TabPanel value={value} index={0}>
        Item One
      </TabPanel>
      <TabPanel value={value} index={1}>
        Item Two
      </TabPanel>
      <TabPanel value={value} index={2}>
        Item Three
      </TabPanel>
    </Box>
  );
};

// Colored Tabs Examples
const ColoredTabsExample = ({
  textColor,
  indicatorColor,
  title,
}: {
  textColor: "primary" | "secondary";
  indicatorColor: "primary" | "secondary";
  title: string;
}) => {
  const [value, setValue] = useState(0);

  const handleChange = (_event: React.SyntheticEvent, newValue: number) => {
    setValue(newValue);
  };

  return (
    <Box sx={{ width: "100%", maxWidth: 600 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>
        {title}
      </Typography>
      <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
        <Tabs
          value={value}
          onChange={handleChange}
          textColor={textColor}
          indicatorColor={indicatorColor}
        >
          <Tab label="Item One" {...a11yProps(0)} />
          <Tab label="Item Two" {...a11yProps(1)} />
          <Tab label="Item Three" {...a11yProps(2)} />
        </Tabs>
      </Box>
      <TabPanel value={value} index={0}>
        Item One
      </TabPanel>
      <TabPanel value={value} index={1}>
        Item Two
      </TabPanel>
      <TabPanel value={value} index={2}>
        Item Three
      </TabPanel>
    </Box>
  );
};

// Icon Tabs Examples
const IconTabsExample = ({ title }: { title: string }) => {
  const [value, setValue] = useState(0);

  const handleChange = (_event: React.SyntheticEvent, newValue: number) => {
    setValue(newValue);
  };

  return (
    <Box sx={{ width: "100%", maxWidth: 600 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>
        {title}
      </Typography>
      <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
        <Tabs value={value} onChange={handleChange}>
          <Tab icon={<Phone />} aria-label="phone" {...a11yProps(0)} />
          <Tab icon={<Favorite />} aria-label="favorite" {...a11yProps(1)} />
          <Tab icon={<PersonPin />} aria-label="person" {...a11yProps(2)} />
        </Tabs>
      </Box>
      <TabPanel value={value} index={0}>
        Phone
      </TabPanel>
      <TabPanel value={value} index={1}>
        Favorite
      </TabPanel>
      <TabPanel value={value} index={2}>
        Person
      </TabPanel>
    </Box>
  );
};

// Icon with Label Tabs Examples
const IconLabelTabsExample = ({ title }: { title: string }) => {
  const [value, setValue] = useState(0);

  const handleChange = (_event: React.SyntheticEvent, newValue: number) => {
    setValue(newValue);
  };

  return (
    <Box sx={{ width: "100%", maxWidth: 600 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>
        {title}
      </Typography>
      <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
        <Tabs value={value} onChange={handleChange}>
          <Tab icon={<Phone />} label="RECENTS" {...a11yProps(0)} />
          <Tab icon={<Favorite />} label="FAVORITES" {...a11yProps(1)} />
          <Tab icon={<PersonPin />} label="NEARBY" {...a11yProps(2)} />
        </Tabs>
      </Box>
      <TabPanel value={value} index={0}>
        RECENTS
      </TabPanel>
      <TabPanel value={value} index={1}>
        FAVORITES
      </TabPanel>
      <TabPanel value={value} index={2}>
        NEARBY
      </TabPanel>
    </Box>
  );
};

// Disabled Tab Example
const DisabledTabExample = () => {
  const [value, setValue] = useState(0);

  const handleChange = (_event: React.SyntheticEvent, newValue: number) => {
    setValue(newValue);
  };

  return (
    <Box sx={{ width: "100%", maxWidth: 600 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>
        Disabled Tab
      </Typography>
      <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
        <Tabs value={value} onChange={handleChange}>
          <Tab label="Active" {...a11yProps(0)} />
          <Tab label="Disabled" disabled {...a11yProps(1)} />
          <Tab label="Active" {...a11yProps(2)} />
        </Tabs>
      </Box>
      <TabPanel value={value} index={0}>
        Active Tab
      </TabPanel>
      <TabPanel value={value} index={1}>
        Disabled Tab (should not be visible)
      </TabPanel>
      <TabPanel value={value} index={2}>
        Active Tab
      </TabPanel>
    </Box>
  );
};

// Scrollable Tabs Example
const ScrollableTabsExample = ({
  scrollButtons,
  allowScrollButtonsMobile,
  title,
}: {
  scrollButtons: boolean | "auto";
  allowScrollButtonsMobile?: boolean;
  title: string;
}) => {
  const [value, setValue] = useState(0);

  const handleChange = (_event: React.SyntheticEvent, newValue: number) => {
    setValue(newValue);
  };

  return (
    <Box sx={{ width: "100%", maxWidth: 600 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>
        {title}
      </Typography>
      <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
        <Tabs
          value={value}
          onChange={handleChange}
          variant="scrollable"
          scrollButtons={scrollButtons}
          allowScrollButtonsMobile={allowScrollButtonsMobile}
        >
          <Tab label="Item One" {...a11yProps(0)} />
          <Tab label="Item Two" {...a11yProps(1)} />
          <Tab label="Item Three" {...a11yProps(2)} />
          <Tab label="Item Four" {...a11yProps(3)} />
          <Tab label="Item Five" {...a11yProps(4)} />
          <Tab label="Item Six" {...a11yProps(5)} />
          <Tab label="Item Seven" {...a11yProps(6)} />
        </Tabs>
      </Box>
      <TabPanel value={value} index={0}>
        Item One
      </TabPanel>
      <TabPanel value={value} index={1}>
        Item Two
      </TabPanel>
      <TabPanel value={value} index={2}>
        Item Three
      </TabPanel>
      <TabPanel value={value} index={3}>
        Item Four
      </TabPanel>
      <TabPanel value={value} index={4}>
        Item Five
      </TabPanel>
      <TabPanel value={value} index={5}>
        Item Six
      </TabPanel>
      <TabPanel value={value} index={6}>
        Item Seven
      </TabPanel>
    </Box>
  );
};

// Vertical Tabs Example
const VerticalTabsExample = () => {
  const [value, setValue] = useState(0);

  const handleChange = (_event: React.SyntheticEvent, newValue: number) => {
    setValue(newValue);
  };

  return (
    <Box sx={{ width: "100%", maxWidth: 600, display: "flex" }}>
      <Typography variant="h6" sx={{ mb: 2, width: "100%" }}>
        Vertical Tabs
      </Typography>
      <Tabs
        orientation="vertical"
        value={value}
        onChange={handleChange}
        sx={{ borderRight: 1, borderColor: "divider", minWidth: 200 }}
      >
        <Tab label="Item One" {...a11yProps(0)} />
        <Tab label="Item Two" {...a11yProps(1)} />
        <Tab label="Item Three" {...a11yProps(2)} />
        <Tab label="Item Four" {...a11yProps(3)} />
      </Tabs>
      <TabPanel value={value} index={0}>
        Item One
      </TabPanel>
      <TabPanel value={value} index={1}>
        Item Two
      </TabPanel>
      <TabPanel value={value} index={2}>
        Item Three
      </TabPanel>
      <TabPanel value={value} index={3}>
        Item Four
      </TabPanel>
    </Box>
  );
};

// Wrapped Labels Example
const WrappedLabelsExample = () => {
  const [value, setValue] = useState(0);

  const handleChange = (_event: React.SyntheticEvent, newValue: number) => {
    setValue(newValue);
  };

  return (
    <Box sx={{ width: "100%", maxWidth: 600 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>
        Wrapped Labels
      </Typography>
      <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
        <Tabs value={value} onChange={handleChange}>
          <Tab
            label="New Arrivals in the Longest Text of Nonfiction that should appear in the next line"
            wrapped
            {...a11yProps(0)}
          />
          <Tab label="Item Two" {...a11yProps(1)} />
          <Tab label="Item Three" {...a11yProps(2)} />
        </Tabs>
      </Box>
      <TabPanel value={value} index={0}>
        Wrapped Label Tab
      </TabPanel>
      <TabPanel value={value} index={1}>
        Item Two
      </TabPanel>
      <TabPanel value={value} index={2}>
        Item Three
      </TabPanel>
    </Box>
  );
};

// Export all stories
export const AllBasicTabs = () => {
  const theme = createMuiTheme();
  return (
    <ThemeProvider theme={theme}>
      <Box
        sx={{
          display: "flex",
          gap: 4,
          flexWrap: "wrap",
          flexDirection: "column",
        }}
      >
        <BasicTabsExample variant="standard" title="Standard" />
        <BasicTabsExample variant="fullWidth" title="Full Width" />
        <BasicTabsExample variant="scrollable" title="Scrollable" />
      </Box>
    </ThemeProvider>
  );
};

export const AllColoredTabs = () => {
  const theme = createMuiTheme();
  return (
    <ThemeProvider theme={theme}>
      <Box
        sx={{
          display: "flex",
          gap: 4,
          flexWrap: "wrap",
          flexDirection: "column",
        }}
      >
        <ColoredTabsExample
          textColor="primary"
          indicatorColor="primary"
          title="Primary Color"
        />
        <ColoredTabsExample
          textColor="secondary"
          indicatorColor="secondary"
          title="Secondary Color"
        />
      </Box>
    </ThemeProvider>
  );
};

export const AllIconTabs = () => {
  const theme = createMuiTheme();
  return (
    <ThemeProvider theme={theme}>
      <Box
        sx={{
          display: "flex",
          gap: 4,
          flexWrap: "wrap",
          flexDirection: "column",
        }}
      >
        <IconTabsExample title="Icons Only" />
        <IconLabelTabsExample title="Icons with Labels" />
      </Box>
    </ThemeProvider>
  );
};

export const AllScrollableTabs = () => {
  const theme = createMuiTheme();
  return (
    <ThemeProvider theme={theme}>
      <Box
        sx={{
          display: "flex",
          gap: 4,
          flexWrap: "wrap",
          flexDirection: "column",
        }}
      >
        <ScrollableTabsExample
          scrollButtons="auto"
          allowScrollButtonsMobile={false}
          title="Auto Scroll Buttons"
        />
        <ScrollableTabsExample
          scrollButtons={true}
          allowScrollButtonsMobile={true}
          title="Force Scroll Buttons"
        />
        <ScrollableTabsExample
          scrollButtons={false}
          title="No Scroll Buttons"
        />
      </Box>
    </ThemeProvider>
  );
};

export const DisabledTab = () => {
  const theme = createMuiTheme();
  return (
    <ThemeProvider theme={theme}>
      <DisabledTabExample />
    </ThemeProvider>
  );
};

export const VerticalTabs = () => {
  const theme = createMuiTheme();
  return (
    <ThemeProvider theme={theme}>
      <VerticalTabsExample />
    </ThemeProvider>
  );
};

export const WrappedLabels = () => {
  const theme = createMuiTheme();
  return (
    <ThemeProvider theme={theme}>
      <WrappedLabelsExample />
    </ThemeProvider>
  );
};

