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

import { FC } from 'react';
import { Link } from 'react-router-dom';
import type { ProfileHashLinkProps } from './Members.types';
import { toHashLocation } from './profileHash.utils';

const ProfileHashLink: FC<ProfileHashLinkProps> = ({
  target,
  onNavigate,
  children,
}) => (
  <Link
    to={toHashLocation(target)}
    onClick={(e) => {
      // Let the browser handle modifier/middle clicks so the hash link opens in
      // a new tab; only intercept a plain left click for in-app navigation.
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) {
        return;
      }
      e.preventDefault();
      onNavigate(target);
    }}>
    {children}
  </Link>
);

export default ProfileHashLink;
