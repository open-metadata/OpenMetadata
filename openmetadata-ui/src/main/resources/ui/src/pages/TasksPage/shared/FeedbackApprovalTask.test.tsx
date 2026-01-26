/*
 *  Copyright 2026 Collate.
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
import { ThemeProvider } from '@mui/material';
import { createMuiTheme } from '@openmetadata/ui-core-components';
import { render, screen } from '@testing-library/react';
import { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { FeedbackType } from '../../../generated/entity/feed/thread';
import { MOCK_TASK_RECOGNIZER_FEEDBACK } from '../../../mocks/Task.mock';
import FeedbackApprovalTask from './FeedbackApprovalTask';

jest.mock(
  '../../../components/common/RichTextEditor/RichTextEditorPreviewNew',
  () => {
    return function MockRichTextEditorPreviewerNew({
      markdown,
    }: {
      markdown: string;
    }) {
      return <div data-testid="rich-text-preview">{markdown}</div>;
    };
  }
);

jest.mock('../../../utils/date-time/DateTimeUtils', () => ({
  ...jest.requireActual('../../../utils/date-time/DateTimeUtils'),
  formatDateTime: jest.fn().mockReturnValue('2023-12-04 10:15:27'),
}));

jest.mock('../../../utils/EntityLink', () => ({
  __esModule: true,
  default: {
    getEntityType: jest.fn().mockReturnValue('table'),
    getEntityFqn: jest
      .fn()
      .mockReturnValue('sample_data.ecommerce_db.shopify."dim.shop"'),
    getEntityColumnFqn: jest
      .fn()
      .mockReturnValue('sample_data.ecommerce_db.shopify."dim.shop".email'),
  },
}));

jest.mock('../../../utils/RouterUtils', () => ({
  ...jest.requireActual('../../../utils/RouterUtils'),
  getEntityDetailsPath: jest
    .fn()
    .mockReturnValue('/table/sample_data.ecommerce_db.shopify.dim.shop'),
}));

const theme = createMuiTheme();

const Wrapper = ({ children }: { children: ReactNode }) => (
  <ThemeProvider theme={theme}>
    <MemoryRouter>{children}</MemoryRouter>
  </ThemeProvider>
);

const mockProps = {
  task: MOCK_TASK_RECOGNIZER_FEEDBACK,
};

describe('FeedbackApprovalTask', () => {
  it('should render the component with feedback data', () => {
    render(<FeedbackApprovalTask {...mockProps} />, {
      wrapper: Wrapper,
    });

    expect(screen.getByTestId('feedback-approval-task')).toBeInTheDocument();
  });

  it('should display feedback type', () => {
    render(<FeedbackApprovalTask {...mockProps} />, {
      wrapper: Wrapper,
    });

    expect(screen.getByText('label.feedback-type')).toBeInTheDocument();
    expect(
      screen.getByText('label.feedback-type-false-positive')
    ).toBeInTheDocument();
  });

  it('should display user comments when available', () => {
    render(<FeedbackApprovalTask {...mockProps} />, {
      wrapper: Wrapper,
    });

    expect(screen.getByText('label.comment-plural')).toBeInTheDocument();
    expect(
      screen.getByText('This is not a sensitive field')
    ).toBeInTheDocument();
  });

  it('should display submitted by information', () => {
    render(<FeedbackApprovalTask {...mockProps} />, {
      wrapper: Wrapper,
    });

    expect(screen.getByText('label.submitted-by')).toBeInTheDocument();
    expect(screen.getByText('Admin User')).toBeInTheDocument();
  });

  it('should display submitted on date', () => {
    render(<FeedbackApprovalTask {...mockProps} />, {
      wrapper: Wrapper,
    });

    expect(screen.getByText('label.submitted-on')).toBeInTheDocument();
    expect(screen.getByText('2023-12-04 10:15:27')).toBeInTheDocument();
  });

  it('should display entity link when available', () => {
    render(<FeedbackApprovalTask {...mockProps} />, {
      wrapper: Wrapper,
    });

    expect(screen.getByText('label.entity-link')).toBeInTheDocument();
  });

  it('should not render when feedback is undefined', () => {
    const { container } = render(
      <FeedbackApprovalTask
        task={{ ...mockProps.task, feedback: undefined }}
      />,
      {
        wrapper: Wrapper,
      }
    );

    expect(container.firstChild).toBeEmptyDOMElement();
  });

  it('should display correct feedback type label for IncorrectClassification', () => {
    const taskWithIncorrectClassification = {
      ...mockProps.task,
      feedback: {
        ...mockProps.task.feedback!,
        feedbackType: FeedbackType.IncorrectClassification,
      },
    };

    render(<FeedbackApprovalTask task={taskWithIncorrectClassification} />, {
      wrapper: Wrapper,
    });

    expect(
      screen.getByText('label.feedback-type-incorrect-classification')
    ).toBeInTheDocument();
  });

  it('should display correct feedback type label for OverlyBroad', () => {
    const taskWithOverlyBroad = {
      ...mockProps.task,
      feedback: {
        ...mockProps.task.feedback!,
        feedbackType: FeedbackType.OverlyBroad,
      },
    };

    render(<FeedbackApprovalTask task={taskWithOverlyBroad} />, {
      wrapper: Wrapper,
    });

    expect(
      screen.getByText('label.feedback-type-overly-broad')
    ).toBeInTheDocument();
  });

  it('should display correct feedback type label for ContextSpecific', () => {
    const taskWithContextSpecific = {
      ...mockProps.task,
      feedback: {
        ...mockProps.task.feedback!,
        feedbackType: FeedbackType.ContextSpecific,
      },
    };

    render(<FeedbackApprovalTask task={taskWithContextSpecific} />, {
      wrapper: Wrapper,
    });

    expect(
      screen.getByText('label.feedback-type-context-specific')
    ).toBeInTheDocument();
  });

  it('should not display user comments when not available', () => {
    const taskWithoutComments = {
      ...mockProps.task,
      feedback: {
        ...mockProps.task.feedback!,
        userComments: undefined,
      },
    };

    render(<FeedbackApprovalTask task={taskWithoutComments} />, {
      wrapper: Wrapper,
    });

    expect(screen.queryByText('label.comment-plural')).not.toBeInTheDocument();
  });

  it('should not display created by when not available', () => {
    const taskWithoutCreatedBy = {
      ...mockProps.task,
      feedback: {
        ...mockProps.task.feedback!,
        createdBy: undefined,
      },
    };

    render(<FeedbackApprovalTask task={taskWithoutCreatedBy} />, {
      wrapper: Wrapper,
    });

    expect(screen.queryByText('label.submitted-by')).not.toBeInTheDocument();
  });

  it('should not display entity link when entityType is null', () => {
    const EntityLink = require('../../../utils/EntityLink').default;
    EntityLink.getEntityType.mockReturnValueOnce(null);

    render(<FeedbackApprovalTask {...mockProps} />, {
      wrapper: Wrapper,
    });

    expect(screen.queryByText('label.entity-link')).not.toBeInTheDocument();
  });

  it('should not display submitted on date when createdAt is not available', () => {
    const taskWithoutCreatedAt = {
      ...mockProps.task,
      feedback: {
        ...mockProps.task.feedback!,
        createdAt: undefined,
      },
    };

    render(<FeedbackApprovalTask task={taskWithoutCreatedAt} />, {
      wrapper: Wrapper,
    });

    expect(screen.queryByText('label.submitted-on')).not.toBeInTheDocument();
  });

  it('should use createdBy name when displayName is not available', () => {
    const taskWithoutDisplayName = {
      ...mockProps.task,
      feedback: {
        ...mockProps.task.feedback!,
        createdBy: {
          id: 'd6764107-e8b4-4748-b256-c86fecc66064',
          type: 'user',
          name: 'admin',
          deleted: false,
        },
      },
    };

    render(<FeedbackApprovalTask task={taskWithoutDisplayName} />, {
      wrapper: Wrapper,
    });

    expect(screen.getByText('admin')).toBeInTheDocument();
  });
});
