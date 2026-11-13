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
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OntologyApprovalRule } from '../../../../generated/entity/data/ontology';
import { Stage } from '../../../../generated/type/ontologyPublicationStatus';
import type { ReviewSettings } from '../../../../hooks/governance/ontology/useOntologyPublication.types';
import {
  useEnUsTranslations,
  useKeyEchoTranslations,
} from '../../../../test/unit/enUsTranslation';
import type { ReleasePanelView } from './OntologyReleasePanel.types';
import OntologyReleaseReviewers from './OntologyReleaseReviewers';

jest.mock('../../../Glossary/hooks/useEntityReferenceOptions', () => ({
  useUserTeamOptions: () => ({
    options: [],
    isFetching: false,
    isPlaceholderData: false,
    error: null,
    onFocus: jest.fn(),
    onSearchChange: jest.fn(),
    refetch: jest.fn(),
  }),
}));

const reviewer = { id: 'bob', name: 'bob', type: 'user' };

const ready = (settings: ReviewSettings): ReleasePanelView => ({
  kind: 'ready',
  value: {
    stage: Stage.Draft,
    candidate: null,
    settings,
    lock: { kind: 'ready', value: {} },
    excludedIds: [],
    excludedNames: [],
    assignees: [],
    canEditSettings: true,
    canRequestReview: false,
    hasIndependentReviewer: true,
    unpublishedChanges: 1,
  },
});

const anyOne: ReviewSettings = {
  reviewers: [reviewer],
  approvalRule: OntologyApprovalRule.AnyReviewer,
};

const busy = (settings: ReviewSettings): ReleasePanelView => {
  const view = ready(settings);
  if (view.kind === 'ready') {
    view.value.canEditSettings = false;
  }

  return view;
};

describe('OntologyReleaseReviewers approval rule menu while a save refetches', () => {
  beforeEach(() => useEnUsTranslations());

  afterEach(() => useKeyEchoTranslations());

  const all: ReviewSettings = {
    reviewers: [reviewer],
    approvalRule: OntologyApprovalRule.AllReviewers,
  };
  const ruleButton = (name: RegExp) => screen.getByRole('button', { name });

  const setup = () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    let finishSave: () => void = () => undefined;
    const onChange = jest.fn().mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishSave = () => resolve({ kind: 'saved' });
        })
    );
    const props = { scopeKey: 'u:o', onRefresh: jest.fn(), onChange };
    const utils = render(
      <OntologyReleaseReviewers {...props} view={ready(anyOne)} />
    );

    return {
      user,
      onChange,
      finishSave: () => finishSave(),
      show: (view: ReleasePanelView) =>
        utils.rerender(<OntologyReleaseReviewers {...props} view={view} />),
    };
  };

  const startSaveToAll = async (flow: ReturnType<typeof setup>) => {
    await flow.user.click(ruleButton(/^Any one/));
    await flow.user.click(await screen.findByRole('option', { name: 'All' }));
    await waitFor(() => expect(flow.onChange).toHaveBeenCalledTimes(1));
    flow.show(busy(all));
  };

  it('opens the menu during the refetch and applies the pick once the read settles', async () => {
    const flow = setup();
    await startSaveToAll(flow);

    expect(ruleButton(/^All/)).toBeEnabled();

    await flow.user.click(ruleButton(/^All/));
    await flow.user.click(
      await screen.findByRole('option', { name: 'Any one' })
    );

    expect(flow.onChange).toHaveBeenCalledTimes(1);

    flow.finishSave();
    flow.show(ready(all));

    await waitFor(() => expect(flow.onChange).toHaveBeenCalledTimes(2));

    expect(flow.onChange).toHaveBeenLastCalledWith({
      reviewers: [reviewer],
      approvalRule: OntologyApprovalRule.AnyReviewer,
    });
  });

  it('drops a pick made during the refetch when the settings turn out to be locked', async () => {
    const flow = setup();
    await startSaveToAll(flow);
    await flow.user.click(ruleButton(/^All/));
    await flow.user.click(
      await screen.findByRole('option', { name: 'Any one' })
    );

    flow.finishSave();
    flow.show(busy(all));

    await waitFor(() => expect(ruleButton(/^All/)).toBeDisabled());

    expect(flow.onChange).toHaveBeenCalledTimes(1);
  });

  it('keeps the rule disabled for a reader who could not edit before the save', () => {
    const flow = setup();
    flow.show(busy(anyOne));

    expect(ruleButton(/^Any one/)).toBeDisabled();
  });
});
