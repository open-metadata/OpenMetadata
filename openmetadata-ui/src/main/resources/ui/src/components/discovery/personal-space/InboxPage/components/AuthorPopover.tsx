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
import UserPopOverCard from '../../../../../components/common/PopOverCard/UserPopOverCard';

interface AuthorPopoverProps {
  userName: string;
  children: ReactNode;
}

/**
 * The user card on hover over an author's avatar or name, as elsewhere in the
 * app. The popover listens on a plain span, since the core Avatar does not
 * forward mouse events; an event with no actor has no card to show.
 */
const AuthorPopover = ({ userName, children }: AuthorPopoverProps) =>
  userName ? (
    <UserPopOverCard userName={userName}>
      <span className="tw:cursor-pointer" data-testid="author-popover-trigger">
        {children}
      </span>
    </UserPopOverCard>
  ) : (
    <>{children}</>
  );

export default AuthorPopover;
