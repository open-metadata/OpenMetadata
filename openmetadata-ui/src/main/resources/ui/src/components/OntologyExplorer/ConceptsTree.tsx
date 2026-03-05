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

import { Input } from '@openmetadata/ui-core-components';
import { SearchMd } from '@untitledui/icons';
import { Tree, TreeDataNode } from 'antd';
import { DataNode } from 'antd/es/tree';
import { AxiosError } from 'axios';
import { debounce, isEmpty } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as IconTerm } from '../../assets/svg/glossary-term-colored-new.svg';
import { ReactComponent as GlossaryIcon } from '../../assets/svg/glossary.svg';
import { TabSpecificField } from '../../enums/entity.enum';
import { Glossary } from '../../generated/entity/data/glossary';
import { GlossaryTerm } from '../../generated/entity/data/glossaryTerm';
import { EntityReference } from '../../generated/type/entityReference';
import { getGlossariesList, getGlossaryTerms } from '../../rest/glossaryAPI';
import { showErrorToast } from '../../utils/ToastUtils';
import Loader from '../common/Loader/Loader';
import {
  ConceptsTreeNode,
  ConceptsTreeProps,
} from './OntologyExplorer.interface';

const isValidUUID = (str: string): boolean => {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  return uuidRegex.test(str);
};

interface ConceptTreeDataNode extends TreeDataNode {
  data?: { conceptNode: ConceptsTreeNode };
}

const convertToTreeData = (nodes: ConceptsTreeNode[]): ConceptTreeDataNode[] =>
  nodes.map((node) => ({
    key: node.key,
    title: (
      <span className="tw:flex tw:items-center tw:gap-2 tw:min-w-0">
        {node.icon && (
          <span className="tw:shrink-0 tw:flex tw:items-center">
            {node.icon}
          </span>
        )}
        <span className="tw:flex-1 tw:min-w-0 tw:overflow-hidden tw:text-ellipsis tw:whitespace-nowrap tw:text-sm">
          {node.title}
        </span>
        {node.data?.relationsCount !== undefined &&
          node.data.relationsCount > 0 && (
            <span className="tw:shrink-0 tw:text-xs tw:text-gray-400 tw:bg-gray-100 tw:px-1.5 tw:py-0.5 tw:rounded-md">
              {node.data.relationsCount}
            </span>
          )}
      </span>
    ),
    isLeaf: node.isLeaf,
    children: node.children?.length
      ? convertToTreeData(node.children)
      : undefined,
    data: { conceptNode: node },
  }));

