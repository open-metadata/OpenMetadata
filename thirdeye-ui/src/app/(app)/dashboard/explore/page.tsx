'use client';

import { useState, useEffect, useCallback } from 'react';
import { Search, Filter, Database, Table, User, Tag } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useDebounce } from '@/hooks/useDebounce';

// Mock search results
const mockResults = [
  { id: '1', name: 'sales_data', type: 'table', service: 'Snowflake', owner: 'John Doe', tags: ['sales', 'revenue'] },
  { id: '2', name: 'customer_info', type: 'table', service: 'PostgreSQL', owner: 'Jane Smith', tags: ['customer', 'profile'] },
  { id: '3', name: 'user_analytics', type: 'dashboard', service: 'Superset', owner: 'Mike Johnson', tags: ['analytics', 'users'] },
  { id: '4', name: 'product_catalog', type: 'table', service: 'MySQL', owner: 'Sarah Wilson', tags: ['products', 'inventory'] },
  { id: '5', name: 'order_processing', type: 'pipeline', service: 'Airflow', owner: 'David Brown', tags: ['orders', 'processing'] },
];

const entityTypes = [
  { value: 'all', label: 'All Types' },
  { value: 'table', label: 'Tables' },
  { value: 'dashboard', label: 'Dashboards' },
  { value: 'pipeline', label: 'Pipelines' },
  { value: 'service', label: 'Services' },
];

const owners = [
  { value: 'all', label: 'All Owners' },
  { value: 'John Doe', label: 'John Doe' },
  { value: 'Jane Smith', label: 'Jane Smith' },
  { value: 'Mike Johnson', label: 'Mike Johnson' },
  { value: 'Sarah Wilson', label: 'Sarah Wilson' },
  { value: 'David Brown', label: 'David Brown' },
];

export default function ExplorePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [entityTypeFilter, setEntityTypeFilter] = useState('all');
  const [ownerFilter, setOwnerFilter] = useState('all');
  const [results, setResults] = useState(mockResults);
  const [isLoading, setIsLoading] = useState(false);

  const debouncedQuery = useDebounce(searchQuery, 300);

  const filteredResults = results.filter(item => {
    const matchesQuery = debouncedQuery === '' || 
      item.name.toLowerCase().includes(debouncedQuery.toLowerCase()) ||
      item.tags.some(tag => tag.toLowerCase().includes(debouncedQuery.toLowerCase()));
    
    const matchesEntityType = entityTypeFilter === 'all' || item.type === entityTypeFilter;
    const matchesOwner = ownerFilter === 'all' || item.owner === ownerFilter;
    
    return matchesQuery && matchesEntityType && matchesOwner;
  });

  const getEntityIcon = (type: string) => {
    switch (type) {
      case 'table': return <Table className="h-4 w-4" />;
      case 'dashboard': return <Database className="h-4 w-4" />;
      case 'pipeline': return <Database className="h-4 w-4" />;
      default: return <Database className="h-4 w-4" />;
    }
  };

  const getEntityColor = (type: string) => {
    switch (type) {
      case 'table': return 'bg-blue-100 text-blue-800';
      case 'dashboard': return 'bg-green-100 text-green-800';
      case 'pipeline': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Explore</h1>
        <p className="text-muted-foreground">
          Search and discover your data assets across all services
        </p>
      </div>

      {/* Search and Filters */}
      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tables, dashboards, pipelines..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="flex gap-4">
          <Select value={entityTypeFilter} onValueChange={setEntityTypeFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Entity Type" />
            </SelectTrigger>
            <SelectContent>
              {entityTypes.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={ownerFilter} onValueChange={setOwnerFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Owner" />
            </SelectTrigger>
            <SelectContent>
              {owners.map((owner) => (
                <SelectItem key={owner.value} value={owner.value}>
                  {owner.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="outline" size="sm">
            <Filter className="h-4 w-4 mr-2" />
            More Filters
          </Button>
        </div>
      </div>

      {/* Results */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {filteredResults.length} results found
          </p>
        </div>

        <div className="grid gap-4">
          {filteredResults.map((item) => (
            <div key={item.id} className="rounded-lg border bg-card p-4 hover:shadow-sm transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-1">
                    {getEntityIcon(item.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm">{item.name}</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      {item.service} • {item.owner}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="secondary" className={getEntityColor(item.type)}>
                        {item.type}
                      </Badge>
                      {item.tags.map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          <Tag className="h-3 w-3 mr-1" />
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
                <Button variant="ghost" size="sm">
                  View Details
                </Button>
              </div>
            </div>
          ))}
        </div>

        {filteredResults.length === 0 && (
          <div className="text-center py-12">
            <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No results found</h3>
            <p className="text-muted-foreground">
              Try adjusting your search query or filters
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
