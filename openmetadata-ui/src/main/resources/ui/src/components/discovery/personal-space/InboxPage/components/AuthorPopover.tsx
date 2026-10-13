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
import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import UserPopOverCard from '../../../../../components/common/PopOverCard/UserPopOverCard';
import { getUserPath } from '../../../../../utils/RouterUtils';

interface AuthorPopoverProps {
  userName: string;
  children: ReactNode;
  // An avatar beside the author's name repeats it: hover only, kept out of the
  // tab order and away from screen readers.
  decorative?: boolean;
}

/**
 * The user card over an author's avatar or name, as elsewhere in the app. The
 * trigger is a link to their profile, so a keyboard reaches the name and its
 * focus opens the card too; an event with no actor has no card to show.
 */
const AuthorPopover = ({
  userName,
  children,
  decorative = false,
}: AuthorPopoverProps) =>
  userName ? (
    <UserPopOverCard userName={userName}>
      <Link
        aria-hidden={decorative || undefined}
        className="tw:text-inherit tw:no-underline"
        data-testid="author-popover-trigger"
        tabIndex={decorative ? -1 : undefined}
        to={getUserPath(userName)}>
        {children}
      </Link>
    </UserPopOverCard>
  ) : (
    <>{children}</>
  );

export default AuthorPopover;
