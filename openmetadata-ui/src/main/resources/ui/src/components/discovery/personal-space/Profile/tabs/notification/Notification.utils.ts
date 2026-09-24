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

import type { NotificationView } from './Notification.types';

export function hashSubPathToView(subPath: string): NotificationView {
  if (!subPath) {
    return { type: 'landing' };
  }

  const parts = subPath.split('/');

  if (parts[0] === 'alerts') {
    if (!parts[1]) {
      return { type: 'list' };
    }

    if (parts[1] === 'add') {
      return { type: 'add' };
    }

    if (parts[1] === 'edit' && parts[2]) {
      return { type: 'edit', fqn: parts.slice(2).join('/') };
    }

    return { type: 'detail', fqn: parts.slice(1).join('/'), name: parts[1] };
  }

  return { type: 'landing' };
}

export function viewToSubPath(view: NotificationView): string | undefined {
  switch (view.type) {
    case 'landing':
      return undefined;
    case 'list':
      return 'alerts';
    case 'add':
      return 'alerts/add';
    case 'edit':
      return `alerts/edit/${view.fqn}`;
    case 'detail':
      return `alerts/${view.fqn}`;
    default:
      return undefined;
  }
}
