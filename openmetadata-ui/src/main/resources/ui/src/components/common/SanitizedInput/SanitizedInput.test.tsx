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
import { fireEvent, render } from '@testing-library/react';
import { getSanitizeContent } from '../../../utils/sanitize.utils';
import SanitizedInput from './SanitizedInput';

jest.mock('../../../utils/sanitize.utils');

describe('SanitizedInput', () => {
  it('should render the input component', () => {
    const { getByPlaceholderText } = render(
      <SanitizedInput placeholder="Enter text" />
    );

    expect(getByPlaceholderText('Enter text')).toBeInTheDocument();
  });

  it('should call getSanitizeContent and onChange with sanitized value', () => {
    const mockSanitizeContent = getSanitizeContent as jest.Mock;
    mockSanitizeContent.mockReturnValue('sanitized value');

    const handleChange = jest.fn();
    const { getByPlaceholderText } = render(
      <SanitizedInput placeholder="Enter text" onChange={handleChange} />
    );

    const input = getByPlaceholderText('Enter text');
    fireEvent.change(input, { target: { value: 'unsanitized value' } });

    expect(mockSanitizeContent).toHaveBeenCalledWith('unsanitized value');
    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        target: expect.objectContaining({ value: 'sanitized value' }),
      })
    );
  });
});
