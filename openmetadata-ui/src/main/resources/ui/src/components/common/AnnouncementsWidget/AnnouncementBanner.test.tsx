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
  jest.fn().mockImplementation(({ markdown }) => <div>{markdown}</div>)
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
        announcementType: AnnouncementType.Warning,
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
        announcementType: AnnouncementType.Custom,
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

  it('should render a plain title when the banner is not clickable', () => {
    renderBanner();

    expect(
      screen.queryByTestId('announcement-title-btn')
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

    const banner = screen.getByTestId('announcement-banner');
    const chip = banner.querySelector('span.tw\\:rounded-full');
    const title = screen.getByText('Pipeline maintenance');

    // The chip sits in the header row; the title is its sibling's sibling, not a
    // descendant of the column the chip opens — that nesting is what indented it.
    expect(chip?.parentElement?.contains(title)).toBe(false);
  });

  it('should not nest the title button inside the tooltip trigger button', () => {
    renderBanner({ onClick: jest.fn() });

    const titleButton = screen.getByTestId('announcement-title-btn');

    // Typography's own ellipsis tooltip wraps a non-focusable node in an
    // AriaButton; applied inside this button it produced button-in-button,
    // which is invalid and threw the row's vertical alignment out.
    expect(titleButton.querySelector('button')).toBeNull();
    expect(titleButton.closest('button')).toBe(titleButton);
  });
});
