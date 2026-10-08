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
import { Users01 } from '@openmetadata/ui-core-components/icons';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TopicCard from './TopicCard';
import { TopicCollapseContext } from './TopicCollapseContext';
import { TopicKey } from './topics.types';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const WIDGET_KEY = 'KnowledgePanel.ActivityFeed-1';
const TONE = { icon: Users01, tile: 'tw:bg-utility-gray-100' };

const renderCard = (props: Partial<Parameters<typeof TopicCard>[0]> = {}) => {
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  const view = render(
    <TopicCard
      isEditView
      summary="Nothing to report"
      title="Team Activity"
      tone={TONE}
      topicKey={TopicKey.TEAM_ACTIVITY}
      widgetKey={WIDGET_KEY}
      {...props}
    />
  );

  return { ...view, user };
};

/**
 * react-aria gates the first tooltip of a session behind a global warmup and
 * opens later ones immediately. Hovering twice makes the assertion independent
 * of which side of that warmup a given test happens to land on.
 */
const openTooltip = async (
  user: ReturnType<typeof userEvent.setup>,
  element: HTMLElement
) => {
  const settle = () =>
    act(async () => {
      jest.advanceTimersByTime(1000);
    });

  await user.hover(element);
  await settle();
  await user.unhover(element);
  await user.hover(element);
  await settle();
};

describe('TopicCard edit-view controls', () => {
  it('renders the controls only in edit view', () => {
    const { unmount } = renderCard({ isEditView: false });

    expect(screen.queryByTestId(`drag-widget-${WIDGET_KEY}`)).toBeNull();
    expect(screen.queryByTestId(`remove-widget-${WIDGET_KEY}`)).toBeNull();

    unmount();
    renderCard();

    expect(screen.getByTestId(`drag-widget-${WIDGET_KEY}`)).toBeInTheDocument();
    expect(
      screen.getByTestId(`remove-widget-${WIDGET_KEY}`)
    ).toBeInTheDocument();
  });

  it('keeps the react-grid-layout drag selector on the handle itself', () => {
    renderCard();

    // `draggableHandle=".drag-widget-icon"` is resolved against the grid item,
    // so the class has to stay on the element the pointer lands on rather than
    // move onto the wrapper Tooltip generates around a non-focusable child.
    expect(screen.getByTestId(`drag-widget-${WIDGET_KEY}`)).toHaveClass(
      'drag-widget-icon'
    );
  });

  it('centres the handle against the button instead of seating it on the baseline', () => {
    renderCard();

    const handle = screen.getByTestId(`drag-widget-${WIDGET_KEY}`);

    // An inline box is sized by line-height and seats its icon on the baseline,
    // which rides above the centre the row's `items-center` aligns to. Both the
    // handle and the wrapper around it have to be boxes for the dots to line up
    // with the trash icon beside them.
    expect(handle).toHaveClass('tw:flex');
    expect(handle.parentElement).toHaveClass('tw:flex');
  });

  it('shows a tooltip on the drag handle without making it a tab stop', async () => {
    const { user } = renderCard();
    const handle = screen.getByTestId(`drag-widget-${WIDGET_KEY}`);

    // Dragging is pointer-only, so the generated wrapper must not add a tab
    // stop that leads nowhere.
    expect(handle.closest('[tabindex]')).toBeNull();

    await openTooltip(user, handle);

    expect(screen.getByRole('tooltip')).toHaveTextContent('label.reposition');
  });

  it('shows a tooltip on the remove button and leaves it a single button', async () => {
    const { user } = renderCard();
    const remove = screen.getByTestId(`remove-widget-${WIDGET_KEY}`);

    expect(remove).toHaveAccessibleName('label.remove');
    // The deprecated TooltipTrigger wrapper renders an AriaButton around its
    // child, nesting a button inside a button and giving one control two tab
    // stops. Passing the button straight to Tooltip wires it up without that.
    expect(screen.getAllByRole('button')).toHaveLength(1);

    await openTooltip(user, remove);

    expect(screen.getByRole('tooltip')).toHaveTextContent('label.remove');
  });

  it('calls handleRemoveWidget with the grid instance key', async () => {
    const handleRemoveWidget = jest.fn();
    const { user } = renderCard({ handleRemoveWidget });

    await user.click(screen.getByTestId(`remove-widget-${WIDGET_KEY}`));

    expect(handleRemoveWidget).toHaveBeenCalledWith(WIDGET_KEY);
  });
});

