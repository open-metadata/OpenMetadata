/*
 *  Copyright 2021 Collate
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

import { findByTestId, fireEvent, render } from '@testing-library/react';
import React from 'react';
import GlossaryReferenceModal from './GlossaryReferenceModal';

const mockSave = jest.fn();
const mockCancel = jest.fn();
const mockRefs: Array<Record<string, string>> = [];

jest.mock('../../GlossaryReferences/GlossaryReferences', () => {
  return jest.fn().mockReturnValue(<p>GlossaryReferences</p>);
});

jest.mock('lodash', () => ({
  isEqual: jest.fn().mockReturnValue(false),
  cloneDeep: jest.fn().mockReturnValue(mockRefs),
}));

describe('Test Ingestion modal component', () => {
  it('Component Should render', async () => {
    const { container } = render(
      <GlossaryReferenceModal
        header="Reference Modal"
        referenceList={mockRefs}
        onCancel={mockCancel}
        onSave={mockSave}
      />
    );

    const glossaryRefModal = await findByTestId(container, 'modal-container');
    const header = await findByTestId(container, 'header');
    const cancel = await findByTestId(container, 'cancelButton');
    const save = await findByTestId(container, 'saveButton');

    expect(glossaryRefModal).toBeInTheDocument();
    expect(header).toBeInTheDocument();
    expect(header.textContent).toStrictEqual('Reference Modal');
    expect(cancel).toBeInTheDocument();
    expect(cancel.textContent).toStrictEqual('Cancel');
    expect(save).toBeInTheDocument();
    expect(save.textContent).toStrictEqual('Save');

    fireEvent.click(cancel);

    expect(mockCancel).toBeCalled();

    fireEvent.click(save);

    expect(mockSave).toBeCalled();
  });
});
