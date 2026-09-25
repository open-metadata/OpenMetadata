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
import { EntityType } from '../../../enums/entity.enum';
import { EntityReference } from '../../../generated/entity/type';
import { LabelType, State, TagSource } from '../../../generated/type/tagLabel';
import {
  GLOSSARY_FORM_DEFAULTS,
  hasOwnerRuleViolation,
  toEntityReferenceOption,
  transformGlossaryFormData,
} from './AddGlossary.utils';

const user = (id: string): EntityReference => ({
  id,
  type: EntityType.USER,
  name: id,
  fullyQualifiedName: id,
});

const team = (id: string): EntityReference => ({
  id,
  type: EntityType.TEAM,
  name: id,
  fullyQualifiedName: id,
});

describe('toEntityReferenceOption', () => {
  it('keeps the reference as the value and labels it by display name', () => {
    const reference = { ...user('u1'), displayName: 'User One' };

    expect(toEntityReferenceOption(reference)).toEqual({
      id: 'u1',
      label: 'User One',
      supportingText: 'u1',
      value: reference,
    });
  });
});

describe('transformGlossaryFormData', () => {
  it('trims names, unwraps pickers and maps domains to FQNs', () => {
    const tag = {
      tagFQN: 'PII.Sensitive',
      source: TagSource.Classification,
      labelType: LabelType.Manual,
      state: State.Confirmed,
    };

    const payload = transformGlossaryFormData(
      {
        ...GLOSSARY_FORM_DEFAULTS,
        name: '  Business ',
        displayName: ' Business Glossary ',
        description: 'Terms',
        tags: [tag],
        mutuallyExclusive: true,
        owners: [toEntityReferenceOption(team('t1'))],
        reviewers: [toEntityReferenceOption(user('u2'))],
        domains: [
          toEntityReferenceOption({
            id: 'd1',
            type: EntityType.DOMAIN,
            fullyQualifiedName: 'Finance',
          }),
        ],
      },
      'me'
    );

    expect(payload).toEqual({
      name: 'Business',
      displayName: 'Business Glossary',
      description: 'Terms',
      tags: [tag],
      mutuallyExclusive: true,
      owners: [team('t1')],
      reviewers: [user('u2')],
      domains: ['Finance'],
    });
  });

  it('assigns the current user as owner and omits empty domains', () => {
    const payload = transformGlossaryFormData(
      { ...GLOSSARY_FORM_DEFAULTS, name: 'G', description: 'D' },
      'me'
    );

    expect(payload.owners).toEqual([{ id: 'me', type: 'user' }]);
    expect(payload.domains).toBeUndefined();
    expect(payload.mutuallyExclusive).toBe(false);
  });
});

describe('hasOwnerRuleViolation', () => {
  const singleTeamRule = {
    canAddMultipleUserOwners: true,
    canAddMultipleTeamOwner: false,
  };

  it('allows any combination when no rule restricts owners', () => {
    expect(
      hasOwnerRuleViolation([
        toEntityReferenceOption(team('t1')),
        toEntityReferenceOption(team('t2')),
        toEntityReferenceOption(user('u1')),
      ])
    ).toBe(false);
  });

  it('allows several users or exactly one team under the single-team rule', () => {
    expect(
      hasOwnerRuleViolation(
        [
          toEntityReferenceOption(user('u1')),
          toEntityReferenceOption(user('u2')),
        ],
        singleTeamRule
      )
    ).toBe(false);
    expect(
      hasOwnerRuleViolation(
        [toEntityReferenceOption(team('t1'))],
        singleTeamRule
      )
    ).toBe(false);
  });

  it('rejects a team combined with other owners under the single-team rule', () => {
    expect(
      hasOwnerRuleViolation(
        [
          toEntityReferenceOption(team('t1')),
          toEntityReferenceOption(user('u1')),
        ],
        singleTeamRule
      )
    ).toBe(true);
    expect(
      hasOwnerRuleViolation(
        [
          toEntityReferenceOption(team('t1')),
          toEntityReferenceOption(team('t2')),
        ],
        singleTeamRule
      )
    ).toBe(true);
  });

  it('rejects several users when multiple user owners are disallowed', () => {
    expect(
      hasOwnerRuleViolation(
        [
          toEntityReferenceOption(user('u1')),
          toEntityReferenceOption(user('u2')),
        ],
        { canAddMultipleUserOwners: false, canAddMultipleTeamOwner: true }
      )
    ).toBe(true);
  });
});
