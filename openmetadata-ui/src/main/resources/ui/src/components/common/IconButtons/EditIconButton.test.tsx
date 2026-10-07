/*
 *  Copyright 2026 Collate.
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
import {
  CardExpandCollapseIconButton,
  CommentIconButton,
  EditIconButton,
  RequestIconButton,
} from './EditIconButton';

describe('EditIconButton', () => {
  it.each([true, false])(
    'names the icon-only edit button by its title (newLook %p)',
    (newLook) => {
      render(<EditIconButton newLook={newLook} title="Edit Parameter" />);

      expect(
        screen.getByRole('button', { name: 'Edit Parameter' })
      ).toBeInTheDocument();
    }
  );

  it.each([
    ['request', RequestIconButton],
    ['comment', CommentIconButton],
  ])('names the bordered %s button by its title', (_, IconButton) => {
    render(<IconButton newLook title="Request Description" />);

    expect(
      screen.getByRole('button', { name: 'Request Description' })
    ).toBeInTheDocument();
  });

  it('names the expand / collapse button by its title', () => {
    render(<CardExpandCollapseIconButton title="Collapse" />);

    expect(
      screen.getByRole('button', { name: 'Collapse' })
    ).toBeInTheDocument();
  });
});
