import { z } from 'zod';
import { router, verifiedUserProcedure, protectedProcedure } from '../trpc';
import { prisma } from '../../lib/prisma';
import { ACTION_ITEM_CATEGORIES, ACTION_ITEM_QUERY_MAPPINGS, SUMMARY_TILE_CONFIG } from '../constants/actionItemCategories';

export const actionItemsRouter = router({
  // Get all action items with real-time database data
  getActionItems: verifiedUserProcedure.query(async () => {
    try {
      // Helper function to convert BigInt to number for JSON serialization
      const convertBigInt = (value: any): number => {
        return typeof value === 'bigint' ? Number(value) : (value || 0);
      };

      // Use action item categories from constants
      const actionItemCategories = ACTION_ITEM_CATEGORIES;

      // Execute all queries in parallel
      const actionItemsWithData = await Promise.all(
        actionItemCategories.map(async (category) => {
          try {
            const result = await prisma.$queryRawUnsafe(category.query) as any[];
            const data = result[0] || { count: 0, cost: 0 };
            
            return {
              id: category.id,
              title: category.title,
              description: category.description,
              subtitle: category.subtitle,
              icon: category.icon,
              color: category.color,
              cost: Math.round(convertBigInt(data.cost)),
              count: convertBigInt(data.count),
              savings: null,
              metadata: {
                type: category.category,
                condition: category.query,
                description: `${category.description} - ${category.subtitle}`,
                action: category.action,
                priority: category.priority
              },
              category: category.category,
              priority: category.priority,
              action: category.action,
              status: 'pending'
            };
          } catch (error) {
            console.error(`Error executing query for ${category.id}:`, error);
            return {
              id: category.id,
              title: category.title,
              description: category.description,
              subtitle: category.subtitle,
              icon: category.icon,
              color: category.color,
              cost: 0,
              count: 0,
              savings: null,
              metadata: {
                type: category.category,
                condition: category.query,
                description: `${category.description} - ${category.subtitle}`,
                action: category.action,
                priority: category.priority
              },
              category: category.category,
              priority: category.priority,
              action: category.action,
              status: 'pending'
            };
          }
        })
      );

      // Calculate total potential savings using the constant query
      const totalPotentialSavings = await (async () => {
        try {
          const result = await prisma.$queryRawUnsafe(SUMMARY_TILE_CONFIG.query) as any[];
          return Math.round(convertBigInt(result[0]?.total_savings));
        } catch (error) {
          console.error('Error calculating total potential savings:', error);
          return 0;
        }
      })();

      // Add summary tile using the constant configuration
      const summaryTile = {
        id: SUMMARY_TILE_CONFIG.id,
        title: SUMMARY_TILE_CONFIG.title,
        description: SUMMARY_TILE_CONFIG.description,
        subtitle: SUMMARY_TILE_CONFIG.subtitle,
        icon: SUMMARY_TILE_CONFIG.icon,
        color: SUMMARY_TILE_CONFIG.color,
        cost: totalPotentialSavings,
        count: 0,
        savings: totalPotentialSavings,
        metadata: {
          type: SUMMARY_TILE_CONFIG.category,
          condition: SUMMARY_TILE_CONFIG.query,
          description: 'Total monthly cost savings from all optimization actions',
          action: SUMMARY_TILE_CONFIG.action,
          priority: SUMMARY_TILE_CONFIG.priority
        },
        category: SUMMARY_TILE_CONFIG.category,
        priority: SUMMARY_TILE_CONFIG.priority,
        action: SUMMARY_TILE_CONFIG.action,
        status: 'pending'
      };

      const allActionItems = [...actionItemsWithData, summaryTile];

      return {
        actionItems: allActionItems,
        totalItems: allActionItems.length,
        pendingItems: allActionItems.filter(item => item.status === 'pending').length,
        totalPotentialSavings: totalPotentialSavings
      };
    } catch (error) {
      console.error('Error fetching action items:', error);
      throw new Error('Failed to fetch action items');
    }
  }),

  // Get action items by category
  getActionItemsByCategory: protectedProcedure
    .input(z.object({
      category: z.enum(['table', 'summary']).optional(),
      priority: z.enum(['high', 'medium', 'low', 'info']).optional(),
      status: z.enum(['pending', 'in_progress', 'completed']).optional()
    }))
    .query(async ({ input }) => {
      try {
        // Get all action items first
        const allActionItemsResult = await actionItemsRouter.createCaller({}).getActionItems();
        let filteredItems = allActionItemsResult.actionItems;

        // Apply filters
        if (input.category) {
          filteredItems = filteredItems.filter(item => item.category === input.category);
        }
        
        if (input.priority) {
          filteredItems = filteredItems.filter(item => item.priority === input.priority);
        }
        
        if (input.status) {
          filteredItems = filteredItems.filter(item => item.status === input.status);
        }

        return {
          actionItems: filteredItems,
          totalItems: filteredItems.length,
          filters: {
            category: input.category,
            priority: input.priority,
            status: input.status
          }
        };
      } catch (error) {
        console.error('Error fetching filtered action items:', error);
        throw new Error('Failed to fetch filtered action items');
      }
    }),

  // Get action item by ID with real-time data
  getActionItemById: protectedProcedure
    .input(z.object({
      id: z.string()
    }))
    .query(async ({ input }) => {
      try {
        // Get all action items and find the requested one
        const allActionItemsResult = await actionItemsRouter.createCaller({}).getActionItems();
        const item = allActionItemsResult.actionItems.find(item => item.id === input.id);
        
        if (!item) {
          throw new Error(`Action item with id '${input.id}' not found`);
        }

        return item;
      } catch (error) {
        console.error('Error fetching action item:', error);
        throw new Error('Failed to fetch action item');
      }
    }),

  // Get detailed table list for a specific action item
  getActionItemTables: protectedProcedure
    .input(z.object({
      actionItemId: z.string(),
      limit: z.number().optional().default(50),
      offset: z.number().optional().default(0)
    }).optional())
    .query(async ({ input }) => {
      try {
        const { actionItemId = 'safe_to_purge', limit = 50, offset = 0 } = input || {};
        
        // Helper function to convert BigInt to number for JSON serialization
        const convertBigInt = (value: any): number => {
          return typeof value === 'bigint' ? Number(value) : (value || 0);
        };

        // Find the action item category configuration
        const actionItemCategory = ACTION_ITEM_CATEGORIES.find(cat => cat.id === actionItemId);
        
        if (!actionItemCategory) {
          throw new Error(`Action item with id '${actionItemId}' not found`);
        }

        // Get the query mapping for detailed table data
        const queryMapping = ACTION_ITEM_QUERY_MAPPINGS[actionItemId];
        
        if (!queryMapping) {
          throw new Error(`No query mapping found for action item '${actionItemId}'`);
        }

        // Build the detailed query to get actual table records
        const detailQuery = `
          SELECT 
            FQN,
            DATABASE_NAME,
            DB_SCHEMA,
            TABLE_NAME,
            COALESCE(SIZE_GB, 0) as SIZE_GB,
            COALESCE(days_since_access, 9999) as days_since_access,
            COALESCE(ROLL_30D_TBL_QC, 0) as ROLL_30D_TBL_QC,
            COALESCE(ROLL_30D_TBL_UC, 0) as ROLL_30D_TBL_UC,
            COALESCE(purge_score, 0) as purge_score,
            COALESCE(monthly_cost_usd, 0) as monthly_cost_usd,
            LAST_ACCESSED_DATE,
            LAST_REFRESHED_DATE
          FROM v_table_purge_scores 
          ${queryMapping.whereClause}
          ${queryMapping.orderClause}
          LIMIT ${limit} OFFSET ${offset}
        `.trim();

        // Get count query for pagination
        const countQuery = `
          SELECT COUNT(*) as total_count 
          FROM v_table_purge_scores 
          ${queryMapping.whereClause}
        `;

        // Debug logging (can be removed in production)
        console.log('🔍 getActionItemTables:', { actionItemId, limit, offset });

        // Execute both queries in parallel
        const [tablesResult, countResult] = await Promise.all([
          prisma.$queryRawUnsafe(detailQuery) as Promise<any[]>,
          prisma.$queryRawUnsafe(countQuery) as Promise<any[]>
        ]);

        // Log results summary
        console.log('📊 Query results:', { tablesCount: tablesResult.length, totalCount: convertBigInt(countResult[0]?.total_count || 0) });

        // Process the results
        const tables = tablesResult.map(table => ({
          FQN: table.FQN || '',
          DATABASE_NAME: table.DATABASE_NAME || '',
          DB_SCHEMA: table.DB_SCHEMA || '',
          TABLE_NAME: table.TABLE_NAME || '',
          SIZE_GB: convertBigInt(table.SIZE_GB),
          days_since_access: convertBigInt(table.days_since_access),
          ROLL_30D_TBL_QC: convertBigInt(table.ROLL_30D_TBL_QC),
          ROLL_30D_TBL_UC: convertBigInt(table.ROLL_30D_TBL_UC),
          purge_score: parseFloat(table.purge_score) || 0,
          monthly_cost_usd: parseFloat(table.monthly_cost_usd) || 0,
          LAST_ACCESSED_DATE: table.LAST_ACCESSED_DATE ? table.LAST_ACCESSED_DATE.toISOString() : null,
          LAST_REFRESHED_DATE: table.LAST_REFRESHED_DATE ? table.LAST_REFRESHED_DATE.toISOString() : null
        }));

        const totalCount = convertBigInt(countResult[0]?.total_count || 0);
        const hasMore = (offset + limit) < totalCount;

        return {
          tables,
          totalCount,
          hasMore,
          actionItem: {
            id: actionItemId,
            title: actionItemCategory.title,
            description: actionItemCategory.description,
            subtitle: actionItemCategory.subtitle,
            category: actionItemCategory.category,
            priority: actionItemCategory.priority,
            action: actionItemCategory.action
          }
        };
      } catch (error) {
        console.error('Error fetching action item tables:', error);
        console.error('Error details:', {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : 'No stack trace',
          actionItemId: input?.actionItemId || 'unknown',
          queryMapping: input?.actionItemId ? ACTION_ITEM_QUERY_MAPPINGS[input.actionItemId] : 'unknown'
        });
        throw new Error(`Failed to fetch action item tables: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }),

  // Test endpoint to verify the getActionItemTables logic works
  testActionItemTables: protectedProcedure
    .input(z.object({
      actionItemId: z.string().optional().default('safe_to_purge')
    }).optional())
    .query(async ({ input }) => {
      console.log('testActionItemTables called with input:', input);
      console.log('Input type:', typeof input);
      console.log('Input is undefined:', input === undefined);
      console.log('Input is null:', input === null);
      try {
        // Call the same logic as getActionItemTables but with simpler error handling
        const { actionItemId = 'safe_to_purge' } = input || {};
        console.log('Extracted actionItemId:', actionItemId);
        
        // Helper function to convert BigInt to number for JSON serialization
        const convertBigInt = (value: any): number => {
          return typeof value === 'bigint' ? Number(value) : (value || 0);
        };

        // Find the action item category configuration
        const actionItemCategory = ACTION_ITEM_CATEGORIES.find(cat => cat.id === actionItemId);
        
        if (!actionItemCategory) {
          throw new Error(`Action item with id '${actionItemId}' not found`);
        }

        // Get the query mapping for detailed table data
        const queryMapping = ACTION_ITEM_QUERY_MAPPINGS[actionItemId];
        
        if (!queryMapping) {
          throw new Error(`No query mapping found for action item '${actionItemId}'`);
        }

        console.log('Query mapping found:', queryMapping);

        // Build a simple test query first
        const testQuery = `
          SELECT COUNT(*) as test_count
          FROM v_table_purge_scores 
          ${queryMapping.whereClause}
        `;

        console.log('Executing test query:', testQuery);
        const testResult = await prisma.$queryRawUnsafe(testQuery) as any[];
        console.log('Test query result:', testResult);

        return {
          tables: [],
          totalCount: convertBigInt(testResult[0]?.test_count || 0),
          hasMore: false,
          actionItem: {
            id: actionItemId,
            title: actionItemCategory.title,
            description: actionItemCategory.description,
            subtitle: actionItemCategory.subtitle,
            category: actionItemCategory.category,
            priority: actionItemCategory.priority,
            action: actionItemCategory.action
          },
          debug: {
            queryMapping,
            testResult: testResult[0]
          }
        };
      } catch (error) {
        console.error('Error in test endpoint:', error);
        throw new Error(`Test endpoint failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    })

});
