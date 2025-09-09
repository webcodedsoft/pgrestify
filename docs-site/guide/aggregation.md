# Aggregation & Functions

Master data aggregation in PGRestify with COUNT, SUM, AVG, MIN, MAX operations, GROUP BY patterns, window functions, and custom PostgreSQL functions.

## Overview

PGRestify provides comprehensive support for data aggregation through PostgREST's aggregation capabilities. You can perform statistical calculations, group data, and use advanced window functions to analyze your data efficiently without retrieving raw records.

## Basic Aggregation Functions

### COUNT Operations

#### Simple Record Counting

```typescript
// Get total count of records
const totalUsers = await client
  .from('users')
  .select('*', { count: 'exact' })
  .execute();

console.log(`Total users: ${totalUsers.count}`); // e.g., Total users: 1500

// Count with head: true returns only the count, no data
const userCount = await client
  .from('users')
  .select('*', { count: 'exact', head: true })
  .execute();

console.log(`User count: ${userCount.count}`);
// No data returned, only count
```

#### Filtered Counting

```typescript
// Count active users only
const activeUserCount = await client
  .from('users')
  .select('*', { count: 'exact', head: true })
  .eq('is_active', true)
  .execute();

// Count posts published in the last month
const lastMonth = new Date();
lastMonth.setMonth(lastMonth.getMonth() - 1);

const recentPostCount = await client
  .from('posts')
  .select('*', { count: 'exact', head: true })
  .gte('published_at', lastMonth.toISOString())
  .eq('status', 'published')
  .execute();
```

#### Distinct Counting

```typescript
// Count distinct values (requires custom RPC function)
const uniqueCategories = await client
  .rpc('count_distinct_categories')
  .execute();

// Or using a view with distinct
const distinctAuthors = await client
  .from('distinct_post_authors_view')
  .select('*', { count: 'exact', head: true })
  .execute();
```

### SUM Operations

```typescript
// Sum using RPC functions (PostgreSQL doesn't support SUM in PostgREST select directly)
const totalRevenue = await client
  .rpc('sum_order_totals')
  .execute();

// Sum with filters
const thisMonthRevenue = await client
  .rpc('sum_order_totals', {
    start_date: '2024-01-01',
    end_date: '2024-01-31'
  })
  .execute();

// Sum by category using GROUP BY (via RPC)
const revenueByCategory = await client
  .rpc('sum_revenue_by_category')
  .execute();
```

### AVG (Average) Operations

```typescript
// Calculate averages using RPC functions
const averageOrderValue = await client
  .rpc('calculate_average_order_value')
  .execute();

// Average with grouping
const averageScoreByCategory = await client
  .rpc('avg_score_by_category')
  .execute();

// Average rating for products
const averageRating = await client
  .rpc('get_average_product_rating', { product_id: 123 })
  .execute();
```

### MIN/MAX Operations

```typescript
// Find minimum and maximum values
const priceRange = await client
  .rpc('get_price_range')
  .execute();

// Latest and earliest dates
const dateRange = await client
  .rpc('get_date_range', { table_name: 'posts' })
  .execute();

// Min/Max with grouping
const categoryPriceRanges = await client
  .rpc('get_price_range_by_category')
  .execute();
```

## GROUP BY Patterns

### Basic Grouping with RPC Functions

```typescript
// Group users by registration date
const usersByDate = await client
  .rpc('group_users_by_registration_date')
  .execute();

// Group orders by month
const ordersByMonth = await client
  .rpc('group_orders_by_month')
  .execute();

// Group products by category with counts
const productsByCategory = await client
  .rpc('count_products_by_category')
  .execute();
```

### Advanced Grouping Patterns

```typescript
// Complex grouping with multiple dimensions
const salesAnalysis = await client
  .rpc('sales_analysis_by_region_and_month')
  .execute();

// Grouping with calculated fields
const userActivityStats = await client
  .rpc('user_activity_statistics')
  .execute();

// Result example:
// [
//   { region: 'North', month: '2024-01', total_sales: 50000, order_count: 150 },
//   { region: 'South', month: '2024-01', total_sales: 35000, order_count: 98 }
// ]
```

### Custom GROUP BY Functions

