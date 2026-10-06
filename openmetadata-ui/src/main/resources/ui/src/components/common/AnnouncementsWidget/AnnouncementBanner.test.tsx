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

import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  AnnouncementColor,
  AnnouncementType,
} from '../../../generated/entity/feed/announcement';
import { AnnouncementEntity } from '../../../rest/announcementsAPI';
import AnnouncementBanner from './AnnouncementBanner.component';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('../../../hooks/user-profile/useUserProfile', () => ({
  useUserProfile: () => [undefined, undefined, { displayName: 'Admin User' }],
}));

jest.mock('../ProfilePicture/ProfilePicture', () =>
  jest.fn().mockReturnValue(<span>ProfilePicture</span>)
);

jest.mock('../RichTextEditor/RichTextEditorPreviewerV1', () =>
  jest
    .fn()
    .mockImplementation(
      ({ markdown, ...rest }: { markdown: string; 'data-testid'?: string }) => (
        <div data-testid={rest['data-testid']}>{markdown}</div>
      )
    )
);

const announcement: AnnouncementEntity = {
  id: 'a-1',
  name: 'pipeline-maintenance',
  displayName: 'Pipeline maintenance',
  description: 'Ingestion is paused on Sat Aug 22.',
  entityLink: '<#E::table::service.db.schema.table>',
  startTime: 1,
  endTime: 2,
  createdBy: 'admin',
};

const renderBanner = (
  props: Partial<Parameters<typeof AnnouncementBanner>[0]> = {}
) =>
  render(<AnnouncementBanner announcement={announcement} {...props} />, {
    wrapper: MemoryRouter,
  });

