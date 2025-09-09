# Raw Queries

Master direct SQL execution and RPC function calls in PGRestify for complex queries, stored procedures, and advanced database operations.

## Overview

While PGRestify's query builder covers most use cases, sometimes you need the full power of SQL. Raw queries in PGRestify are implemented through PostgreSQL stored procedures and functions (RPCs - Remote Procedure Calls), allowing you to execute complex SQL logic while maintaining security and type safety.

## RPC Function Calls

### Basic RPC Usage

```typescript
// Call a simple function without parameters
const result = await client
  .rpc('get_current_timestamp')
  .execute();

// Call function with parameters
const userStats = await client
  .rpc('calculate_user_statistics', {
    user_id: 123,
    start_date: '2024-01-01',
    end_date: '2024-12-31'
  })
  .execute();

// Call function with complex parameters
const searchResults = await client
  .rpc('advanced_product_search', {
    search_criteria: {
      keyword: 'laptop',
      category_ids: [1, 2, 3],
      price_range: { min: 500, max: 2000 },
      in_stock_only: true
    }
  })
  .execute();
```

### Creating PostgreSQL Functions

```sql
-- Simple function returning a table
CREATE OR REPLACE FUNCTION get_user_dashboard_data(p_user_id INT)
RETURNS TABLE (
  user_name TEXT,
  total_orders BIGINT,
  total_spent NUMERIC,
  favorite_category TEXT,
  last_order_date DATE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.name,
    COUNT(o.id),
    COALESCE(SUM(o.total_amount), 0),
    (SELECT c.name 
     FROM categories c 
     JOIN products p ON c.id = p.category_id
     JOIN order_items oi ON p.id = oi.product_id
     JOIN orders o2 ON oi.order_id = o2.id
     WHERE o2.customer_id = p_user_id
     GROUP BY c.name
     ORDER BY COUNT(*) DESC
     LIMIT 1),
    MAX(o.created_at)::DATE
  FROM users u
  LEFT JOIN orders o ON u.id = o.customer_id
  WHERE u.id = p_user_id
  GROUP BY u.id, u.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Complex RPC Functions

```sql
-- Function with complex business logic
CREATE OR REPLACE FUNCTION process_order_workflow(
  p_order_data JSONB,
  p_user_id INT,
  p_apply_discounts BOOLEAN DEFAULT true
)
RETURNS JSONB AS $$
DECLARE
  v_order_id INT;
  v_total_amount NUMERIC := 0;
  v_discount_amount NUMERIC := 0;
  v_item JSONB;
  v_result JSONB;
BEGIN
  -- Start transaction
  -- Create order
  INSERT INTO orders (customer_id, status, created_at)
  VALUES (p_user_id, 'pending', NOW())
  RETURNING id INTO v_order_id;
  
  -- Process order items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_order_data->'items')
  LOOP
    INSERT INTO order_items (order_id, product_id, quantity, unit_price)
    VALUES (
      v_order_id,
      (v_item->>'product_id')::INT,
      (v_item->>'quantity')::INT,
      (v_item->>'unit_price')::NUMERIC
    );
    
    v_total_amount := v_total_amount + 
      ((v_item->>'quantity')::INT * (v_item->>'unit_price')::NUMERIC);
  END LOOP;
  
  -- Apply discounts if requested
  IF p_apply_discounts THEN
    SELECT calculate_user_discount(p_user_id, v_total_amount) INTO v_discount_amount;
    v_total_amount := v_total_amount - v_discount_amount;
  END IF;
  
  -- Update order total
  UPDATE orders 
  SET total_amount = v_total_amount,
      discount_amount = v_discount_amount
  WHERE id = v_order_id;
  
  -- Return result
  SELECT jsonb_build_object(
    'order_id', v_order_id,
    'total_amount', v_total_amount,
    'discount_applied', v_discount_amount,
    'status', 'created'
  ) INTO v_result;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Calling Complex Functions