```typescript
// Create a function to group data dynamically
const getGroupedData = async (
  groupBy: 'day' | 'week' | 'month',
  dateColumn = 'created_at'
) => {
  return client
    .rpc('group_data_by_period', {
      period: groupBy,
      date_col: dateColumn
    })
    .execute();
};

// Usage
const dailyStats = await getGroupedData('day');
const monthlyStats = await getGroupedData('month');
```

## Window Functions

### Basic Window Functions

```typescript
// Ranking functions
const topPerformers = await client
  .rpc('get_employee_rankings')
  .execute();

// Result with rankings:
// [
//   { name: 'Alice', score: 95, rank: 1, dense_rank: 1 },
//   { name: 'Bob', score: 90, rank: 2, dense_rank: 2 },
//   { name: 'Charlie', score: 90, rank: 3, dense_rank: 2 }
// ]

// Moving averages
const movingAverages = await client
  .rpc('calculate_moving_averages', { window_size: 7 })
  .execute();

// Cumulative sums
const cumulativeSales = await client
  .rpc('calculate_cumulative_sales')
  .execute();
```

### Advanced Window Operations

```typescript
// Partition-based window functions
const departmentStats = await client
  .rpc('calculate_department_statistics')
  .execute();

// Result with partitioned data:
// [
//   { 
//     employee: 'Alice', 
//     department: 'Engineering', 
//     salary: 80000,
//     dept_avg: 75000,
//     dept_rank: 1
//   }
// ]

// Lead/Lag operations for time series
const timeSeriesAnalysis = await client
  .rpc('analyze_time_series_data')
  .execute();
```

### Custom Window Function Examples

```sql
-- Example PostgreSQL function for rankings
CREATE OR REPLACE FUNCTION get_product_rankings()
RETURNS TABLE (
  product_id INT,
  product_name TEXT,
  total_sales NUMERIC,
  sales_rank INT,
  category TEXT,
  category_rank INT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    COALESCE(SUM(oi.quantity * oi.unit_price), 0) as total_sales,
    RANK() OVER (ORDER BY COALESCE(SUM(oi.quantity * oi.unit_price), 0) DESC) as sales_rank,
    p.category,
    RANK() OVER (
      PARTITION BY p.category 
      ORDER BY COALESCE(SUM(oi.quantity * oi.unit_price), 0) DESC
    ) as category_rank
  FROM products p
  LEFT JOIN order_items oi ON p.id = oi.product_id
  GROUP BY p.id, p.name, p.category;
END;
$$ LANGUAGE plpgsql;
```

## Statistical Functions

### Basic Statistics

```typescript
// Get comprehensive statistics for numerical columns
const productStats = await client
  .rpc('get_product_price_statistics')
  .execute();

// Result example:
// {
//   count: 1000,
//   mean: 299.99,
//   median: 199.99,
//   mode: 99.99,
//   std_dev: 150.25,
//   variance: 22575.06,
//   min: 9.99,
//   max: 1999.99
// }

// Distribution analysis
const priceDistribution = await client
  .rpc('analyze_price_distribution', { bucket_count: 10 })
  .execute();
```

### Correlation and Advanced Analytics

```typescript
// Correlation between different metrics
const correlationAnalysis = await client
  .rpc('calculate_metric_correlations')
  .execute();

// Trend analysis
const trendData = await client
  .rpc('analyze_sales_trends', { 
    start_date: '2024-01-01',
    end_date: '2024-12-31' 
  })
  .execute();

// Percentile calculations
const percentileData = await client
  .rpc('calculate_performance_percentiles')
  .execute();
```

## Custom PostgreSQL Functions

### Creating Aggregation Functions

```sql
-- Example: Monthly revenue calculation
CREATE OR REPLACE FUNCTION monthly_revenue(
  start_month DATE DEFAULT DATE_TRUNC('month', CURRENT_DATE)
)
RETURNS TABLE (
  month DATE,
  revenue NUMERIC,
  order_count BIGINT,
  avg_order_value NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    DATE_TRUNC('month', o.created_at) as month,
    SUM(o.total_amount) as revenue,
    COUNT(*) as order_count,
    AVG(o.total_amount) as avg_order_value
  FROM orders o
  WHERE o.created_at >= start_month
    AND o.status = 'completed'
  GROUP BY DATE_TRUNC('month', o.created_at)
  ORDER BY month;
END;
$$ LANGUAGE plpgsql;
```

