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

import { TargetEntityType } from '../../../../../../generated/governance/intakeForm';
import { GovernanceView } from './Governance.types';
import { hashSubPathToView, viewToSubPath } from './Governance.utils';

describe('hashSubPathToView', () => {
  it('returns landing for empty subPath', () => {
    expect(hashSubPathToView('')).toEqual({ type: 'landing' });
  });

  it('returns glossary-list for "glossary-relations"', () => {
    expect(hashSubPathToView('glossary-relations')).toEqual({
      type: 'glossary-list',
    });
  });

  it('returns glossary-add for "glossary-relations/add"', () => {
    expect(hashSubPathToView('glossary-relations/add')).toEqual({
      type: 'glossary-add',
    });
  });

  it('returns glossary-edit with name for "glossary-relations/<name>"', () => {
    expect(hashSubPathToView('glossary-relations/myRelation')).toEqual({
      type: 'glossary-edit',
      name: 'myRelation',
    });
  });

  it('returns glossary-edit with compound name for "glossary-relations/a/b"', () => {
    expect(hashSubPathToView('glossary-relations/a/b')).toEqual({
      type: 'glossary-edit',
      name: 'a/b',
    });
  });

  it('returns intake-list for "intake-forms"', () => {
    expect(hashSubPathToView('intake-forms')).toEqual({ type: 'intake-list' });
  });

  it('returns intake-add with entityType for "intake-forms/add/dataProduct"', () => {
    expect(hashSubPathToView('intake-forms/add/dataProduct')).toEqual({
      type: 'intake-add',
      entityType: TargetEntityType.DataProduct,
    });
  });

  it('returns intake-edit with id for "intake-forms/<id>"', () => {
    expect(hashSubPathToView('intake-forms/abc123')).toEqual({
      type: 'intake-edit',
      id: 'abc123',
    });
  });

  it('returns landing for an unrecognised subPath', () => {
    expect(hashSubPathToView('unknown/path')).toEqual({ type: 'landing' });
  });
});

describe('viewToSubPath', () => {
  it('returns undefined for landing', () => {
    const view: GovernanceView = { type: 'landing' };

    expect(viewToSubPath(view)).toBeUndefined();
  });

  it('returns "glossary-relations" for glossary-list', () => {
    const view: GovernanceView = { type: 'glossary-list' };

    expect(viewToSubPath(view)).toBe('glossary-relations');
  });

  it('returns "glossary-relations/add" for glossary-add', () => {
    const view: GovernanceView = { type: 'glossary-add' };

    expect(viewToSubPath(view)).toBe('glossary-relations/add');
  });

  it('returns "glossary-relations/<name>" for glossary-edit', () => {
    const view: GovernanceView = { type: 'glossary-edit', name: 'broader' };

    expect(viewToSubPath(view)).toBe('glossary-relations/broader');
  });

  it('returns "intake-forms" for intake-list', () => {
    const view: GovernanceView = { type: 'intake-list' };

    expect(viewToSubPath(view)).toBe('intake-forms');
  });

  it('returns "intake-forms/add/<entityType>" for intake-add', () => {
    const view: GovernanceView = {
      type: 'intake-add',
      entityType: TargetEntityType.Domain,
    };

    expect(viewToSubPath(view)).toBe('intake-forms/add/domain');
  });

  it('returns "intake-forms/<id>" for intake-edit', () => {
    const view: GovernanceView = { type: 'intake-edit', id: 'form-123' };

    expect(viewToSubPath(view)).toBe('intake-forms/form-123');
  });

  it('is a round-trip for all non-landing views', () => {
    const views: GovernanceView[] = [
      { type: 'glossary-list' },
      { type: 'glossary-add' },
      { type: 'glossary-edit', name: 'relatedTo' },
      { type: 'intake-list' },
      {
        type: 'intake-add',
        entityType: TargetEntityType.GlossaryTerm,
      },
      { type: 'intake-edit', id: 'xyz' },
    ];

    for (const view of views) {
      const subPath = viewToSubPath(view);

      expect(subPath).toBeDefined();

      const back = hashSubPathToView(subPath as string);

      expect(back).toEqual(view);
    }
  });
});