describe('TopicCard loading state', () => {
  const renderLoading = (isLoading: boolean) =>
    render(
      <TopicCard
        isLoading={isLoading}
        meta="Updated 20 min ago"
        status={{ color: 'gray', label: '3 updates' }}
        summary="Nothing to report"
        title="Team Activity"
        tone={TONE}
        topicKey={TopicKey.TEAM_ACTIVITY}
        widgetKey={WIDGET_KEY}>
        <div data-testid="body">Real body</div>
      </TopicCard>
    );

  it('replaces the derived content while the widget fetches', () => {
    renderLoading(true);

    // Summary, status and body are all derived from counts that start at zero,
    // so showing them mid-fetch states something false ("Nothing to report")
    // and then corrects it.
    expect(
      screen.getByTestId(`topic-summary-skeleton-${TopicKey.TEAM_ACTIVITY}`)
    ).toBeInTheDocument();
    expect(
      screen.getByTestId(`topic-body-skeleton-${TopicKey.TEAM_ACTIVITY}`)
    ).toBeInTheDocument();
    expect(screen.queryByText('Nothing to report')).toBeNull();
    expect(screen.queryByTestId('body')).toBeNull();
    expect(
      screen.queryByTestId(`topic-status-${TopicKey.TEAM_ACTIVITY}`)
    ).toBeNull();
    expect(screen.queryByText('Updated 20 min ago')).toBeNull();
  });

  it('keeps the title so the card stays identifiable and does not shift', () => {
    renderLoading(true);

    expect(screen.getByText('Team Activity')).toBeInTheDocument();
  });

  it('shows the real content once the fetch settles', () => {
    renderLoading(false);

    expect(
      screen.queryByTestId(`topic-summary-skeleton-${TopicKey.TEAM_ACTIVITY}`)
    ).toBeNull();
    expect(
      screen.queryByTestId(`topic-body-skeleton-${TopicKey.TEAM_ACTIVITY}`)
    ).toBeNull();
    expect(screen.getByText('Nothing to report')).toBeInTheDocument();
    expect(screen.getByTestId('body')).toBeInTheDocument();
    expect(screen.getByText('Updated 20 min ago')).toBeInTheDocument();
  });

  it('renders a body skeleton even for a card that has no children', () => {
    render(
      <TopicCard
        isLoading
        summary="x"
        title="Team Activity"
        tone={TONE}
        topicKey={TopicKey.TEAM_ACTIVITY}
        widgetKey={WIDGET_KEY}
      />
    );

    expect(
      screen.getByTestId(`topic-body-skeleton-${TopicKey.TEAM_ACTIVITY}`)
    ).toBeInTheDocument();
  });
});

