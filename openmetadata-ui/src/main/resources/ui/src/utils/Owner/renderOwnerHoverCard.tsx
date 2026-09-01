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
import type { RenderOwnerContent } from '@openmetadata/ui-core-components';
import { OwnerType } from '../../enums/user.enum';
import UserPopOverCard from '../../components/common/PopOverCard/UserPopOverCard';

/**
 * Wraps an Owner/OwnerAvatarStack chip with the app's rich, REST-backed
 * hover card (name, username, team/role info) — core-components' Owner
 * can't build that card itself since it stays REST-agnostic, so this is
 * the `renderOwnerContent` slot implementation call sites pass in.
 */
export const renderOwnerHoverCard: RenderOwnerContent = (owner, chip) => (
  <UserPopOverCard
    type={owner.type === 'team' ? OwnerType.TEAM : OwnerType.USER}
    userName={owner.name ?? ''}>
    {chip}
  </UserPopOverCard>
);
