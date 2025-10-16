import { z } from 'zod';
import { router, verifiedUserProcedure } from '../trpc';
import { trpcLogger, logError, logDatabaseQuery } from '../lib/logger';

export const dashboardRouter = router({
  // Get dashboard data using raw SQL (original query)
  getDashboardData: verifiedUserProcedure.query(async ({ ctx }) => {
    try {
      trpcLogger.info({
        procedure: 'getDashboardData'
      }, 'Fetching dashboard data from v_datalake_health_metrics');
      
      // Execute the original SQL query using Prisma's raw query
      const startTime = Date.now();
      const result = await ctx.prisma.$queryRaw`
        SELECT
          health_score,
          total_tables,
          active_tables,
          inactive_percentage,
          total_monthly_cost_usd,
          monthly_savings_opportunity_usd,
          0 as roi,
          0 as breakdown_compute,
          health_score as breakdown_storage,
          0 as breakdown_query,
          0 as breakdown_others
        FROM thirdeye.v_datalake_health_metrics 
        LIMIT 1
      ` as any[];
      
      const queryDuration = Date.now() - startTime;
      logDatabaseQuery(trpcLogger, 'SELECT health_score, total_tables... FROM v_datalake_health_metrics', queryDuration, { 
        procedure: 'getDashboardData',
        queryType: 'main'
      });

      if (!result || result.length === 0) {
        trpcLogger.warn({
          procedure: 'getDashboardData'
        }, 'No data found in v_datalake_health_metrics, falling back to fact_health_score_history');
        // Fallback to fact_health_score_history table if view doesn't exist
        const fallbackResult = await ctx.prisma.fact_health_score_history.findFirst({
          orderBy: {
            snapshot_date: 'desc'
          }
        });

        if (!fallbackResult) {
          trpcLogger.error({
            procedure: 'getDashboardData'
          }, 'No dashboard data found in both v_datalake_health_metrics and fact_health_score_history');
          throw new Error('No dashboard data found');
        }

        trpcLogger.info({
          procedure: 'getDashboardData',
          source: 'fact_health_score_history'
        }, 'Successfully fetched dashboard data from fallback table');

        // Convert BigInt values to numbers to avoid superjson metadata
        const convertBigIntToNumber = (value: any): number => {
          if (typeof value === 'bigint') {
            return Number(value);
          }
          return typeof value === 'number' ? value : parseFloat(value) || 0;
        };

        // Transform the data to match expected format
        const data = {
          health_score: convertBigIntToNumber(fallbackResult.health_score),
          total_tables: convertBigIntToNumber(fallbackResult.total_tables),
          active_tables: convertBigIntToNumber(fallbackResult.active_tables),
          inactive_percentage: fallbackResult.total_tables && fallbackResult.active_tables 
            ? ((Number(fallbackResult.total_tables) - Number(fallbackResult.active_tables)) / Number(fallbackResult.total_tables) * 100)
            : 0,
          total_monthly_cost_usd: convertBigIntToNumber(fallbackResult.monthly_savings_usd || 0),
          monthly_savings_opportunity_usd: convertBigIntToNumber(fallbackResult.monthly_savings_usd),
          roi: 0,
          breakdown_compute: 0,
          breakdown_storage: convertBigIntToNumber(fallbackResult.health_score),
          breakdown_query: 0,
          breakdown_others: 0
        };

        const response = {
          ziScore: {
            score: data.health_score,
            breakdown: {
              compute: data.breakdown_compute,
              storage: data.breakdown_storage,
              query: data.breakdown_query,
              others: data.breakdown_others
            }
          },
          budgetForecast: {
            total_monthly_cost_usd: data.total_monthly_cost_usd,
            monthly_savings_opportunity_usd: data.monthly_savings_opportunity_usd,
            roi: data.roi
          },
          metadata: {
            total_tables: data.total_tables,
            active_tables: data.active_tables,
            inactive_percentage: data.inactive_percentage
          }
        };

        return response;
      }

      const data = result[0];
      
      trpcLogger.info({
        procedure: 'getDashboardData',
        source: 'v_datalake_health_metrics',
        healthScore: data.health_score
      }, 'Successfully fetched dashboard data from main view');
      
      // Convert BigInt values to numbers to avoid superjson metadata
      const convertBigIntToNumber = (value: any): number => {
        if (typeof value === 'bigint') {
          return Number(value);
        }
        return typeof value === 'number' ? value : parseFloat(value) || 0;
      };
      
      // Format the response to match component expectations
      return {
        ziScore: {
          score: convertBigIntToNumber(data.health_score),
          breakdown: {
            compute: convertBigIntToNumber(data.breakdown_compute),
            storage: convertBigIntToNumber(data.breakdown_storage),
            query: convertBigIntToNumber(data.breakdown_query),
            others: convertBigIntToNumber(data.breakdown_others)
          }
        },
        budgetForecast: {
          total_monthly_cost_usd: convertBigIntToNumber(data.total_monthly_cost_usd),
          monthly_savings_opportunity_usd: convertBigIntToNumber(data.monthly_savings_opportunity_usd),
          roi: convertBigIntToNumber(data.roi)
        },
        metadata: {
          total_tables: convertBigIntToNumber(data.total_tables),
          active_tables: convertBigIntToNumber(data.active_tables),
          inactive_percentage: convertBigIntToNumber(data.inactive_percentage)
        }
      };
    } catch (error) {
      logError(trpcLogger, error as Error, {
        procedure: 'getDashboardData'
      });
      throw new Error('Failed to fetch dashboard data');
    }
  }),

  // Get health score history
  getHealthScoreHistory: verifiedUserProcedure
    .input(z.object({
      days: z.number().optional().default(30)
    }))
    .query(async ({ ctx, input }) => {
      try {
        trpcLogger.info({
          days: input.days,
          procedure: 'getHealthScoreHistory'
        }, `Fetching health score history for ${input.days} days`);
        
        const history = await ctx.prisma.fact_health_score_history.findMany({
          orderBy: {
            snapshot_date: 'desc'
          },
          take: input.days
        });

        trpcLogger.info({
          recordsReturned: history.length,
          days: input.days,
          procedure: 'getHealthScoreHistory'
        }, 'Successfully fetched health score history');

        return history;
      } catch (error) {
        logError(trpcLogger, error as Error, {
          days: input.days,
          procedure: 'getHealthScoreHistory'
        });
        throw new Error('Failed to fetch health score history');
      }
    }),

  // Get opportunity campaigns
  getOpportunityCampaigns: verifiedUserProcedure
    .input(z.object({
      status: z.enum(['OPEN', 'IN_REVIEW', 'COMPLETED', 'EXPIRED']).optional(),
      limit: z.number().optional().default(10)
    }))
    .query(async ({ ctx, input }) => {
      try {
        trpcLogger.info({
          status: input.status,
          limit: input.limit,
          procedure: 'getOpportunityCampaigns'
        }, 'Fetching opportunity campaigns');
        
        const campaigns = await ctx.prisma.opportunity_campaigns.findMany({
          where: input.status ? { status: input.status } : undefined,
          orderBy: {
            created_at: 'desc'
          },
          take: input.limit,
          include: {
            entity_decisions: true,
            cost_tracking: true
          }
        });

        trpcLogger.info({
          campaignsReturned: campaigns.length,
          status: input.status,
          limit: input.limit,
          procedure: 'getOpportunityCampaigns'
        }, 'Successfully fetched opportunity campaigns');

        return campaigns;
      } catch (error) {
        logError(trpcLogger, error as Error, {
          status: input.status,
          limit: input.limit,
          procedure: 'getOpportunityCampaigns'
        });
        throw new Error('Failed to fetch opportunity campaigns');
      }
    })
});