describe('TopicCard collapse chevron', () => {
  const renderWithCollapse = (isCollapsed: boolean, toggle = jest.fn()) => {
    const view = render(
      <TopicCollapseContext.Provider
        value={{ isCollapsed: () => isCollapsed, isEnabled: true, toggle }}>
        <TopicCard
          meta="Updated 20 min ago"
          summary="Nothing to report"
          title="Team Activity"
          tone={TONE}
          topicKey={TopicKey.TEAM_ACTIVITY}
          widgetKey={WIDGET_KEY}>
          <div data-testid="body">Real body</div>
        </TopicCard>
      </TopicCollapseContext.Provider>
    );

    return { ...view, toggle };
  };

  // No provider means a surface that does not offer collapsing -- the persona
  // editor, where the card already carries a drag handle and a remove button.
  it('is absent without a provider', () => {
    renderCard({ isEditView: false });

    expect(screen.queryByTestId(`toggle-widget-${WIDGET_KEY}`)).toBeNull();
  });

  it('hides the body and footer when collapsed, keeping the header', () => {
    renderWithCollapse(true);

    expect(screen.getByText('Team Activity')).toBeInTheDocument();
    expect(screen.queryByTestId('body')).toBeNull();
    expect(screen.queryByText('Updated 20 min ago')).toBeNull();
  });

  it('shows the body and footer when expanded', () => {
    renderWithCollapse(false);

    expect(screen.getByTestId('body')).toBeInTheDocument();
    expect(screen.getByText('Updated 20 min ago')).toBeInTheDocument();
  });

  it('reports its state to assistive tech and toggles on press', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const { toggle } = renderWithCollapse(false);
    const chevron = screen.getByTestId(`toggle-widget-${WIDGET_KEY}`);

    expect(chevron).toHaveAttribute('aria-expanded', 'true');

    await user.click(chevron);

    expect(toggle).toHaveBeenCalledWith(WIDGET_KEY);
  });

  // Expanded the card fills its grid cell so the body can scroll inside it;
  // collapsed it is only a header, and stretching left an empty half-card
  // hanging below the summary.
  it('hugs its header when collapsed and fills the cell when expanded', () => {
    const { unmount } = renderWithCollapse(true);

    expect(
      screen.getByTestId(`topic-card-${TopicKey.TEAM_ACTIVITY}`)
    ).toHaveClass('tw:h-auto');

    unmount();
    renderWithCollapse(false);

    expect(
      screen.getByTestId(`topic-card-${TopicKey.TEAM_ACTIVITY}`)
    ).toHaveClass('tw:h-full');
  });

  it('reports the collapsed state and is named by the card it belongs to', () => {
    renderWithCollapse(true);
    const toggle = screen.getByTestId(`toggle-widget-${WIDGET_KEY}`);

    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    // Named by its own content rather than an aria-label, so a screen reader
    // announces which card is collapsing instead of a bare "Expand".
    expect(toggle).toHaveAccessibleName(
      expect.stringContaining('Team Activity')
    );
  });

  // The whole strip is the target, not the 26px chevron: the card is otherwise
  // inert, and the header is what a reader aims at.
  it('makes the title strip itself the control', () => {
    renderWithCollapse(false);
    const toggle = screen.getByTestId(`toggle-widget-${WIDGET_KEY}`);

    expect(toggle.tagName).toBe('BUTTON');
    expect(toggle).toContainElement(screen.getByText('Team Activity'));
    expect(toggle).toContainElement(screen.getByText('Nothing to report'));
    // One control, not a strip plus a nested chevron button.
    expect(toggle.querySelectorAll('button')).toHaveLength(0);
  });
});

describe('TopicCard error and refetch states', () => {
  const renderState = (props: Partial<Parameters<typeof TopicCard>[0]>) =>
    render(
      <TopicCard
        meta="12 more"
        status={{ color: 'warning', label: '3 unowned' }}
        summary="0 domains"
        title="Domains"
        tone={TONE}
        topicKey={TopicKey.DOMAINS}
        widgetKey={WIDGET_KEY}
        {...props}>
        <div data-testid="body">No domains yet.</div>
      </TopicCard>
    );

  // A failed fetch leaves every count at zero, and the body used to render its
  // empty-state copy — "No domains yet." — for an estate it never saw.
  it('replaces the body, summary, status and meta when the fetch failed', () => {
    renderState({ isError: true });

    expect(screen.getByTestId('topic-error-domains')).toBeInTheDocument();
    expect(screen.queryByTestId('body')).toBeNull();
    expect(screen.queryByText('0 domains')).toBeNull();
    expect(
      screen.getByText('message.something-went-wrong')
    ).toBeInTheDocument();
    expect(screen.queryByTestId('topic-status-domains')).toBeNull();
    expect(screen.queryByText('12 more')).toBeNull();
  });

  it('offers a retry when the widget can refetch', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const onRetry = jest.fn();
    renderState({ isError: true, onRetry });

    await user.click(screen.getByRole('button', { name: 'label.retry' }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('shows the skeleton, not the error, while the first load is in flight', () => {
    renderState({ isError: true, isLoading: true });

    expect(screen.queryByTestId('topic-error-domains')).toBeNull();
    expect(
      screen.getByTestId(`topic-body-skeleton-${TopicKey.DOMAINS}`)
    ).toBeInTheDocument();
  });

  // A filter lives in the body; swapping the body for a skeleton on every
  // refetch unmounted it mid-interaction. A refetch only dims.
  it('keeps the body mounted and marks it busy during a refetch', () => {
    renderState({ isFetching: true });

    expect(screen.getByTestId('body')).toBeInTheDocument();
    expect(
      screen.getByTestId(`topic-body-${TopicKey.DOMAINS}`)
    ).toHaveAttribute('aria-busy', 'true');
  });
});
