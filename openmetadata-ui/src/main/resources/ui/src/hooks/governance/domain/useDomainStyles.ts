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
import { useQuery } from '@tanstack/react-query';
import { DomainStyles } from '../../../generated/api/domains/domainStyles';
import { Style } from '../../../generated/type/tagLabel';
import { domainStylesQueryOptions } from '../../../rest/queries/domainStyleQuery';

const NO_STYLES = new Map<string, Style>();

const toStyleById = ({ data }: DomainStyles): Map<string, Style> =>
  new Map(data.map(({ id, style }) => [id, style]));

/**
 * The colour and icon of every styled domain and data product, keyed by id.
 * References carry no style, so chips look it up by the id they already hold;
 * an id without an entry keeps the default chip.
 * ADR:2026-11-02-domain-chips-resolve-their-style-by-domain-id
 */
export const useDomainStyles = (): Map<string, Style> => {
  const { data } = useQuery({
    ...domainStylesQueryOptions,
    select: toStyleById,
  });

  return data ?? NO_STYLES;
};
