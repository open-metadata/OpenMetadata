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
            <div
              style={{
                background: "white",
                borderRadius: 12,
                padding: 24,
                maxWidth: 480,
                width: "100%",
                boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
              }}
            >
              <h2 style={{ marginBottom: 8, fontSize: 18, fontWeight: 600 }}>
                Modal Title
              </h2>
              <p style={{ color: "#6b7280", marginBottom: 24 }}>
                This is a modal dialog. You can put any content here.
              </p>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <Button color="secondary" size="sm">Cancel</Button>
                <Button color="primary" size="sm">Confirm</Button>
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
            <div
              style={{
                background: "white",
                borderRadius: 12,
                padding: 24,
                maxWidth: 400,
                width: "100%",
                boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
              }}
            >
              <h2 style={{ marginBottom: 8, fontSize: 18, fontWeight: 600, color: "#dc2626" }}>
                Delete Confirmation
              </h2>
              <p style={{ color: "#6b7280", marginBottom: 24 }}>
                Are you sure you want to delete this item? This action cannot be undone.
              </p>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <Button color="secondary" size="sm">Cancel</Button>
                <Button color="primary-destructive" size="sm">Delete</Button>
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
            <div
              style={{
                background: "white",
                borderRadius: 12,
                padding: 32,
                maxWidth: 640,
                width: "100%",
                boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
              }}
            >
              <h2 style={{ marginBottom: 16, fontSize: 20, fontWeight: 600 }}>
                Large Modal
              </h2>
              <p style={{ color: "#6b7280", marginBottom: 16 }}>
                This modal contains more content and is wider.
              </p>
              <div style={{ background: "#f9fafb", borderRadius: 8, padding: 16, marginBottom: 24 }}>
                <p style={{ fontSize: 14, color: "#374151" }}>
                  Detailed content goes here. This could be a form, a list of items,
                  or any other complex content.
                </p>
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <Button color="secondary" size="sm">Cancel</Button>
                <Button color="primary" size="sm">Save Changes</Button>
              </div>
            </div>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  ),
};
