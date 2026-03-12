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
import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "../components/base/buttons/button";
import { Input } from "../components/base/input/input";
import { Select } from "../components/base/select/select";
import { SelectItem } from "../components/base/select/select-item";
import {
  Dialog,
  DialogTrigger,
  Modal,
  ModalOverlay,
} from "../components/application/modals/modal";

const meta = {
  title: "Components/Modal",
  component: Modal,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof Modal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <DialogTrigger>
      <Button color="primary">Open Modal</Button>
      <ModalOverlay>
        <Modal>
          <Dialog>
            <div className="tw:p-6 tw:max-w-[480px] tw:w-full">
              <h2 className="tw:mb-2 tw:text-lg tw:font-semibold tw:text-primary">
                Modal Title
              </h2>
              <p className="tw:mb-6 tw:text-secondary">
                This is a modal dialog. You can put any content here.
              </p>
              <div className="tw:flex tw:gap-2 tw:justify-end">
                <Button color="secondary" size="sm">
                  Cancel
                </Button>
                <Button color="primary" size="sm">
                  Confirm
                </Button>
              </div>
            </div>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  ),
};

export const ConfirmationModal: StoryObj = {
  render: () => (
    <DialogTrigger>
      <Button color="primary-destructive">Delete Item</Button>
      <ModalOverlay>
        <Modal>
          <Dialog>
            <div className="tw:p-6 tw:max-w-[400px] tw:w-full">
              <h2 className="tw:mb-2 tw:text-lg tw:font-semibold tw:text-fg-error-primary">
                Delete Confirmation
              </h2>
              <p className="tw:mb-6 tw:text-secondary">
                Are you sure you want to delete this item? This action cannot be
                undone.
              </p>
              <div className="tw:flex tw:gap-2 tw:justify-end">
                <Button color="secondary" size="sm">
                  Cancel
                </Button>
                <Button color="primary-destructive" size="sm">
                  Delete
                </Button>
              </div>
            </div>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  ),
};

export const LargeModal: StoryObj = {
  render: () => (
    <DialogTrigger>
      <Button color="secondary">Open Large Modal</Button>
      <ModalOverlay>
        <Modal>
          <Dialog>
            <div className="tw:p-8 tw:max-w-[640px] tw:w-full">
              <h2 className="tw:mb-4 tw:text-xl tw:font-semibold tw:text-primary">
                Large Modal
              </h2>
              <p className="tw:mb-4 tw:text-secondary">
                This modal contains more content and is wider.
              </p>
              <div className="tw:bg-secondary tw:rounded-lg tw:p-4 tw:mb-6">
                <p className="tw:text-sm tw:text-primary">
                  Detailed content goes here. This could be a form, a list of
                  items, or any other complex content.
                </p>
              </div>
              <div className="tw:flex tw:gap-2 tw:justify-end">
                <Button color="secondary" size="sm">
                  Cancel
                </Button>
                <Button color="primary" size="sm">
                  Save Changes
                </Button>
              </div>
            </div>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  ),
};

const roleItems = [
  { id: "admin", label: "Admin" },
  { id: "editor", label: "Editor" },
  { id: "viewer", label: "Viewer" },
  { id: "owner", label: "Owner" },
];

export const TestModal: StoryObj = {
  render: () => {
    const [submitted, setSubmitted] = useState<Record<string, string> | null>(
      null,
    );

    return (
      <DialogTrigger>
        <Button color="primary">Invite User</Button>
        <ModalOverlay>
          <Modal>
            <Dialog>
              {({ close }) => (
                <div className="tw:p-6 tw:max-w-[480px] tw:w-full">
                  <h2 className="tw:mb-1 tw:text-lg tw:font-semibold tw:text-primary">
                    Invite Team Member
                  </h2>
                  <p className="tw:mb-6 tw:text-sm tw:text-secondary">
                    Fill in the details below to send an invitation.
                  </p>

                  <div className="tw:flex tw:flex-col tw:gap-4">
                    <Input
                      label="Full name"
                      name="name"
                      placeholder="Jane Doe"
                      size="sm"
                      isRequired
                    />
                    <Input
                      label="Email address"
                      name="email"
                      type="email"
                      placeholder="jane@example.com"
                      size="sm"
                      isRequired
                    />
                    <Select
                      label="Role"
                      placeholder="Select a role"
                      size="sm"
                      items={roleItems}
                    >
                      {(item) => (
                        <SelectItem id={item.id}>{item.label}</SelectItem>
                      )}
                    </Select>
                  </div>

                  {submitted && (
                    <pre className="tw:mt-4 tw:p-3 tw:bg-secondary tw:rounded-lg tw:text-xs tw:text-primary">
                      {JSON.stringify(submitted, null, 2)}
                    </pre>
                  )}

                  <div className="tw:flex tw:gap-2 tw:justify-end tw:mt-6">
                    <Button color="secondary" size="sm" onPress={close}>
                      Cancel
                    </Button>
                    <Button
                      color="primary"
                      size="sm"
                      onPress={() => {
                        setSubmitted({ name: "Jane Doe", email: "jane@example.com", role: "editor" });
                      }}
                    >
                      Send Invite
                    </Button>
                  </div>
                </div>
              )}
            </Dialog>
          </Modal>
        </ModalOverlay>
      </DialogTrigger>
    );
  },
};
