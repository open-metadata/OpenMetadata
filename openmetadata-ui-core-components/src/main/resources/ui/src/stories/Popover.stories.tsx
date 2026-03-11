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
import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "../components/base/buttons/button";
import { Select } from "../components/base/select/select";
import { Typography } from "../components/foundations/typography";
import { Popover, PopoverTrigger } from "../components/application/popover/popover";

const COUNTRY_ITEMS = [
  { id: "us", label: "United States" },
  { id: "gb", label: "United Kingdom" },
  { id: "ca", label: "Canada" },
  { id: "au", label: "Australia" },
  { id: "de", label: "Germany" },
];

const ROLE_ITEMS = [
  { id: "admin", label: "Admin", supportingText: "(full access)" },
  { id: "editor", label: "Editor" },
  { id: "viewer", label: "Viewer", supportingText: "(read only)" },
  { id: "guest", label: "Guest", isDisabled: true },
];

const meta = {
  title: "Components/Popover",
  component: Popover,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof Popover>;

export default meta;

export const Default: StoryObj = {
  render: () => (
    <PopoverTrigger>
      <Button color="secondary">Open Popover</Button>
      <Popover>
        <div className="tw:p-4 tw:min-w-50">
          <Typography>
            <h4>Popover title</h4>
            <p>This is a general-purpose popover with any content.</p>
          </Typography>
        </div>
      </Popover>
    </PopoverTrigger>
  ),
};

export const WithSelectContent: StoryObj = {
  render: () => (
    <PopoverTrigger>
      <Button color="secondary">Filter by Country</Button>
      <Popover>
        <div className="tw:p-4 tw:min-w-60">
          <Typography>
            <h4>Select a country</h4>
          </Typography>
          <Select label="Country" placeholder="Select a country" items={COUNTRY_ITEMS}>
            {(item) => (
              <Select.Item key={item.id} id={item.id} textValue={item.label}>
                {item.label}
              </Select.Item>
            )}
          </Select>
        </div>
      </Popover>
    </PopoverTrigger>
  ),
};

export const WithMultipleSelects: StoryObj = {
  render: () => (
    <PopoverTrigger>
      <Button color="primary">Configure Access</Button>
      <Popover>
        <div className="tw:p-4 tw:min-w-70 tw:flex tw:flex-col tw:gap-4">
          <Typography>
            <h4>Access settings</h4>
            <p>Configure the user's region and role.</p>
          </Typography>
          <Select label="Country" placeholder="Select a country" items={COUNTRY_ITEMS}>
            {(item) => (
              <Select.Item key={item.id} id={item.id} textValue={item.label}>
                {item.label}
              </Select.Item>
            )}
          </Select>
          <Select
            label="Role"
            placeholder="Select a role"
            hint="Role determines access level."
            items={ROLE_ITEMS}
          >
            {(item) => (
              <Select.Item key={item.id} id={item.id} textValue={item.label} isDisabled={item.isDisabled}>
                {item.label}
                {item.supportingText && (
                  <span className="tw:text-tertiary tw:text-sm tw:ml-1">{item.supportingText}</span>
                )}
              </Select.Item>
            )}
          </Select>
          <Button color="primary" className="tw:w-full">Apply</Button>
        </div>
      </Popover>
    </PopoverTrigger>
  ),
};

export const WithArrow: StoryObj = {
  render: () => (
    <PopoverTrigger>
      <Button color="secondary">With Arrow</Button>
      <Popover arrow>
        <div className="tw:p-4 tw:min-w-50">
          <Typography>
            <h4>With Arrow</h4>
            <p>This popover has an arrow pointing to its trigger.</p>
          </Typography>
        </div>
      </Popover>
    </PopoverTrigger>
  ),
};

export const Placements: StoryObj = {
  render: () => (
    <div className="tw:grid tw:grid-cols-2 tw:gap-6 tw:p-16">
      {(["top", "bottom", "left", "right"] as const).map((placement) => (
        <PopoverTrigger key={placement}>
          <Button color="secondary" size="sm" className="tw:capitalize">
            {placement}
          </Button>
          <Popover placement={placement} arrow>
            <div className="tw:px-4 tw:py-3">
              <Typography>
                <p>
                  Placed <strong>{placement}</strong>
                </p>
              </Typography>
            </div>
          </Popover>
        </PopoverTrigger>
      ))}
    </div>
  ),
};
