/*
 *  Copyright 2024 Collate.
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
export type GlossaryResponseDataType = {
  name: string;
  displayName: string;
  description: string;
  reviewers: unknown[];
  tags: unknown[];
  mutuallyExclusive: boolean;
  id: string;
  fullyQualifiedName: string;
};

export type UserTeamRef = {
  name: string;
  type: string;
};

export type GlossaryData = {
  name: string;
  displayName: string;
  description: string;
  reviewers: UserTeamRef[];
  tags: string[];
  mutuallyExclusive: boolean;
  terms: { data: GlossaryTermData }[];
  owners: UserTeamRef[];
  fullyQualifiedName: string;
};

export type GlossaryTermResponseDataType = {
  name: string;
  displayName: string;
  description: string;
  reviewers: unknown[];
  relatedTerms: unknown[];
  synonyms: unknown[];
  mutuallyExclusive: boolean;
  tags: unknown[];
  glossary: Record<string, string>;
  id: string;
  fullyQualifiedName: string;
};

export type GlossaryTermData = {
  name: string;
  displayName: string;
  description: string;
  mutuallyExclusive: boolean;
  glossary: string;
  synonyms: string;
  icon?: string;
  color?: string;
  owners?: UserTeamRef[];
  fullyQualifiedName: string;
  reviewers: UserTeamRef[];
};