```typescript
// Process order with complex logic
const orderResult = await client
  .rpc('process_order_workflow', {
    p_order_data: {
      items: [
        { product_id: 1, quantity: 2, unit_price: 99.99 },
        { product_id: 5, quantity: 1, unit_price: 149.99 }
      ],
      shipping_address: {
        street: '123 Main St',
        city: 'New York',
        zip: '10001'
      }
    },
    p_user_id: 456,
    p_apply_discounts: true
  })
  .execute();

console.log('Order created:', orderResult.data);
// { order_id: 789, total_amount: 349.97, discount_applied: 25.00, status: 'created' }
```

## Advanced SQL Patterns

### Window Functions and Analytics

```sql
-- Advanced analytics function
CREATE OR REPLACE FUNCTION get_sales_analytics(
  p_start_date DATE,
  p_end_date DATE,
  p_group_by TEXT DEFAULT 'month'
)
RETURNS TABLE (
  period TEXT,
  revenue NUMERIC,
  order_count BIGINT,
  avg_order_value NUMERIC,
  running_total NUMERIC,
  growth_rate NUMERIC
) AS $$
DECLARE
  v_date_format TEXT;
BEGIN
  -- Set date format based on grouping
  CASE p_group_by
    WHEN 'day' THEN v_date_format := 'YYYY-MM-DD';
    WHEN 'week' THEN v_date_format := 'YYYY-"W"WW';
    WHEN 'month' THEN v_date_format := 'YYYY-MM';
    WHEN 'year' THEN v_date_format := 'YYYY';
    ELSE v_date_format := 'YYYY-MM';
  END CASE;

  RETURN QUERY
  WITH sales_data AS (
    SELECT 
      TO_CHAR(created_at, v_date_format) as period,
      SUM(total_amount) as revenue,
      COUNT(*) as order_count,
      AVG(total_amount) as avg_order_value
    FROM orders
    WHERE created_at >= p_start_date 
      AND created_at <= p_end_date
      AND status = 'completed'
    GROUP BY TO_CHAR(created_at, v_date_format)
  ),
  analytics_data AS (
    SELECT 
      sd.*,
      SUM(sd.revenue) OVER (ORDER BY sd.period) as running_total,
      LAG(sd.revenue) OVER (ORDER BY sd.period) as prev_revenue
    FROM sales_data sd
  )
  SELECT 
    ad.period,
    ad.revenue,
    ad.order_count,
    ad.avg_order_value,
    ad.running_total,
    CASE 
      WHEN ad.prev_revenue IS NULL THEN 0
      ELSE ((ad.revenue - ad.prev_revenue) / ad.prev_revenue * 100)
    END as growth_rate
  FROM analytics_data ad
  ORDER BY ad.period;
END;
$$ LANGUAGE plpgsql;
```

### Complex Joins and Subqueries

```sql
-- Multi-table complex query function
CREATE OR REPLACE FUNCTION get_customer_insights(
  p_customer_segment TEXT DEFAULT 'all',
  p_min_orders INT DEFAULT 1
)
RETURNS TABLE (
  customer_id INT,
  customer_name TEXT,
  total_orders BIGINT,
  total_spent NUMERIC,
  avg_order_value NUMERIC,
  favorite_category TEXT,
  last_order_days_ago INT,
  customer_segment TEXT,
  lifetime_value_score NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH customer_stats AS (
    SELECT 
      c.id,
      c.name,
      COUNT(o.id) as total_orders,
      COALESCE(SUM(o.total_amount), 0) as total_spent,
      COALESCE(AVG(o.total_amount), 0) as avg_order_value,
      MAX(o.created_at) as last_order_date
    FROM customers c
    LEFT JOIN orders o ON c.id = o.customer_id AND o.status = 'completed'
    GROUP BY c.id, c.name
    HAVING COUNT(o.id) >= p_min_orders
  ),
  customer_categories AS (
    SELECT DISTINCT ON (cs.id)
      cs.id,
      cat.name as favorite_category
    FROM customer_stats cs
    LEFT JOIN orders o ON cs.id = o.customer_id
    LEFT JOIN order_items oi ON o.id = oi.order_id
    LEFT JOIN products p ON oi.product_id = p.id
    LEFT JOIN categories cat ON p.category_id = cat.id
    WHERE o.status = 'completed'
    ORDER BY cs.id, COUNT(*) DESC
  )
  SELECT 
    cs.id,
    cs.name,
    cs.total_orders,
    cs.total_spent,
    cs.avg_order_value,
    COALESCE(cc.favorite_category, 'Unknown'),
    COALESCE(EXTRACT(DAY FROM NOW() - cs.last_order_date)::INT, -1),
    CASE 
      WHEN cs.total_spent > 1000 AND cs.total_orders > 10 THEN 'VIP'
      WHEN cs.total_spent > 500 AND cs.total_orders > 5 THEN 'Premium' 
      WHEN cs.total_orders > 2 THEN 'Regular'
      ELSE 'New'
    END as segment,
    (cs.total_spent * 0.7 + cs.total_orders * 50 + 
     CASE WHEN cs.last_order_date > NOW() - INTERVAL '30 days' THEN 100 ELSE 0 END) as ltv_score
  FROM customer_stats cs
  LEFT JOIN customer_categories cc ON cs.id = cc.id
  WHERE (p_customer_segment = 'all' OR 
         (p_customer_segment = 'vip' AND cs.total_spent > 1000) OR
         (p_customer_segment = 'premium' AND cs.total_spent > 500) OR
         (p_customer_segment = 'new' AND cs.total_orders <= 2))
  ORDER BY ltv_score DESC;
END;
$$ LANGUAGE plpgsql;
```

