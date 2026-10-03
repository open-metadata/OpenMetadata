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

import { FC, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ProfileHashTarget, toHashLocation } from './profileHash.utils';

interface ProfileHashLinkProps {
  target: ProfileHashTarget;
  /** Writes the hash synchronously (setHash); a plain react-router push is not
   * mirrored into useSettingsHash, so href-only navigation would not switch the
   * in-modal view. The href is kept for middle-click / open-in-new-tab. */
  onNavigate: (target: ProfileHashTarget) => void;
  children: ReactNode;
}

const ProfileHashLink: FC<ProfileHashLinkProps> = ({
  target,
  onNavigate,
  children,
}) => (
  <Link
    to={toHashLocation(target)}
    onClick={(e) => {
      e.preventDefault();
      onNavigate(target);
    }}>
    {children}
  </Link>
);

export default ProfileHashLink;
