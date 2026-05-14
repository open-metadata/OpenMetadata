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
import type { Meta, StoryObj } from '@storybook/react';
import { Button } from '../components/base/buttons/button';
import { SlideoutMenu } from '../components/application/slideout-menus/slideout-menu';

const meta = {
  title: 'Components/SlideoutMenu',
  component: SlideoutMenu,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof SlideoutMenu>;

export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => (
    <SlideoutMenu.Trigger>
      <Button color="secondary">Open Panel</Button>
      <SlideoutMenu>
        <SlideoutMenu.Header onClose={() => {}}>
          <h2 className="tw:text-lg tw:font-semibold tw:text-primary">
            Panel Title
          </h2>
          <p className="tw:text-sm tw:text-tertiary tw:mt-1">
            A brief description of this panel.
          </p>
        </SlideoutMenu.Header>
        <SlideoutMenu.Content>
          <p className="tw:text-sm tw:text-secondary">
            This is the main content area of the slideout panel. You can place
            any content here.
          </p>
        </SlideoutMenu.Content>
      </SlideoutMenu>
    </SlideoutMenu.Trigger>
  ),
};

export const WithFooter: Story = {
  render: () => (
    <SlideoutMenu.Trigger>
      <Button color="primary">Open with Footer</Button>
      <SlideoutMenu>
        {({ close }) => (
          <>
            <SlideoutMenu.Header onClose={close}>
              <h2 className="tw:text-lg tw:font-semibold tw:text-primary">
                Edit Details
              </h2>
              <p className="tw:text-sm tw:text-tertiary tw:mt-1">
                Make changes and save when done.
              </p>
            </SlideoutMenu.Header>
            <SlideoutMenu.Content>
              <div className="tw:flex tw:flex-col tw:gap-4">
                <div className="tw:flex tw:flex-col tw:gap-1">
                  <label className="tw:text-sm tw:font-medium tw:text-secondary">
                    Name
                  </label>
                  <input
                    className="tw:w-full tw:rounded-lg tw:border tw:border-primary tw:px-3 tw:py-2 tw:text-sm tw:text-primary tw:outline-none focus:tw:border-brand"
                    defaultValue="My Dataset"
                    type="text"
                  />
                </div>
                <div className="tw:flex tw:flex-col tw:gap-1">
                  <label className="tw:text-sm tw:font-medium tw:text-secondary">
                    Description
                  </label>
                  <textarea
                    className="tw:w-full tw:rounded-lg tw:border tw:border-primary tw:px-3 tw:py-2 tw:text-sm tw:text-primary tw:outline-none tw:resize-none focus:tw:border-brand"
                    defaultValue="A sample dataset for demonstration purposes."
                    rows={4}
                  />
                </div>
              </div>
            </SlideoutMenu.Content>
            <SlideoutMenu.Footer>
              <div className="tw:flex tw:justify-end tw:gap-3">
                <Button color="secondary" size="sm" onPress={close}>
                  Cancel
                </Button>
                <Button color="primary" size="sm" onPress={close}>
                  Save Changes
                </Button>
              </div>
            </SlideoutMenu.Footer>
          </>
        )}
      </SlideoutMenu>
    </SlideoutMenu.Trigger>
  ),
};

