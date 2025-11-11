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
import { render, screen, waitFor } from '@testing-library/react';
import { PipelineType } from '../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { fetchMarkdownFile } from '../../../rest/miscAPI';
import { getActiveFieldNameForAppDocs } from '../../../utils/ServiceUtils';
import ServiceDocPanel from './ServiceDocPanel';

jest.mock('../Loader/Loader', () =>
  jest.fn().mockReturnValue(<div data-testid="loader">Loader</div>)
);

jest.mock('../RichTextEditor/RichTextEditorPreviewer', () =>
  jest
    .fn()
    .mockImplementation(({ markdown }) => (
      <div data-testid="requirement-text">{markdown}</div>
    ))
);

jest.mock('../../Explore/EntitySummaryPanel/EntitySummaryPanel.component', () =>
  jest
    .fn()
    .mockReturnValue(
      <div data-testid="entity-summary-panel">Entity Summary</div>
    )
);

jest.mock('../../../rest/miscAPI', () => ({
  fetchMarkdownFile: jest.fn(),
}));

jest.mock('../../../utils/ServiceUtils', () => ({
  getActiveFieldNameForAppDocs: jest.fn(),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: {
      language: 'en-US',
    },
  }),
}));

const mockFetchMarkdownFile = fetchMarkdownFile as jest.MockedFunction<
  typeof fetchMarkdownFile
>;
const mockGetActiveFieldNameForAppDocs =
  getActiveFieldNameForAppDocs as jest.MockedFunction<
    typeof getActiveFieldNameForAppDocs
  >;

const mockScrollIntoView = jest.fn();
const mockQuerySelector = jest.fn();
const mockQuerySelectorAll = jest.fn();
const mockSetAttribute = jest.fn();
const mockRemoveAttribute = jest.fn();

Object.defineProperty(window, 'requestAnimationFrame', {
  writable: true,
  value: jest.fn((callback: FrameRequestCallback) => callback(0)),
});

Object.defineProperty(document, 'querySelector', {
  writable: true,
  value: mockQuerySelector,
});

Object.defineProperty(document, 'querySelectorAll', {
  writable: true,
  value: mockQuerySelectorAll,
});

const createMockElement = (
  setAttribute = mockSetAttribute,
  removeAttribute = mockRemoveAttribute
) => ({
  scrollIntoView: mockScrollIntoView,
  setAttribute,
  removeAttribute,
});

const defaultProps = {
  serviceName: 'mysql',
  serviceType: 'DatabaseService',
};

const mockSelectedEntity = {
  id: 'entity-1',
  name: 'test-entity',
  displayName: 'Test Entity',
  serviceType: 'DatabaseService',
};

