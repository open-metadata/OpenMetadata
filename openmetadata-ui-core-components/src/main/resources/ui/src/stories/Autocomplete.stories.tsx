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
import type { SelectItemType } from "../components/base/select/select";

const ITEMS: SelectItemType[] = [
  { id: "1", label: "Alice Johnson" },
  { id: "2", label: "Bob Smith" },
  { id: "3", label: "Carol Williams" },
  { id: "4", label: "David Brown" },
  { id: "5", label: "Eva Martinez", isDisabled: true },
  { id: "6", label: "Frank Davis" },
  { id: "7", label: "Grace Lee" },
  { id: "8", label: "Henry Wilson" },
];

const ITEMS_WITH_SUPPORTING_TEXT: SelectItemType[] = [
  { id: "t1", label: "PII", supportingText: "Personally Identifiable Information" },
  { id: "t2", label: "Sensitive", supportingText: "Sensitive data" },
  { id: "t3", label: "Public", supportingText: "Publicly available" },
  { id: "t4", label: "Confidential", supportingText: "Internal only" },
  { id: "t5", label: "Restricted", supportingText: "Restricted access" },
];

const ITEMS_WITH_AVATARS: SelectItemType[] = [
  { id: "u1", label: "Alice Johnson", avatarUrl: "https://i.pravatar.cc/32?img=1" },
  { id: "u2", label: "Bob Smith", avatarUrl: "https://i.pravatar.cc/32?img=2" },
  { id: "u3", label: "Carol Williams", avatarUrl: "https://i.pravatar.cc/32?img=3" },
  { id: "u4", label: "David Brown", avatarUrl: "https://i.pravatar.cc/32?img=4" },
  { id: "u5", label: "Eva Martinez", avatarUrl: "https://i.pravatar.cc/32?img=5" },
];

type TagItem = SelectItemType & { tagColor?: string };

const ITEMS_WITH_COLORS: TagItem[] = [
  { id: "c1", label: "PII", supportingText: "Personally Identifiable Information", tagColor: "#e53e3e" },
  { id: "c2", label: "Sensitive", supportingText: "Internal use only", tagColor: "#dd6b20" },
  { id: "c3", label: "Public", supportingText: "Publicly available data", tagColor: "#38a169" },
  { id: "c4", label: "Confidential", supportingText: "Restricted to authorized users", tagColor: "#3182ce" },
  { id: "c5", label: "Restricted", supportingText: "Highly restricted access", tagColor: "#805ad5" },
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
    const selectedItems = useListData<SelectItemType>({ initialItems: [] });

    return (
      <div style={{ width: 360 }}>
        <Autocomplete items={ITEMS} selectedItems={selectedItems} placeholder="Search people...">
          {(item) => (
            <Autocomplete.Item key={item.id} id={item.id} label={item.label} isDisabled={item.isDisabled} />
          )}
        </Autocomplete>
      </div>
    );
  },
};

export const WithLabel: StoryObj = {
  render: () => {
    const selectedItems = useListData<SelectItemType>({ initialItems: [] });

    return (
      <div style={{ width: 360 }}>
        <Autocomplete
          label="Owners"
          items={ITEMS}
          selectedItems={selectedItems}
          placeholder="Search and select owners..."
        >
          {(item) => (
            <Autocomplete.Item key={item.id} id={item.id} label={item.label} />
          )}
        </Autocomplete>
      </div>
    );
  },
};

export const WithHint: StoryObj = {
  render: () => {
    const selectedItems = useListData<SelectItemType>({ initialItems: [] });

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
            <Autocomplete.Item key={item.id} id={item.id} label={item.label} supportingText={item.supportingText} />
          )}
        </Autocomplete>
      </div>
    );
  },
};

export const WithTooltip: StoryObj = {
  render: () => {
    const selectedItems = useListData<SelectItemType>({ initialItems: [] });

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
            <Autocomplete.Item key={item.id} id={item.id} label={item.label} />
          )}
        </Autocomplete>
      </div>
    );
  },
};