### Calling Advanced Functions

```typescript
// Get sales analytics
const salesAnalytics = await client
  .rpc('get_sales_analytics', {
    p_start_date: '2024-01-01',
    p_end_date: '2024-12-31',
    p_group_by: 'month'
  })
  .execute();

// Get customer insights
const customerInsights = await client
  .rpc('get_customer_insights', {
    p_customer_segment: 'vip',
    p_min_orders: 5
  })
  .execute();
```

## Data Manipulation Functions

### Batch Operations

```sql
-- Batch update function
CREATE OR REPLACE FUNCTION batch_update_product_prices(
  p_updates JSONB
)
RETURNS JSONB AS $$
DECLARE
  v_update JSONB;
  v_updated_count INT := 0;
  v_failed_updates JSONB := '[]'::JSONB;
  v_result JSONB;
BEGIN
  FOR v_update IN SELECT * FROM jsonb_array_elements(p_updates)
  LOOP
    BEGIN
      UPDATE products 
      SET 
        price = (v_update->>'new_price')::NUMERIC,
        updated_at = NOW()
      WHERE id = (v_update->>'product_id')::INT;
      
      IF FOUND THEN
        v_updated_count := v_updated_count + 1;
      ELSE
        v_failed_updates := v_failed_updates || jsonb_build_object(
          'product_id', v_update->>'product_id',
          'reason', 'Product not found'
        );
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_failed_updates := v_failed_updates || jsonb_build_object(
        'product_id', v_update->>'product_id',
        'reason', SQLERRM
      );
    END;
  END LOOP;
  
  SELECT jsonb_build_object(
    'updated_count', v_updated_count,
    'failed_updates', v_failed_updates,
    'total_processed', jsonb_array_length(p_updates)
  ) INTO v_result;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql;
```

### Data Validation Functions

```sql
-- Data validation and cleanup function
CREATE OR REPLACE FUNCTION validate_and_clean_user_data(
  p_user_data JSONB
)
RETURNS JSONB AS $$
DECLARE
  v_cleaned_data JSONB;
  v_validation_errors TEXT[] := ARRAY[]::TEXT[];
BEGIN
  -- Initialize cleaned data
  v_cleaned_data := p_user_data;
  
  -- Validate email
  IF NOT (p_user_data->>'email' ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$') THEN
    v_validation_errors := array_append(v_validation_errors, 'Invalid email format');
  END IF;
  
  -- Clean and validate phone number
  IF p_user_data ? 'phone' THEN
    -- Remove non-digits from phone
    v_cleaned_data := jsonb_set(
      v_cleaned_data, 
      '{phone}', 
      to_jsonb(regexp_replace(p_user_data->>'phone', '[^0-9]', '', 'g'))
    );
    
    -- Validate phone length
    IF length(v_cleaned_data->>'phone') < 10 THEN
      v_validation_errors := array_append(v_validation_errors, 'Phone number too short');
    END IF;
  END IF;
  
  -- Validate age
  IF (p_user_data->>'age')::INT < 13 THEN
    v_validation_errors := array_append(v_validation_errors, 'User must be at least 13 years old');
  END IF;
  
  -- Return result with cleaned data and any validation errors
  RETURN jsonb_build_object(
    'cleaned_data', v_cleaned_data,
    'validation_errors', to_jsonb(v_validation_errors),
    'is_valid', array_length(v_validation_errors, 1) IS NULL
  );
END;
$$ LANGUAGE plpgsql;
```