const ConceptsTree: React.FC<ConceptsTreeProps> = ({
  scope,
  entityId,
  glossaryId,
  selectedNodeId,
  onNodeSelect,
  onNodeFocus,
}) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [treeData, setTreeData] = useState<ConceptsTreeNode[]>([]);
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);
  const [searchValue, setSearchValue] = useState('');
  const [filteredData, setFilteredData] = useState<ConceptsTreeNode[]>([]);

  const buildGlossaryTree = useCallback(
    (glossaries: Glossary[]): ConceptsTreeNode[] => {
      return glossaries.map((glossary) => ({
        key: glossary.id,
        title: glossary.displayName || glossary.name,
        type: 'glossary' as const,
        icon: <GlossaryIcon className="tw:w-4 tw:h-4" />,
        isLeaf: false,
        data: {
          id: glossary.id,
          fullyQualifiedName: glossary.fullyQualifiedName || glossary.name,
          description: glossary.description,
        },
      }));
    },
    []
  );

  const buildChildrenFromRefs = useCallback(
    (children: EntityReference[]): ConceptsTreeNode[] => {
      return children
        .filter((child) => child.id && isValidUUID(child.id))
        .map((child) => ({
          key: child.id,
          title: child.displayName || child.name || child.id,
          type: 'term' as const,
          icon: <IconTerm className="tw:w-4 tw:h-4" />,
          isLeaf: true,
          data: {
            id: child.id,
            fullyQualifiedName: child.fullyQualifiedName || child.name || '',
            description: child.description,
            relationsCount: 0,
          },
        }));
    },
    []
  );

  const buildTermTree = useCallback(
    (terms: GlossaryTerm[]): ConceptsTreeNode[] => {
      return terms.map((term) => {
        const childrenRefs = term.children?.length
          ? buildChildrenFromRefs(term.children)
          : undefined;

        return {
          key: term.id,
          title: term.displayName || term.name,
          type: 'term' as const,
          icon: <IconTerm className="tw:w-4 tw:h-4" />,
          isLeaf: !childrenRefs?.length,
          children: childrenRefs,
          data: {
            id: term.id,
            fullyQualifiedName: term.fullyQualifiedName ?? term.name ?? '',
            description: term.description,
            relationsCount:
              term.relatedTerms?.length ?? term.childrenCount ?? 0,
          },
        };
      });
    },
    [buildChildrenFromRefs]
  );

  const fetchGlossaryTerms = useCallback(
    async (id: string): Promise<ConceptsTreeNode[]> => {
      const res = await getGlossaryTerms({
        glossary: id,
        fields: [TabSpecificField.CHILDREN],
        limit: 1000,
      });

      return buildTermTree(res.data ?? []);
    },
    [buildTermTree]
  );

  const fetchGlossaries = useCallback(async () => {
    try {
      const response = await getGlossariesList({
        limit: 1000,
      });
      const glossaryNodes = buildGlossaryTree(response.data);
      setTreeData(glossaryNodes);
      setFilteredData(glossaryNodes);
    } catch (err) {
      showErrorToast(err as AxiosError);
    } finally {
      setLoading(false);
    }
  }, [buildGlossaryTree]);

  const updateTreeData = (
    list: ConceptsTreeNode[],
    key: string,
    children: ConceptsTreeNode[]
  ): ConceptsTreeNode[] => {
    return list.map((node) => {
      if (node.key === key) {
        return { ...node, children };
      }
      if (node.children) {
        return {
          ...node,
          children: updateTreeData(node.children, key, children),
        };
      }

      return node;
    });
  };

  const filterTree = useCallback(
    (nodes: ConceptsTreeNode[], search: string): ConceptsTreeNode[] => {
      if (!search) {
        return nodes;
      }

      const searchLower = search.toLowerCase();

      return nodes.reduce<ConceptsTreeNode[]>((acc, node) => {
        const titleMatch = node.title.toLowerCase().includes(searchLower);
        const childMatches = node.children
          ? filterTree(node.children, search)
          : [];

        if (titleMatch || childMatches.length > 0) {
          acc.push({
            ...node,
            children: childMatches.length > 0 ? childMatches : node.children,
          });
        }

        return acc;
      }, []);
    },
    []
  );

  const getAllKeys = (nodes: ConceptsTreeNode[]): string[] => {
    let keys: string[] = [];
    nodes.forEach((node) => {
      keys.push(node.key);
      if (node.children) {
        keys = keys.concat(getAllKeys(node.children));
      }
    });

    return keys;
  };

  const handleSearch = useMemo(
    () =>
      debounce((value: string) => {
        setSearchValue(value);
        if (value) {
          const filtered = filterTree(treeData, value);
          setFilteredData(filtered);
          setExpandedKeys(getAllKeys(filtered));
        } else {
          setFilteredData(treeData);
        }
      }, 300),
    [treeData, filterTree]
  );

  const handleLoadData = useCallback(
    async (node: DataNode) => {
      const conceptNode = (node as ConceptTreeDataNode).data?.conceptNode;
      if (
        !conceptNode ||
        conceptNode.children?.length ||
        conceptNode.type !== 'glossary' ||
        !conceptNode.data?.id
      ) {
        return;
      }
      try {
        const terms = await fetchGlossaryTerms(conceptNode.data.id);
        setTreeData((prev) => updateTreeData(prev, node.key as string, terms));
        setFilteredData((prev) =>
          updateTreeData(prev, node.key as string, terms)
        );
      } catch (err) {
        showErrorToast(err as AxiosError);
      }
    },
    [fetchGlossaryTerms]
  );

  const handleSelect = useCallback(
    (_: React.Key[], info: { node: DataNode }) => {
      const conceptNode = (info.node as ConceptTreeDataNode).data?.conceptNode;
      if (conceptNode) {
        onNodeSelect(conceptNode);
        if (conceptNode.data?.id) {
          onNodeFocus(conceptNode.data.id);
        }
      }
    },
    [onNodeSelect, onNodeFocus]
  );

  const treeDataNodes = useMemo(
    () => convertToTreeData(filteredData),
    [filteredData]
  );

  useEffect(() => {
    if (scope === 'global') {
      fetchGlossaries();
    } else if (scope === 'glossary' && glossaryId) {
      fetchGlossaryTerms(glossaryId).then((terms) => {
        setTreeData(terms);
        setFilteredData(terms);
        setLoading(false);
      });
    } else if (scope === 'term' && entityId) {
      setLoading(false);
    }
  }, [scope, entityId, glossaryId, fetchGlossaries, fetchGlossaryTerms]);

  if (loading) {
    return (
      <div className="ontology-explorer-sidebar">
        <div className="p-4">
          <Loader />
        </div>
      </div>
    );
  }

  if (scope === 'term') {
    return null;
  }

  return (
    <div className="ontology-explorer-sidebar">
      <div className="sidebar-header">
        <span className="sidebar-title">{t('label.concept-plural')}</span>
        <Input
          className="sidebar-search"
          icon={
            SearchMd as unknown as React.ComponentType<
              React.HTMLAttributes<HTMLOrSVGElement>
            >
          }
          placeholder={t('label.search-entity', {
            entity: t('label.concept-plural'),
          })}
          size="sm"
          onChange={(value) =>
            handleSearch(typeof value === 'string' ? value : '')
          }
        />
      </div>
      <div className="sidebar-content">
        {isEmpty(filteredData) ? (
          <div className="p-4 text-center text-grey-muted">
            {searchValue
              ? t('message.no-match-found')
              : t('message.no-data-available')}
          </div>
        ) : (
          <Tree
            blockNode
            expandedKeys={expandedKeys}
            loadData={handleLoadData}
            selectedKeys={selectedNodeId ? [selectedNodeId] : []}
            showLine={false}
            treeData={treeDataNodes}
            onExpand={(keys) => setExpandedKeys(keys)}
            onSelect={handleSelect}
          />
        )}
      </div>
    </div>
  );
};

export default ConceptsTree;
