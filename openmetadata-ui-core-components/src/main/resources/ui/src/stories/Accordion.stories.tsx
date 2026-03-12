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
import {
  Accordion,
  AccordionHeader,
  AccordionItem,
  AccordionPanel,
} from "../components/application/accordion/accordion";

const meta = {
  title: "Components/Accordion",
  component: Accordion,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof Accordion>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <div style={{ width: 480 }}>
      <Accordion>
        <AccordionItem id="item-1">
          <AccordionHeader>What is OpenMetadata?</AccordionHeader>
          <AccordionPanel>
            OpenMetadata is a unified metadata platform for data discovery, data observability,
            and data governance. It provides a central repository for all your data assets.
          </AccordionPanel>
        </AccordionItem>
        <AccordionItem id="item-2">
          <AccordionHeader>How do I connect a data source?</AccordionHeader>
          <AccordionPanel>
            You can connect a data source by navigating to Settings → Services and clicking
            "Add New Service". Follow the wizard to configure your connector.
          </AccordionPanel>
        </AccordionItem>
        <AccordionItem id="item-3">
          <AccordionHeader>What authentication methods are supported?</AccordionHeader>
          <AccordionPanel>
            OpenMetadata supports multiple authentication methods including Google SSO, Okta,
            Auth0, Azure AD, and LDAP. You can configure your preferred method in the settings.
          </AccordionPanel>
        </AccordionItem>
      </Accordion>
    </div>
  ),
};

export const DefaultExpanded: StoryObj = {
  render: () => (
    <div style={{ width: 480 }}>
      <Accordion defaultExpandedKeys={["item-1"]}>
        <AccordionItem id="item-1">
          <AccordionHeader>First item (expanded by default)</AccordionHeader>
          <AccordionPanel>
            This section is expanded by default when the component first renders.
          </AccordionPanel>
        </AccordionItem>
        <AccordionItem id="item-2">
          <AccordionHeader>Second item</AccordionHeader>
          <AccordionPanel>
            Click the header to expand this section.
          </AccordionPanel>
        </AccordionItem>
        <AccordionItem id="item-3">
          <AccordionHeader>Third item</AccordionHeader>
          <AccordionPanel>
            Click the header to expand this section.
          </AccordionPanel>
        </AccordionItem>
      </Accordion>
    </div>
  ),
};

export const MultipleExpanded: StoryObj = {
  render: () => (
    <div style={{ width: 480 }}>
      <Accordion allowsMultipleExpanded defaultExpandedKeys={["item-1", "item-2"]}>
        <AccordionItem id="item-1">
          <AccordionHeader>Expanded item 1</AccordionHeader>
          <AccordionPanel>
            Both this and the second item start expanded. Multiple items can be open simultaneously.
          </AccordionPanel>
        </AccordionItem>
        <AccordionItem id="item-2">
          <AccordionHeader>Expanded item 2</AccordionHeader>
          <AccordionPanel>
            Multiple items can remain expanded at the same time with <code>allowsMultipleExpanded</code>.
          </AccordionPanel>
        </AccordionItem>
        <AccordionItem id="item-3">
          <AccordionHeader>Collapsed item 3</AccordionHeader>
          <AccordionPanel>
            This item starts collapsed.
          </AccordionPanel>
        </AccordionItem>
      </Accordion>
    </div>
  ),
};

export const WithDisabledItem: StoryObj = {
  render: () => (
    <div style={{ width: 480 }}>
      <Accordion>
        <AccordionItem id="item-1">
          <AccordionHeader>Available section</AccordionHeader>
          <AccordionPanel>
            This section can be expanded and collapsed normally.
          </AccordionPanel>
        </AccordionItem>
        <AccordionItem id="item-2" isDisabled>
          <AccordionHeader>Disabled section</AccordionHeader>
          <AccordionPanel>
            This content is not accessible because the item is disabled.
          </AccordionPanel>
        </AccordionItem>
        <AccordionItem id="item-3">
          <AccordionHeader>Another available section</AccordionHeader>
          <AccordionPanel>
            This section can also be expanded and collapsed.
          </AccordionPanel>
        </AccordionItem>
      </Accordion>
    </div>
  ),
};

export const WithRichContent: StoryObj = {
  render: () => (
    <div style={{ width: 520 }}>
      <Accordion allowsMultipleExpanded>
        <AccordionItem id="permissions">
          <AccordionHeader>Permissions</AccordionHeader>
          <AccordionPanel>
            <ul style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 4 }}>
              <li>Read access to all datasets</li>
              <li>Write access to assigned projects</li>
              <li>Admin access to metadata tags</li>
            </ul>
          </AccordionPanel>
        </AccordionItem>
        <AccordionItem id="schema">
          <AccordionHeader>Schema Details</AccordionHeader>
          <AccordionPanel>
            <div style={{ fontFamily: "monospace", background: "#F9FAFB", padding: 12, borderRadius: 6, fontSize: 13 }}>
              <div><strong>Table:</strong> customer_orders</div>
              <div><strong>Columns:</strong> 24</div>
              <div><strong>Rows:</strong> 1,204,331</div>
              <div><strong>Last updated:</strong> 2025-03-11</div>
            </div>
          </AccordionPanel>
        </AccordionItem>
        <AccordionItem id="lineage">
          <AccordionHeader>Data Lineage</AccordionHeader>
          <AccordionPanel>
            <p style={{ margin: "0 0 8px", color: "#344054" }}>
              This table is derived from the following upstream sources:
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {["raw_orders", "customers", "products"].map((source) => (
                <div
                  key={source}
                  style={{
                    padding: "6px 12px",
                    background: "#F0F9FF",
                    borderRadius: 6,
                    fontSize: 13,
                    color: "#026AA2",
                    fontFamily: "monospace",
                  }}
                >
                  {source}
                </div>
              ))}
            </div>
          </AccordionPanel>
        </AccordionItem>
      </Accordion>
    </div>
  ),
};