### Calling Data Manipulation Functions

```typescript
// Batch update prices
const priceUpdates = await client
  .rpc('batch_update_product_prices', {
    p_updates: [
      { product_id: 1, new_price: 99.99 },
      { product_id: 2, new_price: 149.99 },
      { product_id: 3, new_price: 199.99 }
    ]
  })
  .execute();

console.log('Update result:', priceUpdates.data);
// { updated_count: 2, failed_updates: [{ product_id: 3, reason: "Product not found" }], total_processed: 3 }

// Validate user data
const validationResult = await client
  .rpc('validate_and_clean_user_data', {
    p_user_data: {
      email: 'user@example.com',
      phone: '(555) 123-4567',
      age: 25,
      name: 'John Doe'
    }
  })
  .execute();

if (validationResult.data.is_valid) {
  // Use cleaned data
  console.log('Clean data:', validationResult.data.cleaned_data);
} else {
  console.log('Validation errors:', validationResult.data.validation_errors);
}
```

## Dynamic SQL Generation

### Query Builder Functions

```sql
-- Dynamic query builder function
CREATE OR REPLACE FUNCTION dynamic_product_search(
  p_filters JSONB,
  p_sort_by TEXT DEFAULT 'name',
  p_sort_order TEXT DEFAULT 'ASC',
  p_limit INT DEFAULT 20,
  p_offset INT DEFAULT 0
)
RETURNS JSONB AS $$
DECLARE
  v_query TEXT := 'SELECT row_to_json(t) FROM (SELECT * FROM products WHERE 1=1';
  v_count_query TEXT := 'SELECT COUNT(*) FROM products WHERE 1=1';
  v_where_clause TEXT := '';
  v_filter_key TEXT;
  v_filter_value JSONB;
  v_results JSONB;
  v_total_count INT;
BEGIN
  -- Build WHERE clause dynamically
  FOR v_filter_key, v_filter_value IN SELECT * FROM jsonb_each(p_filters)
  LOOP
    CASE v_filter_key
      WHEN 'name' THEN
        v_where_clause := v_where_clause || ' AND name ILIKE ' || quote_literal('%' || (v_filter_value #>> '{}') || '%');
      WHEN 'category_id' THEN
        v_where_clause := v_where_clause || ' AND category_id = ' || (v_filter_value #>> '{}')::INT;
      WHEN 'price_min' THEN
        v_where_clause := v_where_clause || ' AND price >= ' || (v_filter_value #>> '{}')::NUMERIC;
      WHEN 'price_max' THEN
        v_where_clause := v_where_clause || ' AND price <= ' || (v_filter_value #>> '{}')::NUMERIC;
      WHEN 'in_stock' THEN
        v_where_clause := v_where_clause || ' AND in_stock = ' || (v_filter_value #>> '{}')::BOOLEAN;
    END CASE;
  END LOOP;
  
  -- Add WHERE clause to queries
  v_query := v_query || v_where_clause;
  v_count_query := v_count_query || v_where_clause;
  
  -- Add ORDER BY and LIMIT
  v_query := v_query || ' ORDER BY ' || quote_ident(p_sort_by) || ' ' || p_sort_order;
  v_query := v_query || ' LIMIT ' || p_limit || ' OFFSET ' || p_offset || ') t';
  
  -- Execute count query
  EXECUTE v_count_query INTO v_total_count;
  
  -- Execute main query and collect results
  EXECUTE 'SELECT jsonb_agg(results) FROM (' || v_query || ') as results' INTO v_results;
  
  -- Return results with metadata
  RETURN jsonb_build_object(
    'data', COALESCE(v_results, '[]'::jsonb),
    'total_count', v_total_count,
    'limit', p_limit,
    'offset', p_offset,
    'generated_query', v_query
  );
END;
$$ LANGUAGE plpgsql;
```

