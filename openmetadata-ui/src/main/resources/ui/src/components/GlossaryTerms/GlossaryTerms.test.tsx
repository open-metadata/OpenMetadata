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

import { render, screen } from '@testing-library/react';
import React from 'react';
import {
  mockedAssetData,
  mockedGlossaryTerms,
  MOCK_ASSETS_DATA,
} from '../../mocks/Glossary.mock';
import { OperationPermission } from '../PermissionProvider/PermissionProvider.interface';
import GlossaryTerms from './GlossaryTermsV1.component';

jest.mock('../PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn().mockReturnValue({
    getEntityPermission: jest.fn().mockReturnValue({
      Create: true,
      Delete: true,
      ViewAll: true,
      EditAll: true,
      EditDescription: true,
      EditDisplayName: true,
      EditCustomFields: true,
    }),
    permissions: {
      glossaryTerm: {
        Create: true,
        Delete: true,
        ViewAll: true,
        EditAll: true,
        EditDescription: true,
        EditDisplayName: true,
        EditCustomFields: true,
      },
      glossary: {
        Create: true,
        Delete: true,
        ViewAll: true,
        EditAll: true,
        EditDescription: true,
        EditDisplayName: true,
        EditCustomFields: true,
      },
    },
  }),
}));

jest.mock('../../utils/PermissionsUtils', () => ({
  checkPermission: jest.fn().mockReturnValue(true),
  userPermissions: {
    hasViewPermissions: jest.fn(),
  },
}));

jest.mock('react-router-dom', () => ({
  useHistory: jest.fn(),
  useParams: jest.fn().mockReturnValue({
    glossaryName: 'GlossaryName',
    tab: 'terms',
  }),
}));

jest.mock('rest/miscAPI', () => ({
  searchData: jest
    .fn()
    .mockImplementation(() => Promise.resolve(MOCK_ASSETS_DATA)),
}));

jest.mock('components/Tag/TagsContainer/tags-container', () => {
  return jest.fn().mockReturnValue(<>Tags-container component</>);
});

jest.mock('../common/description/DescriptionV1', () => {
  return jest.fn().mockReturnValue(<>Description component</>);
});

jest.mock('../common/rich-text-editor/RichTextEditorPreviewer', () => {
  return jest.fn().mockReturnValue(<p>RichTextEditorPreviewer</p>);
});

jest.mock('./tabs/RelatedTerms', () =>
  jest.fn().mockReturnValue(<div>RelatedTermsComponent</div>)
);
jest.mock('./tabs/GlossaryTermSynonyms', () =>
  jest.fn().mockReturnValue(<div>GlossaryTermSynonymsComponent</div>)
);
jest.mock('./tabs/GlossaryTermReferences', () =>
  jest.fn().mockReturnValue(<div>GlossaryTermReferencesComponent</div>)
);
jest.mock('./tabs/AssetsTabs.component', () =>
  jest.fn().mockReturnValue(<div>AssetsTabs</div>)
);
jest.mock('components/Glossary/GlossaryTermTab/GlossaryTermTab.component', () =>
  jest.fn().mockReturnValue(<div>GlossaryTermTab</div>)
);
jest.mock('components/Glossary/GlossaryHeader/GlossaryHeader.component', () =>
  jest.fn().mockReturnValue(<div>GlossaryHeader.component</div>)
);

const mockProps = {
  assetData: mockedAssetData,
  currentPage: 1,
  permissions: {
    Create: true,
    Delete: true,
    ViewAll: true,
    EditAll: true,
    EditDescription: true,
    EditDisplayName: true,
    EditCustomFields: true,
  } as OperationPermission,
  glossaryTerm: mockedGlossaryTerms[0],
  handleGlossaryTermUpdate: jest.fn(),
  onAssetPaginate: jest.fn(),
  onRelatedTermClick: jest.fn(),
  handleGlossaryTermDelete: jest.fn(),
};

describe('Test Glossary-term component', () => {
  it('Should render Glossary-term component', async () => {
    render(<GlossaryTerms {...mockProps} childGlossaryTerms={[]} />);

    const glossaryTerm = screen.getByTestId('glossary-term');
    const tabs = await screen.findAllByRole('tab');

    expect(await screen.findByText('GlossaryTermTab')).toBeInTheDocument();
    expect(glossaryTerm).toBeInTheDocument();
    expect(tabs).toHaveLength(2);
    expect(tabs.map((tab) => tab.textContent)).toStrictEqual([
      'label.glossary-term-plural0',
      'label.asset-plural1', // 1 added as its count for assets
    ]);
  });
});
