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
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { TagBoost } from '../../../generated/configuration/searchSettings';
import tagClassBase from '../../../utils/TagClassBase';
import TagBoostComponent from './TagBoost';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (str: string) => str,
  }),
}));

jest.mock('../../../utils/TagClassBase', () => ({
  getTags: jest.fn(),
}));

const mockTagBoost: TagBoost = {
  tagFQN: 'PII.NonSensitive',
  boost: 5,
};

const mockProps = {
  tagBoost: mockTagBoost,
  onTagBoostChange: jest.fn().mockImplementation((tagBoost: TagBoost) => {
    mockProps.tagBoost = { ...tagBoost };
  }),
  onDeleteBoost: jest.fn(),
};

const mockTagResponse = {
  data: [
    {
      data: {
        name: 'None',
        displayName: 'None',
        fullyQualifiedName: 'PII.None',
      },
    },
    {
      data: {
        name: 'Personal',
        displayName: 'Personal',
        fullyQualifiedName: 'PersonalData.Personal',
      },
    },
  ],
};

describe('TagBoost Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (tagClassBase.getTags as jest.Mock).mockResolvedValue(mockTagResponse);
  });

  it('Should render component with initial values', () => {
    render(<TagBoostComponent {...mockProps} />);

    expect(screen.getByTestId('tag-label')).toBeInTheDocument();
    expect(screen.getByTestId('tag-impact-label')).toBeInTheDocument();
    expect(screen.getByTestId('tag-boost-value')).toBeInTheDocument();
    expect(screen.getByRole('slider')).toBeInTheDocument();
  });

  it('Should handle tag selection', async () => {
    render(<TagBoostComponent {...mockProps} />);

    const select = screen.getByTestId('tag-select');
    fireEvent.mouseDown(select);

    await waitFor(() => {
      expect(tagClassBase.getTags).toHaveBeenCalled();
    });

    const option = screen.getByText('PII.NonSensitive');
    fireEvent.click(option);
  });

  it('Should handle boost value changes', () => {
    render(<TagBoostComponent {...mockProps} />);

    const slider = screen.getByRole('slider');

    fireEvent.keyDown(slider, { key: 'ArrowRight' });
  });

  it('Should handle delete tag boost', () => {
    render(<TagBoostComponent {...mockProps} />);

    const deleteIcon = screen.getByTestId('delete-tag-boost');
    fireEvent.click(deleteIcon);

    expect(mockProps.onDeleteBoost).toHaveBeenCalledWith('PII.NonSensitive');
  });

  it('Should not call onTagBoostChange when tag is empty', () => {
    const emptyTagBoost = {
      ...mockTagBoost,
      tagFQN: '',
    };

    render(<TagBoostComponent {...mockProps} tagBoost={emptyTagBoost} />);

    const slider = screen.getByRole('slider');
    fireEvent.keyDown(slider, { key: 'ArrowRight' });

    expect(mockProps.onTagBoostChange).not.toHaveBeenCalled();
  });
});
