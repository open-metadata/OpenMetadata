import { Divider, Tree } from 'antd';
import { cloneDeep, isEmpty, map, startCase } from 'lodash';
import React, { Key, useEffect, useMemo, useState } from 'react';
import { getInitialFilters } from '../../axiosAPIs/eventFiltersAPI';
import { TERM_ALL } from '../../constants/constants';
import { EventFilter } from '../../generated/api/events/createWebhook';
import { Filters } from '../../generated/settings/settings';
import { getEventFilterFromTree } from '../../pages/ActivityFeedSettingsPage/ActivityFeedSettingsPage.utils';
import './../../pages/ActivityFeedSettingsPage/ActivityFeedSettingsPage.style.less';

interface EventFilterTreeProps {
  value: EventFilter[];
  onChange: (data: EventFilter[]) => void;
}

const EventFilterTree = ({ value, onChange }: EventFilterTreeProps) => {
  const [updatedTree, setUpdatedTree] = useState<Record<string, string[]>>();
  const [initialFilters, setInitialFilters] = useState<EventFilter[]>([]);

  const eventFilters = isEmpty(value) ? initialFilters : value;
  const fetchInitialFilters = async () => {
    try {
      const data = await getInitialFilters();
      setInitialFilters(data);
      isEmpty(value) && onChange(getEventFilterFromTree({}, eventFilters));
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`filed to fetch event filters `);
    }
  };

  useEffect(() => {
    fetchInitialFilters();
  }, []);

  const generateTreeData = (entityType: string, data?: Filters[]) => {
    return [
      {
        key: entityType,
        title: <strong>{startCase(entityType)}</strong>,
        data: true,
        children:
          data?.map(({ eventType, include, exclude }) => {
            const key = `${entityType}-${eventType}` as string;

            return {
              key: key,
              title: startCase(eventType),
              data: isEmpty(value) ? true : include,
              children:
                (include?.length === 1 && include[0] === TERM_ALL) ||
                (exclude?.length === 1 && exclude[0] === TERM_ALL)
                  ? undefined
                  : [
                      ...(include?.map((inc) => ({
                        key: `${key}-${inc}`,
                        title: startCase(inc),
                        data: true,
                      })) || []),
                      ...(exclude?.map((ex) => ({
                        key: `${key}-${ex}`,
                        title: startCase(ex),
                        data: false,
                      })) || []),
                    ],
            };
          }) || [],
      },
    ];
  };

  const handleTreeCheckChange = (keys: Key[], entityType: string) => {
    const updateData = cloneDeep(updatedTree || {});

    updateData[entityType] = keys as string[];

    onChange(getEventFilterFromTree(cloneDeep(updateData), eventFilters));
    setUpdatedTree(updateData);
  };
  const getCheckedKeys = (eventFilters: EventFilter[]) => {
    const checkedArray = [] as string[];
    const clonedFilters = cloneDeep(eventFilters);

    clonedFilters?.map(({ entityType, filters }) => {
      filters &&
        filters.map((obj) => {
          if (
            obj.include &&
            obj.include.length === 1 &&
            obj.include[0] === 'all'
          ) {
            checkedArray.push(`${entityType}-${obj.eventType}`);
          } else {
            obj?.include?.forEach((entityUpdated) => {
              const name = `${entityType}-${obj.eventType}-${entityUpdated}`;
              checkedArray.push(name);
            });
          }
        });
    });

    return checkedArray;
  };

  const checkedKeys = useMemo(() => {
    const checkKeys = getCheckedKeys(eventFilters as EventFilter[]);

    return checkKeys;
  }, [eventFilters, updatedTree]);

  return (
    <>
      {initialFilters &&
        map(initialFilters, ({ entityType, filters }, index) => (
          <>
            {entityType !== TERM_ALL ? (
              <div className="tw-rounded-border" key={entityType}>
                <Tree
                  checkable
                  defaultExpandAll
                  className="activity-feed-settings-tree"
                  defaultCheckedKeys={checkedKeys}
                  key={entityType}
                  treeData={generateTreeData(entityType, filters)}
                  onCheck={(keys) =>
                    handleTreeCheckChange(keys as Key[], entityType)
                  }
                />
                {index !== initialFilters.length - 1 && <Divider />}
              </div>
            ) : null}
          </>
        ))}
    </>
  );
};

export default EventFilterTree;
