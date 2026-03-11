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
import { useListData } from "react-stately";
import { Autocomplete } from "../components/base/autocomplete/autocomplete";
import type { AutocompleteItemType } from "../components/base/autocomplete/autocomplete";

const ITEMS: AutocompleteItemType[] = [
  { id: "1", label: "Alice Johnson" },
  { id: "2", label: "Bob Smith" },
  { id: "3", label: "Carol Williams" },
  { id: "4", label: "David Brown" },
  { id: "5", label: "Eva Martinez", isDisabled: true },
  { id: "6", label: "Frank Davis" },
  { id: "7", label: "Grace Lee" },
  { id: "8", label: "Henry Wilson" },
];

const ITEMS_WITH_SUPPORTING_TEXT: AutocompleteItemType[] = [
  { id: "t1", label: "PII", supportingText: "Personally Identifiable Information" },
  { id: "t2", label: "Sensitive", supportingText: "Sensitive data" },
  { id: "t3", label: "Public", supportingText: "Publicly available" },
  { id: "t4", label: "Confidential", supportingText: "Internal only" },
  { id: "t5", label: "Restricted", supportingText: "Restricted access" },
];

const ITEMS_WITH_SUPPORTING_TEXT_COLUMN: AutocompleteItemType[] = [
  { id: "c1", label: "Alice Johnson", supportingText: "alice@example.com", supportingTextLayout: "column" },
  { id: "c2", label: "Bob Smith", supportingText: "bob@example.com", supportingTextLayout: "column" },
  { id: "c3", label: "Carol Williams", supportingText: "carol@example.com", supportingTextLayout: "column" },
  { id: "c4", label: "David Brown", supportingText: "david@example.com", supportingTextLayout: "column" },
  { id: "c5", label: "Eva Martinez", supportingText: "eva@example.com", supportingTextLayout: "column" },
];

const ITEMS_WITH_AVATARS: AutocompleteItemType[] = [
  { id: "u1", label: "Alice Johnson", avatarUrl: "https://i.pravatar.cc/32?img=1" },
  { id: "u2", label: "Bob Smith", avatarUrl: "https://i.pravatar.cc/32?img=2" },
  { id: "u3", label: "Carol Williams", avatarUrl: "https://i.pravatar.cc/32?img=3" },
  { id: "u4", label: "David Brown", avatarUrl: "https://i.pravatar.cc/32?img=4" },
  { id: "u5", label: "Eva Martinez", avatarUrl: "https://i.pravatar.cc/32?img=5" },
];

const meta = {
  title: "Components/Autocomplete",
  component: Autocomplete,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof Autocomplete>;

export default meta;


export const Default: StoryObj = {
  render: () => {
    const selectedItems = useListData<AutocompleteItemType>({ initialItems: [] });

    return (
      <div style={{ width: 360 }}>
        <Autocomplete items={ITEMS} selectedItems={selectedItems} placeholder="Search people...">
          {(item) => (
            <Autocomplete.Item key={item.id} id={item.id} label={item.label} isDisabled={item.isDisabled}>
              {item.label}
            </Autocomplete.Item>
          )}
        </Autocomplete>
      </div>
    );
  },
};

export const WithLabel: StoryObj = {
  render: () => {
    const selectedItems = useListData<AutocompleteItemType>({ initialItems: [] });

    return (
      <div style={{ width: 360 }}>
        <Autocomplete
          label="Owners"
          items={ITEMS}
          selectedItems={selectedItems}
          placeholder="Search and select owners..."
        >
          {(item) => (
            <Autocomplete.Item key={item.id} id={item.id} label={item.label}>
              {item.label}
            </Autocomplete.Item>
          )}
        </Autocomplete>
      </div>
    );
  },
};

export const WithHint: StoryObj = {
  render: () => {
    const selectedItems = useListData<AutocompleteItemType>({ initialItems: [] });

    return (
      <div style={{ width: 360 }}>
        <Autocomplete
          label="Tags"
          hint="Select one or more tags to classify this asset."
          items={ITEMS_WITH_SUPPORTING_TEXT}
          selectedItems={selectedItems}
          placeholder="Search tags..."
        >
          {(item) => (
            <Autocomplete.Item key={item.id} id={item.id} label={item.label} supportingText={item.supportingText}>
              {item.label}
            </Autocomplete.Item>
          )}
        </Autocomplete>
      </div>
    );
  },
};

export const WithTooltip: StoryObj = {
  render: () => {
    const selectedItems = useListData<AutocompleteItemType>({ initialItems: [] });

    return (
      <div style={{ width: 360 }}>
        <Autocomplete
          label="Assignees"
          tooltip="Assign this item to one or more team members."
          items={ITEMS}
          selectedItems={selectedItems}
          placeholder="Search assignees..."
        >
          {(item) => (
            <Autocomplete.Item key={item.id} id={item.id} label={item.label}>
              {item.label}
            </Autocomplete.Item>
          )}
        </Autocomplete>
      </div>
    );
  },
};

export const WithPreselectedItems: StoryObj = {
  render: () => {
    const selectedItems = useListData<AutocompleteItemType>({
      initialItems: [ITEMS[0], ITEMS[2], ITEMS[5]],
    });

    return (
      <div style={{ width: 360 }}>
        <Autocomplete
          label="Owners"
          items={ITEMS}
          selectedItems={selectedItems}
          placeholder="Search and add more..."
        >
          {(item) => (
            <Autocomplete.Item key={item.id} id={item.id} label={item.label}>
              {item.label}
            </Autocomplete.Item>
          )}
        </Autocomplete>
      </div>
    );
  },
};

export const WithAvatars: StoryObj = {
  render: () => {
    const selectedItems = useListData<AutocompleteItemType>({ initialItems: [] });

    return (
      <div style={{ width: 360 }}>
        <Autocomplete
          label="Team Members"
          items={ITEMS_WITH_AVATARS}
          selectedItems={selectedItems}
          placeholder="Search team members..."
        >
          {(item) => (
            <Autocomplete.Item key={item.id} id={item.id} label={item.label} avatarUrl={item.avatarUrl}>
              {item.label}
            </Autocomplete.Item>
          )}
        </Autocomplete>
      </div>
    );
  },
};

export const WithSupportingText: StoryObj = {
  render: () => {
    const selectedItems = useListData<AutocompleteItemType>({ initialItems: [] });

    return (
      <div style={{ width: 380 }}>
        <Autocomplete
          label="Tags"
          items={ITEMS_WITH_SUPPORTING_TEXT}
          selectedItems={selectedItems}
          placeholder="Search tags..."
        >
          {(item) => (
            <Autocomplete.Item key={item.id} id={item.id} label={item.label} supportingText={item.supportingText}>
              {item.label}
            </Autocomplete.Item>
          )}
        </Autocomplete>
      </div>
    );
  },
};

export const Sizes: StoryObj = {
  render: () => {
    const selectedSmall = useListData<AutocompleteItemType>({ initialItems: [ITEMS[0]] });
    const selectedMedium = useListData<AutocompleteItemType>({ initialItems: [ITEMS[1]] });

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16, width: 360 }}>
        <Autocomplete size="sm" label="Small (sm)" items={ITEMS} selectedItems={selectedSmall} placeholder="Search...">
          {(item) => (
            <Autocomplete.Item key={item.id} id={item.id} label={item.label}>
              {item.label}
            </Autocomplete.Item>
          )}
        </Autocomplete>

        <Autocomplete size="md" label="Medium (md)" items={ITEMS} selectedItems={selectedMedium} placeholder="Search...">
          {(item) => (
            <Autocomplete.Item key={item.id} id={item.id} label={item.label}>
              {item.label}
            </Autocomplete.Item>
          )}
        </Autocomplete>
      </div>
    );
  },
};

