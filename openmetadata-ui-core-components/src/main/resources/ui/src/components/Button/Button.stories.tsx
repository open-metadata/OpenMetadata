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
  Info,
  Settings,
  SyncDisabled,
  Warning,
} from "@mui/icons-material";
import type { ButtonProps } from "@mui/material";
import { Box, ThemeProvider, Typography } from "@mui/material";
import type { Meta } from "@storybook/react";
import { createMuiTheme } from "../../theme/createMuiTheme";
import { Button } from "@mui/material";

type ButtonVariants = "contained" | "outlined" | "text";
type CustomButtonArgs = ButtonProps & {
  startIconType?: "none" | "add" | "delete" | "settings";
  endIconType?: "none" | "add" | "delete" | "settings";
};

export const CustomButton = (args: CustomButtonArgs) => {
  const theme = createMuiTheme();
  const { startIconType, endIconType, ...buttonProps } = args;

  const getIcon = (iconType?: string) => {
    switch (iconType) {
      case "add":
        return <Add />;
      case "delete":
        return <Delete />;
      case "settings":
        return <Settings />;
      default:
        return undefined;
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <Button
        {...buttonProps}
        startIcon={
          startIconType !== "none" ? getIcon(startIconType) : undefined
        }
        endIcon={endIconType !== "none" ? getIcon(endIconType) : undefined}
      />
    </ThemeProvider>
  );
};

CustomButton.args = {
  children: "Click me",
  variant: "contained",
  color: "primary",
  size: "small",
  startIconType: "none",
  endIconType: "none",
};

CustomButton.argTypes = {
  variant: {
    control: "select",
    options: ["contained", "outlined", "text"],
    description: "The variant of the button",
  },
  color: {
    control: "select",
    options: ["primary", "secondary", "error", "success", "info", "warning"],
    description: "The color of the button",
  },
  size: {
    control: "select",
    options: ["small", "medium", "large"],
    description: "The size of the button",
  },
  startIconType: {
    control: "select",
    options: ["none", "add", "delete", "settings"],
    description: "Icon to display at the start of the button",
  },
  endIconType: {
    control: "select",
    options: ["none", "add", "delete", "settings"],
    description: "Icon to display at the end of the button",
  },
};

const meta = {
  title: "Components/Buttons",
  component: CustomButton,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof CustomButton>;

export default meta;

const ButtonsList = ({
  variant,
  title,
}: {
  variant: ButtonVariants;
  title: string;
}) => {
  return (
    <Box>
      <Typography>{title}</Typography>
      <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
        <Button variant={variant} color="primary">
          Primary
        </Button>
        <Button variant={variant} color="secondary">
          Secondary
        </Button>
        <Button variant={variant} color="success">
          Success
        </Button>
        <Button variant={variant} color="error">
          Error
        </Button>
        <Button variant={variant} color="info">
          Info
        </Button>
        <Button variant={variant} color="warning">
          Warning
        </Button>
        <Button variant={variant} disabled>
          Disabled
        </Button>
      </Box>
    </Box>
  );
};

const ButtonsListWithIcon = ({
  variant,
  title,
}: {
  variant: ButtonVariants;
  title: string;
}) => {
  return (
    <Box>
      <Typography>{title}</Typography>
      <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
        <Button variant={variant} color="primary" startIcon={<Add />}>
          Primary
        </Button>
        <Button variant={variant} color="secondary" endIcon={<Settings />}>
          Secondary
        </Button>
        <Button variant={variant} color="success" endIcon={<CheckCircle />}>
          Success
        </Button>
        <Button variant={variant} color="error" startIcon={<Error />}>
          Error
        </Button>
        <Button variant={variant} color="info" startIcon={<Info />}>
          Info
        </Button>
        <Button variant={variant} color="warning" startIcon={<Warning />}>
          Warning
        </Button>
        <Button variant={variant} disabled startIcon={<SyncDisabled />}>
          Disabled
        </Button>
      </Box>
    </Box>
  );
};

export const AllButtons = () => {
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
        <ButtonsList variant="contained" title="Contained" />
        <ButtonsList variant="outlined" title="Outlined" />
        <ButtonsList variant="text" title="Text" />
      </Box>
    </ThemeProvider>
  );
};

export const AllButtonsWithIcon = () => {
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
        <ButtonsListWithIcon variant="contained" title="Contained" />
        <ButtonsListWithIcon variant="outlined" title="Outlined" />
        <ButtonsListWithIcon variant="text" title="Text" />
      </Box>
    </ThemeProvider>
  );
};
