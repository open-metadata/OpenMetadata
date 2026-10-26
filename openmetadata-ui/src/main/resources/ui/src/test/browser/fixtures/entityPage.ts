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
import { applyPatch, deepClone, Operation } from 'fast-json-patch';
import { http, HttpResponse } from 'msw';
import { EntityReference, Votes } from '../../../generated/type/votes';
import {
  QueryVote,
  QueryVoteType,
} from '../../../interface/entity/vote.interface';
import { EntityRule } from '../../../interface/platform/ruleEnforcement.interface';
import { worker } from '../msw';

/**
 * The entity rules a fresh server seeds
 * (openmetadata-service/src/main/resources/json/data/settings/entityRulesSettings.json).
 * They decide, e.g., that an asset takes many user owners but a single team.
 */
export const SEEDED_ENTITY_RULES: EntityRule[] = [
  {
    name: 'Multiple Users or Single Team Ownership',
    description:
      'Validates that an entity has either multiple owners or a single team as the owner.',
    rule: '{"multipleUsersOrSingleTeamOwnership":{"var":"owners"}}',
    enabled: true,
    ignoredEntities: [],
    provider: 'system',
  },
  {
    name: 'Multiple Domains are not allowed',
    description:
      'By default, we only allow entities to be assigned to a single domain, except for Users and Teams.',
    rule: '{"<=":[{"length":{"var":"domains"}},1]}',
    enabled: true,
    ignoredEntities: ['user', 'team', 'persona', 'bot', 'query'],
    provider: 'system',
  },
  {
    name: 'Multiple Data Products are not allowed',
    description:
      'By default, we only allow entities to be assigned to a single Data Product.',
    rule: '{"<=":[{"length":{"var":"dataProducts"}},1]}',
    enabled: false,
    ignoredEntities: [],
    provider: 'system',
  },
  {
    name: 'Data Product Domain Validation',
    description:
      "Validates that Data Products assigned to an entity match the entity's domains.",
    rule: '{"validateDataProductDomainMatch":[{"var":"dataProducts"},{"var":"domains"}]}',
    enabled: true,
    ignoredEntities: ['user', 'team', 'persona', 'bot', 'query'],
    provider: 'system',
  },
];

/** Answers the entity-rules lookup with the seeded rules. */
export const serveSeededEntityRules = () =>
  worker.use(
    http.get('/api/v1/system/settings/entityRulesSettings/:entityType', () =>
      HttpResponse.json(SEEDED_ENTITY_RULES)
    )
  );

/** What an entity details page edits: the stored entity plus every write it sent. */
export interface EntityServer<T> {
  /** The entity as the server holds it now, after every write so far. */
  current: () => T;
  /** Each JSON-patch body the page sent, in order. */
  patches: Operation[][];
  /** Each vote body the page sent (`{ updatedVoteType }`), in order. */
  votes: QueryVote[];
  followed: string[];
  unfollowed: string[];
  /** Each async DELETE's query string (`?hardDelete=…&recursive=…`), in order. */
  deletes: string[];
}

type Voted = {
  votes?: Votes;
  followers?: EntityReference[];
  deleted?: boolean;
};

const without = (refs: EntityReference[] = [], id: string) =>
  refs.filter((ref) => ref.id !== id);

/** EntityRepository.updateVote: one vote per user, `unVoted` withdraws it. */
const applyVote = (
  votes: Votes = {},
  vote: QueryVote,
  voter: EntityReference
) => {
  const upVoters = without(votes.upVoters, voter.id);
  const downVoters = without(votes.downVoters, voter.id);
  if (vote.updatedVoteType === QueryVoteType.votedUp) {
    upVoters.push(voter);
  }
  if (vote.updatedVoteType === QueryVoteType.votedDown) {
    downVoters.push(voter);
  }

  return {
    upVoters,
    downVoters,
    upVotes: upVoters.length,
    downVotes: downVoters.length,
  };
};

/**
 * Serves one entity at `/api/v1/<endpoint>` the way the server does: GET by
 * name, PATCH applies the JSON patch and returns the updated entity, votes
 * and followers update it too (as `actor`, the signed-in user). Tests assert
 * on what the page sent (`patches`, `votes`, ...) and on what it shows after
 * the round trip.
 */
export const serveEntity = <T extends { id: string }>(
  endpoint: string,
  entity: T,
  actor: EntityReference = {
    id: '0a8f0c1e-0000-4000-8000-000000000001',
    type: 'user',
  }
): EntityServer<T> => {
  let stored = deepClone(entity) as T & Voted;
  const server: EntityServer<T> = {
    current: () => stored,
    patches: [],
    votes: [],
    followed: [],
    unfollowed: [],
    deletes: [],
  };
  let hardDeleted = false;
  const base = `/api/v1/${endpoint}`;

  worker.use(
    http.get(`${base}/name/:fqn`, () =>
      hardDeleted
        ? HttpResponse.json({ code: 404 }, { status: 404 })
        : HttpResponse.json(stored)
    ),
    http.get(`${base}/:id`, () => HttpResponse.json(stored)),
    // EntityResource.deleteByIdAsync: a soft delete marks the entity
    // deleted, a hard one removes it; either way the job runs later.
    http.delete(`${base}/async/:id`, ({ request }) => {
      const { search, searchParams } = new URL(request.url);
      server.deletes.push(search);
      hardDeleted = searchParams.get('hardDelete') === 'true';
      stored = { ...stored, deleted: true };

      return HttpResponse.json({
        jobId: `delete-job-${server.deletes.length}`,
        message: 'Delete operation initiated',
      });
    }),
    http.put(`${base}/restore`, () => {
      stored = { ...stored, deleted: false };

      return HttpResponse.json(stored);
    }),
    http.patch(`${base}/:id`, async ({ request }) => {
      const ops = (await request.json()) as Operation[];
      server.patches.push(ops);
      stored = applyPatch(deepClone(stored), ops).newDocument;

      return HttpResponse.json(stored);
    }),
    http.put(`${base}/:id/vote`, async ({ request }) => {
      const vote = (await request.json()) as QueryVote;
      server.votes.push(vote);
      stored = { ...stored, votes: applyVote(stored.votes, vote, actor) };

      return HttpResponse.json({ entity: stored });
    }),
    http.put(`${base}/:id/followers`, async ({ request }) => {
      const userId = String(await request.json());
      const follower = { ...actor, id: userId };
      server.followed.push(userId);
      stored = {
        ...stored,
        followers: [...without(stored.followers, userId), follower],
      };

      // The ChangeEvent the server answers with; pages read the follower from it.
      return HttpResponse.json({
        changeDescription: {
          fieldsAdded: [{ name: 'followers', newValue: [follower] }],
        },
      });
    }),
    http.delete(`${base}/:id/followers/:userId`, ({ params }) => {
      const userId = String(params.userId);
      const follower = { ...actor, id: userId };
      server.unfollowed.push(userId);
      stored = { ...stored, followers: without(stored.followers, userId) };

      return HttpResponse.json({
        changeDescription: {
          fieldsDeleted: [{ name: 'followers', oldValue: [follower] }],
        },
      });
    })
  );

  return server;
};
