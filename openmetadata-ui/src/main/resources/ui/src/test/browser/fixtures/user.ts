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
import { User } from '../../../generated/entity/teams/user';

export const ADMIN_USER: User = {
  id: '0a8f0c1e-0000-4000-8000-000000000001',
  name: 'admin',
  fullyQualifiedName: 'admin',
  email: 'admin@open-metadata.org',
  isAdmin: true,
  isBot: false,
  teams: [],
  roles: [],
};
