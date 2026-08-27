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
import TagChip from './TagChip';

// The global test setup stubs MUI styling; this suite needs real sx-generated CSS.
jest.unmock('@mui/styled-engine');

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe('TagChip color styling', () => {
  it('tints the background and colors the label when tagColor is provided', () => {
    render(
      <TagChip
        data-testid="tags"
        label="Confidential"
        labelDataTestId="tag-color-test"
        tagColor="#ff0000"
      />
    );

    expect(screen.getByTestId('tags')).toHaveStyle(
      'background-color: rgba(255, 0, 0, 0.05)'
    );
    expect(screen.getByTestId('tag-color-test')).toHaveStyle({
      color: '#ff0000',
    });
  });

  it('does not apply a tag color when tagColor is absent', () => {
    render(
      <TagChip
        data-testid="tags"
        label="Plain"
        labelDataTestId="tag-plain-test"
      />
    );

    expect(screen.getByTestId('tags')).not.toHaveStyle(
      'background-color: rgba(255, 0, 0, 0.05)'
    );
    expect(screen.getByTestId('tag-plain-test')).not.toHaveStyle(
      'color: rgb(255, 0, 0)'
    );
  });
});
