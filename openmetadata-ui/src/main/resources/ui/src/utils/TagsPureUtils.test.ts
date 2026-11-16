/*
 *  Copyright 2025 Collate.
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
import { UIPermission } from '../context/PermissionProvider/PermissionProvider.interface';
import { EntityType } from '../enums/entity.enum';
import { ResourceEntity } from '../enums/permissions.enum';
import { Operation } from '../generated/entity/policies/policy';
import {
  LabelType,
  State,
  TagSource,
  type TagLabel,
} from '../generated/type/tagLabel';
import {
  getExcludedIndexesBasedOnEntityTypeEditTagPermission,
  getTagRedirectLink,
  getTagValue,
} from './TagsPureUtils';

const buildPermissions = (resource: ResourceEntity): UIPermission =>
  ({
    [resource]: { [Operation.EditTags]: true },
  } as unknown as UIPermission);

describe('getExcludedIndexesBasedOnEntityTypeEditTagPermission', () => {
  it('should grant MESSAGING_SERVICE when EditTags is held on messagingService', () => {
    const permissions = buildPermissions(ResourceEntity.MESSAGING_SERVICE);

    const { entitiesHavingPermission, entitiesNotHavingPermission } =
      getExcludedIndexesBasedOnEntityTypeEditTagPermission(permissions);

    expect(entitiesHavingPermission).toContain(EntityType.MESSAGING_SERVICE);
    expect(entitiesNotHavingPermission).not.toContain(
      EntityType.MESSAGING_SERVICE
    );
  });

  it('should not grant MESSAGING_SERVICE when EditTags is held only on pipelineService', () => {
    const permissions = buildPermissions(ResourceEntity.PIPELINE_SERVICE);

    const { entitiesHavingPermission, entitiesNotHavingPermission } =
      getExcludedIndexesBasedOnEntityTypeEditTagPermission(permissions);

    expect(entitiesHavingPermission).toContain(EntityType.PIPELINE_SERVICE);
    expect(entitiesNotHavingPermission).toContain(EntityType.MESSAGING_SERVICE);
  });
});

describe('getTagValue', () => {
  const tierTag: TagLabel = {
    tagFQN: 'Tier.Tier1',
    source: TagSource.Classification,
    labelType: LabelType.Manual,
    state: State.Confirmed,
    name: 'Tier1',
    displayName: 'Tier 1',
    description: 'Tier 1 description',
  };

  const normalTag: TagLabel = {
    tagFQN: 'PersonalData.SpecialCategory',
    source: TagSource.Classification,
    labelType: LabelType.Manual,
    state: State.Confirmed,
    name: 'SpecialCategory',
    displayName: 'Special Category',
  };

  it('does not strip the Tier. prefix from a TagLabel tagFQN (routing field stays intact)', () => {
    const result = getTagValue(tierTag) as TagLabel;

    expect(result.tagFQN).toBe('Tier.Tier1');
  });

  it('does not strip the Tier. prefix from a string tag (routing field stays intact)', () => {
    expect(getTagValue('Tier.Tier1')).toBe('Tier.Tier1');
  });

  it('preserves the display name fields so the badge label is unchanged', () => {
    const result = getTagValue(tierTag) as TagLabel;

    expect(result.name).toBe('Tier1');
    expect(result.displayName).toBe('Tier 1');
  });

  it('returns the TagLabel unchanged (no mutation of the original object)', () => {
    const result = getTagValue(tierTag) as TagLabel;

    expect(tierTag.tagFQN).toBe('Tier.Tier1');
    expect(result.tagFQN).toBe('Tier.Tier1');
  });

  it('passes through non-Tier TagLabels unchanged', () => {
    const result = getTagValue(normalTag) as TagLabel;

    expect(result).toEqual(normalTag);
  });

  it('passes through non-Tier strings unchanged', () => {
    expect(getTagValue('PersonalData.SpecialCategory')).toBe(
      'PersonalData.SpecialCategory'
    );
  });
});

describe('getTagValue + getTagRedirectLink routing (Tier tag)', () => {
  const tierTag: TagLabel = {
    tagFQN: 'Tier.Tier1',
    source: TagSource.Classification,
    labelType: LabelType.Manual,
    state: State.Confirmed,
    name: 'Tier1',
    displayName: 'Tier 1',
    description: 'Tier 1 description',
  };

  it('routes to /tag/Tier.Tier1 (not the 404-causing /tag/Tier1) after getTagValue', () => {
    const processed = getTagValue(tierTag) as TagLabel;
    const href = getTagRedirectLink(processed);

    expect(href).toBe('/tag/Tier.Tier1');
    expect(href).not.toBe('/tag/Tier1');
  });

  it('getTagRedirectLink on the original (unprocessed) tag routes to /tag/Tier.Tier1', () => {
    expect(getTagRedirectLink(tierTag)).toBe('/tag/Tier.Tier1');
  });
});
