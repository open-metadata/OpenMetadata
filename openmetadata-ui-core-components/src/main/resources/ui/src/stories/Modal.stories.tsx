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
import { AlertTriangle, Building07, Mail01, User01 } from '@untitledui/icons';
import { Button } from '../components/base/buttons/button';
import { Input } from '../components/base/input/input';
import { TextArea } from '../components/base/textarea/textarea';
import { Select } from '../components/base/select/select';
import { SelectItem } from '../components/base/select/select-item';
import { Badge } from '../components/base/badges/badges';
import { FeaturedIcon } from '../components/foundations/featured-icon/featured-icon';
import {
  Dialog,
  DialogTrigger,
  Modal,
  ModalOverlay,
} from '../components/application/modals/modal';

const meta = {
  title: 'Components/Modal',
  component: Modal,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Modal>;

export default meta;
type Story = StoryObj<typeof meta>;

// ─── Simple title prop ────────────────────────────────────────────────────────

export const WithTitleProp: Story = {
  name: 'Title prop (no sub-components)',
  render: () => {
    const [isOpen, setIsOpen] = useState(false);

    return (
      <DialogTrigger isOpen={isOpen} onOpenChange={setIsOpen}>
        <Button color="primary" onPress={() => setIsOpen(true)}>
          Open Modal
        </Button>
        <ModalOverlay>
          <Modal>
            <Dialog
              showCloseButton
              title="Add your company"
              onClose={() => setIsOpen(false)}>
              <Dialog.Content>
                <p className="tw:text-sm tw:text-secondary">
                  Provide a few details about your organisation to get started.
                </p>
                <Input
                  label="Company name"
                  name="company"
                  placeholder="e.g. Acme Corp"
                />
              </Dialog.Content>
              <Dialog.Footer>
                <Button color="secondary" onPress={() => setIsOpen(false)}>
                  Cancel
                </Button>
                <Button color="primary">Create</Button>
              </Dialog.Footer>
            </Dialog>
          </Modal>
        </ModalOverlay>
      </DialogTrigger>
    );
  },
};

// ─── Full sub-component composition ──────────────────────────────────────────

export const SubComponentComposition: Story = {
  name: 'Sub-component composition',
  render: () => {
    const [isOpen, setIsOpen] = useState(false);

    return (
      <DialogTrigger isOpen={isOpen} onOpenChange={setIsOpen}>
        <Button color="primary" onPress={() => setIsOpen(true)}>
          Invite member
        </Button>
        <ModalOverlay>
          <Modal>
            <Dialog showCloseButton onClose={() => setIsOpen(false)}>
              <Dialog.Header>
                <FeaturedIcon
                  className="tw:max-sm:hidden"
                  color="gray"
                  icon={User01}
                  size="lg"
                  theme="modern"
                />
                <div className="tw:z-10 tw:flex tw:flex-col tw:gap-0.5">
                  <span className="tw:text-md tw:font-semibold tw:text-primary">
                    Invite team member
                  </span>
                  <p className="tw:text-sm tw:text-tertiary">
                    They will receive an email with a link to join.
                  </p>
                </div>
              </Dialog.Header>
              <div className="tw:h-5 tw:w-full" />
              <div className="tw:w-full tw:border-t tw:border-secondary" />
              <Dialog.Content>
                <Input
                  icon={User01}
                  label="Full name"
                  name="name"
                  placeholder="Jane Doe"
                />
                <Input
                  icon={Mail01}
                  label="Email address"
                  name="email"
                  placeholder="jane@acme.com"
                  type="email"
                />
                <Select
                  items={[
                    { id: 'admin', label: 'Admin' },
                    { id: 'editor', label: 'Editor' },
                    { id: 'viewer', label: 'Viewer' },
                  ]}
                  label="Role"
                  placeholder="Select a role">
                  {(item) => <SelectItem id={item.id}>{item.label}</SelectItem>}
                </Select>
              </Dialog.Content>
              <Dialog.Footer>
                <Button color="secondary" onPress={() => setIsOpen(false)}>
                  Cancel
                </Button>
                <Button color="primary">Send invite</Button>
              </Dialog.Footer>
            </Dialog>
          </Modal>
        </ModalOverlay>
      </DialogTrigger>
    );
  },
};

// ─── Custom header (no title, custom children) ────────────────────────────────

export const CustomHeader: Story = {
  name: 'Custom header with icon + badge',
  render: () => {
    const [isOpen, setIsOpen] = useState(false);

    return (
      <DialogTrigger isOpen={isOpen} onOpenChange={setIsOpen}>
        <Button color="secondary" onPress={() => setIsOpen(true)}>
          Add company
        </Button>
        <ModalOverlay>
          <Modal>
            <Dialog showCloseButton onClose={() => setIsOpen(false)}>
              <Dialog.Header>
                <FeaturedIcon
                  className="tw:max-sm:hidden"
                  color="gray"
                  icon={Building07}
                  size="lg"
                  theme="modern"
                />
                <div className="tw:z-10 tw:flex tw:flex-col tw:gap-0.5">
                  <div className="tw:flex tw:items-center tw:gap-2">
                    <span className="tw:text-md tw:font-semibold tw:text-primary">
                      Add your company
                    </span>
                    <Badge color="brand" size="sm">
                      New
                    </Badge>
                  </div>
                  <p className="tw:text-sm tw:text-tertiary">
                    Create your company profile for free{' '}
                    <span className="tw:max-md:hidden">
                      in less than 5 minutes.
                    </span>
                  </p>
                </div>
              </Dialog.Header>
              <div className="tw:h-5 tw:w-full" />
              <div className="tw:w-full tw:border-t tw:border-secondary" />
              <Dialog.Content>
                <Input
                  label="Company name"
                  name="company"
                  placeholder="e.g. Linear"
                />
                <TextArea
                  className="tw:h-24"
                  label="Description"
                  name="description"
                  placeholder="Write a few sentences about the company..."
                />
              </Dialog.Content>
              <Dialog.Footer>
                <Button color="secondary" onPress={() => setIsOpen(false)}>
                  Cancel
                </Button>
                <Button color="primary">Add company</Button>
              </Dialog.Footer>
            </Dialog>
          </Modal>
        </ModalOverlay>
      </DialogTrigger>
    );
  },
};

// ─── Custom footer layout ─────────────────────────────────────────────────────

export const CustomFooter: Story = {
  name: 'Custom footer layout',
  render: () => {
    const [isOpen, setIsOpen] = useState(false);

    return (
      <DialogTrigger isOpen={isOpen} onOpenChange={setIsOpen}>
        <Button color="secondary" onPress={() => setIsOpen(true)}>
          Settings
        </Button>
        <ModalOverlay>
          <Modal>
            <Dialog
              showCloseButton
              title="Notification settings"
              onClose={() => setIsOpen(false)}>
              <Dialog.Content>
                <p className="tw:text-sm tw:text-secondary">
                  Choose how you want to be notified about activity.
                </p>
                <Select
                  items={[
                    { id: 'realtime', label: 'Real-time' },
                    { id: 'daily', label: 'Daily digest' },
                    { id: 'weekly', label: 'Weekly digest' },
                    { id: 'never', label: 'Never' },
                  ]}
                  label="Email frequency"
                  placeholder="Select frequency">
                  {(item) => <SelectItem id={item.id}>{item.label}</SelectItem>}
                </Select>
              </Dialog.Content>
              {/* Custom footer — full-width single button */}
              <Dialog.Footer className="tw:[&>div:last-child]:tw:grid-cols-1">
                <Button
                  className="tw:w-full"
                  color="primary"
                  onPress={() => setIsOpen(false)}>
                  Save settings
                </Button>
              </Dialog.Footer>
            </Dialog>
          </Modal>
        </ModalOverlay>
      </DialogTrigger>
    );
  },
};

// ─── Destructive / confirmation ───────────────────────────────────────────────

export const Destructive: Story = {
  name: 'Destructive confirmation',
  render: () => {
    const [isOpen, setIsOpen] = useState(false);

    return (
      <DialogTrigger isOpen={isOpen} onOpenChange={setIsOpen}>
        <Button color="primary-destructive" onPress={() => setIsOpen(true)}>
          Delete workspace
        </Button>
        <ModalOverlay>
          <Modal>
            <Dialog
              showCloseButton
              width={400}
              onClose={() => setIsOpen(false)}>
              <Dialog.Header className="tw:flex-col">
                <div className="tw:relative tw:w-max">
                  <FeaturedIcon
                    color="error"
                    icon={AlertTriangle}
                    size="lg"
                    theme="light"
                  />
                </div>
                <div className="tw:z-10 tw:flex tw:flex-col tw:gap-0.5 tw:mt-4">
                  <span className="tw:text-md tw:font-semibold tw:text-primary">
                    Delete workspace
                  </span>
                  <p className="tw:text-sm tw:text-tertiary">
                    Are you sure you want to delete this workspace? This action
                    cannot be undone.
                  </p>
                </div>
              </Dialog.Header>
              <div className="tw:z-10 tw:flex tw:flex-1 tw:flex-col-reverse tw:gap-3 tw:p-4 tw:pt-6 tw:*:grow tw:sm:grid tw:sm:grid-cols-2 tw:sm:px-6 tw:sm:pt-8 tw:sm:pb-6">
                <Button
                  color="secondary"
                  size="lg"
                  onPress={() => setIsOpen(false)}>
                  Cancel
                </Button>
                <Button color="primary-destructive" size="lg">
                  Delete workspace
                </Button>
              </div>
            </Dialog>
          </Modal>
        </ModalOverlay>
      </DialogTrigger>
    );
  },
};

// ─── No close button, controlled open state ───────────────────────────────────

export const ControlledWithNoCloseButton: Story = {
  name: 'Controlled open state (no close button)',
  render: () => {
    const [isOpen, setIsOpen] = useState(false);

    return (
      <div className="tw:flex tw:flex-col tw:items-center tw:gap-4">
        <Button color="primary" onPress={() => setIsOpen(true)}>
          Open modal
        </Button>
        <DialogTrigger isOpen={isOpen} onOpenChange={setIsOpen}>
          <span />
          <ModalOverlay>
            <Modal>
              <Dialog title="Processing payment">
                <Dialog.Content>
                  <p className="tw:text-sm tw:text-secondary">
                    Please wait while we process your payment. Do not close this
                    window.
                  </p>
                  <div className="tw:flex tw:justify-center tw:py-4">
                    <div className="tw:size-10 tw:animate-spin tw:rounded-full tw:border-4 tw:border-secondary tw:border-t-brand-solid" />
                  </div>
                </Dialog.Content>
                <Dialog.Footer>
                  <Button
                    className="tw:col-span-2"
                    color="secondary"
                    onPress={() => setIsOpen(false)}>
                    Cancel payment
                  </Button>
                </Dialog.Footer>
              </Dialog>
            </Modal>
          </ModalOverlay>
        </DialogTrigger>
      </div>
    );
  },
};

// ─── Content-only (no header or footer) ──────────────────────────────────────

export const ContentOnly: Story = {
  name: 'Content only (no header/footer)',
  render: () => (
    <DialogTrigger>
      <Button color="secondary">View details</Button>
      <ModalOverlay>
        <Modal>
          <Dialog showCloseButton>
            <Dialog.Content className="tw:py-8">
              <div className="tw:flex tw:flex-col tw:items-center tw:gap-3 tw:text-center">
                <FeaturedIcon
                  color="success"
                  icon={Mail01}
                  size="lg"
                  theme="modern"
                />
                <p className="tw:text-lg tw:font-semibold tw:text-primary">
                  Check your email
                </p>
                <p className="tw:text-sm tw:text-secondary tw:max-w-xs">
                  We sent a verification link to <strong>jane@acme.com</strong>.
                  Click the link to continue.
                </p>
                <Button className="tw:mt-2" color="primary">
                  Open email app
                </Button>
              </div>
            </Dialog.Content>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  ),
};
