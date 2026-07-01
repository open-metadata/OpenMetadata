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
import { NodeViewProps } from '@tiptap/core';
import React from 'react';
import { PipelineType } from '../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { fetchMarkdownFile } from '../../../rest/miscAPI';
import { getActiveFieldNameForAppDocs } from '../../../utils/ServicePureUtils';
import { processDocMarkdown } from '../../../utils/ServiceUtils';
import CodeBlockComponent from '../../BlockEditor/Extensions/CodeBlock/CodeBlockComponent';
import ServiceDocPanel from './ServiceDocPanel';

jest.mock('../Loader/Loader', () =>
  jest.fn().mockReturnValue(<div data-testid="loader">Loader</div>)
);

jest.mock('@tiptap/react', () => ({
  NodeViewWrapper: ({
    children,
    ...props
  }: {
    children: React.ReactNode;
    [key: string]: unknown;
  }) => React.createElement('pre', props, children),
  NodeViewContent: ({ as: Tag = 'div' }: { as?: string }) =>
    React.createElement(Tag),
}));

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

jest.mock('../../../utils/ServicePureUtils', () => ({
  getActiveFieldNameForAppDocs: jest.fn(),
}));

jest.mock('../../../utils/ServiceUtils', () => ({
  processDocMarkdown: jest.fn((content: string) => content),
}));

jest.mock('../RichTextEditor/RichTextEditorPreviewerV1', () =>
  jest.fn(({ markdown }: { markdown: string }) => (
    <div
      className="service-doc-content"
      dangerouslySetInnerHTML={{ __html: markdown }}
    />
  ))
);

