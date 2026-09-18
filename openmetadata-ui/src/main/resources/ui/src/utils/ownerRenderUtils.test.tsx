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
import { OwnerType } from '../enums/user.enum';
import { renderOwnerPopover } from './ownerRenderUtils';

jest.mock('../components/common/PopOverCard/UserPopOverCard', () => ({
  __esModule: true,
  default: jest.fn(({ children, userName, type }) => (
    <div
      data-testid="user-pop-over-card"
      data-owner-type={type}
      data-username={userName}>
      {children}
    </div>
  )),
}));

describe('renderOwnerPopover', () => {
  it('should show the chip while the card chunk is still loading', () => {
    render(<>{renderOwnerPopover({ name: 'alice' }, <span>Alice</span>)}</>);

    // The Suspense fallback is the chip itself, so the owner name is never
    // missing — that is what keeps the lazy boundary invisible to the reader.
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  it('should wrap the chip in the card once it resolves', async () => {
    render(<>{renderOwnerPopover({ name: 'alice' }, <span>Alice</span>)}</>);

    const card = await screen.findByTestId('user-pop-over-card');

    expect(card).toHaveAttribute('data-username', 'alice');
    expect(card).toContainElement(screen.getByText('Alice'));
  });

  it('should map a team owner onto the team type', async () => {
    render(
      <>{renderOwnerPopover({ name: 'eng', type: 'team' }, <span>Eng</span>)}</>
    );

    expect(await screen.findByTestId('user-pop-over-card')).toHaveAttribute(
      'data-owner-type',
      OwnerType.TEAM
    );
  });

  it('should map every other owner onto the user type', async () => {
    render(
      <>{renderOwnerPopover({ name: 'alice', type: 'user' }, <span>A</span>)}</>
    );

    expect(await screen.findByTestId('user-pop-over-card')).toHaveAttribute(
      'data-owner-type',
      OwnerType.USER
    );
  });

  it('should treat a missing type as a user', async () => {
    render(<>{renderOwnerPopover({ name: 'alice' }, <span>A</span>)}</>);

    expect(await screen.findByTestId('user-pop-over-card')).toHaveAttribute(
      'data-owner-type',
      OwnerType.USER
    );
  });
});
