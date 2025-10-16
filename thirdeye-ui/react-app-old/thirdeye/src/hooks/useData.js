import { useState, useEffect } from 'react';

// Custom hook for loading mock data
export const useData = () => {
  const [data, setData] = useState({
    summary: null,
    summaryExpansion: null,
    actionItems: null,
    loading: true,
    error: null
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        setData(prev => ({ ...prev, loading: true }));

        // Load all JSON files
        const [summaryRes, expansionRes, actionItemsRes] = await Promise.all([
          import('../data/summary.json'),
          import('../data/summary_expansion.json'),
          import('../data/action_items.json')
        ]);

        setData({
          summary: summaryRes.default,
          summaryExpansion: expansionRes.default,
          actionItems: actionItemsRes.default,
          loading: false,
          error: null
        });
      } catch (error) {
        console.error('Error loading data:', error);
        setData(prev => ({
          ...prev,
          loading: false,
          error: 'Failed to load data'
        }));
      }
    };

    loadData();
  }, []);

  return data;
};

// Custom hook for transforming action items data
export const useActionItemsData = (actionItemsRaw) => {
  return Object.entries(actionItemsRaw || {}).map(([key, item]) => {
    const urgencyMap = {
      'approvals': 'high',
      'pause_idle_whs': 'medium',
      'zero_it': 'low'
    };

    return {
      id: key,
      title: item.h1,
      subtitle: item.h2,
      detail: item.h3,
      primary: key === 'approvals' ? 'Zero It' : 'Simulate',
      secondary: key === 'approvals' ? 'Simulate' : undefined,
      urgency: urgencyMap[key] || 'medium'
    };
  });
};

// Custom hook for budget data
export const useBudgetData = (summaryExpansion) => {
  if (!summaryExpansion?.budget_and_forecast) {
    return {
      budget: '300k',
      budgetUsage: 328,
      forecast: '285k',
      forecastUsage: 95
    };
  }

  const { budget_and_forecast } = summaryExpansion;
  return {
    budget: budget_and_forecast.overall,
    budgetUsage: 328, // This would be calculated based on actual vs budget
    forecast: budget_and_forecast.forecast || '285k',
    forecastUsage: 95 // This would be calculated based on forecast vs budget
  };
};
