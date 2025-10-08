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
import { Add, Delete, Settings } from "@mui/icons-material";
import { Box, Button, ThemeProvider } from "@mui/material";
import type { Meta } from "@storybook/react";
import { createMuiTheme } from "../theme/createMuiTheme";

type ButtonVariants = "contained" | "outlined" | "text";

const ButtonsList = ({ variant }: { variant: ButtonVariants }) => {
  const theme = createMuiTheme();
  return (
    <ThemeProvider theme={theme}>
      <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
        <Button variant={variant} color="primary">
          Primary
        </Button>
        <Button variant={variant} color="secondary">
          Secondary
        </Button>
        <Button variant={variant} color="error">
          Error
        </Button>
        <Button variant={variant} disabled>
          Disabled
        </Button>
      </Box>
    </ThemeProvider>
  );
};

const ButtonsListWithIcons = ({ variant }: { variant: ButtonVariants }) => {
  const theme = createMuiTheme();
  return (
    <ThemeProvider theme={theme}>
      <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
        <Button variant={variant} color="primary" startIcon={<Add />}>
          Add Item
        </Button>
        <Button variant={variant} color="secondary" endIcon={<Settings />}>
          Settings
        </Button>
        <Button variant={variant} color="error" startIcon={<Delete />}>
          Delete
        </Button>
      </Box>
    </ThemeProvider>
  );
};

export const ContainedButtons = () => <ButtonsList variant="contained" />;
export const ContainedButtonsWithIcon = () => (
  <ButtonsListWithIcons variant="contained" />
);

export const OutlinedButtons = () => <ButtonsList variant="outlined" />;
export const OutlinedButtonsWithIcon = () => (
  <ButtonsListWithIcons variant="outlined" />
);

export const TextButtons = () => <ButtonsList variant="text" />;
export const TextButtonsWithIcon = () => (
  <ButtonsListWithIcons variant="text" />
);

const meta = {
  title: "Components/Buttons",
  component: ContainedButtons,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof ContainedButtons>;

export default meta;
