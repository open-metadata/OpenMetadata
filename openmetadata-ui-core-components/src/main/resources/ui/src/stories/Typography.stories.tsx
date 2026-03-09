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
import { Typography } from "../components/foundations/typography";

const meta = {
  title: "Foundations/Typography",
  component: Typography,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof Typography>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: (
      <>
        <h1>Heading 1</h1>
        <p>This is a paragraph with <strong>bold text</strong> and <em>italic text</em>.</p>
      </>
    ),
  },
};

export const WithAsProp: Story = {
  name: "as prop — wraps children in inner element",
  render: () => (
    <Typography as="p">Hello</Typography>
  ),
};

export const WithAsAndClassName: Story = {
  name: "as prop with className on inner element",
  render: () => (
    <Typography as="p" className="font-bold text-blue-600">
      Hello with className on the inner &lt;p&gt;
    </Typography>
  ),
};

export const Headings: StoryObj = {
  render: () => (
    <Typography>
      <h1>Heading 1</h1>
      <h2>Heading 2</h2>
      <h3>Heading 3</h3>
      <h4>Heading 4</h4>
      <h5>Heading 5</h5>
      <h6>Heading 6</h6>
    </Typography>
  ),
};

export const Paragraphs: StoryObj = {
  render: () => (
    <div style={{ maxWidth: 600 }}>
      <Typography>
        <p>
          Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod
          tempor incididunt ut labore et dolore magna aliqua.
        </p>
        <p>
          Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi
          ut aliquip ex ea commodo consequat.
        </p>
      </Typography>
    </div>
  ),
};

export const Lists: StoryObj = {
  render: () => (
    <div style={{ maxWidth: 400 }}>
      <Typography>
        <h3>Unordered List</h3>
        <ul>
          <li>Item one</li>
          <li>Item two</li>
          <li>Item three with nested items
            <ul>
              <li>Nested item 1</li>
              <li>Nested item 2</li>
            </ul>
          </li>
        </ul>
        <h3>Ordered List</h3>
        <ol>
          <li>First item</li>
          <li>Second item</li>
          <li>Third item</li>
        </ol>
      </Typography>
    </div>
  ),
};

export const Links: StoryObj = {
  render: () => (
    <div style={{ maxWidth: 400 }}>
      <Typography>
        <p>
          Visit the <a href="#">OpenMetadata documentation</a> to learn more about
          the platform.
        </p>
      </Typography>
    </div>
  ),
};

export const CodeBlocks: StoryObj = {
  render: () => (
    <div style={{ maxWidth: 500 }}>
      <Typography>
        <p>Use inline <code>code formatting</code> for short snippets.</p>
        <pre>
          <code>{`const greeting = "Hello, World!";
console.log(greeting);`}</code>
        </pre>
      </Typography>
    </div>
  ),
};

export const Blockquote: StoryObj = {
  render: () => (
    <div style={{ maxWidth: 500 }}>
      <Typography quoteVariant="default">
        <blockquote>
          <p>The only way to do great work is to love what you do.</p>
        </blockquote>
      </Typography>
    </div>
  ),
};

export const CenteredQuote: StoryObj = {
  render: () => (
    <div style={{ maxWidth: 500 }}>
      <Typography quoteVariant="centered-quote">
        <blockquote>
          <p>The only way to do great work is to love what you do.</p>
        </blockquote>
      </Typography>
    </div>
  ),
};

export const MinimalQuote: StoryObj = {
  render: () => (
    <div style={{ maxWidth: 500 }}>
      <Typography quoteVariant="minimal-quote">
        <blockquote>
          <p>The only way to do great work is to love what you do.</p>
        </blockquote>
      </Typography>
    </div>
  ),
};

export const AsArticle: StoryObj = {
  name: "as='article' — inner element is article",
  render: () => (
    <div style={{ maxWidth: 500 }}>
      <Typography as="article">
        <h1>Article Title</h1>
        <p>This Typography component renders the inner element as an article.</p>
      </Typography>
    </div>
  ),
};
