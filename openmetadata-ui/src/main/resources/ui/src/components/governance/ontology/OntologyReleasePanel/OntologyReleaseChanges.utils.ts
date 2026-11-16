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
import {
  ChangeType,
  ConceptChange,
  MemberChange,
  MemberKind,
} from '../../../../generated/api/data/ontologyWorkingDiff';
import { getEntityName } from '../../../../utils/EntityNameUtils';

export interface ChangeKindCounts {
  concepts: number;
  properties: number;
  relationships: number;
  rules: number;
  total: number;
}

export type ChangeFilter = 'all' | 'added' | 'changed' | 'removed';

export type VersionReason = 'first' | 'removal' | 'addition' | 'change';

export interface VersionSuggestion {
  bump: VersionBump;
  reason: VersionReason;
}

export const KIND_MESSAGES: readonly [
  Exclude<keyof ChangeKindCounts, 'total'>,
  string
][] = [
  ['concepts', 'message.native-concept-count'],
  ['properties', 'message.ontology-property-count'],
  ['relationships', 'message.ontology-relationship-count'],
  ['rules', 'message.ontology-rule-count'],
];

const KIND_FIELD: Partial<
  Record<MemberKind, Exclude<keyof ChangeKindCounts, 'total'>>
> = {
  [MemberKind.Concept]: 'concepts',
  [MemberKind.Property]: 'properties',
  [MemberKind.Association]: 'relationships',
  [MemberKind.Axiom]: 'rules',
  [MemberKind.Shape]: 'rules',
};

/**
 * Counts member changes per kind. The ontology row is the container a user
 * created, not a change they made, so it never counts.
 */
export const countChangesByKind = (
  changes: readonly Pick<MemberChange, 'memberKind'>[]
): ChangeKindCounts => {
  const counts: ChangeKindCounts = {
    concepts: 0,
    properties: 0,
    relationships: 0,
    rules: 0,
    total: 0,
  };
  changes.forEach(({ memberKind }) => {
    const field = KIND_FIELD[memberKind];
    if (field) {
      counts[field] += 1;
      counts.total += 1;
    }
  });

  return counts;
};

export const flattenConceptChanges = (
  groups: readonly ConceptChange[]
): MemberChange[] => groups.flatMap((group) => group.changes);

/** Removals break readers, additions extend them, and edits correct them. */
export const suggestVersion = (
  changes: readonly Pick<MemberChange, 'memberKind' | 'changeType'>[],
  baseVersion: string | undefined
): VersionSuggestion => {
  if (!baseVersion) {
    return { bump: VersionBump.Minor, reason: 'first' };
  }
  const content = changes.filter(
    ({ memberKind }) => memberKind !== MemberKind.Ontology
  );
  if (content.some(({ changeType }) => changeType === ChangeType.Removed)) {
    return { bump: VersionBump.Major, reason: 'removal' };
  }
  if (content.some(({ changeType }) => changeType === ChangeType.Added)) {
    return { bump: VersionBump.Minor, reason: 'addition' };
  }

  return { bump: VersionBump.Patch, reason: 'change' };
};