describe('ServiceDocPanel Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchMarkdownFile.mockResolvedValue('markdown content');
    mockQuerySelectorAll.mockReturnValue([]);
    mockQuerySelector.mockReturnValue(null);
    mockGetActiveFieldNameForAppDocs.mockReturnValue(undefined);
  });

  describe('Core Functionality', () => {
    it('should render component and fetch markdown content', async () => {
      render(<ServiceDocPanel {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('service-requirements')).toBeInTheDocument();
        expect(screen.getByTestId('requirement-text')).toBeInTheDocument();
        expect(mockFetchMarkdownFile).toHaveBeenCalledWith(
          'en-US/DatabaseService/mysql.md'
        );
      });
    });

    it('should show loader during fetch and hide when complete', async () => {
      const pendingPromise = Promise.resolve('markdown content');
      mockFetchMarkdownFile.mockReturnValue(pendingPromise);

      render(<ServiceDocPanel {...defaultProps} />);

      expect(screen.getByTestId('loader')).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.queryByTestId('loader')).not.toBeInTheDocument();
      });
    });

    it('should handle Api service type conversion', async () => {
      render(<ServiceDocPanel serviceName="rest-api" serviceType="Api" />);

      await waitFor(() => {
        expect(mockFetchMarkdownFile).toHaveBeenCalledWith(
          'en-US/ApiEntity/rest-api.md'
        );
      });
    });

    it('should fetch workflow documentation when isWorkflow is true', async () => {
      render(
        <ServiceDocPanel
          {...defaultProps}
          isWorkflow
          workflowType={PipelineType.Metadata}
        />
      );

      await waitFor(() => {
        expect(mockFetchMarkdownFile).toHaveBeenCalledWith(
          'en-US/DatabaseService/workflows/metadata.md'
        );
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle fetch failures gracefully', async () => {
      mockFetchMarkdownFile.mockRejectedValue(new Error('Network error'));

      render(<ServiceDocPanel {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('requirement-text')).toHaveTextContent('');
      });
    });
  });

  describe('Field Highlighting', () => {
    beforeEach(() => {
      const mockElement = createMockElement();
      mockQuerySelector.mockReturnValue(mockElement);
      mockQuerySelectorAll.mockReturnValue([createMockElement()]);
    });

    it('should highlight and scroll to active field', async () => {
      render(
        <ServiceDocPanel {...defaultProps} activeField="root/database/name" />
      );

      await waitFor(() => {
        expect(mockQuerySelector).toHaveBeenCalledWith('[data-id="name"]');
        expect(mockScrollIntoView).toHaveBeenCalledWith({
          block: 'center',
          behavior: 'smooth',
          inline: 'center',
        });
        expect(mockSetAttribute).toHaveBeenCalledWith(
          'data-highlighted',
          'true'
        );
      });
    });

    it('should handle Applications service type with custom field processing', async () => {
      mockGetActiveFieldNameForAppDocs.mockReturnValue('config.database');

      render(
        <ServiceDocPanel
          activeField="root/config/database"
          serviceName="app-service"
          serviceType="Applications"
        />
      );

      await waitFor(() => {
        expect(mockGetActiveFieldNameForAppDocs).toHaveBeenCalledWith(
          'root/config/database'
        );
        expect(mockQuerySelector).toHaveBeenCalledWith(
          '[data-id="config.database"]'
        );
      });
    });

    it('should clean up previous highlights before highlighting new element', async () => {
      const previousElement = createMockElement();
      const currentElement = createMockElement();

      mockQuerySelectorAll.mockReturnValue([previousElement]);
      mockQuerySelector.mockReturnValue(currentElement);

      render(
        <ServiceDocPanel {...defaultProps} activeField="root/database/host" />
      );

      await waitFor(() => {
        expect(mockQuerySelectorAll).toHaveBeenCalledWith(
          '[data-highlighted="true"]'
        );
        expect(previousElement.removeAttribute).toHaveBeenCalledWith(
          'data-highlighted'
        );
        expect(currentElement.setAttribute).toHaveBeenCalledWith(
          'data-highlighted',
          'true'
        );
      });
    });

    it('should handle field names with special patterns', async () => {
      render(
        <ServiceDocPanel
          {...defaultProps}
          activeField="root/database/items/0"
        />
      );

      await waitFor(() => {
        expect(mockQuerySelector).toHaveBeenCalledWith('[data-id="database"]');
      });
    });
  });

  describe('Entity Integration', () => {
    it('should render EntitySummaryPanel when selectedEntity is provided', async () => {
      render(
        <ServiceDocPanel
          {...defaultProps}
          selectedEntity={mockSelectedEntity}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('entity-summary-panel')).toBeInTheDocument();
      });
    });

    it('should handle complete integration with entity and highlighting', async () => {
      const mockElement = createMockElement();
      mockQuerySelector.mockReturnValue(mockElement);
      mockGetActiveFieldNameForAppDocs.mockReturnValue('application.config');

      render(
        <ServiceDocPanel
          activeField="root/application/config"
          selectedEntity={mockSelectedEntity}
          serviceName="custom-app"
          serviceType="Applications"
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('entity-summary-panel')).toBeInTheDocument();
        expect(screen.getByTestId('requirement-text')).toBeInTheDocument();
        expect(mockGetActiveFieldNameForAppDocs).toHaveBeenCalledWith(
          'root/application/config'
        );
        expect(mockQuerySelector).toHaveBeenCalledWith(
          '[data-id="application.config"]'
        );
      });
    });
  });

  describe('Props Updates', () => {
    it('should refetch content when serviceName changes', async () => {
      const { rerender } = render(<ServiceDocPanel {...defaultProps} />);

      await waitFor(() => {
        expect(mockFetchMarkdownFile).toHaveBeenCalledTimes(1);
      });

      rerender(<ServiceDocPanel {...defaultProps} serviceName="postgres" />);

      await waitFor(() => {
        expect(mockFetchMarkdownFile).toHaveBeenCalledTimes(2);
        expect(mockFetchMarkdownFile).toHaveBeenLastCalledWith(
          'en-US/DatabaseService/postgres.md'
        );
      });
    });

    it('should update highlighting when activeField changes', async () => {
      const mockElement = createMockElement();
      mockQuerySelector.mockReturnValue(mockElement);

      const { rerender } = render(
        <ServiceDocPanel {...defaultProps} activeField="root/field1" />
      );

      await waitFor(() => {
        expect(mockQuerySelector).toHaveBeenCalledWith('[data-id="field1"]');
      });

      rerender(<ServiceDocPanel {...defaultProps} activeField="root/field2" />);

      await waitFor(() => {
        expect(mockQuerySelector).toHaveBeenCalledWith('[data-id="field2"]');
      });
    });
  });
});
