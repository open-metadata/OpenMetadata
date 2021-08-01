export type Tag = {
  description: string;
  fullyQualifiedName: string;
  name: string;
  associatedTags: Array<string>;
  usageCount: number;
};

export type TagsCategory = {
  name: string;
  description: string;
  categoryType?: string;
  children?: Array<Tag>;
  href?: string;
  usageCount?: number;
};
