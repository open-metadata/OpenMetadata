/*
 *  Copyright 2022 Collate.
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

import { fireEvent, render, screen } from '@testing-library/react';
import { UserTag } from './UserTag.component';
import { UserTagSize } from './UserTag.interface';

jest.mock('../ProfilePicture/ProfilePicture', () => {
  return jest.fn().mockReturnValue(<div>ProfilePicture</div>);
});

describe('UserTag Component', () => {
  it('If valid props being passed to UserTag it should show tag', () => {
    const { getByTestId, container } = render(
      <UserTag id="test-2176e73" name="test-tag" />
    );

    const userTag = getByTestId('user-tag');

    expect(userTag).toBeInTheDocument();
    expect(container).toHaveTextContent('test-tag');
  });

  it('If inValid props being passed to UserTag it should not show tag', () => {
    const { queryByTestId, container } = render(
      <UserTag
        id={undefined as unknown as string}
        name={undefined as unknown as string}
      />
    );

    expect(queryByTestId('user-tag')).not.toBeInTheDocument();
    expect(container).toHaveTextContent('');
  });

  const userTagProps = {
    id: '123',
    name: 'John Doe',
    onRemove: jest.fn(),
    closable: true,
    bordered: true,
    size: UserTagSize.default,
    className: 'custom-class',
    isTeam: false,
  };

  it('renders without crashing', () => {
    render(<UserTag {...userTagProps} />);

    // Add more specific assertions if needed
    expect(screen.getByTestId('user-tag')).toBeInTheDocument();
  });

  it('calls onRemove when close icon is clicked', () => {
    render(<UserTag {...userTagProps} />);
    const closeIcon = screen
      .getByTestId('user-tag')
      .querySelector('.anticon-close');

    // Simulate click on the close icon
    closeIcon && fireEvent.click(closeIcon);

    // Check if the onRemove callback is called
    expect(userTagProps.onRemove).toHaveBeenCalledTimes(1);
  });
});
