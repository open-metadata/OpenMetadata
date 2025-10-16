import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { ACTION_ITEM_CATEGORIES, ActionItemCategory } from '../constants/actionItemCategories';
import { trpcLogger, logError } from '../lib/logger';

export const techniquesRouter = router({
  // Get all available techniques for showcase
  getTechniques: protectedProcedure.query(async () => {
    try {
      trpcLogger.info({
        procedure: 'getTechniques'
      }, 'Fetching all techniques for showcase');
      
      // Transform the categories to include only showcase-relevant fields
      const techniques = ACTION_ITEM_CATEGORIES.map((category: ActionItemCategory) => ({
        id: category.id,
        title: category.title,
        description: category.description,
        subtitle: category.subtitle,
        icon: category.icon,
        color: category.color,
        priority: category.priority,
        action: category.action,
        category: category.category,
        // For future use - will be fetched from database
        enabled: true, // Default to enabled for showcase
        isActive: true, // Default to active for showcase
      }));

      trpcLogger.info({
        techniquesCount: techniques.length,
        procedure: 'getTechniques'
      }, 'Successfully fetched techniques');

      return {
        success: true,
        data: techniques,
        totalCount: techniques.length,
      };
    } catch (error) {
      logError(trpcLogger, error as Error, {
        procedure: 'getTechniques'
      });
      throw new Error('Failed to fetch techniques');
    }
  }),

  // Get technique by ID (for future detailed view)
  getTechniqueById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      try {
        trpcLogger.info({
          techniqueId: input.id,
          procedure: 'getTechniqueById'
        }, `Fetching technique by ID: ${input.id}`);
        
        const technique = ACTION_ITEM_CATEGORIES.find(
          (category) => category.id === input.id
        );

        if (!technique) {
          trpcLogger.warn({
            techniqueId: input.id,
            procedure: 'getTechniqueById'
          }, 'Technique not found');
          throw new Error('Technique not found');
        }

        trpcLogger.info({
          techniqueId: input.id,
          techniqueTitle: technique.title,
          procedure: 'getTechniqueById'
        }, 'Successfully fetched technique by ID');

        return {
          success: true,
          data: {
            ...technique,
            enabled: true,
            isActive: true,
            // Additional metadata for future use
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        };
      } catch (error) {
        logError(trpcLogger, error as Error, {
          techniqueId: input.id,
          procedure: 'getTechniqueById'
        });
        throw new Error('Failed to fetch technique');
      }
    }),

  // Get techniques by category (table/summary)
  getTechniquesByCategory: protectedProcedure
    .input(z.object({ category: z.string() }))
    .query(async ({ input }) => {
      try {
        trpcLogger.info({
          category: input.category,
          procedure: 'getTechniquesByCategory'
        }, `Fetching techniques by category: ${input.category}`);
        
        const techniques = ACTION_ITEM_CATEGORIES.filter(
          (category) => category.category === input.category
        ).map((category: ActionItemCategory) => ({
          id: category.id,
          title: category.title,
          description: category.description,
          subtitle: category.subtitle,
          icon: category.icon,
          color: category.color,
          priority: category.priority,
          action: category.action,
          category: category.category,
          enabled: true,
          isActive: true,
        }));

        trpcLogger.info({
          category: input.category,
          techniquesCount: techniques.length,
          procedure: 'getTechniquesByCategory'
        }, `Successfully fetched ${techniques.length} techniques for category: ${input.category}`);

        return {
          success: true,
          data: techniques,
          totalCount: techniques.length,
        };
      } catch (error) {
        logError(trpcLogger, error as Error, {
          category: input.category,
          procedure: 'getTechniquesByCategory'
        });
        throw new Error('Failed to fetch techniques by category');
      }
    }),

  // Get techniques statistics for overview
  getTechniquesStats: protectedProcedure.query(async () => {
    try {
      trpcLogger.info({
        procedure: 'getTechniquesStats'
      }, 'Fetching techniques statistics');
      
      const totalTechniques = ACTION_ITEM_CATEGORIES.length;
      const tableTechniques = ACTION_ITEM_CATEGORIES.filter(
        (cat) => cat.category === 'table'
      ).length;
      const summaryTechniques = ACTION_ITEM_CATEGORIES.filter(
        (cat) => cat.category === 'summary'
      ).length;

      const priorityBreakdown = ACTION_ITEM_CATEGORIES.reduce((acc, cat) => {
        acc[cat.priority] = (acc[cat.priority] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const stats = {
        totalTechniques,
        tableTechniques,
        summaryTechniques,
        priorityBreakdown,
        enabledTechniques: totalTechniques, // All enabled for showcase
        activeTechniques: totalTechniques, // All active for showcase
      };

      trpcLogger.info({
        stats,
        procedure: 'getTechniquesStats'
      }, 'Successfully fetched techniques statistics');

      return {
        success: true,
        data: stats,
      };
    } catch (error) {
      logError(trpcLogger, error as Error, {
        procedure: 'getTechniquesStats'
      });
      throw new Error('Failed to fetch techniques statistics');
    }
  }),
});
