import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { prisma } from '../../lib/prisma';
import { trpcLogger, logError, logDatabaseQuery } from '../lib/logger';

export const insightsRouter = router({
  getInsightReport: protectedProcedure
    .input(z.object({
      reportType: z.enum(['storage', 'compute', 'query', 'other']),
      limit: z.number().min(1).max(1000).default(50),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ input }) => {
      const { reportType, limit, offset } = input;
      
      try {
        trpcLogger.info({
          reportType,
          limit,
          offset,
          procedure: 'getInsightReport'
        }, `Fetching ${reportType} insight report`);
        
        // Base query for all table data from v_table_purge_scores
        let whereClause = '';
        let orderByClause = '';
        
        // Customize query based on report type
        switch (reportType) {
          case 'storage':
            // Focus on storage-related metrics
            whereClause = 'WHERE COALESCE(SIZE_GB, 0) > 0';
            orderByClause = 'ORDER BY SIZE_GB DESC, monthly_cost_usd DESC';
            break;
            
          case 'compute':
            // Focus on compute-intensive tables (high query frequency)
            whereClause = 'WHERE COALESCE(ROLL_30D_TBL_QC, 0) > 0';
            orderByClause = 'ORDER BY ROLL_30D_TBL_QC DESC, ROLL_30D_TBL_UC DESC';
            break;
            
          case 'query':
            // Focus on query patterns and performance
            whereClause = 'WHERE COALESCE(ROLL_30D_TBL_QC, 0) > 0 OR COALESCE(days_since_access, 9999) <= 90';
            orderByClause = 'ORDER BY ROLL_30D_TBL_QC DESC, days_since_access ASC';
            break;
            
          case 'other':
            // Focus on miscellaneous metrics (purge scores, access patterns)
            whereClause = 'WHERE purge_score IS NOT NULL';
            orderByClause = 'ORDER BY purge_score DESC, days_since_access DESC';
            break;
            
          default:
            whereClause = '';
            orderByClause = 'ORDER BY monthly_cost_usd DESC';
        }

        // Get total count for pagination
        const countQuery = `
          SELECT COUNT(*) as total_count 
          FROM thirdeye.v_table_purge_scores 
          ${whereClause}
        `;
        
        const startTime = Date.now();
        const countResult = await prisma.$queryRawUnsafe(countQuery);
        const countDuration = Date.now() - startTime;
        logDatabaseQuery(trpcLogger, countQuery, countDuration, { reportType, queryType: 'count' });
        
        const totalCount = Number((countResult as any)[0]?.total_count || 0);

        // Get the actual data
        const dataQuery = `
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
          FROM thirdeye.v_table_purge_scores 
          ${whereClause}
          ${orderByClause}
          LIMIT ${limit} OFFSET ${offset}
        `;

        const dataStartTime = Date.now();
        const tables = await prisma.$queryRawUnsafe(dataQuery);
        const dataDuration = Date.now() - dataStartTime;
        logDatabaseQuery(trpcLogger, dataQuery, dataDuration, { reportType, queryType: 'data', limit, offset });
        
        // Convert BigInt values to strings for JSON serialization
        const processedTables = (tables as any[]).map(table => ({
          ...table,
          SIZE_GB: table.SIZE_GB ? Number(table.SIZE_GB) : 0,
          monthly_cost_usd: table.monthly_cost_usd ? Number(table.monthly_cost_usd) : 0,
          purge_score: table.purge_score ? Number(table.purge_score) : 0,
          ROLL_30D_TBL_QC: table.ROLL_30D_TBL_QC ? Number(table.ROLL_30D_TBL_QC) : 0,
          ROLL_30D_TBL_UC: table.ROLL_30D_TBL_UC ? Number(table.ROLL_30D_TBL_UC) : 0,
          days_since_access: table.days_since_access ? Number(table.days_since_access) : 0,
        }));

        trpcLogger.info({
          reportType,
          tablesReturned: processedTables.length,
          totalCount,
          pagination: {
            showing: `${offset + 1}-${Math.min(offset + limit, totalCount)}`,
            limit,
            offset
          },
          procedure: 'getInsightReport'
        }, `Successfully fetched ${reportType} insight report`);

        return {
          tables: processedTables,
          totalCount,
          reportType,
          pagination: {
            limit,
            offset,
            hasMore: offset + limit < totalCount,
            totalPages: Math.ceil(totalCount / limit),
            currentPage: Math.floor(offset / limit) + 1,
          }
        };

      } catch (error) {
        logError(trpcLogger, error as Error, {
          reportType,
          limit,
          offset,
          procedure: 'getInsightReport'
        });
        throw new Error(`Failed to fetch ${reportType} insight report: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }),

  getInsightSummary: protectedProcedure
    .query(async () => {
      try {
        trpcLogger.info({
          procedure: 'getInsightSummary'
        }, 'Fetching insight summary statistics');
        
        // Get summary statistics for all report types
        const summaryQuery = `
          SELECT 
            COUNT(*) as total_tables,
            SUM(CASE WHEN size_gb > 0 THEN 1 ELSE 0 END) as storage_tables,
            SUM(CASE WHEN total_queries_90d > 0 THEN 1 ELSE 0 END) as compute_tables,
            SUM(CASE WHEN total_queries_90d > 0 OR days_since_access <= 90 THEN 1 ELSE 0 END) as query_tables,
            SUM(CASE WHEN purge_score IS NOT NULL THEN 1 ELSE 0 END) as other_tables,
            SUM(monthly_cost_usd) as total_monthly_cost,
            AVG(purge_score) as avg_purge_score,
            SUM(size_gb) as total_size_gb
          FROM thirdeye.v_table_purge_scores
        `;

        const summaryStartTime = Date.now();
        const result = await prisma.$queryRawUnsafe(summaryQuery);
        const summaryDuration = Date.now() - summaryStartTime;
        logDatabaseQuery(trpcLogger, summaryQuery, summaryDuration, { queryType: 'summary' });
        
        const summary = (result as any)[0];

        const processedSummary = {
          totalTables: Number(summary.total_tables || 0),
          storageTables: Number(summary.storage_tables || 0),
          computeTables: Number(summary.compute_tables || 0),
          queryTables: Number(summary.query_tables || 0),
          otherTables: Number(summary.other_tables || 0),
          totalMonthlyCost: Number(summary.total_monthly_cost || 0),
          avgPurgeScore: Number(summary.avg_purge_score || 0),
          totalSizeGb: Number(summary.total_size_gb || 0),
        };

        trpcLogger.info({
          summary: processedSummary,
          procedure: 'getInsightSummary'
        }, 'Successfully fetched insight summary');
        
        return processedSummary;

      } catch (error) {
        logError(trpcLogger, error as Error, {
          procedure: 'getInsightSummary'
        });
        throw new Error(`Failed to fetch insight summary: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }),
});
