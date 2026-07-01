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
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Button } from '../components/base/buttons/button';
import { Select } from '../components/base/select/select';
import type { SelectItemType } from '../components/base/select/select';
import {
  Dialog,
  DialogTrigger,
  Modal,
  ModalOverlay,
} from '../components/application/modals/modal';

const { ComboBox, Item: SelectItem } = Select;

const ITEMS: SelectItemType[] = [
  { id: '1', label: 'Dashboard' },
  { id: '2', label: 'Tables' },
  { id: '3', label: 'Topics' },
  { id: '4', label: 'Pipelines', isDisabled: true },
  { id: '5', label: 'ML Models' },
  { id: '6', label: 'Containers' },
  { id: '7', label: 'Search Indexes' },
];

const ITEMS_WITH_SUPPORTING_TEXT: SelectItemType[] = [
  { id: 'p1', label: 'PII', supportingText: 'Personally Identifiable Info' },
  { id: 'p2', label: 'Sensitive', supportingText: 'Internal use only' },
  { id: 'p3', label: 'Public', supportingText: 'Publicly available' },
  { id: 'p4', label: 'Confidential', supportingText: 'Restricted access' },
  { id: 'p5', label: 'Restricted', supportingText: 'Highly restricted' },
];

const renderItem = (item: SelectItemType) => (
  <SelectItem id={item.id} isDisabled={item.isDisabled} key={item.id}>
    {item.label}
  </SelectItem>
);

const meta = {
  title: 'Components/ComboBox',
  component: ComboBox,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof ComboBox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <div style={{ width: 320 }}>
      <ComboBox items={ITEMS} placeholder="Search assets...">
        {renderItem}
      </ComboBox>
    </div>
  ),
};

export const WithLabel: Story = {
  render: () => (
    <div style={{ width: 320 }}>
      <ComboBox
        items={ITEMS}
        label="Asset type"
        placeholder="Search asset types...">
        {renderItem}
      </ComboBox>
    </div>
  ),
};

export const WithHint: Story = {
  render: () => (
    <div style={{ width: 320 }}>
      <ComboBox
        hint="Choose the asset type you want to explore."
        items={ITEMS}
        label="Asset type"
        placeholder="Search asset types...">
        {renderItem}
      </ComboBox>
    </div>
  ),
};

export const WithSupportingText: Story = {
  render: () => (
    <div style={{ width: 360 }}>
      <ComboBox
        items={ITEMS_WITH_SUPPORTING_TEXT}
        label="Tag"
        placeholder="Search tags...">
        {(item) => (
          <SelectItem
            id={item.id}
            key={item.id}
            supportingText={item.supportingText}>
            {item.label}
          </SelectItem>
        )}
      </ComboBox>
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div
      style={{ display: 'flex', flexDirection: 'column', gap: 16, width: 320 }}>
      <ComboBox items={ITEMS} placeholder="Small (default)" size="sm">
        {renderItem}
      </ComboBox>
      <ComboBox items={ITEMS} placeholder="Medium" size="md">
        {renderItem}
      </ComboBox>
    </div>
  ),
};

export const WithoutShortcut: Story = {
  render: () => (
    <div style={{ width: 320 }}>
      <ComboBox
        items={ITEMS}
        label="Asset type"
        placeholder="Search..."
        shortcut={false}>
        {renderItem}
      </ComboBox>
    </div>
  ),
};

export const Disabled: Story = {
  render: () => (
    <div style={{ width: 320 }}>
      <ComboBox
        isDisabled
        items={ITEMS}
        label="Asset type (disabled)"
        placeholder="Search...">
        {renderItem}
      </ComboBox>
    </div>
  ),
};

export const WithInvalidState: Story = {
  render: () => (
    <div style={{ width: 320 }}>
      <ComboBox
        isInvalid
        isRequired
        hint="Please select an asset type."
        items={ITEMS}
        label="Asset type"
        placeholder="Search...">
        {renderItem}
      </ComboBox>
    </div>
  ),
};

export const InModal: Story = {
  name: 'ComboBox inside a Modal',
  render: () => {
    const [isOpen, setIsOpen] = useState(false);

    return (
      <DialogTrigger isOpen={isOpen} onOpenChange={setIsOpen}>
        <Button color="primary" onPress={() => setIsOpen(true)}>
          Open modal with ComboBox
        </Button>
        <ModalOverlay>
          <Modal>
            <Dialog
              showCloseButton
              title="Filter assets"
              onClose={() => setIsOpen(false)}>
              <Dialog.Content>
                <p className="tw:text-sm tw:text-secondary">
                  Use the search below to filter by asset type or tag.
                </p>
                <ComboBox
                  items={ITEMS}
                  label="Asset type"
                  placeholder="Search asset types..."
                  shortcut={false}>
                  {renderItem}
                </ComboBox>
                <ComboBox
                  items={ITEMS_WITH_SUPPORTING_TEXT}
                  label="Tag"
                  placeholder="Search tags...">
                  {(item) => (
                    <SelectItem
                      id={item.id}
                      key={item.id}
                      supportingText={item.supportingText}>
                      {item.label}
                    </SelectItem>
                  )}
                </ComboBox>
              </Dialog.Content>
              <Dialog.Footer>
                <Button color="secondary" onPress={() => setIsOpen(false)}>
                  Cancel
                </Button>
                <Button color="primary" onPress={() => setIsOpen(false)}>
                  Apply filters
                </Button>
              </Dialog.Footer>
            </Dialog>
          </Modal>
        </ModalOverlay>
      </DialogTrigger>
    );
  },
};