### Complex Business Logic Functions

```sql
-- Customer lifetime value calculation
CREATE OR REPLACE FUNCTION calculate_customer_ltv()
RETURNS TABLE (
  customer_id INT,
  customer_name TEXT,
  total_orders BIGINT,
  total_spent NUMERIC,
  avg_order_value NUMERIC,
  ltv_score NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id as customer_id,
    c.name as customer_name,
    COUNT(o.id) as total_orders,
    COALESCE(SUM(o.total_amount), 0) as total_spent,
    COALESCE(AVG(o.total_amount), 0) as avg_order_value,
    -- Simple LTV calculation
    COALESCE(SUM(o.total_amount), 0) * 
    (CASE 
      WHEN COUNT(o.id) > 10 THEN 1.5
      WHEN COUNT(o.id) > 5 THEN 1.2
      ELSE 1.0
    END) as ltv_score
  FROM customers c
  LEFT JOIN orders o ON c.id = o.customer_id
  GROUP BY c.id, c.name
  ORDER BY ltv_score DESC;
END;
$$ LANGUAGE plpgsql;
```

### Calling Custom Functions

```typescript
// Call monthly revenue function
const monthlyRevenue = await client
  .rpc('monthly_revenue', { 
    start_month: '2024-01-01' 
  })
  .execute();

// Call customer LTV calculation
const customerLTV = await client
  .rpc('calculate_customer_ltv')
  .execute();

// Call with multiple parameters
const salesAnalysis = await client
  .rpc('analyze_sales_performance', {
    start_date: '2024-01-01',
    end_date: '2024-12-31',
    include_refunds: false,
    group_by_region: true
  })
  .execute();
```

## Dynamic Aggregation Patterns

### Flexible Aggregation Functions

```typescript
interface AggregationRequest {
  table: string;
  groupBy: string[];
  aggregates: Array<{
    field: string;
    operation: 'sum' | 'avg' | 'count' | 'min' | 'max';
    alias?: string;
  }>;
  filters?: Record<string, any>;
}

const performDynamicAggregation = async (request: AggregationRequest) => {
  // This would call a generic aggregation function
  return client
    .rpc('dynamic_aggregation', {
      table_name: request.table,
      group_columns: request.groupBy,
      aggregate_config: request.aggregates,
      filter_conditions: request.filters
    })
    .execute();
};

// Usage
const salesByRegion = await performDynamicAggregation({
  table: 'orders',
  groupBy: ['region', 'month'],
  aggregates: [
    { field: 'total_amount', operation: 'sum', alias: 'total_revenue' },
    { field: 'id', operation: 'count', alias: 'order_count' },
    { field: 'total_amount', operation: 'avg', alias: 'avg_order_value' }
  ],
  filters: { status: 'completed' }
});
```

### Conditional Aggregation

```typescript
// Aggregation with conditional logic
const conditionalStats = await client
  .rpc('calculate_conditional_statistics')
  .execute();

// Example function with conditional aggregation:
/*
SELECT 
  category,
  COUNT(*) as total_products,
  COUNT(CASE WHEN price > 100 THEN 1 END) as expensive_count,
  COUNT(CASE WHEN in_stock THEN 1 END) as in_stock_count,
  AVG(CASE WHEN price > 100 THEN price END) as avg_expensive_price
FROM products
GROUP BY category;
*/
```

## Time-Series Aggregation

### Time-Based Grouping

```typescript
// Daily aggregations
const dailyMetrics = await client
  .rpc('get_daily_metrics', {
    metric_type: 'sales',
    start_date: '2024-01-01',
    end_date: '2024-01-31'
  })
  .execute();

// Hourly patterns
const hourlyPatterns = await client
  .rpc('analyze_hourly_patterns')
  .execute();

// Seasonal analysis
const seasonalTrends = await client
  .rpc('calculate_seasonal_trends', { years: 2 })
  .execute();
```

### Rolling Aggregations

```typescript
// Rolling averages
const rollingAverages = await client
  .rpc('calculate_rolling_metrics', {
    metric: 'daily_sales',
    window_days: 7
  })
  .execute();

// Year-over-year comparisons
const yoyGrowth = await client
  .rpc('calculate_yoy_growth')
  .execute();
```

