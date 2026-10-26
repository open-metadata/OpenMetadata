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
import { EntityReference } from '../../../generated/type/entityReference';
import { worker } from '../msw';
import { ADMIN_USER } from './user';

/**
 * A persona is what the server would answer for a signed-in user: the user
 * itself and the operations its roles allow. Operations come from the seeded
 * policies in openmetadata-service/src/main/resources/json/data/, so a test
 * renders exactly the controls that user would get.
 */
export interface Persona {
  user: User;
  /** Unconditional allow rules on every resource. */
  allowed: Operation[];
  /** Unconditional allow rules that name one resource (e.g. `task`). */
  allowedOn?: Record<string, Operation[]>;
  /** Allow rules with an `isOwner()` condition. */
  ifOwner?: Operation[];
  /** Allow rules with a `noOwner()` condition. */
  ifNoOwner?: Operation[];
  /** Unconditional deny rules on every resource; a deny beats any allow. */
  denied?: Operation[];
}

/**
 * A user with `isAdmin`: PolicyEvaluator answers every operation `allow`
 * without consulting any policy.
 */
export const ADMIN: Persona = {
  user: ADMIN_USER,
  allowed: [],
};

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
 * DataConsumer role (DataConsumerPolicy, TaskAuthorPolicy) plus
 * OrganizationPolicy, which every user inherits, for a user who does not own
 * the entity. TaskAuthorPolicy is left out: each of its rules is conditional
 * on the task's filer/assignee, so it never allows anything on a data asset.
 */
export const DATA_CONSUMER: Persona = {
  user: {
    id: '0a8f0c1e-0000-4000-8000-0000000000c5',
    name: 'pw_data_consumer',
    displayName: 'PW Data Consumer',
    fullyQualifiedName: 'pw_data_consumer',
    email: 'pw_data_consumer@open-metadata.org',
    isAdmin: false,
    isBot: false,
    teams: [],
    roles: [
      {
        id: '0a8f0c1e-0000-4000-8000-0000000000e2',
        type: 'role',
        name: 'DataConsumer',
      },
    ],
  },
  allowed: [
    Operation.ViewAll,
    Operation.EditDescription,
    Operation.EditTags,
    Operation.EditGlossaryTerms,
    Operation.EditTier,
    Operation.EditCertification,
    Operation.CreateTask,
    Operation.EditTask,
    Operation.ExecuteSparqlQuery,
  ],
  allowedOn: {
    task: [Operation.Create],
    conversation: [Operation.Create],
    contextMemory: [Operation.Create],
  },
  ifOwner: [Operation.All],
  ifNoOwner: [Operation.EditOwners],
};

/** Operations an allow rule must name; `All` does not grant them (CompiledRule). */
const EXPLICIT_ONLY = [Operation.Impersonate, Operation.ExecuteSparqlQuery];

/**
 * Mirrors CompiledRule.matchOperation: `All` matches every operation, `ViewAll`
 * every View* and `EditAll` every Edit* one. Unmatched operations come back
 * `notAllow`, not `deny`; `deny` only results from an explicit deny rule.
 */
const grantedBy = (operation: Operation): Operation[] => {
  if (EXPLICIT_ONLY.includes(operation)) {
    return [operation];
  }

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

/**
 * The entity a lookup is about. Without one (the resource-level lookups) the
 * server cannot evaluate a condition, so a conditional rule answers
 * `conditionalAllow`; with one, PolicyEvaluator evaluates it against the
 * entity's owners and answers `allow` or leaves `notAllow`.
 */
type Owned = { owners?: EntityReference[] };

/**
 * The conditional grants whose condition holds. Without an entity every one
 * may hold. `isOwner()` is checked against user owners only: these personas
 * belong to no team.
 */
const conditionalGrants = (
  { user, ifOwner = [], ifNoOwner = [] }: Persona,
  entity?: Owned
) => {
  if (!entity) {
    return [...ifOwner, ...ifNoOwner];
  }
  const owners = entity.owners ?? [];

  return [
    ...(owners.some((owner) => owner.id === user.id) ? ifOwner : []),
    ...(owners.length === 0 ? ifNoOwner : []),
  ];
};

const accessFor = (
  persona: Persona,
  resource: string,
  operation: Operation,
  entity?: Owned
) => {
  if (persona.user.isAdmin) {
    return 'allow';
  }
  if (persona.denied?.includes(operation)) {
    return 'deny';
  }
  const unconditional = [
    ...persona.allowed,
    ...(persona.allowedOn?.[resource] ?? []),
  ];

  if (isAllowed(unconditional, operation)) {
    return 'allow';
  }
  if (isAllowed(conditionalGrants(persona, entity), operation)) {
    return entity ? 'allow' : 'conditionalAllow';
  }

  return 'notAllow';
};

const permissionsFor = (
  persona: Persona,
  resource: string,
  entity?: Owned
) => ({
  resource,
  permissions: Object.values(Operation).map((operation) => ({
    operation,
    access: accessFor(persona, resource, operation, entity),
  })),
});

/**
 * Answers every permission lookup the app makes as the persona's server would.
 * `entity` is the one the page shows: lookups by id or name evaluate the
 * persona's conditional rules against its owners at request time.
 */
export const servePersona = (
  persona: Persona,
  entity: () => Owned = () => ({ owners: [] })
) => {
  worker.use(
    http.get('/api/v1/permissions', () =>
      HttpResponse.json({
        data: Object.values(ResourceEntity).map((resource) =>
          permissionsFor(persona, resource)
        ),
      })
    ),
    http.get('/api/v1/permissions/:resource/name/:fqn', ({ params }) =>
      HttpResponse.json(
        permissionsFor(persona, String(params.resource), entity())
      )
    ),
    http.get('/api/v1/permissions/:resource/:id', ({ params }) =>
      HttpResponse.json(
        permissionsFor(persona, String(params.resource), entity())
      )
    ),
    http.get('/api/v1/permissions/:resource', ({ params }) =>
      HttpResponse.json(permissionsFor(persona, String(params.resource)))
    )
  );
};