export const WithRichContent: Story = {
  render: () => (
    <SlideoutMenu.Trigger>
      <Button color="secondary">View Details</Button>
      <SlideoutMenu>
        {({ close }) => (
          <>
            <SlideoutMenu.Header onClose={close}>
              <h2 className="tw:text-lg tw:font-semibold tw:text-primary">
                Table: orders
              </h2>
              <p className="tw:text-sm tw:text-tertiary tw:mt-1">
                Schema: public · Database: analytics_db
              </p>
            </SlideoutMenu.Header>
            <SlideoutMenu.Content>
              <div className="tw:flex tw:flex-col tw:gap-6">
                <section className="tw:flex tw:flex-col tw:gap-2">
                  <h3 className="tw:text-sm tw:font-semibold tw:text-primary">
                    Description
                  </h3>
                  <p className="tw:text-sm tw:text-secondary">
                    Contains all customer orders including order status, totals,
                    and timestamps.
                  </p>
                </section>
                <section className="tw:flex tw:flex-col tw:gap-2">
                  <h3 className="tw:text-sm tw:font-semibold tw:text-primary">
                    Columns
                  </h3>
                  <div className="tw:flex tw:flex-col tw:divide-y tw:divide-[var(--color-border-secondary)]">
                    {[
                      { name: 'order_id', type: 'BIGINT', desc: 'Primary key' },
                      {
                        name: 'customer_id',
                        type: 'BIGINT',
                        desc: 'FK to customers table',
                      },
                      { name: 'status', type: 'VARCHAR', desc: 'Order status' },
                      {
                        name: 'total_amount',
                        type: 'DECIMAL',
                        desc: 'Total order value',
                      },
                      {
                        name: 'created_at',
                        type: 'TIMESTAMP',
                        desc: 'Order creation time',
                      },
                    ].map((col) => (
                      <div
                        className="tw:flex tw:items-start tw:gap-3 tw:py-3"
                        key={col.name}>
                        <span className="tw:font-mono tw:text-sm tw:text-primary tw:w-28 tw:shrink-0">
                          {col.name}
                        </span>
                        <span className="tw:text-xs tw:text-tertiary tw:bg-secondary tw:rounded tw:px-1.5 tw:py-0.5 tw:shrink-0">
                          {col.type}
                        </span>
                        <span className="tw:text-sm tw:text-secondary">
                          {col.desc}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
                <section className="tw:flex tw:flex-col tw:gap-2">
                  <h3 className="tw:text-sm tw:font-semibold tw:text-primary">
                    Tags
                  </h3>
                  <div className="tw:flex tw:flex-wrap tw:gap-2">
                    {['PII', 'Sensitive', 'Orders'].map((tag) => (
                      <span
                        className="tw:rounded-full tw:border tw:border-primary tw:px-3 tw:py-0.5 tw:text-xs tw:font-medium tw:text-secondary"
                        key={tag}>
                        {tag}
                      </span>
                    ))}
                  </div>
                </section>
              </div>
            </SlideoutMenu.Content>
            <SlideoutMenu.Footer>
              <div className="tw:flex tw:justify-end">
                <Button color="secondary" size="sm" onPress={close}>
                  Close
                </Button>
              </div>
            </SlideoutMenu.Footer>
          </>
        )}
      </SlideoutMenu>
    </SlideoutMenu.Trigger>
  ),
};

export const CustomWidth: Story = {
  render: () => (
    <div className="tw:flex tw:gap-4">
      <SlideoutMenu.Trigger>
        <Button color="secondary" size="sm">
          Narrow (320px)
        </Button>
        <SlideoutMenu width={320}>
          {({ close }) => (
            <>
              <SlideoutMenu.Header onClose={close}>
                <h2 className="tw:text-lg tw:font-semibold tw:text-primary">
                  Narrow Panel
                </h2>
              </SlideoutMenu.Header>
              <SlideoutMenu.Content>
                <p className="tw:text-sm tw:text-secondary">
                  This panel is 320px wide.
                </p>
              </SlideoutMenu.Content>
            </>
          )}
        </SlideoutMenu>
      </SlideoutMenu.Trigger>

      <SlideoutMenu.Trigger>
        <Button color="secondary" size="sm">
          Wide (640px)
        </Button>
        <SlideoutMenu width={640}>
          {({ close }) => (
            <>
              <SlideoutMenu.Header onClose={close}>
                <h2 className="tw:text-lg tw:font-semibold tw:text-primary">
                  Wide Panel
                </h2>
              </SlideoutMenu.Header>
              <SlideoutMenu.Content>
                <p className="tw:text-sm tw:text-secondary">
                  This panel is 640px wide.
                </p>
              </SlideoutMenu.Content>
            </>
          )}
        </SlideoutMenu>
      </SlideoutMenu.Trigger>

      <SlideoutMenu.Trigger>
        <Button color="secondary" size="sm">
          CSS value (50vw)
        </Button>
        <SlideoutMenu width="50vw">
          {({ close }) => (
            <>
              <SlideoutMenu.Header onClose={close}>
                <h2 className="tw:text-lg tw:font-semibold tw:text-primary">
                  Half Viewport
                </h2>
              </SlideoutMenu.Header>
              <SlideoutMenu.Content>
                <p className="tw:text-sm tw:text-secondary">
                  This panel is 50vw wide.
                </p>
              </SlideoutMenu.Content>
            </>
          )}
        </SlideoutMenu>
      </SlideoutMenu.Trigger>
    </div>
  ),
};

export const WithRenderProps: Story = {
  render: () => (
    <SlideoutMenu.Trigger>
      <Button color="secondary">Render Props Pattern</Button>
      <SlideoutMenu>
        {({ close, isEntering, isExiting }) => (
          <>
            <SlideoutMenu.Header onClose={close}>
              <h2 className="tw:text-lg tw:font-semibold tw:text-primary">
                Render Props
              </h2>
              <p className="tw:text-sm tw:text-tertiary tw:mt-1">
                State:{' '}
                {isEntering ? 'entering' : isExiting ? 'exiting' : 'open'}
              </p>
            </SlideoutMenu.Header>
            <SlideoutMenu.Content>
              <p className="tw:text-sm tw:text-secondary">
                The SlideoutMenu supports a render-props pattern, giving you
                access to{' '}
                <code className="tw:font-mono tw:text-xs tw:bg-secondary tw:rounded tw:px-1">
                  close
                </code>
                ,{' '}
                <code className="tw:font-mono tw:text-xs tw:bg-secondary tw:rounded tw:px-1">
                  isEntering
                </code>
                , and{' '}
                <code className="tw:font-mono tw:text-xs tw:bg-secondary tw:rounded tw:px-1">
                  isExiting
                </code>{' '}
                animation states from the children function.
              </p>
            </SlideoutMenu.Content>
            <SlideoutMenu.Footer>
              <Button color="primary" size="sm" onPress={close}>
                Done
              </Button>
            </SlideoutMenu.Footer>
          </>
        )}
      </SlideoutMenu>
    </SlideoutMenu.Trigger>
  ),
};
