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

import { render, screen } from '@testing-library/react';
import { act, PropsWithChildren } from 'react';
import { MemoryRouter } from 'react-router-dom';

// The modals pull their own permissions, drives, and form stacks; stub them so
// the layout's intent wiring stays the only thing under test.
jest.mock('../UploadDocumentModal/UploadDocumentModal.component', () => ({
  __esModule: true,
  default: ({ isOpen }: { isOpen?: boolean }) =>
    isOpen ? <div data-open="true" data-testid="upload-modal" /> : null,
}));

jest.mock(
  '../../KnowledgeCenter/QuickLinkFormModal/QuickLinkFormModal',
  () => ({
    QuickLinkFormModal: ({ isOpen }: { isOpen?: boolean }) => (
      <div data-open={String(Boolean(isOpen))} data-testid="quick-link-modal" />
    ),
  })
);

// LiveRefreshBoundary also calls useRouteActivation (to remount children on a
// dirty/maxAge signal). Stub it as a passthrough so only the layout's
// useRouteActivation callback is captured by the mock below.
jest.mock(
  '../../platform/ai-shell/LiveRefreshBoundary/LiveRefreshBoundary',
  () => ({
    LiveRefreshBoundary: ({ children }: PropsWithChildren) => <>{children}</>,
  })
);

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));

jest.mock('../../../hooks/useApplicationStore', () => ({
  useApplicationStore: () => ({ currentUser: { id: 'user-1' } }),
}));

jest.mock('../../../utils/ContextCenterPureUtils', () => ({
  createArticleKnowledgePage: jest.fn(),
}));

// The layout re-claims its intent listeners when its kept-alive route becomes
// visible again; capture that callback so the reactivation can be driven directly.
let routeActivationCallback: (() => void) | undefined;

jest.mock('../../platform/ai-shell/context/useRouteActivation', () => ({
  useRouteActivation: (onActivate: () => void) => {
    routeActivationCallback = onActivate;
  },
}));

import { createArticleKnowledgePage } from '../../../utils/ContextCenterPureUtils';
import { Intent } from '../../platform/ai-shell/AppModule.types';
import { emitIntent, useIntent } from '../../platform/ai-shell/useIntent';
import ContextCenterLayout from './ContextCenterLayout';

// A competing host (e.g. a non-cacheable detail ContextCenterLayout) that
// clobbers all three CTA slots and frees them on unmount.
const IntentProbe = ({ handler }: { handler: () => void }) => {
  useIntent(Intent.UploadFile, handler);
  useIntent(Intent.CreateArticle, handler);
  useIntent(Intent.AddQuickLink, handler);

  return null;
};

const renderLayout = () =>
  render(
    <MemoryRouter>
      <ContextCenterLayout>
        <div data-testid="child-content">Test Content</div>
      </ContextCenterLayout>
    </MemoryRouter>
  );

const articleSpy = createArticleKnowledgePage as jest.MockedFunction<
  typeof createArticleKnowledgePage
>;

describe('ContextCenterLayout', () => {
  it('renders children', () => {
    renderLayout();

    expect(screen.getByTestId('child-content')).toBeInTheDocument();
  });

  it('keeps both modals closed until an intent arrives', () => {
    renderLayout();

    expect(screen.queryByTestId('upload-modal')).not.toBeInTheDocument();
    expect(screen.getByTestId('quick-link-modal')).toHaveAttribute(
      'data-open',
      'false'
    );
  });

  it('opens the upload modal on the UploadFile intent', () => {
    renderLayout();

    act(() => {
      emitIntent(Intent.UploadFile);
    });

    expect(screen.getByTestId('upload-modal')).toBeInTheDocument();
    expect(screen.getByTestId('quick-link-modal')).toHaveAttribute(
      'data-open',
      'false'
    );
  });

  it('creates an article on the CreateArticle intent', () => {
    renderLayout();

    act(() => {
      emitIntent(Intent.CreateArticle);
    });

    expect(articleSpy).toHaveBeenCalledTimes(1);
    expect(articleSpy).toHaveBeenCalledWith('user-1', expect.any(Function));
  });

  it('opens the quick-link modal on the AddQuickLink intent', () => {
    renderLayout();

    act(() => {
      emitIntent(Intent.AddQuickLink);
    });

    expect(screen.getByTestId('quick-link-modal')).toHaveAttribute(
      'data-open',
      'true'
    );
    expect(screen.queryByTestId('upload-modal')).not.toBeInTheDocument();
  });

  it('re-claims its intent listeners when the kept-alive route reactivates', () => {
    renderLayout();

    // A detail host clobbers the three single listener slots and frees them on unmount.
    const other = jest.fn();
    const { unmount } = render(<IntentProbe handler={other} />);
    unmount();

    // Slots are now orphaned (empty): every CTA is a silent no-op.
    act(() => {
      emitIntent(Intent.UploadFile);
    });
    act(() => {
      emitIntent(Intent.CreateArticle);
    });
    act(() => {
      emitIntent(Intent.AddQuickLink);
    });

    expect(other).not.toHaveBeenCalled();
    expect(screen.queryByTestId('upload-modal')).not.toBeInTheDocument();
    expect(screen.getByTestId('quick-link-modal')).toHaveAttribute(
      'data-open',
      'false'
    );
    expect(articleSpy).not.toHaveBeenCalled();

    // The route becomes visible again: the layout re-claims all three slots.
    act(() => {
      routeActivationCallback?.();
    });

    act(() => {
      emitIntent(Intent.UploadFile);
    });
    act(() => {
      emitIntent(Intent.CreateArticle);
    });
    act(() => {
      emitIntent(Intent.AddQuickLink);
    });

    expect(other).not.toHaveBeenCalled();
    expect(screen.getByTestId('upload-modal')).toBeInTheDocument();
    expect(screen.getByTestId('quick-link-modal')).toHaveAttribute(
      'data-open',
      'true'
    );
    expect(articleSpy).toHaveBeenCalledTimes(1);
    expect(articleSpy).toHaveBeenCalledWith('user-1', expect.any(Function));
  });
});
