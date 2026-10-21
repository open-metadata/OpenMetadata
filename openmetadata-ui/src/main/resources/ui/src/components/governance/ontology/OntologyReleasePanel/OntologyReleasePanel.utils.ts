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
import { VersionBump } from '../../../../generated/api/data/captureOntologyRelease';
import { OntologyState } from '../../../../generated/type/ontologyState';

export const nextSemanticVersion = (
  version: string | undefined,
  bump: VersionBump
): string => {
  const base = version ?? '0.0.0';
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(base)) {
    throw new Error('Invalid ontology semantic version');
  }
  const [major, minor, patch] = base.split('.').map(BigInt);
  const one = BigInt(1);
  switch (bump) {
    case VersionBump.Major:
      return `${major + one}.0.0`;
    case VersionBump.Minor:
      return `${major}.${minor + one}.0`;
    case VersionBump.Patch:
      return `${major}.${minor}.${patch + one}`;
  }
};

export const isSameWorkingState = (
  first: OntologyState | undefined,
  current: OntologyState | undefined
) => {
  if (!first || !current) {
    return false;
  }

  return [
    current.ontologyId === first.ontologyId,
    current.workingRevision === first.workingRevision,
    current.activationRevision === first.activationRevision,
    current.activeReleaseId === first.activeReleaseId,
    current.lastReleaseRevision === first.lastReleaseRevision,
  ].every(Boolean);
};