### Calling Dynamic Functions

```typescript
// Dynamic product search with flexible filters
const dynamicSearch = await client
  .rpc('dynamic_product_search', {
    p_filters: {
      name: 'laptop',
      category_id: 1,
      price_min: 500,
      price_max: 2000,
      in_stock: true
    },
    p_sort_by: 'price',
    p_sort_order: 'DESC',
    p_limit: 10,
    p_offset: 0
  })
  .execute();

console.log('Search results:', dynamicSearch.data);
// {
//   data: [...products...],
//   total_count: 45,
//   limit: 10,
//   offset: 0,
//   generated_query: "SELECT row_to_json(t) FROM (SELECT * FROM products WHERE..."
// }
```

## Error Handling and Security

### Secure Function Creation

```sql
-- Function with proper error handling and security
CREATE OR REPLACE FUNCTION secure_user_operation(
  p_user_id INT,
  p_operation TEXT,
  p_data JSONB DEFAULT '{}'::JSONB
)
RETURNS JSONB 
SECURITY DEFINER  -- Runs with creator's privileges
SET search_path = public, pg_catalog  -- Prevent search path attacks
AS $$
DECLARE
  v_result JSONB;
  v_user_exists BOOLEAN;
BEGIN
  -- Validate input parameters
  IF p_user_id IS NULL OR p_user_id <= 0 THEN
    RAISE EXCEPTION 'Invalid user ID: %', p_user_id;
  END IF;
  
  IF p_operation IS NULL OR p_operation = '' THEN
    RAISE EXCEPTION 'Operation cannot be empty';
  END IF;
  
  -- Check if user exists
  SELECT EXISTS(SELECT 1 FROM users WHERE id = p_user_id) INTO v_user_exists;
  IF NOT v_user_exists THEN
    RAISE EXCEPTION 'User with ID % does not exist', p_user_id;
  END IF;
  
  -- Perform operation based on type
  CASE p_operation
    WHEN 'get_profile' THEN
      SELECT row_to_json(u) INTO v_result 
      FROM (SELECT id, name, email, created_at FROM users WHERE id = p_user_id) u;
      
    WHEN 'update_preferences' THEN
      UPDATE users 
      SET preferences = p_data,
          updated_at = NOW()
      WHERE id = p_user_id;
      
      v_result := jsonb_build_object('success', true, 'message', 'Preferences updated');
      
    ELSE
      RAISE EXCEPTION 'Unknown operation: %', p_operation;
  END CASE;
  
  RETURN v_result;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Log error (in real application, use proper logging)
    RAISE LOG 'Error in secure_user_operation: % %', SQLSTATE, SQLERRM;
    
    -- Return error information
    RETURN jsonb_build_object(
      'error', true,
      'error_code', SQLSTATE,
      'error_message', SQLERRM,
      'operation', p_operation,
      'user_id', p_user_id
    );
END;
$$ LANGUAGE plpgsql;
```

### Calling Secure Functions

```typescript
// Call secure function with error handling
const userOperation = async (userId: number, operation: string, data?: any) => {
  try {
    const result = await client
      .rpc('secure_user_operation', {
        p_user_id: userId,
        p_operation: operation,
        p_data: data || {}
      })
      .execute();
    
    if (result.data?.error) {
      throw new Error(`Database error: ${result.data.error_message}`);
    }
    
    return result.data;
  } catch (error) {
    console.error('RPC call failed:', error);
    throw error;
  }
};

// Usage
try {
  const profile = await userOperation(123, 'get_profile');
  console.log('User profile:', profile);
  
  const updateResult = await userOperation(123, 'update_preferences', {
    theme: 'dark',
    language: 'en',
    notifications: true
  });
  console.log('Update result:', updateResult);
} catch (error) {
  console.error('Operation failed:', error.message);
}
```

## Performance Optimization

### Efficient Function Design

