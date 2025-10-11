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
  Add,
  CheckCircle,
  Delete,
  Error,
  Favorite,
  Info,
  Settings,
  Star,
  SyncDisabled,
  Warning,
} from "@mui/icons-material";
import type { IconButtonProps } from "@mui/material";
import { Box, IconButton, ThemeProvider, Typography } from "@mui/material";
import type { Meta } from "@storybook/react";
import { createMuiTheme } from "../../theme/createMuiTheme";

type IconTypes =
  | "add"
  | "delete"
  | "settings"
  | "star"
  | "favorite"
  | "checkCircle"
  | "error"
  | "info"
  | "warning"
  | "syncDisabled";

type CustomIconButtonArgs = IconButtonProps & {
  iconType?: IconTypes;
};

export const CustomIconButton = (args: CustomIconButtonArgs) => {
  const theme = createMuiTheme();
  const { iconType, ...iconButtonProps } = args;

  const getIcon = (type?: IconTypes) => {
    switch (type) {
      case "add":
        return <Add />;
      case "delete":
        return <Delete />;
      case "settings":
        return <Settings />;
      case "star":
        return <Star />;
      case "favorite":
        return <Favorite />;
      case "checkCircle":
        return <CheckCircle />;
      case "error":
        return <Error />;
      case "info":
        return <Info />;
      case "warning":
        return <Warning />;
      case "syncDisabled":
        return <SyncDisabled />;
      default:
        return <Add />;
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <IconButton {...iconButtonProps}>{getIcon(iconType)}</IconButton>
    </ThemeProvider>
  );
};

CustomIconButton.args = {
  color: "primary",
  size: "medium",
  iconType: "add",
};

CustomIconButton.argTypes = {
  color: {
    control: "select",
    options: [
      "default",
      "inherit",
      "primary",
      "secondary",
      "error",
      "success",
      "info",
      "warning",
    ],
    description: "The color of the icon button",
  },
  size: {
    control: "select",
    options: ["small", "medium", "large"],
    description: "The size of the icon button",
  },
  iconType: {
    control: "select",
    options: [
      "add",
      "delete",
      "settings",
      "star",
      "favorite",
      "checkCircle",
      "error",
      "info",
      "warning",
      "syncDisabled",
    ],
    description: "Icon to display",
  },
  edge: {
    control: "select",
    options: [false, "start", "end"],
    description: "If given, uses a negative margin to counteract padding",
  },
};

const meta = {
  title: "Components/IconButtons",
  component: CustomIconButton,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof CustomIconButton>;

export default meta;

const IconButtonsList = ({ title }: { title: string }) => {
  return (
    <Box>
      <Typography>{title}</Typography>
      <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
        <IconButton color="primary">
          <Add />
        </IconButton>
        <IconButton color="secondary">
          <Settings />
        </IconButton>
        <IconButton color="success">
          <CheckCircle />
        </IconButton>
        <IconButton color="error">
          <Delete />
        </IconButton>
        <IconButton color="info">
          <Info />
        </IconButton>
        <IconButton color="warning">
          <Warning />
        </IconButton>
        <IconButton disabled>
          <SyncDisabled />
        </IconButton>
      </Box>
    </Box>
  );
};

const IconButtonsSizeList = ({ title }: { title: string }) => {
  return (
    <Box>
      <Typography>{title}</Typography>
      <Box
        sx={{
          display: "flex",
          gap: 2,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <IconButton color="primary" size="small">
          <Star />
        </IconButton>
        <IconButton color="primary" size="medium">
          <Star />
        </IconButton>
        <IconButton color="primary" size="large">
          <Star />
        </IconButton>
      </Box>
    </Box>
  );
};

export const AllIconButtons = () => {
  const theme = createMuiTheme();
  return (
    <ThemeProvider theme={theme}>
      <Box
        sx={{
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          flexDirection: "column",
        }}
      >
        <IconButtonsList title="Icon Buttons by Color" />
        <IconButtonsSizeList title="Icon Buttons by Size" />
      </Box>
    </ThemeProvider>
  );
};
