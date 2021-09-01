/**
 * This schema defines the Tag Category entity. A Tag Category contains tags called Primary
 * Tags. Primary Tags can further have children Tags called Secondary Tags. Only two levels
 * of tags are supported currently.
 */
export interface TagCategory {
  categoryType: TagCategoryType;
  /**
   * Tags under this category.
   */
  children?: Array<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    any[] | boolean | TagClass | number | number | null | string
  >;
  /**
   * Description of the tag category.
   */
  description: string;
  /**
   * Link to the resource corresponding to the tag category.
   */
  href?: string;
  name: string;
  /**
   * Count of how many times the tags from this tag category are used.
   */
  usageCount?: number;
}

/**
 * Type of tag category.
 */
export enum TagCategoryType {
  Classification = 'Classification',
  Descriptive = 'Descriptive',
}

export interface TagClass {
  /**
   * Fully qualified names of tags associated with this tag. Associated tags captures
   * relationship of one tag to another automatically. As an example a tag 'User.PhoneNumber'
   * might have an associated tag 'PII.Sensitive'. When 'User.Address' is used to label a
   * column in a table, 'PII.Sensitive' label is also applied automatically due to Associated
   * tag relationship.
   */
  associatedTags?: string[];
  /**
   * Tags under this tag group or empty for tags at the leaf level.
   */
  children?: Array<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    any[] | boolean | TagClass | number | number | null | string
  >;
  /**
   * If the tag is deprecated.
   */
  deprecated?: boolean;
  /**
   * Unique name of the tag category.
   */
  description: string;
  /**
   * Unique name of the tag of format Category.PrimaryTag.SecondaryTag.
   */
  fullyQualifiedName?: string;
  /**
   * Link to the resource corresponding to the tag.
   */
  href?: string;
  /**
   * Name of the tag.
   */
  name: string;
  /**
   * Count of how many times this tag and children tags are used.
   */
  usageCount?: number;
}
