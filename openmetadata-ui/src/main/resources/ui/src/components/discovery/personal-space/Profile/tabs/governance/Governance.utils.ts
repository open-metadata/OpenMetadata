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

const PATH_GLOSSARY = 'glossary-relations';
const PATH_INTAKE = 'intake-forms';

const INTAKE_LIST_VIEW: GovernanceView = { type: 'intake-list' };

export function hashSubPathToView(subPath: string): GovernanceView {
  if (!subPath) {
    return { type: 'landing' };
  }

  const parts = subPath.split('/');

  if (parts[0] === PATH_GLOSSARY) {
    if (!parts[1]) {
      return { type: 'glossary-list' };
    }

    if (parts[1] === 'add') {
      return { type: 'glossary-add' };
    }

    return { type: 'glossary-edit', name: parts.slice(1).join('/') };
  }

  if (parts[0] === PATH_INTAKE) {
    if (!parts[1]) {
      return INTAKE_LIST_VIEW;
    }

    if (parts[1] === 'add') {
      return parts[2] &&
        (Object.values(TargetEntityType) as string[]).includes(parts[2])
        ? { type: 'intake-add', entityType: parts[2] as TargetEntityType }
        : INTAKE_LIST_VIEW;
    }

    return { type: 'intake-edit', id: parts.slice(1).join('/') };
  }

  return { type: 'landing' };
}

export function viewToSubPath(view: GovernanceView): string | undefined {
  switch (view.type) {
    case 'landing':
      return undefined;
    case 'glossary-list':
      return PATH_GLOSSARY;
    case 'glossary-add':
      return `${PATH_GLOSSARY}/add`;
    case 'glossary-edit':
      return `${PATH_GLOSSARY}/${view.name}`;
    case 'intake-list':
      return PATH_INTAKE;
    case 'intake-add':
      return `${PATH_INTAKE}/add/${view.entityType}`;
    case 'intake-edit':
      return `${PATH_INTAKE}/${view.id}`;
    default:
      return undefined;
  }
}