describe('AnnouncementBanner', () => {
  it('should tint the banner with the type colour and label it', () => {
    renderBanner({
      announcement: {
        ...announcement,
        type: AnnouncementType.Warning,
      },
    });

    expect(screen.getByTestId('announcement-banner')).toHaveClass(
      'tw:bg-utility-warning-50'
    );
    expect(screen.getByTestId('announcement-type-badge')).toHaveTextContent(
      'label.warning'
    );
  });

  it('should use the stored colour for a Custom announcement', () => {
    renderBanner({
      announcement: {
        ...announcement,
        type: AnnouncementType.Custom,
        color: AnnouncementColor.Success,
      },
    });

    expect(screen.getByTestId('announcement-banner')).toHaveClass(
      'tw:bg-utility-success-50'
    );
  });

  it('should collapse to a flattened one-line description by default', () => {
    renderBanner();

    expect(screen.getByTestId('announcement-description')).toHaveTextContent(
      'Ingestion is paused on Sat Aug 22.'
    );
    expect(screen.queryByText('ProfilePicture')).not.toBeInTheDocument();
  });

  it('should reveal the author only once expanded', () => {
    renderBanner({ expanded: true });

    expect(screen.getByText('ProfilePicture')).toBeInTheDocument();
    expect(screen.getByText('Admin User')).toBeInTheDocument();
  });

  it('should label the toggle View when collapsed and Hide when expanded', () => {
    const onToggleExpand = jest.fn();
    const { rerender } = renderBanner({ onToggleExpand });

    expect(screen.getByTestId('announcement-toggle-btn')).toHaveTextContent(
      'label.view'
    );

    fireEvent.click(screen.getByTestId('announcement-toggle-btn'));

    expect(onToggleExpand).toHaveBeenCalledTimes(1);

    rerender(
      <AnnouncementBanner
        expanded
        announcement={announcement}
        onToggleExpand={onToggleExpand}
      />
    );

    expect(screen.getByTestId('announcement-toggle-btn')).toHaveTextContent(
      'label.hide'
    );
  });

  it('should expose the title as the click target and keep dismiss separate', () => {
    const onClick = jest.fn();
    const onDismiss = jest.fn();
    renderBanner({ onClick, onDismiss });

    fireEvent.click(screen.getByTestId('announcement-dismiss-btn'));

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onClick).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('announcement-title-btn'));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('should not render the click overlay when the banner is not clickable', () => {
    renderBanner();

    expect(
      screen.queryByTestId('announcement-open-btn')
    ).not.toBeInTheDocument();
    expect(screen.getByText('Pipeline maintenance')).toBeInTheDocument();
  });

  it('should hide the expand toggle in the full variant', () => {
    renderBanner({ variant: 'full', onToggleExpand: jest.fn() });

    expect(
      screen.queryByTestId('announcement-toggle-btn')
    ).not.toBeInTheDocument();
    expect(screen.getByText('ProfilePicture')).toBeInTheDocument();
  });

  it('should leave the entity out of the expanded strip but keep it on the landing banner', () => {
    const { rerender } = renderBanner({ expanded: true });

    // On an entity's own page the FQN just repeats the page you are looking at.
    expect(
      screen.queryByText('service.db.schema.table')
    ).not.toBeInTheDocument();

    rerender(<AnnouncementBanner announcement={announcement} variant="full" />);

    expect(screen.getByText('service.db.schema.table')).toBeInTheDocument();
  });

  it('should not indent the expanded title past the type chip', () => {
    renderBanner({ expanded: true });

    const badge = within(screen.getByTestId('announcement-banner')).getByTestId(
      'announcement-type-badge'
    );
    const title = screen.getByText('Pipeline maintenance');

    // The badge shares the header row with the type icon; the title is that
    // row's sibling, not a descendant — that nesting is what indented it.
    expect(badge.parentElement?.contains(title)).toBe(false);
  });

  it('should give the clickable title exactly one button', () => {
    renderBanner({ onClick: jest.fn() });

    const trigger = screen
      .getByTestId('announcement-title-btn')
      .closest('button');

    // Tooltip generates the focusable trigger itself — it wraps even a native
    // `<button>` child in an AriaButton, so rendering our own around the text
    // produced button-in-button, which is invalid and threw the row's vertical
    // alignment out.
    expect(trigger).not.toBeNull();
    expect(trigger?.querySelector('button')).toBeNull();
    expect(trigger?.parentElement?.closest('button')).toBeNull();
  });

  it('should let the clickable title truncate rather than size to its text', () => {
    renderBanner({ onClick: jest.fn() });

    // `Tooltip` gives its generated trigger `w-max`, which on its own would size
    // it to the untruncated title and leave the ellipsis nothing to clip. Core's
    // ellipsis trigger caps that with `max-w-full`, and the host supplies the
    // `min-w-0` that lets it shrink below its content.
    const trigger = screen
      .getByTestId('announcement-title-btn')
      .closest('button');

    expect(trigger).toHaveClass('tw:max-w-full', 'tw:min-w-0');
  });

  it('should keep the ellipsis tooltip trigger left-aligned', () => {
    renderBanner({ onClick: jest.fn() });

    // The trigger is a `<button>`, whose UA `text-align: center` preflight does
    // not reset. Core gives it `[text-align:inherit]`, which cures that but then
    // follows the ancestors — so the host has to state the alignment, or the
    // title drifts to the middle wherever the host stretches.
    const trigger = screen
      .getByTestId('announcement-description')
      .closest('button');

    expect(trigger).toHaveClass('tw:[text-align:inherit]');
    expect(trigger?.parentElement).toHaveClass('tw:text-start');
  });

  it('should show the expanded title in full, with no tooltip trigger', () => {
    renderBanner({ expanded: true, onClick: jest.fn() });

    const title = screen.getByTestId('announcement-title-btn');

    // Expanded there is room to wrap, so the title is not truncated and needs no
    // tooltip repeating text already on screen. No tooltip means Typography
    // builds no trigger `<button>` — which is also what kept centring it, since
    // a button's UA `text-align: center` beats an inherited value.
    expect(title.closest('button')).toBeNull();
    expect(title).not.toHaveClass('tw:truncate');
    // Nothing clips it now, so it has to fit by wrapping — a title with no break
    // points would otherwise push itself and the badge past the banner's edge.
    expect(title).toHaveClass('tw:min-w-0', 'tw:break-words');
  });

  it('should still truncate the collapsed title and keep its tooltip', () => {
    renderBanner({ onClick: jest.fn() });

    const title = screen.getByTestId('announcement-title-btn');

    expect(title).toHaveClass('tw:truncate');
    expect(title.closest('button')).not.toBeNull();
  });

  it('should make the whole banner clickable through a separate overlay', () => {
    const onClick = jest.fn();
    renderBanner({ onClick, onDismiss: jest.fn() });

    // The banner cannot be the button — it holds the dismiss control, and ARIA
    // makes a button's descendants presentational. A transparent overlay is the
    // click target instead, and the controls are lifted back above it.
    const overlay = screen.getByTestId('announcement-open-btn');

    // `isolate` keeps those z-indexes inside the banner. Without it they land
    // in the root stacking context and paint over the announcement drawer,
    // whose overlay is `fixed` with no z-index of its own.
    expect(screen.getByTestId('announcement-banner')).toHaveClass(
      'tw:relative',
      'tw:isolate'
    );
    expect(overlay).toHaveClass('tw:absolute', 'tw:inset-0', 'tw:z-10');
    expect(
      screen.getByTestId('announcement-dismiss-btn').closest('div')
    ).toHaveClass('tw:relative', 'tw:z-20');

    fireEvent.click(overlay);

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('should keep the rendered description above the overlay when expanded', () => {
    const { rerender } = renderBanner({ expanded: true, onClick: jest.fn() });

    // Rendered markdown carries links and mentions and people select it, so it
    // cannot sit under the overlay — every click there would open the drawer.
    expect(
      screen.getByTestId('announcement-description').parentElement
    ).toHaveClass('tw:relative', 'tw:z-20');

    rerender(
      <AnnouncementBanner
        announcement={announcement}
        variant="full"
        onClick={jest.fn()}
      />
    );

    expect(
      screen.getByTestId('announcement-description').parentElement
    ).toHaveClass('tw:relative', 'tw:z-20');
  });

  it('should give the title and the description each their own tooltip', () => {
    const onClick = jest.fn();
    renderBanner({ onClick });

    // Hanging the overlay off the title's trigger made every hover on the
    // banner pop the title's tooltip, and the description never showed its own.
    // Each label owns its trigger now, and both sit above the overlay.
    for (const testId of [
      'announcement-title-btn',
      'announcement-description',
    ]) {
      const trigger = screen.getByTestId(testId).closest('button');

      expect(trigger).not.toBeNull();
      expect(trigger?.parentElement).toHaveClass('tw:relative', 'tw:z-20');
    }

    fireEvent.click(screen.getByTestId('announcement-description'));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('should put the badge beside the title on the landing banner', () => {
    render(<AnnouncementBanner announcement={announcement} variant="full" />, {
      wrapper: MemoryRouter,
    });

    const badge = screen.getByTestId('announcement-type-badge');
    const title = screen.getByText('Pipeline maintenance');

    // The frame runs title and badge on one line, unlike the expanded strip
    // where the badge sits in its own header row above the title. The title is
    // wrapped by its tooltip trigger, so compare the enclosing flex row.
    // From the parent: Badge's own class list contains `items-center`, so
    // `closest` from the badge matches the badge.
    const row = badge.parentElement?.closest('[class*="items-center"]');

    expect(row).not.toBeNull();
    expect(row?.contains(title)).toBe(true);
  });
});
