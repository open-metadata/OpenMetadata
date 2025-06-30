/*
 *  Copyright 2023 Collate.
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
import { act } from 'react-test-renderer';
import { ReactComponent as Icon } from '../../../assets/svg/teams-grey.svg';
import { ManageButtonItemLabel } from './ManageButtonContentItem.component';
import { MangeButtonItemLabelProps } from './ManageButtonItemLabel.interface';

const mockProps: MangeButtonItemLabelProps = {
  name: 'export',
  icon: Icon,
  description: 'description',
  id: 'export',
};

describe('ManageButtonContentItem component', () => {
  it('Component should render', async () => {
    render(<ManageButtonItemLabel {...mockProps} />);

    expect(await screen.findByTestId(`${mockProps.id}`)).toBeInTheDocument();
    expect(
      await screen.findByTestId(`${mockProps.id}-icon`)
    ).toBeInTheDocument();
    expect(
      await screen.findByTestId(`${mockProps.id}-details-container`)
    ).toBeInTheDocument();
    expect(
      await screen.findByTestId(`${mockProps.id}-title`)
    ).toBeInTheDocument();
    expect(
      await screen.findByTestId(`${mockProps.id}-description`)
    ).toBeInTheDocument();
  });

  it('should call onClick for clicking on item', async () => {
    const mockClick = jest.fn();
    render(<ManageButtonItemLabel {...mockProps} onClick={mockClick} />);

    await act(async () => {
      screen.getByTestId(`${mockProps.id}`).click();
    });

    expect(mockClick).toHaveBeenCalled();
  });
});
