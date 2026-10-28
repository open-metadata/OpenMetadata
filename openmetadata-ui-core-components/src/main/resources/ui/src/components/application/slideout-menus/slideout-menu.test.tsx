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

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SlideoutMenu } from './slideout-menu';

describe('SlideoutMenu', () => {
  it('labels the dialog from its header and respects custom close controls', () => {
    render(
      <SlideoutMenu isOpen aria-labelledby="slideout-title">
        <SlideoutMenu.Header id="slideout-title" showCloseButton={false}>
          Reindex failures
        </SlideoutMenu.Header>
        <SlideoutMenu.Content>Details</SlideoutMenu.Content>
      </SlideoutMenu>
    );

    expect(
      screen.getByRole('dialog', { name: 'Reindex failures' })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /close/i })
    ).not.toBeInTheDocument();
  });

  it('puts the given test id on the built-in close control', () => {
    render(
      <SlideoutMenu isOpen aria-label="Activity feed">
        <SlideoutMenu.Header closeButtonTestId="closeDrawer">
          Activity feed
        </SlideoutMenu.Header>
      </SlideoutMenu>
    );

    expect(screen.getByTestId('closeDrawer')).toHaveAccessibleName(/close/i);
  });
});
