import React, { useState } from 'react';
import { 
  Trash2, 
  Clock, 
  Eye, 
  DollarSign, 
  Ghost, 
  RefreshCw, 
  HardDrive, 
  CalendarX, 
  Cpu, 
  TrendingDown,
  Filter,
  Search,
  Shield,
  Sparkles,
  Info,
  CheckCircle,
  AlertTriangle,
  XCircle
} from 'lucide-react';
import { trpc } from '../../lib/trpc-client';

// Icon mapping for technique icons
const iconMap = {
  'trash-2': Trash2,
  'clock': Clock,
  'eye': Eye,
  'dollar-sign': DollarSign,
  'ghost': Ghost,
  'refresh-cw': RefreshCw,
  'hard-drive': HardDrive,
  'calendar-x': CalendarX,
  'cpu': Cpu,
  'trending-down': TrendingDown,
};

// Color mapping for technique colors
const colorMap = {
  green: 'from-emerald-500 to-teal-500',
  yellow: 'from-yellow-500 to-orange-500',
  orange: 'from-orange-500 to-red-500',
  red: 'from-red-500 to-pink-500',
  purple: 'from-purple-500 to-indigo-500',
  blue: 'from-blue-500 to-cyan-500',
  indigo: 'from-indigo-500 to-purple-500',
  gray: 'from-gray-500 to-slate-500',
  cyan: 'from-cyan-500 to-blue-500',
  emerald: 'from-emerald-500 to-green-500',
};

// Priority color mapping
const priorityColorMap = {
  high: 'text-red-400 bg-red-500/10 border-red-500/20',
  medium: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  low: 'text-green-400 bg-green-500/10 border-green-500/20',
  info: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
};

const TechniquesShowcase: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedPriority, setSelectedPriority] = useState('all');

  // Fetch techniques data
  const { data: techniquesData, isLoading, error } = trpc.techniques.getTechniques.useQuery();
  const { data: statsData } = trpc.techniques.getTechniquesStats.useQuery();

  const techniques = techniquesData?.data || [];
  const stats = statsData?.data;

  // Filter techniques based on search and filters
  const filteredTechniques = techniques.filter(technique => {
    const matchesSearch = technique.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         technique.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || technique.category === selectedCategory;
    const matchesPriority = selectedPriority === 'all' || technique.priority === selectedPriority;
    
    return matchesSearch && matchesCategory && matchesPriority;
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-white/70">Loading optimization techniques...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <XCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Failed to Load Techniques</h2>
          <p className="text-white/70">{error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header Section */}
      <div className="relative overflow-hidden">
        <div className="relative max-w-7xl mx-auto px-6 py-12">
          <div className="text-center mb-12">
            <div className="flex items-center justify-center mb-6">
              <div className="relative">
                <Shield className="w-16 h-16 text-purple-400" />
                <Sparkles className="w-6 h-6 text-cyan-400 absolute -top-1 -right-1 animate-pulse" />
              </div>
            </div>
          </div>

          {/* Stats Overview */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6 text-center">
                <div className="text-3xl font-bold text-purple-400">{stats.totalTechniques}</div>
                <div className="text-white/70 text-sm">Total Techniques</div>
              </div>
              <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6 text-center">
                <div className="text-3xl font-bold text-cyan-400">{stats.enabledTechniques}</div>
                <div className="text-white/70 text-sm">Enabled</div>
              </div>
              <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6 text-center">
                <div className="text-3xl font-bold text-green-400">{stats.priorityBreakdown.high || 0}</div>
                <div className="text-white/70 text-sm">High Priority</div>
              </div>
              <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6 text-center">
                <div className="text-3xl font-bold text-yellow-400">{stats.tableTechniques}</div>
                <div className="text-white/70 text-sm">Table Techniques</div>
              </div>
            </div>
          )}

          {/* Search and Filters */}
          <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6 mb-8">
            <div className="flex flex-col md:flex-row gap-4">
              {/* Search */}
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-white/50" />
                <input
                  type="text"
                  placeholder="Search techniques..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50"
                />
              </div>

              {/* Category Filter */}
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-white/50" />
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="pl-10 pr-8 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 appearance-none cursor-pointer"
                >
                  <option value="all">All Categories</option>
                  <option value="table">Table Techniques</option>
                  <option value="summary">Summary Techniques</option>
                </select>
              </div>

              {/* Priority Filter */}
              <div className="relative">
                <AlertTriangle className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-white/50" />
                <select
                  value={selectedPriority}
                  onChange={(e) => setSelectedPriority(e.target.value)}
                  className="pl-10 pr-8 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 appearance-none cursor-pointer"
                >
                  <option value="all">All Priorities</option>
                  <option value="high">High Priority</option>
                  <option value="medium">Medium Priority</option>
                  <option value="low">Low Priority</option>
                  <option value="info">Info</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Techniques Grid */}
      <div className="max-w-7xl mx-auto px-6 pb-12">
        {filteredTechniques.length === 0 ? (
          <div className="text-center py-12">
            <Info className="w-16 h-16 text-white/30 mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-white mb-2">No Techniques Found</h3>
            <p className="text-white/70">Try adjusting your search or filter criteria.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filteredTechniques.map((technique) => {
              const IconComponent = iconMap[technique.icon as keyof typeof iconMap] || Shield;
              const gradientColor = colorMap[technique.color as keyof typeof colorMap] || colorMap.purple;
              const priorityStyle = priorityColorMap[technique.priority as keyof typeof priorityColorMap] || priorityColorMap.info;

              return (
                <div
                  key={technique.id}
                  className="group bg-white/5 backdrop-blur-xl rounded-xl border border-white/10 p-4 hover:bg-white/10 hover:border-white/20 transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-purple-500/10"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center space-x-1">
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium border ${priorityStyle}`}>
                        {technique.priority.charAt(0).toUpperCase()}
                      </span>
                      <CheckCircle className="w-3 h-3 text-green-400" title="Enabled" />
                    </div>
                  </div>

                  {/* Content */}
                  <div className="mb-3">
                    <h3 className="text-sm font-bold text-white mb-1 group-hover:text-purple-300 transition-colors line-clamp-2">
                      {technique.title}
                    </h3>
                    <p className="text-white/70 text-xs mb-1 line-clamp-2">
                      {technique.description}
                    </p>
                    <p className="text-white/50 text-xs line-clamp-1">
                      {technique.subtitle}
                    </p>
                  </div>

                  {/* Action & Category */}
                  <div className="flex items-center justify-between pt-2 border-t border-white/10">
                    <span className="text-xs text-white/50 uppercase tracking-wider truncate">
                      {technique.category}
                    </span>
                    <span className="px-2 py-0.5 bg-purple-500/20 text-purple-300 text-xs rounded font-medium truncate ml-1">
                      {technique.action.split('_')[0]}
                    </span>
                  </div>

                  {/* Hover Effect Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-600/0 to-cyan-600/0 group-hover:from-purple-600/5 group-hover:to-cyan-600/5 rounded-xl transition-all duration-300 pointer-events-none"></div>
                </div>
              );
            })}
          </div>
        )}

        {/* Results Summary */}
        <div className="mt-8 text-center">
          <p className="text-white/50 text-sm">
            Showing {filteredTechniques.length} of {techniques.length} optimization techniques
          </p>
        </div>
      </div>
    </div>
  );
};

export default TechniquesShowcase;
