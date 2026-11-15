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
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Stage } from '../../../../generated/type/ontologyPublicationStatus';
import {
  useEnUsTranslations,
  useKeyEchoTranslations,
} from '../../../../test/unit/enUsTranslation';
import { RELEASE_STAGE_LABELS } from '../OntologyReleasePanel/OntologyReleasePanel.constants';
import OntologyVersionChip from './OntologyVersionChip';

const active = {
  releaseId: 'release',
  releaseRevision: 2,
  semanticVersion: '1.3.2',
  activatedAt: new Date(2026, 7, 14, 12).getTime(),
};

it('shows the active version and locale date and opens release history', async () => {
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  const onPress = jest.fn();
  render(
    <OntologyVersionChip
      status={{ active, unpublishedChanges: 0 }}
      onPress={onPress}
    />
  );

  expect(screen.getByText('v1.3.2 · Aug 14')).toBeVisible();

  await user.tab();

  expect(await screen.findByRole('tooltip')).toHaveTextContent(
    'label.release-history'
  );

  fireEvent.click(screen.getByRole('button', { name: 'v1.3.2 · Aug 14' }));

  expect(onPress).toHaveBeenCalledTimes(1);
});

it.each(Object.values(Stage))('shows %s and unpublished count', (stage) => {
  render(
    <OntologyVersionChip
      status={{
        active,
        latest: { releaseId: 'latest', releaseRevision: 3, stage },
        unpublishedChanges: 4,
      }}
      onPress={jest.fn()}
    />
  );

  expect(screen.getByRole('button')).toHaveTextContent(
    `v1.3.2 · Aug 14 · ${RELEASE_STAGE_LABELS[stage]} · label.ontology-unpublished-count`
  );
});

it('retains an outstanding review stage with zero unpublished changes', () => {
  render(
    <OntologyVersionChip
      status={{
        active,
        latest: {
          releaseId: 'latest',
          releaseRevision: 3,
          stage: Stage.InReview,
        },
        unpublishedChanges: 0,
      }}
      onPress={jest.fn()}
    />
  );

  expect(screen.getByRole('button')).toHaveTextContent(
    'label.ontology-in-review'
  );
  expect(screen.getByRole('button')).not.toHaveTextContent(
    'label.ontology-unpublished-count'
  );
});

it('uses honest draft, missing-status and legacy revision fallbacks', () => {
  const { rerender } = render(<OntologyVersionChip onPress={jest.fn()} />);

  expect(screen.getByRole('button')).toHaveTextContent('label.unavailable');

  rerender(
    <OntologyVersionChip
      status={{ unpublishedChanges: 0 }}
      onPress={jest.fn()}
    />
  );

  expect(screen.getByRole('button')).toHaveTextContent('label.draft');

  rerender(
    <OntologyVersionChip
      status={{
        active: { releaseId: 'r', releaseRevision: 1 },
        unpublishedChanges: 0,
      }}
      onPress={jest.fn()}
    />
  );

  expect(screen.getByRole('button')).toHaveTextContent(
    'label.ontology-release-revision'
  );
});

describe('Draft and Published switch', () => {
  it('marks the version being read and reports the other one when pressed', () => {
    const onVersionChange = jest.fn();
    render(
      <OntologyVersionChip
        status={{ active, unpublishedChanges: 0 }}
        version="draft"
        onPress={jest.fn()}
        onVersionChange={onVersionChange}
      />
    );

    expect(screen.getByTestId('ontology-version-draft')).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByTestId('ontology-version-published')).toHaveAttribute(
      'aria-pressed',
      'false'
    );

    fireEvent.click(screen.getByTestId('ontology-version-published'));

    expect(onVersionChange).toHaveBeenCalledWith('published');
  });

  it('gives an editor only the switch, with no separate release-history button', () => {
    const onPress = jest.fn();
    render(
      <OntologyVersionChip
        status={{ active, unpublishedChanges: 0 }}
        version="published"
        onPress={onPress}
        onVersionChange={jest.fn()}
      />
    );

    expect(
      screen.queryByTestId('ontology-release-history-trigger')
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('ontology-version-published')).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(onPress).not.toHaveBeenCalled();
  });

  it('shows no switch to a user who cannot edit', () => {
    render(
      <OntologyVersionChip
        status={{ active, unpublishedChanges: 0 }}
        onPress={jest.fn()}
      />
    );

    expect(
      screen.queryByTestId('ontology-version-switch')
    ).not.toBeInTheDocument();
    expect(screen.getByText('v1.3.2 · Aug 14')).toBeVisible();
  });
});

describe('a new ontology with its first concept', () => {
  beforeEach(() => {
    useEnUsTranslations();
  });

  afterEach(() => {
    useKeyEchoTranslations();
  });

  it('reads Draft once and counts the concept, not the ontology row', () => {
    render(
      <OntologyVersionChip
        status={{
          latest: {
            releaseId: 'latest',
            releaseRevision: 1,
            stage: Stage.Draft,
          },
          unpublishedChanges: 2,
        }}
        onPress={jest.fn()}
      />
    );

    expect(screen.getByRole('button')).toHaveTextContent(
      /^Draft · 1 unpublished$/
    );
  });

  it('shows plain Draft for an ontology nobody has changed', () => {
    render(
      <OntologyVersionChip
        status={{ unpublishedChanges: 1 }}
        onPress={jest.fn()}
      />
    );

    expect(screen.getByRole('button')).toHaveTextContent(/^Draft$/);
  });
});
