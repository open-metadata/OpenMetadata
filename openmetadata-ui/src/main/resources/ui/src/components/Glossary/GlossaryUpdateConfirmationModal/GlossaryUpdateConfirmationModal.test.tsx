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
import { act, fireEvent, render } from '@testing-library/react';
import { GlossaryTerm } from '../../../generated/entity/data/glossaryTerm';
import { GlossaryUpdateConfirmationModal } from './GlossaryUpdateConfirmationModal';

const mockOnCancel = jest.fn();
const mockOnValidationSuccess = jest.fn();
const mockValidateTagAddtionToGlossary = jest.fn().mockResolvedValue({});

jest.mock('../../../rest/glossaryAPI', () => ({
  validateTagAddtionToGlossary: mockValidateTagAddtionToGlossary,
}));

jest.mock('../../../utils/EntityUtils', () => ({
  getEntityLinkFromType: jest.fn(),
  getEntityName: jest.fn(),
}));

jest.mock('../../common/Table/Table', () => {
  return jest.fn();
});

describe('GlossaryUpdateConfirmationModal component', () => {
  it('should render confirmation screen', async () => {
    const { findByText } = render(
      <GlossaryUpdateConfirmationModal
        glossaryTerm={{} as GlossaryTerm}
        updatedTags={[]}
        onCancel={mockOnCancel}
        onValidationSuccess={mockOnValidationSuccess}
      />
    );

    expect(await findByText('label.no-comma-cancel')).toBeInTheDocument();
    expect(await findByText('label.yes-comma-confirm')).toBeInTheDocument();
    expect(
      await findByText('message.tag-update-confirmation')
    ).toBeInTheDocument();
    expect(
      await findByText('message.glossary-tag-update-description')
    ).toBeInTheDocument();
  });

  it('should call onCancel on clicking on no, cancel button', async () => {
    const { findByText } = render(
      <GlossaryUpdateConfirmationModal
        glossaryTerm={{} as GlossaryTerm}
        updatedTags={[]}
        onCancel={mockOnCancel}
        onValidationSuccess={mockOnValidationSuccess}
      />
    );

    fireEvent.click(await findByText('label.no-comma-cancel'));

    expect(mockOnCancel).toHaveBeenCalled();
  });

  it.skip('should call validation api on clicking on yes, confirm button', async () => {
    const { findByText } = render(
      <GlossaryUpdateConfirmationModal
        glossaryTerm={{} as GlossaryTerm}
        updatedTags={[]}
        onCancel={mockOnCancel}
        onValidationSuccess={mockOnValidationSuccess}
      />
    );

    await act(async () => {
      fireEvent.click(await findByText('label.yes-comma-confirm'));
    });

    expect(mockValidateTagAddtionToGlossary).toHaveBeenCalledWith(
      { tags: [] },
      true
    );
  });
});
