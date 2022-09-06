/*
 *  Copyright 2021 Collate
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

import { TreeSelect } from 'antd';
import React, { useEffect, useState } from 'react';
import { getTeamsByQuery } from '../../axiosAPIs/miscAPI';
import { Team, TeamType } from '../../generated/entity/teams/team';
import { EntityReference } from '../../generated/type/entityReference';
import SVGIcons from '../../utils/SvgUtils';

interface Props {
  showTeamsAlert?: boolean;
  onSelectionChange: (teams: string[]) => void;
  filterJoinable?: boolean;
  placeholder?: string;
}

interface Node {
  team: Team;
  children: Array<Node>;
}

const { TreeNode } = TreeSelect;
const TEAM_OPTION_PAGE_LIMIT = 100;

const TeamsSelectable = ({
  showTeamsAlert,
  onSelectionChange,
  filterJoinable,
  placeholder = 'Search for teams',
}: Props) => {
  const [value, setValue] = useState<Array<string>>();
  const [noTeam, setNoTeam] = useState<boolean>(false);
  const [nodes, setNodes] = useState<Array<Node>>([]);
  const teamCacheMap: Map<string, Team[]> = new Map();

  const onChange = (newValue: string[]) => {
    onSelectionChange(newValue);
    setValue(newValue);
  };

  const deepCopy = (n: Node) => {
    const children: Array<Node> = [];
    if (n.children.length) {
      n.children.forEach((child) => children.push(deepCopy(child)));
    }

    return { team: n.team, children };
  };

  const mergeTrees = (node1: Node, node2: Node) => {
    const toMerge: Node[] = node1.children.filter((value) =>
      node2.children.some((n) => n.team.id === value.team.id)
    );
    const toAdd: Node[] = node2.children.filter(
      (value) => !node1.children.some((n) => n.team.id === value.team.id)
    );
    toMerge.forEach((n) => {
      mergeTrees(
        n,
        node2.children[node2.children.findIndex((x) => x.team.id === n.team.id)]
      );
    });

    toAdd.forEach((n) => {
      node1.children = node1.children.concat(deepCopy(n));
    });

    return node1;
  };

  const fetchTeam = (id: string) => {
    return new Promise<Team[]>((resolve, reject) => {
      if (teamCacheMap.has(id)) {
        const team = teamCacheMap.get(id);
        if (team != null) {
          resolve(team);
        }
      } else {
        getTeamsByQuery({
          q: `id:${id}`,
          from: 0,
          size: 1,
        })
          // TODO: Improve type below
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .then((res: any) => {
            const teams: Team[] =
              res.hits.hits.map((t: { _source: Team }) => t._source) || [];
            teamCacheMap.set(id, teams);
            resolve(teams);
          })
          .catch((error) => {
            reject(error);
          });
      }
    });
  };

  const processTeams = async (teams: Team[]) => {
    const nodes = new Map<string, Node>();

    return new Promise<Map<string, Node>>((resolve) => {
      Promise.all(
        teams.map(async (team) => {
          let node: Node = { children: [], team };
          if (
            team.parents?.length &&
            team.parents[0].name !== TeamType.Organization
          ) {
            let count = 0;
            while (
              count < 10 &&
              team.parents &&
              team.parents[0].name !== TeamType.Organization
            ) {
              const parent: EntityReference = team.parents[0];
              if (nodes.has(parent.id)) {
                // merge trees
                const parentNode = nodes.get(parent.id);
                if (parentNode != null) {
                  node = mergeTrees(parentNode, { team, children: [node] });
                  team = parentNode.team;
                }
              } else {
                const result = await fetchTeam(parent.id);
                if (result.length) {
                  const parentTeam: Team = result[0];
                  node = { team: parentTeam, children: [node] };
                  team = parentTeam;
                }
              }
              count++;
            }
          }
          nodes.set(team.id, node);
        })
      ).then(() => resolve(nodes));
    });
  };

  const loadOptions = () => {
    getTeamsByQuery({
      q: '*' + (filterJoinable ? ` AND isJoinable:true` : ''),
      from: 0,
      size: TEAM_OPTION_PAGE_LIMIT,
      // TODO: Improve type below
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }).then((res: any) => {
      const teams: Team[] =
        res.hits.hits.map((t: { _source: Team }) => t._source) || [];
      // Build hierarchical tree structure for Tree Select
      processTeams(teams).then((nodes: Map<string, Node>) => {
        const nodeValues: Array<Node> = Array.from(nodes.values());
        setNodes(nodeValues);
        showTeamsAlert && setNoTeam(teams.length === 0);
      });
    });
  };

  useEffect(() => {
    loadOptions();
  }, []);

  const getTreeNodes = (node: Node) => {
    const teamName = node.team.displayName || node.team.name;
    const value = node.team.id;
    const disabled = filterJoinable ? !node.team.isJoinable : false;

    return (
      <TreeNode disabled={disabled} key={value} title={teamName} value={value}>
        {node.children.map((n) => getTreeNodes(n))}
      </TreeNode>
    );
  };
  const showLeafIcon = false;

  return (
    <>
      <TreeSelect
        allowClear
        multiple
        showSearch
        treeDefaultExpandAll
        dropdownStyle={{ maxHeight: 300, overflow: 'auto' }}
        placeholder={placeholder}
        showCheckedStrategy={TreeSelect.SHOW_ALL}
        style={{ width: '100%' }}
        treeLine={{ showLeafIcon }}
        treeNodeFilterProp="title"
        value={value}
        onChange={onChange}>
        {nodes.map((node) => {
          return getTreeNodes(node);
        })}
      </TreeSelect>
      {noTeam && (
        <div
          className="tw-notification tw-bg-info tw-mt-2 tw-justify-start tw-w-full tw-p-2"
          data-testid="toast">
          <div className="tw-font-semibold tw-flex-shrink-0">
            <SVGIcons alt="info" icon="info" title="Info" width="16px" />
          </div>
          <div className="tw-font-semibold tw-px-1">
            There is no team available.
          </div>
        </div>
      )}
    </>
  );
};

export default TeamsSelectable;
