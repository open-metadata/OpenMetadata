/*
 *  Copyright 2024 Collate.
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
import { EntityReference } from '../generated/entity/type';
import { userCellRenderer } from './Users.util';
import { isMaskedEmail } from './UsersPureUtils';

jest.mock('../components/common/PopOverCard/UserPopOverCard', () =>
  jest.fn().mockImplementation(({ displayName }) => <span>{displayName}</span>)
);

describe('User Utils -- userCellRenderer', () => {
  it('should keep the login in the username column', () => {
    const user: EntityReference = {
      id: '1',
      name: 'jdoe',
      displayName: 'John Doe',
      type: 'user',
    };

    render(<>{userCellRenderer(user)}</>);

    expect(screen.getByText('jdoe')).toBeInTheDocument();
    expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
  });
});

describe('User Utils -- isMaskedEmail', () => {
  it('should return true for masked email', () => {
    const email = '********@masked.com';
    const result = isMaskedEmail(email);

    expect(result).toBe(true);
  });

  it('should return false for non-masked email', () => {
    const email = 'test@example.com';
    const result = isMaskedEmail(email);

    expect(result).toBe(false);
  });
});
