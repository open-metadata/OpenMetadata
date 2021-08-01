export type Params = {
  searchQuery: string;
};

export type Service = {
  collection: {
    name: string;
    documentation: string;
    href: string;
  };
};
export type Team = {
  id: string;
  name: string;
  displayName: string;
  description: string;
  href: string;
};