export const WithPreselectedItems: StoryObj = {
  render: () => {
    const selectedItems = useListData<SelectItemType>({
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
            <Autocomplete.Item key={item.id} id={item.id} label={item.label} />
          )}
        </Autocomplete>
      </div>
    );
  },
};

export const WithAvatars: StoryObj = {
  render: () => {
    const selectedItems = useListData<SelectItemType>({ initialItems: [] });

    return (
      <div style={{ width: 360 }}>
        <Autocomplete
          label="Team Members"
          items={ITEMS_WITH_AVATARS}
          selectedItems={selectedItems}
          placeholder="Search team members..."
        >
          {(item) => (
            <Autocomplete.Item key={item.id} id={item.id} label={item.label} avatarUrl={item.avatarUrl} />
          )}
        </Autocomplete>
      </div>
    );
  },
};

export const WithSupportingText: StoryObj = {
  render: () => {
    const selectedItems = useListData<SelectItemType>({ initialItems: [] });

    return (
      <div style={{ width: 380 }}>
        <Autocomplete
          label="Tags"
          items={ITEMS_WITH_SUPPORTING_TEXT}
          selectedItems={selectedItems}
          placeholder="Search tags..."
        >
          {(item) => (
            <Autocomplete.Item key={item.id} id={item.id} label={item.label} supportingText={item.supportingText} />
          )}
        </Autocomplete>
      </div>
    );
  },
};

export const WithCustomChildren: StoryObj = {
  render: () => {
    const selectedItems = useListData<TagItem>({ initialItems: [] });

    return (
      <div style={{ width: 380 }}>
        <Autocomplete
          label="Tags"
          hint="Items use custom children for column layout and colored labels."
          items={ITEMS_WITH_COLORS}
          selectedItems={selectedItems}
          placeholder="Search tags..."
        >
          {(item) => {
            const tagItem = item as TagItem;

            return (
              <Autocomplete.Item
                key={tagItem.id}
                id={tagItem.id}
                label={tagItem.label}
                supportingText={tagItem.supportingText}
              >
                {({ isDisabled }) => (
                  <div className="tw:flex tw:flex-col tw:gap-y-0.5 tw:min-w-0 tw:flex-1">
                    <span
                      className="tw:truncate tw:text-md tw:font-medium tw:whitespace-nowrap"
                      style={tagItem.tagColor && !isDisabled ? { color: tagItem.tagColor } : undefined}
                    >
                      {tagItem.label}
                    </span>
                    {tagItem.supportingText && (
                      <span className="tw:text-md tw:whitespace-nowrap tw:text-tertiary">
                        {tagItem.supportingText}
                      </span>
                    )}
                  </div>
                )}
              </Autocomplete.Item>
            );
          }}
        </Autocomplete>
      </div>
    );
  },
};

export const Disabled: StoryObj = {
  render: () => {
    const selectedItems = useListData<SelectItemType>({
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
            <Autocomplete.Item key={item.id} id={item.id} label={item.label} />
          )}
        </Autocomplete>
      </div>
    );
  },
};

export const WithInvalidState: StoryObj = {
  render: () => {
    const selectedItems = useListData<SelectItemType>({ initialItems: [] });

    return (
      <div style={{ width: 360 }}>
        <Autocomplete
          isInvalid
          isRequired
          label="Required Field"
          hint="At least one owner must be selected."
          items={ITEMS}
          selectedItems={selectedItems}
          placeholder="Search owners..."
        >
          {(item) => (
            <Autocomplete.Item key={item.id} id={item.id} label={item.label} />
          )}
        </Autocomplete>
      </div>
    );
  },
};

export const WithoutIcon: StoryObj = {
  render: () => {
    const selectedItems = useListData<SelectItemType>({ initialItems: [] });

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
            <Autocomplete.Item key={item.id} id={item.id} label={item.label} supportingText={item.supportingText} />
          )}
        </Autocomplete>
      </div>
    );
  },
};

export const ManySelectedItems: StoryObj = {
  render: () => {
    const selectedItems = useListData<SelectItemType>({
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
            <Autocomplete.Item key={item.id} id={item.id} label={item.label} />
          )}
        </Autocomplete>
      </div>
    );
  },
};
