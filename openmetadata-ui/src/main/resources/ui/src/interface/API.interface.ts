import { Include } from '../generated/type/include';

export type ListParams = {
  fields?: string;
  limit?: number;
  before?: string;
  after?: string;
  include?: Include;
};