let mockLanguage = 'en-US';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: {
      language: mockLanguage,
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
const mockProcessDocMarkdown = processDocMarkdown as jest.MockedFunction<
  typeof processDocMarkdown
>;

const mockScrollIntoView = jest.fn();
const mockQuerySelector = jest.fn();
const mockQuerySelectorAll = jest.fn();

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

const createMockElement = () => ({
  scrollIntoView: mockScrollIntoView,
  dataset: {} as DOMStringMap,
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
    mockLanguage = 'en-US';
    mockFetchMarkdownFile.mockResolvedValue('markdown content');
    mockQuerySelectorAll.mockReturnValue([]);
    mockQuerySelector.mockReturnValue(null);
    mockGetActiveFieldNameForAppDocs.mockReturnValue(undefined);
  });

  describe('Core Functionality', () => {
    it('should render component and fetch markdown content', async () => {
      const { container } = render(<ServiceDocPanel {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('service-requirements')).toBeInTheDocument();
        expect(container.querySelector('.service-doc-content')).not.toBeNull();
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

    it('should normalize short language codes before fetching markdown', async () => {
      mockLanguage = 'en';

      render(<ServiceDocPanel {...defaultProps} />);

      await waitFor(() => {
        expect(mockFetchMarkdownFile).toHaveBeenCalledWith(
          'en-US/DatabaseService/mysql.md'
        );
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle fetch failures gracefully', async () => {
      mockFetchMarkdownFile.mockRejectedValue(new Error('Network error'));

      render(<ServiceDocPanel {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('service-requirements')).toBeInTheDocument();
        expect(screen.queryByTestId('loader')).not.toBeInTheDocument();
      });
    });
  });

  describe('Admonition Rendering', () => {
    it('should render a note admonition block', async () => {
      mockProcessDocMarkdown.mockReturnValue(
        '<div class="admonition admonition-note"><p>This is a note</p></div>'
      );

      const { container } = render(<ServiceDocPanel {...defaultProps} />);

      await waitFor(() => {
        expect(
          container.querySelector('.admonition.admonition-note')
        ).toBeInTheDocument();
      });
    });

    it('should render a warning admonition block', async () => {
      mockProcessDocMarkdown.mockReturnValue(
        '<div class="admonition admonition-warning"><p>This is a warning</p></div>'
      );

      const { container } = render(<ServiceDocPanel {...defaultProps} />);

      await waitFor(() => {
        expect(
          container.querySelector('.admonition.admonition-warning')
        ).toBeInTheDocument();
      });
    });

    it('should pass fetched markdown through processDocMarkdown', async () => {
      mockFetchMarkdownFile.mockResolvedValue('$$note\nsome note\n$$');

      render(<ServiceDocPanel {...defaultProps} />);

      await waitFor(() => {
        expect(mockProcessDocMarkdown).toHaveBeenCalledWith(
          '$$note\nsome note\n$$'
        );
      });
    });

    it('should render focused field docs without carrying requirements forward', async () => {
      mockFetchMarkdownFile.mockResolvedValue(
        [
          '# Snowflake',
          '## Requirements',
          'Grant metadata privileges.',
          '## Connection Details',
          '$$section',
          '### Database $(id="database")',
          'Database guidance.',
          '$$',
          '$$section',
          '### Warehouse $(id="warehouse")',
          'Warehouse guidance.',
          '$$',
        ].join('\n')
      );

      render(
        <ServiceDocPanel
          {...defaultProps}
          focusedMode
          activeField="root/database"
        />
      );

      await waitFor(() => {
        expect(mockProcessDocMarkdown).toHaveBeenCalledWith(
          expect.stringContaining('Database guidance.')
        );
        expect(mockProcessDocMarkdown).not.toHaveBeenCalledWith(
          expect.stringContaining('Grant metadata privileges.')
        );
        expect(mockProcessDocMarkdown).not.toHaveBeenCalledWith(
          expect.stringContaining('Warehouse guidance.')
        );
      });
    });

    it('should render full requirements on focused docs landing state', async () => {
      mockFetchMarkdownFile.mockResolvedValue(
        [
          '# Snowflake',
          '## Requirements',
          'Grant metadata privileges.',
          '$$note',
          'Use Snowflake 8.0.0 and up.',
          '$$',
          '### Usage & Lineage',
          'Grant lineage privileges.',
          '### Profiler & Data Quality',
          'Grant profiler privileges.',
          '## Connection Details',
          '$$section',
          '### Database $(id="database")',
          'Database guidance.',
          '$$',
        ].join('\n')
      );

      render(<ServiceDocPanel {...defaultProps} focusedMode />);

      await waitFor(() => {
        expect(mockProcessDocMarkdown).toHaveBeenCalledWith(
          expect.stringContaining('### label.metadata')
        );
        expect(mockProcessDocMarkdown).toHaveBeenCalledWith(
          expect.stringContaining('Grant metadata privileges.')
        );
        expect(mockProcessDocMarkdown).toHaveBeenCalledWith(
          expect.stringContaining('$$note\nUse Snowflake 8.0.0 and up.\n$$')
        );
        expect(mockProcessDocMarkdown).toHaveBeenCalledWith(
          expect.stringContaining('### label.lineage')
        );
        expect(mockProcessDocMarkdown).toHaveBeenCalledWith(
          expect.stringContaining('Grant lineage privileges.')
        );
        expect(mockProcessDocMarkdown).toHaveBeenCalledWith(
          expect.stringContaining('### label.profiler')
        );
        expect(mockProcessDocMarkdown).toHaveBeenCalledWith(
          expect.stringContaining('Grant profiler privileges.')
        );
        expect(mockProcessDocMarkdown).not.toHaveBeenCalledWith(
          expect.stringContaining('Database guidance.')
        );
      });
    });

    it('should show the dedicated service-name guidance for the service name focused field', async () => {
      mockFetchMarkdownFile.mockResolvedValue(
        [
          '# Snowflake',
          '## Requirements',
          'Grant metadata privileges.',
          '## Connection Details',
          '$$section',
          '### Database $(id="database")',
          'Database guidance.',
          '$$',
        ].join('\n')
      );

      render(
        <ServiceDocPanel
          {...defaultProps}
          focusedMode
          activeField="serviceName"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('label.name-this-service')).toBeInTheDocument();
        expect(mockProcessDocMarkdown).toHaveBeenCalledWith(
          expect.stringContaining('label.service-name')
        );
        expect(mockProcessDocMarkdown).not.toHaveBeenCalledWith(
          expect.stringContaining('Grant metadata privileges.')
        );
        expect(mockProcessDocMarkdown).not.toHaveBeenCalledWith(
          expect.stringContaining('Database guidance.')
        );
      });
    });

    it('should show a generic fallback card when a focused field has no matching docs section or schema metadata', async () => {
      mockFetchMarkdownFile.mockResolvedValue(
        [
          '# Salesforce',
          '## Requirements',
          'Grant metadata privileges.',
          '## Connection Details',
          '$$section',
          '### Username $(id="username")',
          'Username guidance.',
          '$$',
        ].join('\n')
      );

      const { container } = render(
        <ServiceDocPanel
          {...defaultProps}
          focusedMode
          activeField="root/account"
        />
      );

      await waitFor(() => {
        expect(
          container.querySelector('.focused-service-docs-intro')
        ).toHaveTextContent('Account');
        expect(
          container.querySelector('.focused-service-docs-intro')
        ).toHaveTextContent('message.openmetadata-docs-description');
        expect(mockProcessDocMarkdown).not.toHaveBeenCalledWith(
          expect.stringContaining('Grant metadata privileges.')
        );
        expect(mockProcessDocMarkdown).not.toHaveBeenCalledWith(
          expect.stringContaining('Username guidance.')
        );
      });
    });

    it('should show schema field metadata when a focused field has no matching docs section but schema metadata is available', async () => {
      mockFetchMarkdownFile.mockResolvedValue(
        [
          '# Salesforce',
          '## Requirements',
          'Grant metadata privileges.',
          '## Connection Details',
          '$$section',
          '### Username $(id="username")',
          'Username guidance.',
          '$$',
        ].join('\n')
      );

      render(
        <ServiceDocPanel
          {...defaultProps}
          focusedMode
          activeField="root/account"
          activeFieldMeta={{
            title: 'Account Name',
            description: 'The Snowflake account identifier.',
          }}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Account Name')).toBeInTheDocument();
        expect(
          screen.getByText('The Snowflake account identifier.')
        ).toBeInTheDocument();
        expect(mockProcessDocMarkdown).not.toHaveBeenCalledWith(
          expect.stringContaining('Grant metadata privileges.')
        );
      });
    });
  });

  describe('Brand Name Replacement', () => {
    const originalEnv = process.env;

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should replace OpenMetadata with BRAND_NAME when env var is set', async () => {
      process.env = { ...originalEnv, BRAND_NAME: 'Collate' };
      mockFetchMarkdownFile.mockResolvedValue(
        'Connect to OpenMetadata using OpenMetadata SDK'
      );

      render(<ServiceDocPanel {...defaultProps} />);

      await waitFor(() => {
        expect(mockProcessDocMarkdown).toHaveBeenCalledWith(
          'Connect to Collate using Collate SDK'
        );
      });
    });

    it('should keep OpenMetadata when BRAND_NAME env var is not set', async () => {
      process.env = { ...originalEnv };
      delete process.env.BRAND_NAME;
      mockFetchMarkdownFile.mockResolvedValue(
        'Connect to OpenMetadata using OpenMetadata SDK'
      );

      render(<ServiceDocPanel {...defaultProps} />);

      await waitFor(() => {
        expect(mockProcessDocMarkdown).toHaveBeenCalledWith(
          'Connect to OpenMetadata using OpenMetadata SDK'
        );
      });
    });

    it('should replace all occurrences of OpenMetadata with BRAND_NAME', async () => {
      process.env = { ...originalEnv, BRAND_NAME: 'MyBrand' };
      mockFetchMarkdownFile.mockResolvedValue(
        'OpenMetadata is great. Use OpenMetadata for metadata management.'
      );

      render(<ServiceDocPanel {...defaultProps} />);

      await waitFor(() => {
        expect(mockProcessDocMarkdown).toHaveBeenCalledWith(
          'MyBrand is great. Use MyBrand for metadata management.'
        );
      });
    });
  });

  describe('Field Highlighting', () => {
    beforeEach(() => {
      mockQuerySelector.mockReturnValue(createMockElement());
      mockQuerySelectorAll.mockReturnValue([createMockElement()]);
    });

    it('should highlight and scroll to active field', async () => {
      const mockElement = createMockElement();
      mockQuerySelector.mockReturnValue(mockElement);

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
        expect(mockElement.dataset.highlighted).toBe('true');
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
          `[data-id="${CSS.escape('config.database')}"]`
        );
      });
    });

    it('should clean up previous highlights before highlighting new element', async () => {
      const previousElement = createMockElement();
      previousElement.dataset.highlighted = 'true';
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
        expect(previousElement.dataset.highlighted).toBe('false');
        expect(currentElement.dataset.highlighted).toBe('true');
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

      const { container } = render(
        <ServiceDocPanel
          activeField="root/application/config"
          selectedEntity={mockSelectedEntity}
          serviceName="custom-app"
          serviceType="Applications"
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('entity-summary-panel')).toBeInTheDocument();
        expect(container.querySelector('.service-doc-content')).not.toBeNull();
        expect(mockGetActiveFieldNameForAppDocs).toHaveBeenCalledWith(
          'root/application/config'
        );
        expect(mockQuerySelector).toHaveBeenCalledWith(
          `[data-id="${CSS.escape('application.config')}"]`
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

describe('CodeBlockComponent', () => {
  const mockWriteText = jest.fn().mockResolvedValue(undefined);

  const mockNode = {
    textContent: 'SELECT * FROM table;',
  } as unknown as NodeViewProps['node'];

  const mockNodeViewProps = {
    node: mockNode,
  } as unknown as NodeViewProps;

  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: mockWriteText },
      writable: true,
    });
    Object.defineProperty(window, 'isSecureContext', {
      value: true,
      writable: true,
      configurable: true,
    });
  });

  it('should render the copy button', () => {
    render(<CodeBlockComponent {...mockNodeViewProps} />);

    expect(screen.getByTestId('code-block-copy-icon')).toBeInTheDocument();
  });

  it('should set data-copied to false initially', () => {
    const { container } = render(<CodeBlockComponent {...mockNodeViewProps} />);

    expect(container.querySelector('.code-copy-button')).toHaveAttribute(
      'data-copied',
      'false'
    );
  });

  it('should copy node text content to clipboard on click', async () => {
    render(<CodeBlockComponent {...mockNodeViewProps} />);

    fireEvent.click(screen.getByTestId('code-block-copy-icon'));

    await waitFor(() => {
      expect(mockWriteText).toHaveBeenCalledWith('SELECT * FROM table;');
    });
  });

  it('should set data-copied to true after clicking copy', async () => {
    const { container } = render(<CodeBlockComponent {...mockNodeViewProps} />);

    fireEvent.click(screen.getByTestId('code-block-copy-icon'));

    await waitFor(() => {
      expect(container.querySelector('.code-copy-button')).toHaveAttribute(
        'data-copied',
        'true'
      );
    });
  });

  it('should remain in copied state after rapid clicks', async () => {
    const { container } = render(<CodeBlockComponent {...mockNodeViewProps} />);

    fireEvent.click(screen.getByTestId('code-block-copy-icon'));

    await waitFor(() => {
      expect(mockWriteText).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByTestId('code-block-copy-icon'));

    await waitFor(() => {
      expect(mockWriteText).toHaveBeenCalledTimes(2);
    });

    expect(container.querySelector('.code-copy-button')).toHaveAttribute(
      'data-copied',
      'true'
    );
  });
});
