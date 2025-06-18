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

import { findByText, queryByText, render } from '@testing-library/react';
import {
  mockedGlossaries,
  mockedGlossaryTerms,
} from '../../mocks/Glossary.mock';
import GlossaryV1 from './GlossaryV1.component';
import { GlossaryV1Props } from './GlossaryV1.interfaces';

const params = {
  glossaryName: 'GlossaryName',
  action: '',
};

jest.mock('../../context/PermissionProvider/PermissionProvider', () => ({
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
  DEFAULT_ENTITY_PERMISSION: {
    Create: true,
    Delete: true,
    ViewAll: true,
    EditAll: true,
    EditDescription: true,
    EditDisplayName: true,
    EditCustomFields: true,
  },
}));

jest.mock('react-router-dom', () => ({
  useParams: jest.fn().mockImplementation(() => params),
  Link: jest.fn().mockImplementation(({ children }) => <a>{children}</a>),
  useNavigate: jest.fn().mockReturnValue(jest.fn()),
}));

jest.mock('./GlossaryDetails/GlossaryDetails.component', () => {
  return jest.fn().mockReturnValue(<>Glossary-Details component</>);
});

jest.mock('./GlossaryTerms/GlossaryTermsV1.component', () => {
  return jest.fn().mockReturnValue(<>Glossary-Term component</>);
});

jest.mock('../common/TitleBreadcrumb/TitleBreadcrumb.component', () => {
  return jest.fn().mockReturnValue(<>TitleBreadcrumb</>);
});

jest.mock('../common/TitleBreadcrumb/TitleBreadcrumb.component', () =>
  jest.fn().mockReturnValue(<div>Breadcrumb</div>)
);

jest.mock('../Modals/EntityDeleteModal/EntityDeleteModal', () =>
  jest.fn().mockReturnValue(<div>Entity Delete Modal</div>)
);
jest.mock('../common/ProfilePicture/ProfilePicture', () =>
  jest.fn().mockReturnValue(<span>U</span>)
);

jest.mock('../ActivityFeed/FeedEditor/FeedEditor', () => {
  return jest.fn().mockReturnValue(<p>FeedEditor</p>);
});

jest.mock('../../components/AppRouter/withActivityFeed', () => ({
  withActivityFeed: jest.fn().mockImplementation((component) => component),
}));
jest.mock('./useGlossary.store', () => ({
  useGlossaryStore: jest.fn().mockImplementation(() => ({
    activeGlossary: mockedGlossaryTerms[0],
    updateActiveGlossary: jest.fn(),
    setGlossaryFunctionRef: jest.fn(),
    termsLoading: false,
    setTermsLoading: jest.fn(),
  })),
}));

const mockProps: GlossaryV1Props = {
  selectedData: mockedGlossaries[0],
  isGlossaryActive: true,
  onGlossaryTermUpdate: jest.fn(),
  updateGlossary: jest.fn(),
  onGlossaryDelete: jest.fn(),
  onGlossaryTermDelete: jest.fn(),
  isVersionsView: false,
  isSummaryPanelOpen: false,
};

describe('Test Glossary component', () => {
  it('Should render Glossary-details', async () => {
    const { container } = render(<GlossaryV1 {...mockProps} />);

    const glossaryDetails = await findByText(
      container,
      /Glossary-Details component/i
    );

    const glossaryTerm = await queryByText(
      container,
      /Glossary-Term component/i
    );

    expect(glossaryDetails).toBeInTheDocument();
    expect(glossaryTerm).not.toBeInTheDocument();
  });

  it('Should render Glossary-term', async () => {
    const { container } = render(
      <GlossaryV1
        {...mockProps}
        isGlossaryActive={false}
        selectedData={mockedGlossaryTerms[0]}
      />
    );

    const glossaryTerm = await findByText(
      container,
      /Glossary-Term component/i
    );

    const glossaryDetails = await queryByText(
      container,
      /Glossary-Details component/i
    );

    expect(glossaryTerm).toBeInTheDocument();
    expect(glossaryDetails).not.toBeInTheDocument();
  });
});
