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
/* eslint-disable i18next/no-literal-string */
import { Box, Stack, Typography } from '@mui/material';

import { AlertExample } from './alert-example';
import { BreadcrumbsExample } from './breadcrumbs-example';
import { ButtonGroupExample } from './buttongroup-example';
import { ButtonsExample } from './buttons-example';
import { CheckboxesExample } from './checkboxes-example';
import { ChipsExample } from './chips-example';
import { DatePickerExample } from './datepicker-example';
import { MenuExample } from './menu-example';
import { ModalExample } from './modal-example';
import { RadioExample } from './radio-example';
import { SelectExample } from './select-example';
import { SwitchExample } from './switch-example';
import { TableExample } from './table-example';
import { TabsExample } from './tabs-example';
import { TextareaExample } from './textarea-example';
import { TextFieldExample } from './textfield-example';
import { TooltipExample } from './tooltip-example';
import { TypographyExample } from './typography-example';

export default function MuiExample() {
  return (
    <Box sx={{ p: 4, maxWidth: 1200, mx: 'auto' }}>
      <Typography gutterBottom component="h1" sx={{ mb: 3 }} variant="h4">
        MUI Components - Figma Design System
      </Typography>

      <Typography color="text.secondary" sx={{ mb: 4 }} variant="body1">
        Essential MUI components with systematic design tokens. All components
        follow Figma design specifications and styling.
      </Typography>

      <Stack spacing={4}>
        <TypographyExample />
        <ButtonsExample />
        <ChipsExample />
        <CheckboxesExample />
        <TextFieldExample />
        <SelectExample />
        <TextareaExample />
        <RadioExample />
        <SwitchExample />
        <ButtonGroupExample />
        <MenuExample />
        <TooltipExample />
        <TabsExample />
        <BreadcrumbsExample />
        <ModalExample />
        <DatePickerExample />
        <AlertExample />
        <TableExample />
      </Stack>
    </Box>
  );
}
