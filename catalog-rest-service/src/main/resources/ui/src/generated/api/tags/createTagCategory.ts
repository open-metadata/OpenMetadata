/**
 * Create tag category request
 */
export interface CreateTagCategory {
  categoryType: TagCategoryType;
  /**
   * Description of the tag category
   */
  description: string;
  name: string;
}

/**
 * Type of tag category.
 */
export enum TagCategoryType {
  Classification = 'Classification',
  Descriptive = 'Descriptive',
}
