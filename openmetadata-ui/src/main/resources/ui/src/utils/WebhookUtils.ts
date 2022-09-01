import { Store } from 'antd/lib/form/interface';
import { isEqual } from 'lodash';
import {
  EVENT_FILTERS_DEFAULT_VALUE,
  EVENT_FILTER_FORM_INITIAL_VALUE,
} from '../components/AddWebhook/WebhookConstants';
import { TERM_ALL } from '../constants/constants';
import { EventFilter, Filters } from '../generated/entity/events/webhook';

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

      return [
        ...acc,
        {
          entityType: key,
          filters:
            selectedFilter[0] === TERM_ALL
              ? EVENT_FILTERS_DEFAULT_VALUE.filters
              : (selectedFilter.map((filter) => ({
                  eventType: filter,
                  fields: [TERM_ALL],
                })) as Filters[]),
        },
      ];
    }

    return acc;
  }, [] as EventFilter[]);

  return [EVENT_FILTERS_DEFAULT_VALUE, ...newFilters];
};
