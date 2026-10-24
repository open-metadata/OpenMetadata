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
import { http, HttpResponse } from 'msw';
import { ResourceEntity } from '../../../enums/permissions.enum';
import { Operation } from '../../../generated/entity/policies/policy';
import { User } from '../../../generated/entity/teams/user';
import { worker } from '../msw';

/**
 * A persona is what the server would answer for a signed-in user: the user
 * itself and the operations its roles allow. Operations come from the seeded
 * policies in openmetadata-service/src/main/resources/json/data/, so a test
 * renders exactly the controls that user would get.
 */
export interface Persona {
  user: User;
  allowed: Operation[];
}

/**
 * DataSteward role (DataStewardPolicy) plus what every user inherits from the
 * Organization team (DataConsumer role, OrganizationPolicy), for a user who
 * does not own the entity.
 */
export const DATA_STEWARD: Persona = {
  user: {
    id: '0a8f0c1e-0000-4000-8000-0000000000d5',
    name: 'pw_data_steward',
    displayName: 'PW Data Steward',
    fullyQualifiedName: 'pw_data_steward',
    email: 'pw_data_steward@open-metadata.org',
    isAdmin: false,
    isBot: false,
    teams: [],
    roles: [
      {
        id: '0a8f0c1e-0000-4000-8000-0000000000e1',
        type: 'role',
        name: 'DataSteward',
      },
    ],
  },
  allowed: [
    Operation.ViewAll,
    Operation.EditDescription,
    Operation.EditDisplayName,
    Operation.EditLineage,
    Operation.EditOwners,
    Operation.EditTags,
    Operation.EditTier,
    Operation.EditGlossaryTerms,
    Operation.EditCertification,
    Operation.Trigger,
  ],
};

/**
 * Mirrors CompiledRule.matchOperation: `All` matches every operation, `ViewAll`
 * every View* and `EditAll` every Edit* one. Unmatched operations come back
 * `notAllow`, not `deny`; `deny` only results from an explicit deny rule.
 */
const grantedBy = (operation: Operation): Operation[] => {
  if (operation.startsWith('View')) {
    return [Operation.All, Operation.ViewAll, operation];
  }

  if (operation.startsWith('Edit')) {
    return [Operation.All, Operation.EditAll, operation];
  }

  return [Operation.All, operation];
};

const isAllowed = (allowed: Operation[], operation: Operation) =>
  grantedBy(operation).some((grant) => allowed.includes(grant));

const permissionsFor = (allowed: Operation[], resource = 'all') => ({
  resource,
  permissions: Object.values(Operation).map((operation) => ({
    operation,
    access: isAllowed(allowed, operation) ? 'allow' : 'notAllow',
  })),
});

/** Answers every permission lookup the app makes as the persona's server would. */
export const servePersona = ({ allowed }: Persona) => {
  worker.use(
    http.get('/api/v1/permissions', () =>
      HttpResponse.json({
        data: Object.values(ResourceEntity).map((resource) =>
          permissionsFor(allowed, resource)
        ),
      })
    ),
    http.get('/api/v1/permissions/*', () =>
      HttpResponse.json(permissionsFor(allowed))
    )
  );
};
