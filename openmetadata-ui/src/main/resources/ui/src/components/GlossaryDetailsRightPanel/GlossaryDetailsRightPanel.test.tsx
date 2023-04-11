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
import { render } from '@testing-library/react';
import { OperationPermission } from 'components/PermissionProvider/PermissionProvider.interface';
import { mockedGlossaries } from 'mocks/Glossary.mock';
import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import GlossaryDetailsRightPanel from './GlossaryDetailsRightPanel.component';

const mockPermissions = {
  Create: true,
  Delete: true,
  EditAll: true,
  EditCustomFields: true,
  EditDataProfile: true,
  EditDescription: true,
  EditDisplayName: true,
  EditLineage: true,
  EditOwner: true,
  EditQueries: true,
  EditSampleData: true,
  EditTags: true,
  EditTests: true,
  EditTier: true,
  ViewAll: true,
  ViewDataProfile: true,
  ViewQueries: true,
  ViewSampleData: true,
  ViewTests: true,
  ViewUsage: true,
} as OperationPermission;

describe('GlossaryDetailsRightPanel', () => {
  it('should render the GlossaryDetailsRightPanel component', () => {
    const { getByTestId } = render(
      <BrowserRouter>
        <GlossaryDetailsRightPanel
          isGlossary
          permissions={mockPermissions}
          selectedData={mockedGlossaries[0]}
          onUpdate={jest.fn()}
        />
      </BrowserRouter>
    );

    expect(getByTestId('glossary-owner-name')).toHaveTextContent('label.owner');
    expect(getByTestId('glossary-reviewer-name')).toHaveTextContent(
      'label.reviewer-plural'
    );
    expect(getByTestId('glossary-tags-name')).toHaveTextContent(
      'label.tag-plural'
    );
  });
});
