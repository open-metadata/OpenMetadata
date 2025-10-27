# ZI Score Quick Reference Card

## 🚀 Quick Start

### Start Services
```bash
# Backend
cd thirdeye-py-service
uvicorn thirdeye.app:app --reload --port 8586

# Frontend
cd thirdeye-ui
npm run dev
```

### Test Backend
```bash
# Health check
curl http://localhost:8586/api/v1/thirdeye/health

# ZI Score summary
curl http://localhost:8586/api/v1/thirdeye/zi-score/summary

# Run test script
python thirdeye-py-service/test_zi_score_api.py
```

## 📡 API Endpoints

### REST API
```
GET /api/v1/thirdeye/zi-score              # Full score
GET /api/v1/thirdeye/zi-score/summary      # For UI gauge
GET /api/v1/thirdeye/zi-score/health-metrics    # Raw data
GET /api/v1/thirdeye/zi-score/purge-candidates  # Tables to delete
```

### GraphQL
```
POST /api/v1/thirdeye/graphql
```

**Query:**
```graphql
{
  ziScore {
    overall
    status
    breakdown { storage compute query }
  }
}
```

## 💻 Frontend Usage

### Simple Component
```typescript
import { thirdeyeClient } from '@/lib/thirdeyeClient';
import ZIScoreGauge from '@/components/features/ZIScoreGauge';

const data = await thirdeyeClient.getZIScoreSummary();

<ZIScoreGauge score={data.score} breakdown={data.breakdown} />
```

### With React Query
```typescript
const { data } = useQuery({
  queryKey: ['ziScore'],
  queryFn: () => thirdeyeClient.getZIScoreSummary(),
  staleTime: 5 * 60 * 1000,
});
```

## 📊 Response Format

```json
{
  "score": 74.5,
  "status": "GOOD",
  "breakdown": {
    "storage": 26.1,
    "compute": 29.8,
    "query": 18.6,
    "others": 0.0
  },
  "trend": "improving",
  "savings": {
    "monthly": 221.40,
    "annual": 2656.80
  }
}
```

## 🎯 Score Ranges

- **80-100**: EXCELLENT ✅
- **60-79**: GOOD 👍
- **40-59**: FAIR ⚠️
- **20-39**: POOR ❌
- **0-19**: CRITICAL 🚨

## 🔧 Troubleshooting

| Issue | Solution |
|-------|----------|
| 404 errors | Check service is running on port 8586 |
| NO_DATA status | Populate `fact_datalake_table_usage_inventory` |
| 401 auth errors | Ensure JWT token is valid |
| Slow queries | Add database indexes, enable caching |

## 📁 Key Files

### Backend
- `src/thirdeye/repo/te_write.py` - Database queries
- `src/thirdeye/services/zi_score.py` - Business logic
- `src/thirdeye/graphql/schema.py` - GraphQL schema
- `src/thirdeye/routers/zi_score.py` - REST endpoints
- `src/thirdeye/app.py` - App configuration

### Frontend
- `src/lib/thirdeyeClient.ts` - API client
- `src/components/features/ZIScoreGauge.tsx` - UI component

### Documentation
- `ZI_SCORE_API.md` - Complete API reference
- `ZI_SCORE_IMPLEMENTATION.md` - Technical details
- `ZI_SCORE_INTEGRATION.md` - Frontend guide
- `ZI_SCORE_COMPLETE_SUMMARY.md` - Full summary
- `test_zi_score_api.py` - Test script

## 🧪 Testing Commands

```bash
# Test all endpoints
python thirdeye-py-service/test_zi_score_api.py

# Manual cURL tests
curl http://localhost:8586/api/v1/thirdeye/zi-score
curl http://localhost:8586/api/v1/thirdeye/zi-score/summary
curl http://localhost:8586/api/v1/thirdeye/zi-score/purge-candidates?limit=10

# GraphQL test
curl -X POST http://localhost:8586/api/v1/thirdeye/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ ziScore { overall status } }"}'
```

## 📐 Calculation Formula

```
ZI Score = (Utilization × 40%) + 
           (Storage Efficiency × 35%) + 
           (Access Freshness × 25%)
```

## 🎨 Component Mapping

```typescript
// API Response → UI Component
{
  score: number,        // → ZIScoreGauge.score
  breakdown: {          // → ZIScoreGauge.breakdown
    storage: number,
    compute: number,
    query: number,
    others: number
  }
}
```

## ✅ Integration Checklist

- [ ] Database views exist (`v_datalake_health_metrics`)
- [ ] Sample data populated
- [ ] Backend service running (port 8586)
- [ ] Frontend dev server running (port 3000)
- [ ] Test endpoints with cURL
- [ ] Integrate ZIScoreGauge in dashboard
- [ ] Add error handling
- [ ] Test with real auth

## 🔗 Quick Links

- GraphQL Playground: `http://localhost:8586/api/v1/thirdeye/graphql`
- API Docs: `http://localhost:8586/docs`
- Health Check: `http://localhost:8586/api/v1/thirdeye/health`
- Frontend: `http://localhost:3000`

## 💡 Pro Tips

1. **Cache Results**: Use 5-15 minute cache TTL
2. **Load Summary First**: It's lighter than full data
3. **Paginate Purge Candidates**: Don't fetch >100 at once
4. **Handle NO_DATA**: Show appropriate message to users
5. **Monitor Performance**: Add logging for slow queries

---

**Need More Details?** See:
- `ZI_SCORE_API.md` for complete API reference
- `ZI_SCORE_INTEGRATION.md` for frontend examples
- `ZI_SCORE_COMPLETE_SUMMARY.md` for full documentation

