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

import { SelectProps, Tag, Typography } from 'antd';
import { isEmpty } from 'lodash';
import type { CustomTagProps } from 'rc-select/lib/BaseSelect';
import React, { useEffect, useState } from 'react';
import { SearchIndex } from '../../../enums/search.enum';
import { searchQuery } from '../../../rest/searchAPI';
import { getTermQuery } from '../../../utils/SearchPureUtils';
import { AsyncSelect } from '../../common/AsyncSelect/AsyncSelect';
import { AsyncSelectListProps } from '../../common/AsyncSelect/AsyncSelectList.interface';
interface FQNListSelectProps
  extends SelectProps,
    Pick<AsyncSelectListProps, 'api'> {
  searchIndex: SearchIndex | SearchIndex[];
  containerEntities?: string[];
}

// Resolves which of the saved FQNs refer to a container (ancestor) entity type for the current
// source. The match rule is identical to authoring time (entityType in containerEntities), so the
// saved-alert view can re-apply the display-only ".*" subtree hint that is not persisted.
export const resolveWildcardFqns = async (
  fqns: string[],
  searchIndex: SearchIndex | SearchIndex[],
  containerEntities: string[] = []
): Promise<string[]> => {
  let wildcardFqns: string[] = [];
  if (!isEmpty(fqns) && !isEmpty(containerEntities)) {
    try {
      const response = await searchQuery({
        query: '*',
        pageNumber: 1,
        pageSize: fqns.length,
        searchIndex,
        queryFilter: getTermQuery({ fullyQualifiedName: fqns }, 'should', 1),
      });

      wildcardFqns = response.hits.hits
        .filter(
          (hit) =>
            !!hit._source.entityType &&
            containerEntities.includes(hit._source.entityType)
        )
        .map((hit) => hit._source.fullyQualifiedName ?? '')
        .filter(Boolean);
    } catch {
      wildcardFqns = [];
    }
  }

  return wildcardFqns;
};

// Alerts-only wrapper around the shared AsyncSelect. It keeps the shared component untouched and
// scopes the ".*" tag decoration to the Entity-FQN filter, so other consumers of AsyncSelect are
// unaffected.
const FQNListSelect = ({
  value,
  searchIndex,
  containerEntities = [],
  ...rest
}: FQNListSelectProps) => {
  const [wildcardFqns, setWildcardFqns] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fqns = (value as string[] | undefined) ?? [];
    if (isEmpty(fqns) || isEmpty(containerEntities)) {
      setWildcardFqns(new Set());

      return;
    }

    let isActive = true;
    resolveWildcardFqns(fqns, searchIndex, containerEntities).then((list) => {
      if (isActive) {
        setWildcardFqns(new Set(list));
      }
    });

    return () => {
      isActive = false;
    };
  }, [value, searchIndex, containerEntities]);

  const tagRender = (tagProps: CustomTagProps) => {
    const { value: tagValue, closable, onClose } = tagProps;
    const fqn = tagValue as string;
    const label = wildcardFqns.has(fqn) ? `${fqn}.*` : fqn;

    const onPreventMouseDown = (event: React.MouseEvent<HTMLSpanElement>) => {
      event.preventDefault();
      event.stopPropagation();
    };

    return (
      <Tag
        closable={closable}
        data-testid={`fqn-tag-${fqn}`}
        title={label}
        onClose={onClose}
        onMouseDown={onPreventMouseDown}>
        <Typography.Text className="break-all">{label}</Typography.Text>
      </Tag>
    );
  };

  return <AsyncSelect {...rest} tagRender={tagRender} value={value} />;
};

export default FQNListSelect;
