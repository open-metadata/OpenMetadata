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
import { fireEvent, render, screen } from '@testing-library/react';
import {
  NO_DATA_PLACEHOLDER,
  USER_DATA_SIZE,
} from '../../../constants/constants';
import { EntityType } from '../../../enums/entity.enum';
import { MOCK_USER_ROLE } from '../../../mocks/User.mock';
import Chip from './Chip.component';

const mockLinkButton = jest.fn();

jest.mock('react-router-dom', () => ({
  Link: jest.fn().mockImplementation(({ children, ...rest }) => (
    <a {...rest} onClick={mockLinkButton}>
      {children}
    </a>
  )),
}));

jest.mock('../../../utils/EntityUtils', () => ({
  getEntityName: jest.fn().mockReturnValue('getEntityName'),
}));

jest.mock('../../../utils/EntityUtilClassBase', () => ({
  getEntityLink: jest.fn(),
}));

const mockProps = {
  data: [],
  entityType: EntityType.ROLE,
};

describe('Test Chip Component', () => {
  it('should renders errorPlaceholder in case of no data', () => {
    render(<Chip {...mockProps} />);

    expect(screen.getByText(NO_DATA_PLACEHOLDER)).toBeInTheDocument();
  });

  it('should renders noDataPlaceholder if provided', () => {
    const placeholder = 'this is custom placeholder';

    render(<Chip {...mockProps} noDataPlaceholder={placeholder} />);

    expect(screen.getByText(placeholder)).toBeInTheDocument();
  });

  it('should renders tag chips', () => {
    render(
      <Chip {...mockProps} data={MOCK_USER_ROLE.slice(0, USER_DATA_SIZE)} />
    );

    expect(screen.getAllByTestId('tag-chip')).toHaveLength(5);
    expect(screen.getAllByText('getEntityName')).toHaveLength(5);
  });

  it('should renders more chip button if data is more than the size', () => {
    render(<Chip {...mockProps} data={MOCK_USER_ROLE} />);

    expect(screen.getByTestId('plus-more-count')).toBeInTheDocument();
    expect(screen.getByText('+3 more')).toBeInTheDocument();
  });

  it('should redirect the page when click on tag chip', () => {
    render(<Chip {...mockProps} data={MOCK_USER_ROLE} />);

    const tagChip = screen.getByTestId('ApplicationBotRole-link');

    fireEvent.click(tagChip);

    expect(mockLinkButton).toHaveBeenCalledTimes(1);
  });
});