export const Disabled: StoryObj = {
  render: () => {
    const selectedItems = useListData<AutocompleteItemType>({
      initialItems: [ITEMS[0], ITEMS[1]],
    });

    return (
      <div style={{ width: 360 }}>
        <Autocomplete
          isDisabled
          label="Owners (disabled)"
          items={ITEMS}
          selectedItems={selectedItems}
          placeholder="Search..."
        >
          {(item) => (
            <Autocomplete.Item key={item.id} id={item.id} label={item.label}>
              {item.label}
            </Autocomplete.Item>
          )}
        </Autocomplete>
      </div>
    );
  },
};

export const WithInvalidState: StoryObj = {
  render: () => {
    const selectedItems = useListData<AutocompleteItemType>({ initialItems: [] });

    return (
      <div style={{ width: 360 }}>
        <Autocomplete
          isInvalid
          label="Required Field"
          hint="At least one owner must be selected."
          items={ITEMS}
          selectedItems={selectedItems}
          placeholder="Search owners..."
          isRequired
        >
          {(item) => (
            <Autocomplete.Item key={item.id} id={item.id} label={item.label}>
              {item.label}
            </Autocomplete.Item>
          )}
        </Autocomplete>
      </div>
    );
  },
};

export const WithoutIcon: StoryObj = {
  render: () => {
    const selectedItems = useListData<AutocompleteItemType>({ initialItems: [] });

    return (
      <div style={{ width: 360 }}>
        <Autocomplete
          label="Tags"
          placeholderIcon={null}
          items={ITEMS_WITH_SUPPORTING_TEXT}
          selectedItems={selectedItems}
          placeholder="Type to search..."
        >
          {(item) => (
            <Autocomplete.Item key={item.id} id={item.id} label={item.label} supportingText={item.supportingText}>
              {item.label}
            </Autocomplete.Item>
          )}
        </Autocomplete>
      </div>
    );
  },
};

export const WithSupportingTextLayouts: StoryObj = {
  render: () => {
    const selectedRow = useListData<AutocompleteItemType>({ initialItems: [] });
    const selectedColumn = useListData<AutocompleteItemType>({ initialItems: [] });

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 24, width: 380 }}>
        <Autocomplete
          label="Row layout (default)"
          items={ITEMS_WITH_SUPPORTING_TEXT}
          selectedItems={selectedRow}
          placeholder="Search tags..."
        >
          {(item) => (
            <Autocomplete.Item key={item.id} id={item.id} label={item.label} supportingText={item.supportingText} supportingTextLayout="row">
              {item.label}
            </Autocomplete.Item>
          )}
        </Autocomplete>

        <Autocomplete
          label="Column layout"
          items={ITEMS_WITH_SUPPORTING_TEXT_COLUMN}
          selectedItems={selectedColumn}
          placeholder="Search people..."
        >
          {(item) => (
            <Autocomplete.Item key={item.id} id={item.id} label={item.label} supportingText={item.supportingText} supportingTextLayout="column">
              {item.label}
            </Autocomplete.Item>
          )}
        </Autocomplete>
      </div>
    );
  },
};

export const ManySelectedItems: StoryObj = {
  render: () => {
    const selectedItems = useListData<AutocompleteItemType>({
      initialItems: [ITEMS[0], ITEMS[1], ITEMS[2], ITEMS[3]],
    });

    return (
      <div style={{ width: 360 }}>
        <Autocomplete
          label="Team"
          items={ITEMS}
          selectedItems={selectedItems}
          placeholder="Add more..."
        >
          {(item) => (
            <Autocomplete.Item key={item.id} id={item.id} label={item.label}>
              {item.label}
            </Autocomplete.Item>
          )}
        </Autocomplete>
      </div>
    );
  },
};