```sql
-- Optimized function with proper indexing hints
CREATE OR REPLACE FUNCTION get_user_dashboard_optimized(
  p_user_id INT
)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
  v_user_info JSONB;
  v_order_stats JSONB;
  v_recent_activity JSONB;
BEGIN
  -- Use efficient queries with proper WHERE clauses for indexes
  
  -- Get user info (single query)
  SELECT to_jsonb(u) INTO v_user_info
  FROM (
    SELECT id, name, email, created_at, last_login
    FROM users 
    WHERE id = p_user_id
  ) u;
  
  -- Get order statistics (optimized aggregation)
  SELECT to_jsonb(stats) INTO v_order_stats
  FROM (
    SELECT 
      COUNT(*) as total_orders,
      COALESCE(SUM(total_amount), 0) as total_spent,
      MAX(created_at) as last_order_date
    FROM orders 
    WHERE customer_id = p_user_id AND status = 'completed'
  ) stats;
  
  -- Get recent activity (limited query)
  SELECT jsonb_agg(activity) INTO v_recent_activity
  FROM (
    SELECT type, description, created_at
    FROM user_activities
    WHERE user_id = p_user_id
    ORDER BY created_at DESC
    LIMIT 10
  ) activity;
  
  -- Combine results
  SELECT jsonb_build_object(
    'user_info', v_user_info,
    'order_stats', v_order_stats,
    'recent_activity', COALESCE(v_recent_activity, '[]'::jsonb)
  ) INTO v_result;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql;
```

### Function Caching Strategies

```typescript
// Client-side caching for expensive RPC calls
class RPCManager {
  private cache = new Map<string, { data: any; expires: number }>();
  
  async callWithCache(
    functionName: string, 
    params: any = {}, 
    cacheSeconds = 300
  ) {
    const cacheKey = `${functionName}:${JSON.stringify(params)}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && cached.expires > Date.now()) {
      return { data: cached.data, fromCache: true };
    }
    
    const result = await client.rpc(functionName, params).execute();
    
    // Cache successful results
    if (!result.error) {
      this.cache.set(cacheKey, {
        data: result.data,
        expires: Date.now() + (cacheSeconds * 1000)
      });
    }
    
    return { data: result.data, fromCache: false };
  }
}

// Usage
const rpcManager = new RPCManager();
const dashboard = await rpcManager.callWithCache(
  'get_user_dashboard_optimized',
  { p_user_id: 123 },
  600 // Cache for 10 minutes
);
```

## Common RPC Patterns

### Utility Functions

```typescript
// Common database utilities as RPC functions
const dbUtils = {
  async getTableStats(tableName: string) {
    return client.rpc('get_table_statistics', { table_name: tableName });
  },
  
  async cleanupOldRecords(tableName: string, daysOld: number) {
    return client.rpc('cleanup_old_records', { 
      table_name: tableName, 
      days_old: daysOld 
    });
  },
  
  async validateDataIntegrity() {
    return client.rpc('validate_data_integrity');
  },
  
  async getSystemHealth() {
    return client.rpc('get_system_health_status');
  }
};
```

### Business Logic Functions

```typescript
// Business logic encapsulated in RPC functions
const businessLogic = {
  async calculateShipping(orderData: any) {
    return client.rpc('calculate_shipping_cost', { order_data: orderData });
  },
  
  async applyPromotions(cartData: any, userId: number) {
    return client.rpc('apply_available_promotions', { 
      cart_data: cartData, 
      user_id: userId 
    });
  },
  
  async processRefund(orderId: number, reason: string) {
    return client.rpc('process_order_refund', { 
      order_id: orderId, 
      refund_reason: reason 
    });
  }
};
```

---

## Summary

PGRestify's raw query capabilities through RPC functions provide:

- **Full SQL Power**: Execute complex queries and stored procedures
- **Business Logic Encapsulation**: Keep complex logic in the database
- **Type Safety**: Structured input/output with PostgreSQL functions
- **Security**: SECURITY DEFINER functions with proper validation
- **Performance**: Optimized database operations with minimal network calls
- **Flexibility**: Dynamic SQL generation and complex data processing
- **Error Handling**: Comprehensive error management and logging
- **Caching**: Client-side caching strategies for expensive operations

Master these raw query patterns to handle complex business requirements that go beyond standard CRUD operations while maintaining security and performance through PostgreSQL's powerful function system.