import { Store } from 'antd/lib/form/interface';
import { isEqual, isUndefined } from 'lodash';
import {
  EVENT_FILTERS_DEFAULT_VALUE,
  EVENT_FILTER_FORM_INITIAL_VALUE,
} from '../components/AddWebhook/WebhookConstants';
import { TERM_ALL } from '../constants/constants';
import {
  EventFilter,
  EventType,
  Filters,
} from '../generated/entity/events/webhook';

export const getEventFilters = (data: Store): EventFilter[] => {
  if (isEqual(data, EVENT_FILTER_FORM_INITIAL_VALUE)) {
    return [EVENT_FILTERS_DEFAULT_VALUE];
  }

  const newFilters = Object.entries(data).reduce((acc, [key, value]) => {
    if (key.includes('-tree')) {
      return acc;
    }
    if (value) {
      const selectedFilter = data[`${key}-tree`] as string[];
      const entityUpdatedFields = selectedFilter
        ?.map((filter) =>
          filter.includes(`${EventType.EntityUpdated}-`)
            ? filter.split('-')[1]
            : undefined
        )
        .filter((filter) => filter);

      const eventFilters = [
        ...selectedFilter.filter(
          (filter) => !filter.includes(`${EventType.EntityUpdated}-`)
        ),
        entityUpdatedFields ? EventType.EntityUpdated : undefined,
      ];

      const includeData = (entityUpdatedFields as string[]).filter(
        (entityUpdatedField) => !isUndefined(entityUpdatedField)
      );

      return [
        ...acc,
        {
          entityType: key,
          filters:
            eventFilters[0] === TERM_ALL
              ? EVENT_FILTERS_DEFAULT_VALUE.filters
              : (eventFilters.map((filter) => ({
                  eventType: filter,
                  include:
                    filter === EventType.EntityUpdated
                      ? includeData
                      : [TERM_ALL],
                  exclude: [],
                })) as Filters[]),
        },
      ];
    }

    return acc;
  }, [] as EventFilter[]);

  return [EVENT_FILTERS_DEFAULT_VALUE, ...newFilters];
};
