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

import { fireEvent, screen } from '@testing-library/react';
import {
  Task,
  TaskCategory,
  TaskStatus,
  TaskType,
} from '../../../../generated/entity/tasks/task';
import { OntologyReviewTarget } from '../../../../generated/type/ontologyReviewTarget';
import APIClient from '../../../../rest/axiosClient';
import {
  renderWithQueryClient,
  runQueryNotificationsSynchronously,
} from '../../../../test/unit/test-utils';
import OntologyReviewPanel from './OntologyReviewPanel';

jest.mock('../../../../rest/axiosClient', () => ({ get: jest.fn() }));
jest.mock('@uiw/react-codemirror', () => {
  const { forwardRef } = jest.requireActual<typeof import('react')>('react');

  return {
    __esModule: true,
    default: forwardRef<HTMLPreElement, { value: string }>(function Editor(
      { value },
      ref
    ) {
      return (
        <pre data-testid="review-content" ref={ref}>
          {value}
        </pre>
      );
    }),
  };
});

const get = APIClient.get as jest.MockedFunction<typeof APIClient.get>;
const target: OntologyReviewTarget = {
  entityId: 'release-id',
  entityVersion: 0.2,
  ontologyId: 'ontology-id',
  reviewRevision: 1,
  contentDigest: 'a'.repeat(64),
  author: 'author',
  workflowDefinitionVersion: 1,
  workflowDefinitionDigest: 'b'.repeat(64),
};
const task: Task = {
  id: 'task-id',
  category: TaskCategory.Approval,
  status: TaskStatus.Open,
  createdBy: { id: 'author-id', type: 'user' },
  name: 'Review release',
  type: TaskType.RequestApproval,
  about: { id: 'release-id', type: 'ontologyRelease' },
  ontologyReview: target,
};
const release = {
  id: 'release-id',
  name: 'Release 2',
  version: 0.2,
  baseReleaseId: 'previous-release',
};

runQueryNotificationsSynchronously();

describe('OntologyReviewPanel', () => {
  beforeEach(() => {
    get.mockReset();
  });

  it.each(['CHANGED', 'REMOVED'])(
    'compares the captured baseline and opens the %s member snapshots',
    async (changeType) => {
      get.mockImplementation(async (url) => {
        if (url.endsWith('/versions/0.2')) {
          return { data: release };
        }
        if (url.endsWith('/diff')) {
          return {
            data: {
              data: [
                {
                  entity: {
                    id: 'concept-id',
                    name: 'Customer',
                    type: 'ontologyConcept',
                  },
                  memberKind: 'CONCEPT',
                  changeType,
                  beforeReleaseId: 'previous-release',
                  afterReleaseId:
                    changeType === 'CHANGED' ? 'release-id' : undefined,
                },
              ],
              paging: { total: 1 },
            },
          };
        }
        if (url.includes('/members/CONCEPT/concept-id')) {
          return {
            data: {
              payload: {
                description: url.includes('/previous-release/')
                  ? 'Previous meaning'
                  : 'Submitted meaning',
              },
            },
          };
        }

        throw new Error(`Unexpected request ${url}`);
      });
      const onReadyChange = jest.fn();
      renderWithQueryClient(
        <OntologyReviewPanel task={task} onReadyChange={onReadyChange} />
      );
      fireEvent.click(await screen.findByRole('button', { name: 'Customer' }));

      expect(await screen.findByText(/Previous meaning/)).toBeInTheDocument();

      if (changeType === 'CHANGED') {
        expect(
          await screen.findByText(/Submitted meaning/)
        ).toBeInTheDocument();
      } else {
        expect(screen.queryByText(/Submitted meaning/)).not.toBeInTheDocument();
      }

      expect(onReadyChange).toHaveBeenLastCalledWith(true);
      expect(get).toHaveBeenCalledWith(
        '/ontologyReleases/release-id/versions/0.2',
        expect.anything()
      );
      expect(get).toHaveBeenCalledWith(
        '/ontologyReleases/release-id/diff',
        expect.objectContaining({
          params: {
            baseReleaseId: 'previous-release',
            limit: 25,
            after: undefined,
          },
        })
      );
    }
  );

  it.each([403, 404])(
    'keeps a %s history error visible without substituting current content',
    async (status) => {
      get.mockRejectedValue({ response: { status } });
      const onReadyChange = jest.fn();
      renderWithQueryClient(
        <OntologyReviewPanel task={task} onReadyChange={onReadyChange} />
      );

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'message.ontology-review-unavailable'
      );
      expect(screen.queryByTestId('review-content')).not.toBeInTheDocument();
      expect(get).toHaveBeenCalledTimes(1);
      expect(onReadyChange).toHaveBeenLastCalledWith(false);
    }
  );

  it('rejects history from a different identity or version', async () => {
    get.mockResolvedValue({ data: { ...release, version: 0.3 } });
    renderWithQueryClient(<OntologyReviewPanel task={task} />);

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByTestId('review-content')).not.toBeInTheDocument();
  });

  it('does not read an unpinned or per-definition task target', async () => {
    const result = renderWithQueryClient(
      <OntologyReviewPanel task={{ ...task, ontologyReview: undefined }} />
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();

    result.rerender(
      <OntologyReviewPanel
        task={{ ...task, about: { id: 'release-id', type: 'ontologyConcept' } }}
      />
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(get).not.toHaveBeenCalled();
  });
});