const iriTail = (iri?: string) => iri?.split(/[#/:]/).pop() || undefined;

/**
 * A concept made by the API, an import, a pack or the AI has a UUID IRI, so
 * its tail is no name; the label comes first and the tail is the last resort.
 */
export const conceptChangeLabel = (group: ConceptChange) => {
  const member = group.changes.find(
    ({ memberKind }) => memberKind === MemberKind.Concept
  );

  const memberName = member ? getEntityName(member.entity) : '';

  return (
    group.concept ||
    memberName ||
    iriTail(group.iri) ||
    group.changes.map(({ entity }) => getEntityName(entity)).join(', ')
  );
};

const FILTER_TYPES: Record<ChangeFilter, readonly ChangeType[]> = {
  all: Object.values(ChangeType),
  added: [ChangeType.Added],
  changed: [ChangeType.Changed, ChangeType.Deprecated],
  removed: [ChangeType.Removed],
};

export const matchesChangeFilter = (
  changeType: ChangeType,
  filter: ChangeFilter
) => FILTER_TYPES[filter].includes(changeType);

const matchesSearch = (texts: readonly string[], search: string) => {
  const needle = search.trim().toLowerCase();

  return !needle || texts.some((text) => text.toLowerCase().includes(needle));
};

export const filterConceptChanges = (
  groups: readonly ConceptChange[],
  filter: ChangeFilter,
  search: string
): ConceptChange[] =>
  groups.filter(
    (group) =>
      matchesChangeFilter(group.changeType, filter) &&
      matchesSearch(
        [
          conceptChangeLabel(group),
          ...group.changes.map(({ entity }) => getEntityName(entity)),
        ],
        search
      )
  );

export const filterMemberChanges = (
  changes: readonly MemberChange[],
  filter: ChangeFilter,
  search: string
): MemberChange[] =>
  changes.filter(
    (change) =>
      matchesChangeFilter(change.changeType, filter) &&
      matchesSearch([getEntityName(change.entity)], search)
  );

/**
 * How many changes each filter would show for the current search. A class row
 * holds its rules and properties, so it counts every change it carries, and
 * the All filter agrees with the "N changes" summary.
 */
export const countRowsByFilter = (
  groups: readonly ConceptChange[],
  members: readonly MemberChange[],
  search: string
): Record<ChangeFilter, number> => {
  const filters = Object.keys(FILTER_TYPES) as ChangeFilter[];
  const groupChanges = (group: ConceptChange) =>
    Math.max(countChangesByKind(group.changes).total, 1);

  return Object.fromEntries(
    filters.map((filter) => [
      filter,
      filterConceptChanges(groups, filter, search).reduce(
        (sum, group) => sum + groupChanges(group),
        0
      ) +
        countChangesByKind(filterMemberChanges(members, filter, search)).total,
    ])
  ) as Record<ChangeFilter, number>;
};

export type ChangeCardKind =
  | Exclude<keyof ChangeKindCounts, 'total'>
  | 'ontology';

const CHANGE_CARD_ORDER: readonly ChangeCardKind[] = [
  'concepts',
  'properties',
  'relationships',
  'rules',
  'ontology',
];

/** A class row carries its group for the class sentence; any other row is one member. */
export interface ChangeRow {
  key: string;
  kind: ChangeCardKind;
  changeType: ChangeType;
  group?: ConceptChange;
  member?: MemberChange;
}

export interface ChangeCard {
  kind: ChangeCardKind;
  rows: ChangeRow[];
}

const memberCardKind = (memberKind?: MemberKind): ChangeCardKind =>
  (memberKind && KIND_FIELD[memberKind]) ?? 'ontology';

const groupCardKind = (group: ConceptChange): ChangeCardKind =>
  group.concept ||
  group.changes.some(({ memberKind }) => memberKind === MemberKind.Concept)
    ? 'concepts'
    : memberCardKind(group.changes[0]?.memberKind);

const isOntologyMember = ({ memberKind }: MemberChange) =>
  memberKind === MemberKind.Ontology;

/**
 * Before the first release the ontology's own row is the container the user
 * created, not a change, so it is left out as the header count does.
 */
export const visibleWorkingChanges = (
  page: { groups?: ConceptChange[]; data: MemberChange[] } | undefined,
  isFirstRelease: boolean
) => {
  const groups = page?.groups ?? [];
  const members = page?.data ?? [];

  return isFirstRelease
    ? {
        groups: groups.filter(
          (group) =>
            !group.changes.length || !group.changes.every(isOntologyMember)
        ),
        members: members.filter((member) => !isOntologyMember(member)),
      }
    : { groups, members };
};

const memberRow = (member: MemberChange): ChangeRow => ({
  key: member.entity.id + ':' + member.memberKind,
  kind: memberCardKind(member.memberKind),
  changeType: member.changeType,
  member,
});

/**
 * A class row folds in its own properties and rules as one sentence. Each of those
 * members is also listed in its own card, so every card counts what the summary counts
 * and a rule the sentence cannot show (a disjointness, say) is still reviewable.
 */
const foldedMembers = (group: ConceptChange) =>
  group.concept
    ? group.changes.filter(
        ({ memberKind }) =>
          memberKind !== MemberKind.Concept &&
          memberKind !== MemberKind.Ontology
      )
    : [];

/** The review dialog's rows, one card per kind of definition in a fixed order. */
export const groupChangeCards = (
  groups: readonly ConceptChange[],
  members: readonly MemberChange[]
): ChangeCard[] => {
  const rows: ChangeRow[] = [
    ...groups.map((group, index) => ({
      key: 'group:' + (group.iri ?? index),
      kind: groupCardKind(group),
      changeType: group.changeType,
      group,
    })),
    ...groups.flatMap(foldedMembers).map(memberRow),
    ...members.map(memberRow),
  ];

  return CHANGE_CARD_ORDER.map((kind) => ({
    kind,
    rows: rows.filter((row) => row.kind === kind),
  })).filter((card) => card.rows.length > 0);
};