## Performance Optimization for Aggregations

### Efficient Aggregation Patterns

```typescript
// Use materialized views for expensive aggregations
const cachedStats = await client
  .from('daily_sales_summary_mv') // Materialized view
  .select('*')
  .gte('date', '2024-01-01')
  .execute();

// Incremental aggregation updates
const incrementalUpdate = await client
  .rpc('update_aggregation_tables', {
    last_update: '2024-01-15 00:00:00'
  })
  .execute();
```

### Index Optimization

```sql
-- Indexes for better aggregation performance
CREATE INDEX idx_orders_created_at_status ON orders(created_at, status);
CREATE INDEX idx_order_items_product_id ON order_items(product_id);
CREATE INDEX idx_users_created_at ON users(DATE(created_at));
```

### Batch Aggregation Processing

```typescript
// Process large aggregations in batches
const processBatchAggregation = async (batchSize = 1000) => {
  let offset = 0;
  const results = [];
  
  while (true) {
    const batch = await client
      .rpc('process_aggregation_batch', {
        batch_size: batchSize,
        offset_val: offset
      })
      .execute();
    
    if (batch.data.length === 0) break;
    
    results.push(...batch.data);
    offset += batchSize;
  }
  
  return results;
};
```

## Common Aggregation Use Cases

### E-commerce Analytics

```typescript
// Sales dashboard metrics
const salesDashboard = await client
  .rpc('get_sales_dashboard_metrics')
  .execute();

// Product performance analysis
const productPerformance = await client
  .rpc('analyze_product_performance', {
    time_period: 'last_30_days'
  })
  .execute();

// Customer segmentation
const customerSegments = await client
  .rpc('segment_customers_by_behavior')
  .execute();
```

### User Analytics

```typescript
// User engagement metrics
const engagementMetrics = await client
  .rpc('calculate_user_engagement')
  .execute();

// Activity patterns
const activityPatterns = await client
  .rpc('analyze_user_activity_patterns')
  .execute();

// Retention analysis
const retentionAnalysis = await client
  .rpc('calculate_user_retention', {
    cohort_period: 'month'
  })
  .execute();
```

### Financial Reporting

```typescript
// Revenue reporting
const revenueReport = await client
  .rpc('generate_revenue_report', {
    start_date: '2024-01-01',
    end_date: '2024-12-31',
    group_by: 'month'
  })
  .execute();

// Profitability analysis
const profitabilityAnalysis = await client
  .rpc('calculate_profitability_metrics')
  .execute();
```

## Real-time Aggregation Updates

### Trigger-Based Updates

```sql
-- Trigger to update aggregation tables
CREATE OR REPLACE FUNCTION update_daily_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- Update daily statistics when orders change
  INSERT INTO daily_sales_stats (date, revenue, order_count)
  VALUES (DATE(NEW.created_at), NEW.total_amount, 1)
  ON CONFLICT (date) DO UPDATE SET
    revenue = daily_sales_stats.revenue + NEW.total_amount,
    order_count = daily_sales_stats.order_count + 1;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER order_stats_trigger
  AFTER INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_daily_stats();
```

### Scheduled Aggregation Updates

```typescript
// Refresh materialized views periodically
const refreshAggregations = async () => {
  await client
    .rpc('refresh_all_aggregation_views')
    .execute();
};

// Schedule this function to run periodically
setInterval(refreshAggregations, 60 * 60 * 1000); // Every hour
```

---

## Summary

PGRestify's aggregation capabilities provide:

- **Complete Function Set**: COUNT, SUM, AVG, MIN, MAX operations
- **GROUP BY Support**: Flexible grouping patterns via RPC functions  
- **Window Functions**: Advanced analytics with ranking and partitioning
- **Custom Functions**: PostgreSQL function integration for complex logic
- **Statistical Analysis**: Comprehensive statistical calculations
- **Time-Series Support**: Time-based aggregations and trending
- **Performance Optimization**: Efficient aggregation patterns and indexing
- **Real-time Updates**: Trigger-based and scheduled aggregation updates

Master these aggregation techniques to build powerful analytics and reporting features that provide valuable insights from your PostgreSQL data through PGRestify.