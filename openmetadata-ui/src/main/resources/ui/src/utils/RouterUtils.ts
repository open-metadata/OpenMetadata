import { IN_PAGE_SEARCH_ROUTES, ROUTES } from '../constants/constants';

export const isDashboard = (pathname: string): boolean => {
  return pathname === ROUTES.FEEDS;
};

export const isInPageSearchAllowed = (pathname: string): boolean => {
  return Boolean(
    Object.keys(IN_PAGE_SEARCH_ROUTES).find((route) => pathname.includes(route))
  );
};

export const inPageSearchOptions = (pathname: string): Array<string> => {
  let strOptions: Array<string> = [];
  for (const route in IN_PAGE_SEARCH_ROUTES) {
    if (pathname.includes(route)) {
      strOptions = IN_PAGE_SEARCH_ROUTES[route];

      break;
    }
  }

  return strOptions;
};
