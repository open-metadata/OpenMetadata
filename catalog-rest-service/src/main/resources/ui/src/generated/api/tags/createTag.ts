/**
 * Create tag API request
 */
export interface CreateTag {
  /**
   * Fully qualified names of tags associated with this tag
   */
  associatedTags?: string[];
  /**
   * Unique name of the tag category
   */
  description: string;
  name: string;
}
