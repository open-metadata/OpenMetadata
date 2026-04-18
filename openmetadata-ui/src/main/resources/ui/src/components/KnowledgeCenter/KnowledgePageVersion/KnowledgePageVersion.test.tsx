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
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Settings } from 'luxon';
import KnowledgePageVersion from './KnowledgePageVersion';
import { MOCK_KNOWLEDGE_PAGE_VERSION_DATA } from './KnowledgePageVersion.mock';

const systemLocale = Settings.defaultLocale;
const systemZoneName = Settings.defaultZone;

const mockPush = jest.fn();

jest.mock('utils/EntityUtils', () => ({
  getEntityName: jest.fn(),
}));

jest.mock(
  'components/common/OwnerLabel/OwnerLabel.component',
  () => ({
    OwnerLabel: jest.fn().mockImplementation(() => {
      return <div data-testid="owner-label">OwnerLabel</div>;
    }),
  })
);

jest.mock(
  'components/Tag/TagsContainerV2/TagsContainerV2',
  () =>
    jest
      .fn()
      .mockImplementation(() => (
        <div data-testid="tags-container">TagsContainerV2</div>
      ))
);

jest.mock('components/common/Loader/Loader', () =>
  jest.fn().mockImplementation(() => <div data-testid="loader">Loader</div>)
);

jest.mock('react-router-dom', () => ({
  DataNode: jest.fn(),
  useNavigate: jest.fn().mockImplementation(() => mockPush),
}));

jest.mock('components/BlockEditor/BlockEditor', () => {
  return jest
    .fn()
    .mockReturnValue(<div data-testid="block-editor">Block Editor</div>);
});

jest.mock(
  'components/common/ProfilePicture/ProfilePicture',
  () => {
    return jest.fn().mockReturnValue(<div data-testid="avatar">Avatar</div>);
  }
);

const mockProps = {
  knowledgePage: MOCK_KNOWLEDGE_PAGE_VERSION_DATA,
  loading: false,
};

describe('Knowledge page version', () => {
  beforeAll(() => {
    // Explicitly set locale and time zone to make sure date time manipulations and literal
    // results are consistent regardless of where tests are run
    Settings.defaultLocale = 'en-US';
    Settings.defaultZone = 'UTC';
  });

  afterAll(() => {
    // Restore locale and time zone
    Settings.defaultLocale = systemLocale;
    Settings.defaultZone = systemZoneName;
  });

  it('Should render the components', async () => {
    render(<KnowledgePageVersion {...mockProps} />);

    const header = screen.getByTestId('entity-header-display-name');

    const ownerName = screen.getByTestId('owner-label');

    const updateAt = screen.getByTestId('updated-at');

    const versionButton = screen.getByTestId('version-button');

    const tagsContainer = screen.getAllByTestId('tags-container');

    const blockEditor = screen.getByTestId('block-editor');

    expect(header).toBeInTheDocument();
    expect(ownerName).toBeInTheDocument();
    expect(updateAt).toBeInTheDocument();
    expect(versionButton).toBeInTheDocument();
    expect(tagsContainer).toHaveLength(2);

    expect(blockEditor).toBeInTheDocument();

    expect(updateAt).toHaveTextContent('Sep 20, 2023');
    expect(versionButton).toHaveTextContent('1.1');
  });

  it('Should show the loader if loading is true', async () => {
    render(<KnowledgePageVersion {...mockProps} loading />);

    expect(screen.getByTestId('loader')).toBeInTheDocument();
  });

  it('Version button should redirect to entity page', async () => {
    render(<KnowledgePageVersion {...mockProps} />);

    const versionButton = screen.getByTestId('version-button');

    expect(versionButton).toHaveTextContent('1.1');

    fireEvent.click(versionButton);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(
        '/knowledge-center/Article_oRKYYTCu'
      );
    });
  });
});
