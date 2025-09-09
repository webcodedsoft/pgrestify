import chalk from 'chalk';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { SchemaInspector, DatabaseConnection, TableColumn } from './SchemaInspector.js';
import { getPostgRESTConfig } from '../utils/postgrest-config.js';

export interface TestingDataConfig {
  template: 'basic' | 'blog' | 'ecommerce';
  recordCount?: number;
  includeImages?: boolean;
  generateRealistic?: boolean;
}

export class TestingDataGenerator {
  private schemaInspector: SchemaInspector;

  constructor(private projectPath: string) {
    this.schemaInspector = new SchemaInspector(projectPath);
  }

  /**
   * Generate testing data SQL for the specified template
   */
  async generateTestingData(config: TestingDataConfig, connection?: DatabaseConnection): Promise<string> {
    const { template, recordCount = 50, includeImages = false, generateRealistic = true } = config;
    const postgrestConfig = await getPostgRESTConfig(connection);
    
    console.log(chalk.blue(`🔧 Generating testing data for ${template} template...`));
    
    let sql = `-- Testing Data for ${template.toUpperCase()} Template\n`;
    sql += `-- Generated on ${new Date().toISOString()}\n`;
    sql += `-- Records per table: ${recordCount}\n`;
    sql += `-- Realistic data: ${generateRealistic ? 'YES' : 'NO'}\n\n`;
    
    sql += `-- Disable triggers during data insertion (optional)\n`;
    sql += `SET session_replication_role = replica;\n\n`;
    
    // NEW APPROACH: Read actual schema from generated SQL files
    try {
      const schemaAnalysis = this.parseSchemaFromFiles();
      if (schemaAnalysis && Object.keys(schemaAnalysis.tables).length > 0) {
        console.log(chalk.green(`📋 Found ${Object.keys(schemaAnalysis.tables).length} tables in generated schema`));
        sql += this.generateDataFromSchema(schemaAnalysis, recordCount, generateRealistic, includeImages, postgrestConfig);
      } else {
        console.log(chalk.yellow('⚠️  Could not parse schema from files, falling back to template-based generation'));
        sql += this.generateTemplateBasedDataFallback(template, recordCount, generateRealistic, includeImages, postgrestConfig);
      }
    } catch (error) {
      console.log(chalk.yellow(`⚠️  Error parsing schema: ${error}, falling back to template-based generation`));
      sql += this.generateTemplateBasedDataFallback(template, recordCount, generateRealistic, includeImages, postgrestConfig);
    }
    
    sql += `\n-- Re-enable triggers\n`;
    sql += `SET session_replication_role = DEFAULT;\n\n`;
    
    sql += `-- Update sequences to correct values\n`;
    sql += this.generateSequenceUpdates(template, postgrestConfig);
    
    sql += `-- Refresh materialized views if any exist\n`;
    sql += `-- REFRESH MATERIALIZED VIEW CONCURRENTLY ${postgrestConfig.schema}.view_name;\n\n`;
    
    console.log(chalk.green(`✅ Generated testing data SQL for ${template} template`));
    return sql;
  }

  /**
   * Generate testing data for basic template
   */
  private generateBasicTemplateData(recordCount: number, realistic: boolean, postgrestConfig: any): string {
    const users = realistic ? this.getRealisticUsers(recordCount) : this.getGenericUsers(recordCount);
    const profiles = realistic ? this.getRealisticProfiles(recordCount) : this.getGenericProfiles(recordCount);
    
    let sql = `-- Basic Template Testing Data\n\n`;
    
    // Users table
    sql += `-- Insert users\n`;
    sql += `INSERT INTO ${postgrestConfig.schema}.users (id, email, password_hash, role, created_at, updated_at) VALUES\n`;
    sql += users.map((user, index) => 
      `  ('${this.generateUUID()}', '${user.email}', '${this.hashPassword('password123')}', '${user.role}', NOW() - INTERVAL '${Math.floor(Math.random() * 365)} days', NOW() - INTERVAL '${Math.floor(Math.random() * 30)} days')`
    ).join(',\n');
    sql += `;\n\n`;
    
    // Profiles table
    sql += `-- Insert profiles\n`;
    sql += `INSERT INTO ${postgrestConfig.schema}.profiles (id, user_id, first_name, last_name, bio, avatar_url, created_at, updated_at) VALUES\n`;
    sql += profiles.map((profile, index) => 
      `  ('${this.generateUUID()}', (SELECT id FROM ${postgrestConfig.schema}.users ORDER BY created_at LIMIT 1 OFFSET ${index}), '${profile.first_name}', '${profile.last_name}', '${profile.bio}', ${profile.avatar_url ? `'${profile.avatar_url}'` : 'NULL'}, NOW() - INTERVAL '${Math.floor(Math.random() * 300)} days', NOW() - INTERVAL '${Math.floor(Math.random() * 30)} days')`
    ).join(',\n');
    sql += `;\n\n`;
    
    return sql;
  }

  /**
   * Generate testing data for blog template
   */
  private generateBlogTemplateData(recordCount: number, realistic: boolean, includeImages: boolean, postgrestConfig: any): string {
    let sql = `-- Blog Template Testing Data\n\n`;
    
    // Users
    const users = realistic ? this.getRealisticBlogUsers(Math.ceil(recordCount * 0.1)) : this.getGenericUsers(Math.ceil(recordCount * 0.1));
    sql += `-- Insert users\n`;
    sql += `INSERT INTO ${postgrestConfig.schema}.users (id, email, password_hash, role, created_at, updated_at) VALUES\n`;
    sql += users.map(user => 
      `  ('${this.generateUUID()}', '${user.email}', '${this.hashPassword('password123')}', '${user.role}', NOW() - INTERVAL '${Math.floor(Math.random() * 365)} days', NOW() - INTERVAL '${Math.floor(Math.random() * 30)} days')`
    ).join(',\n');
    sql += `;\n\n`;
    
    // Categories
    const categories = realistic ? this.getRealisticBlogCategories() : this.getGenericCategories();
    sql += `-- Insert categories\n`;
    sql += `INSERT INTO ${postgrestConfig.schema}.categories (id, name, slug, description, created_at, updated_at) VALUES\n`;
    sql += categories.map(cat => 
      `  ('${this.generateUUID()}', '${cat.name}', '${cat.slug}', '${cat.description}', NOW() - INTERVAL '${Math.floor(Math.random() * 200)} days', NOW() - INTERVAL '${Math.floor(Math.random() * 30)} days')`
    ).join(',\n');
    sql += `;\n\n`;
    
    // Posts
    const posts = realistic ? this.getRealisticBlogPosts(recordCount) : this.getGenericPosts(recordCount);
    sql += `-- Insert posts\n`;
    sql += `INSERT INTO ${postgrestConfig.schema}.posts (id, user_id, category_id, title, slug, content, excerpt, status, featured_image, published_at, created_at, updated_at) VALUES\n`;
    sql += posts.map((post, index) => {
      const publishedAt = post.status === 'published' ? `NOW() - INTERVAL '${Math.floor(Math.random() * 180)} days'` : 'NULL';
      const featuredImage = includeImages && Math.random() > 0.6 ? `'https://picsum.photos/800/400?random=${index}'` : 'NULL';
      
      return `  ('${this.generateUUID()}', (SELECT id FROM ${postgrestConfig.schema}.users ORDER BY RANDOM() LIMIT 1), (SELECT id FROM ${postgrestConfig.schema}.categories ORDER BY RANDOM() LIMIT 1), '${post.title}', '${post.slug}', '${post.content}', '${post.excerpt}', '${post.status}', ${featuredImage}, ${publishedAt}, NOW() - INTERVAL '${Math.floor(Math.random() * 200)} days', NOW() - INTERVAL '${Math.floor(Math.random() * 30)} days')`;
    }).join(',\n');
    sql += `;\n\n`;
    
    // Comments
    sql += `-- Insert comments\n`;
    sql += `INSERT INTO ${postgrestConfig.schema}.comments (id, post_id, user_id, content, status, created_at, updated_at) VALUES\n`;
    const comments = this.generateBlogComments(recordCount * 3);
    sql += comments.map(comment => 
      `  ('${this.generateUUID()}', (SELECT id FROM ${postgrestConfig.schema}.posts WHERE status = 'published' ORDER BY RANDOM() LIMIT 1), (SELECT id FROM ${postgrestConfig.schema}.users ORDER BY RANDOM() LIMIT 1), '${comment.content}', '${comment.status}', NOW() - INTERVAL '${Math.floor(Math.random() * 180)} days', NOW() - INTERVAL '${Math.floor(Math.random() * 30)} days')`
    ).join(',\n');
    sql += `;\n\n`;
    
    // Tags
    const tags = realistic ? this.getRealisticBlogTags() : this.getGenericTags();
    sql += `-- Insert tags\n`;
    sql += `INSERT INTO ${postgrestConfig.schema}.tags (id, name, slug, created_at, updated_at) VALUES\n`;
    sql += tags.map(tag => 
      `  ('${this.generateUUID()}', '${tag.name}', '${tag.slug}', NOW() - INTERVAL '${Math.floor(Math.random() * 300)} days', NOW() - INTERVAL '${Math.floor(Math.random() * 30)} days')`
    ).join(',\n');
    sql += `;\n\n`;
    
    // Post Tags (many-to-many)
    sql += `-- Insert post_tags relationships\n`;
    sql += `INSERT INTO ${postgrestConfig.schema}.post_tags (post_id, tag_id, created_at) \n`;
    sql += `SELECT DISTINCT p.id, t.id, NOW() - INTERVAL '${Math.floor(Math.random() * 180)} days'\n`;
    sql += `FROM ${postgrestConfig.schema}.posts p \n`;
    sql += `CROSS JOIN ${postgrestConfig.schema}.tags t \n`;
    sql += `WHERE RANDOM() < 0.3 \n`; // 30% chance of each post-tag combination
    sql += `LIMIT ${recordCount * 2};\n\n`;
    
    return sql;
  }

  /**
   * Generate testing data for ecommerce template
   */
  private generateEcommerceTemplateData(recordCount: number, realistic: boolean, includeImages: boolean, postgrestConfig: any): string {
    let sql = `-- E-commerce Template Testing Data\n\n`;
    
    // Users/Customers
    const users = realistic ? this.getRealisticEcommerceUsers(Math.ceil(recordCount * 0.2)) : this.getGenericUsers(Math.ceil(recordCount * 0.2));
    sql += `-- Insert customers\n`;
    sql += `INSERT INTO ${postgrestConfig.schema}.customers (id, email, password_hash, first_name, last_name, phone, created_at, updated_at) VALUES\n`;
    sql += users.map(user => 
      `  ('${this.generateUUID()}', '${user.email}', '${this.hashPassword('password123')}', '${user.first_name}', '${user.last_name}', '${user.phone || 'NULL'}', NOW() - INTERVAL '${Math.floor(Math.random() * 365)} days', NOW() - INTERVAL '${Math.floor(Math.random() * 30)} days')`
    ).join(',\n');
    sql += `;\n\n`;
    
    // Categories
    const categories = realistic ? this.getRealisticEcommerceCategories() : this.getGenericCategories();
    sql += `-- Insert product categories\n`;
    sql += `INSERT INTO ${postgrestConfig.schema}.categories (id, name, slug, description, created_at, updated_at) VALUES\n`;
    sql += categories.map(cat => 
      `  ('${this.generateUUID()}', '${cat.name}', '${cat.slug}', '${cat.description}', NOW() - INTERVAL '${Math.floor(Math.random() * 200)} days', NOW() - INTERVAL '${Math.floor(Math.random() * 30)} days')`
    ).join(',\n');
    sql += `;\n\n`;
    
    // Products
    const products = realistic ? this.getRealisticEcommerceProducts(recordCount) : this.getGenericProducts(recordCount);
    sql += `-- Insert products\n`;
    sql += `INSERT INTO ${postgrestConfig.schema}.products (id, category_id, name, slug, description, price, stock_quantity, sku, status, image_url, created_at, updated_at) VALUES\n`;
    sql += products.map((product, index) => {
      const imageUrl = includeImages && Math.random() > 0.4 ? `'https://picsum.photos/400/400?random=${index}'` : 'NULL';
      return `  ('${this.generateUUID()}', (SELECT id FROM ${postgrestConfig.schema}.categories ORDER BY RANDOM() LIMIT 1), '${product.name}', '${product.slug}', '${product.description}', ${product.price}, ${product.stock}, '${product.sku}', '${product.status}', ${imageUrl}, NOW() - INTERVAL '${Math.floor(Math.random() * 300)} days', NOW() - INTERVAL '${Math.floor(Math.random() * 30)} days')`;
    }).join(',\n');
    sql += `;\n\n`;
    
    // Orders
    sql += `-- Insert orders\n`;
    sql += `INSERT INTO ${postgrestConfig.schema}.orders (id, customer_id, status, total_amount, shipping_address, billing_address, created_at, updated_at) VALUES\n`;
    const orders = this.generateEcommerceOrders(Math.ceil(recordCount * 0.3));
    sql += orders.map(order => 
      `  ('${this.generateUUID()}', (SELECT id FROM ${postgrestConfig.schema}.customers ORDER BY RANDOM() LIMIT 1), '${order.status}', ${order.total}, '${order.shipping_address}', '${order.billing_address}', NOW() - INTERVAL '${Math.floor(Math.random() * 180)} days', NOW() - INTERVAL '${Math.floor(Math.random() * 30)} days')`
    ).join(',\n');
    sql += `;\n\n`;
    
    // Order Items
    sql += `-- Insert order items\n`;
    sql += `INSERT INTO ${postgrestConfig.schema}.order_items (id, order_id, product_id, quantity, unit_price, total_price, created_at) VALUES\n`;
    const orderItems = this.generateOrderItems(Math.ceil(recordCount * 0.8));
    sql += orderItems.map(item => 
      `  ('${this.generateUUID()}', (SELECT id FROM ${postgrestConfig.schema}.orders ORDER BY RANDOM() LIMIT 1), (SELECT id FROM ${postgrestConfig.schema}.products ORDER BY RANDOM() LIMIT 1), ${item.quantity}, ${item.unit_price}, ${item.total_price}, NOW() - INTERVAL '${Math.floor(Math.random() * 180)} days')`
    ).join(',\n');
    sql += `;\n\n`;
    
    return sql;
  }

  /**
   * Generate realistic users for different contexts
   */
  private getRealisticUsers(count: number): any[] {
    const firstNames = ['John', 'Jane', 'Michael', 'Emily', 'David', 'Sarah', 'Robert', 'Lisa', 'James', 'Jessica', 'William', 'Ashley', 'Richard', 'Amanda', 'Thomas'];
    const lastNames = ['Smith', 'Johnson', 'Brown', 'Davis', 'Miller', 'Wilson', 'Moore', 'Taylor', 'Anderson', 'Thomas', 'Jackson', 'White', 'Harris', 'Martin', 'Thompson'];
    const domains = ['example.com', 'test.org', 'demo.net', 'sample.io', 'mock.dev'];
    
    return Array.from({ length: count }, (_, i) => {
      const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
      const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
      const domain = domains[Math.floor(Math.random() * domains.length)];
      const role = i === 0 ? 'admin' : (Math.random() > 0.8 ? 'moderator' : 'user');
      
      return {
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i > 0 ? i : ''}@${domain}`,
        first_name: firstName,
        last_name: lastName,
        role,
        phone: Math.random() > 0.7 ? `+1${Math.floor(Math.random() * 9000000000) + 1000000000}` : null
      };
    });
  }

  private getRealisticBlogUsers(count: number): any[] {
    const bloggers = [
      { first_name: 'Alex', last_name: 'Writer', email: 'alex.writer@blogdemo.com', role: 'admin' },
      { first_name: 'Sam', last_name: 'Editor', email: 'sam.editor@blogdemo.com', role: 'editor' },
      { first_name: 'Jordan', last_name: 'Author', email: 'jordan.author@blogdemo.com', role: 'author' },
      { first_name: 'Casey', last_name: 'Contributor', email: 'casey.contrib@blogdemo.com', role: 'author' },
      { first_name: 'Morgan', last_name: 'Guest', email: 'morgan.guest@blogdemo.com', role: 'user' }
    ];
    
    return bloggers.slice(0, count);
  }

  private getRealisticEcommerceUsers(count: number): any[] {
    const users = this.getRealisticUsers(count);
    return users.map(user => ({
      ...user,
      role: 'customer', // Override role for e-commerce
      phone: Math.random() > 0.5 ? `+1${Math.floor(Math.random() * 9000000000) + 1000000000}` : null
    }));
  }

  private getGenericUsers(count: number): any[] {
    return Array.from({ length: count }, (_, i) => ({
      email: `user${i + 1}@example.com`,
      first_name: `User${i + 1}`,
      last_name: `LastName${i + 1}`,
      role: i === 0 ? 'admin' : 'user',
      phone: null
    }));
  }

  private getRealisticProfiles(count: number): any[] {
    const bios = [
      'Passionate about technology and innovation.',
      'Love traveling and discovering new places.',
      'Software developer with 5+ years experience.',
      'Marketing professional and coffee enthusiast.',
      'Designer focused on user experience.',
      'Entrepreneur building the next big thing.',
      'Writer sharing stories about life.',
      'Photographer capturing beautiful moments.',
      'Teacher helping others learn and grow.',
      'Chef experimenting with new recipes.'
    ];
    
    return Array.from({ length: count }, (_, i) => ({
      first_name: `User${i + 1}`,
      last_name: `LastName${i + 1}`,
      bio: bios[Math.floor(Math.random() * bios.length)],
      avatar_url: Math.random() > 0.6 ? `https://picsum.photos/200/200?random=${i}` : null
    }));
  }

  private getGenericProfiles(count: number): any[] {
    return Array.from({ length: count }, (_, i) => ({
      first_name: `User${i + 1}`,
      last_name: `LastName${i + 1}`,
      bio: `This is the bio for User ${i + 1}.`,
      avatar_url: null
    }));
  }

  private getRealisticBlogCategories(): any[] {
    return [
      { name: 'Technology', slug: 'technology', description: 'Latest trends in technology and software development' },
      { name: 'Lifestyle', slug: 'lifestyle', description: 'Tips and stories about modern lifestyle' },
      { name: 'Travel', slug: 'travel', description: 'Travel guides and adventure stories' },
      { name: 'Food & Recipes', slug: 'food-recipes', description: 'Delicious recipes and cooking tips' },
      { name: 'Health & Fitness', slug: 'health-fitness', description: 'Wellness tips and fitness guides' },
      { name: 'Business', slug: 'business', description: 'Business insights and entrepreneurship' },
      { name: 'Design', slug: 'design', description: 'UI/UX design and creative inspiration' },
      { name: 'Personal Development', slug: 'personal-development', description: 'Self-improvement and growth mindset' }
    ];
  }

  private getRealisticEcommerceCategories(): any[] {
    return [
      { name: 'Electronics', slug: 'electronics', description: 'Computers, phones, and electronic devices' },
      { name: 'Clothing & Fashion', slug: 'clothing-fashion', description: 'Trendy clothes and fashion accessories' },
      { name: 'Home & Garden', slug: 'home-garden', description: 'Home improvement and gardening supplies' },
      { name: 'Books & Media', slug: 'books-media', description: 'Books, movies, music and digital media' },
      { name: 'Sports & Outdoors', slug: 'sports-outdoors', description: 'Sports equipment and outdoor gear' },
      { name: 'Beauty & Personal Care', slug: 'beauty-personal-care', description: 'Cosmetics and personal care products' },
      { name: 'Toys & Games', slug: 'toys-games', description: 'Toys, board games and video games' },
      { name: 'Automotive', slug: 'automotive', description: 'Car parts and automotive accessories' }
    ];
  }

  private getGenericCategories(): any[] {
    return Array.from({ length: 5 }, (_, i) => ({
      name: `Category ${i + 1}`,
      slug: `category-${i + 1}`,
      description: `Description for category ${i + 1}`
    }));
  }

  private getRealisticBlogPosts(count: number): any[] {
    const titles = [
      'Getting Started with React Hooks',
      '10 Tips for Better Work-Life Balance',
      'The Future of Remote Work',
      'Cooking Italian Pasta Like a Pro',
      'Building Healthy Habits That Stick',
      'Travel Photography: Capturing Perfect Moments',
      'Understanding TypeScript in 2024',
      'Sustainable Living: Small Changes, Big Impact',
      'The Art of Minimalist Design',
      'Mindfulness in the Digital Age'
    ];
    
    const statuses = ['published', 'draft', 'published', 'published', 'draft'];
    
    return Array.from({ length: count }, (_, i) => {
      const title = titles[i % titles.length] + (i >= titles.length ? ` - Part ${Math.floor(i / titles.length) + 1}` : '');
      const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      
      return {
        title,
        slug,
        content: `This is the full content of the blog post titled "${title}". It contains detailed information about the topic and provides valuable insights to readers. The content is engaging and well-structured with multiple paragraphs covering different aspects of the subject matter.`,
        excerpt: `This is a brief excerpt of the blog post about ${title.toLowerCase()}.`,
        status: statuses[Math.floor(Math.random() * statuses.length)]
      };
    });
  }

  private getGenericPosts(count: number): any[] {
    return Array.from({ length: count }, (_, i) => ({
      title: `Blog Post ${i + 1}`,
      slug: `blog-post-${i + 1}`,
      content: `This is the content of blog post ${i + 1}. It contains sample text for testing purposes.`,
      excerpt: `Excerpt for blog post ${i + 1}`,
      status: Math.random() > 0.3 ? 'published' : 'draft'
    }));
  }

  private generateBlogComments(count: number): any[] {
    const comments = [
      'Great article! Thanks for sharing these insights.',
      'I completely agree with your points here.',
      'This was exactly what I was looking for.',
      'Very helpful information, bookmarking for later.',
      'Interesting perspective on this topic.',
      'Could you elaborate more on this point?',
      'Thanks for the detailed explanation.',
      'Looking forward to more posts like this.',
      'This helped me solve my problem.',
      'Well written and easy to understand.'
    ];
    
    return Array.from({ length: count }, () => ({
      content: comments[Math.floor(Math.random() * comments.length)],
      status: Math.random() > 0.1 ? 'approved' : 'pending'
    }));
  }

  private getRealisticBlogTags(): any[] {
    const tags = [
      'javascript', 'react', 'nodejs', 'typescript', 'web-development',
      'tutorial', 'tips', 'beginner', 'advanced', 'best-practices',
      'productivity', 'remote-work', 'career', 'lifestyle', 'health',
      'travel', 'food', 'photography', 'design', 'minimalism'
    ];
    
    return tags.map(tag => ({
      name: tag.charAt(0).toUpperCase() + tag.slice(1).replace('-', ' '),
      slug: tag
    }));
  }

  private getGenericTags(): any[] {
    return Array.from({ length: 10 }, (_, i) => ({
      name: `Tag ${i + 1}`,
      slug: `tag-${i + 1}`
    }));
  }

  private getRealisticEcommerceProducts(count: number): any[] {
    const products = [
      { name: 'Wireless Bluetooth Headphones', price: 89.99, category: 'Electronics' },
      { name: 'Cotton T-Shirt', price: 19.99, category: 'Clothing' },
      { name: 'Coffee Maker', price: 129.99, category: 'Home' },
      { name: 'Running Shoes', price: 79.99, category: 'Sports' },
      { name: 'Smartphone Case', price: 14.99, category: 'Electronics' },
      { name: 'Garden Tool Set', price: 45.99, category: 'Home' },
      { name: 'Fitness Tracker', price: 99.99, category: 'Sports' },
      { name: 'Moisturizing Cream', price: 24.99, category: 'Beauty' },
      { name: 'Board Game', price: 34.99, category: 'Toys' },
      { name: 'Car Phone Mount', price: 12.99, category: 'Automotive' }
    ];
    
    return Array.from({ length: count }, (_, i) => {
      const product = products[i % products.length];
      const variation = i >= products.length ? ` - Version ${Math.floor(i / products.length) + 1}` : '';
      
      return {
        name: product.name + variation,
        slug: (product.name + variation).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
        description: `High-quality ${product.name.toLowerCase()} perfect for everyday use. Features premium materials and excellent durability.`,
        price: product.price + (Math.random() * 20 - 10), // Add some price variation
        stock: Math.floor(Math.random() * 100) + 10,
        sku: `SKU-${String(i + 1).padStart(6, '0')}`,
        status: Math.random() > 0.1 ? 'active' : 'inactive'
      };
    });
  }

  private getGenericProducts(count: number): any[] {
    return Array.from({ length: count }, (_, i) => ({
      name: `Product ${i + 1}`,
      slug: `product-${i + 1}`,
      description: `Description for product ${i + 1}`,
      price: Math.floor(Math.random() * 200) + 10,
      stock: Math.floor(Math.random() * 100) + 1,
      sku: `SKU${String(i + 1).padStart(6, '0')}`,
      status: 'active'
    }));
  }

  private generateEcommerceOrders(count: number): any[] {
    const statuses = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];
    const addresses = [
      '123 Main St, Anytown, ST 12345',
      '456 Oak Ave, Somewhere, ST 67890',
      '789 Pine Rd, Elsewhere, ST 13579',
      '321 Elm St, Nowhere, ST 24680',
      '654 Maple Dr, Anywhere, ST 97531'
    ];
    
    return Array.from({ length: count }, () => ({
      status: statuses[Math.floor(Math.random() * statuses.length)],
      total: Math.floor(Math.random() * 500) + 20,
      shipping_address: addresses[Math.floor(Math.random() * addresses.length)],
      billing_address: addresses[Math.floor(Math.random() * addresses.length)]
    }));
  }

  private generateOrderItems(count: number): any[] {
    return Array.from({ length: count }, () => {
      const quantity = Math.floor(Math.random() * 5) + 1;
      const unitPrice = Math.floor(Math.random() * 100) + 10;
      
      return {
        quantity,
        unit_price: unitPrice,
        total_price: quantity * unitPrice
      };
    });
  }

  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  private hashPassword(password: string): string {
    // This is a mock hash for testing purposes
    return '$2b$10$' + Buffer.from(password).toString('base64').substring(0, 22).replace(/\+/g, '.').replace(/\//g, '/') + 'abcdefghijklmnop';
  }

  private generateSequenceUpdates(template: string, postgrestConfig: any): string {
    let sql = '';
    
    switch (template) {
      case 'basic':
        sql += `SELECT setval('${postgrestConfig.schema}.users_id_seq', COALESCE((SELECT MAX(id::int) FROM ${postgrestConfig.schema}.users WHERE id ~ '^[0-9]+$'), 1), true);\n`;
        sql += `SELECT setval('${postgrestConfig.schema}.profiles_id_seq', COALESCE((SELECT MAX(id::int) FROM ${postgrestConfig.schema}.profiles WHERE id ~ '^[0-9]+$'), 1), true);\n`;
        break;
      case 'blog':
        sql += `SELECT setval('${postgrestConfig.schema}.users_id_seq', COALESCE((SELECT MAX(id::int) FROM ${postgrestConfig.schema}.users WHERE id ~ '^[0-9]+$'), 1), true);\n`;
        sql += `SELECT setval('${postgrestConfig.schema}.posts_id_seq', COALESCE((SELECT MAX(id::int) FROM ${postgrestConfig.schema}.posts WHERE id ~ '^[0-9]+$'), 1), true);\n`;
        sql += `SELECT setval('${postgrestConfig.schema}.comments_id_seq', COALESCE((SELECT MAX(id::int) FROM ${postgrestConfig.schema}.comments WHERE id ~ '^[0-9]+$'), 1), true);\n`;
        break;
      case 'ecommerce':
        sql += `SELECT setval('${postgrestConfig.schema}.customers_id_seq', COALESCE((SELECT MAX(id::int) FROM ${postgrestConfig.schema}.customers WHERE id ~ '^[0-9]+$'), 1), true);\n`;
        sql += `SELECT setval('${postgrestConfig.schema}.products_id_seq', COALESCE((SELECT MAX(id::int) FROM ${postgrestConfig.schema}.products WHERE id ~ '^[0-9]+$'), 1), true);\n`;
        sql += `SELECT setval('${postgrestConfig.schema}.orders_id_seq', COALESCE((SELECT MAX(id::int) FROM ${postgrestConfig.schema}.orders WHERE id ~ '^[0-9]+$'), 1), true);\n`;
        break;
    }
    
    return sql;
  }

  /**
   * Parse schema from generated SQL files
   */
  private parseSchemaFromFiles(): { tables: Record<string, TableColumn[]> } | null {
    const schemaFile = join(this.projectPath, 'sql', 'schemas', '01_main.sql');
    if (!existsSync(schemaFile)) {
      return null;
    }
    
    const schemaContent = readFileSync(schemaFile, 'utf-8');
    const tables: Record<string, TableColumn[]> = {};
    
    // Extract CREATE TABLE statements using regex
    const createTableRegex = /CREATE TABLE\s+(\w+\.\w+)\s*\(\s*([\s\S]*?)\s*\);/gi;
    let match;
    
    while ((match = createTableRegex.exec(schemaContent)) !== null) {
      const tableName = match[1].replace(/^\w+\./, ''); // Remove schema prefix
      const columnsText = match[2];
      
      // Parse columns
      const columns = this.parseTableColumns(columnsText);
      if (columns.length > 0) {
        tables[tableName] = columns;
      }
    }
    
    return { tables };
  }

  /**
   * Parse individual table columns from CREATE TABLE statement
   */
  private parseTableColumns(columnsText: string): TableColumn[] {
    const columns: TableColumn[] = [];
    const lines = columnsText.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('--') || trimmed.length === 0 || 
          trimmed.startsWith('CONSTRAINT') || trimmed.startsWith('FOREIGN KEY') ||
          trimmed.startsWith('PRIMARY KEY') || trimmed.startsWith('UNIQUE') ||
          trimmed.startsWith('CHECK')) {
        continue;
      }
      
      // Parse column definition
      const columnMatch = trimmed.match(/^(\w+)\s+([A-Z]+[^,]*?)(?:\s+(.*))?[,]?$/);
      if (columnMatch) {
        const [, name, type, constraints = ''] = columnMatch;
        
        columns.push({
          name,
          type: type.trim(),
          nullable: !constraints.includes('NOT NULL'),
          isPrimaryKey: constraints.includes('PRIMARY KEY'),
          isForeignKey: constraints.includes('REFERENCES'),
          defaultValue: this.extractDefaultValue(constraints)
        });
      }
    }
    
    return columns;
  }

  /**
   * Extract default value from column constraints
   */
  private extractDefaultValue(constraints: string): string | undefined {
    const defaultMatch = constraints.match(/DEFAULT\s+([^,\s]+(?:\([^)]*\))?)/i);
    return defaultMatch ? defaultMatch[1] : undefined;
  }

  /**
   * Generate testing data based on actual schema analysis
   */
  private generateDataFromSchema(schemaAnalysis: { tables: Record<string, TableColumn[]> }, 
                                recordCount: number, realistic: boolean, includeImages: boolean, postgrestConfig: any): string {
    let sql = `-- Schema-based Testing Data\n\n`;
    
    const tableNames = Object.keys(schemaAnalysis.tables);
    console.log(chalk.blue(`📋 Generating data for tables: ${tableNames.join(', ')}`));
    
    // Generate data for each table in dependency order
    const orderedTables = this.orderTablesByDependency(schemaAnalysis.tables);
    
    for (const tableName of orderedTables) {
      const columns = schemaAnalysis.tables[tableName];
      sql += this.generateTableData(tableName, columns, recordCount, realistic, includeImages, postgrestConfig);
      sql += '\n';
    }
    
    return sql;
  }

  /**
   * Order tables by dependency (referenced tables first)
   */
  private orderTablesByDependency(tables: Record<string, TableColumn[]>): string[] {
    const tableNames = Object.keys(tables);
    const withoutForeignKeys: string[] = [];
    const withForeignKeys: string[] = [];
    
    for (const tableName of tableNames) {
      const hasForeignKeys = tables[tableName].some(col => col.isForeignKey);
      if (hasForeignKeys) {
        withForeignKeys.push(tableName);
      } else {
        withoutForeignKeys.push(tableName);
      }
    }
    
    // Return tables without foreign keys first, then tables with foreign keys
    return [...withoutForeignKeys, ...withForeignKeys];
  }

  /**
   * Generate data for a specific table
   */
  private generateTableData(tableName: string, columns: TableColumn[], 
                          recordCount: number, realistic: boolean, includeImages: boolean, postgrestConfig: any): string {
    let sql = `-- Insert ${tableName}\n`;
    
    const insertableColumns = columns.filter(col => 
      col.name !== 'created_at' && col.name !== 'updated_at' && 
      (!col.defaultValue || !col.defaultValue.includes('gen_random_uuid'))
    );
    
    if (insertableColumns.length === 0) {
      return sql + `-- No insertable columns found for ${tableName}\n`;
    }
    
    const columnNames = insertableColumns.map(col => col.name).join(', ');
    sql += `INSERT INTO ${postgrestConfig.schema}.${tableName} (${columnNames}) VALUES\n`;
    
    const records: string[] = [];
    for (let i = 0; i < recordCount; i++) {
      const values = insertableColumns.map(col => this.generateColumnValue(col, i, realistic, includeImages));
      records.push(`  (${values.join(', ')})`);
    }
    
    sql += records.join(',\n');
    sql += ';\n';
    
    return sql;
  }

  /**
   * Generate appropriate value for a column
   */
  private generateColumnValue(column: TableColumn, recordIndex: number, 
                            realistic: boolean, includeImages: boolean): string {
    const { name, type, nullable } = column;
    
    // Handle nullable columns (10% null chance)
    if (nullable && Math.random() < 0.1) {
      return 'NULL';
    }
    
    // Generate based on column type
    if (type.startsWith('UUID')) {
      return `'${this.generateUUID()}'`;
    }
    
    if (type.startsWith('TEXT') || type.startsWith('VARCHAR')) {
      return `'${this.generateTextValue(name, recordIndex, realistic, includeImages)}'`;
    }
    
    if (type.startsWith('INTEGER') || type.startsWith('SERIAL')) {
      return this.generateIntegerValue(name, recordIndex).toString();
    }
    
    if (type.startsWith('DECIMAL') || type.startsWith('NUMERIC')) {
      return this.generateDecimalValue(name, recordIndex).toString();
    }
    
    if (type.startsWith('BOOLEAN')) {
      return Math.random() > 0.5 ? 'true' : 'false';
    }
    
    if (type.includes('TIMESTAMP')) {
      const daysAgo = Math.floor(Math.random() * 365);
      return `NOW() - INTERVAL '${daysAgo} days'`;
    }
    
    // Default fallback
    return `'default_${recordIndex}'`;
  }

  /**
   * Generate text value based on column name and context
   */
  private generateTextValue(columnName: string, index: number, realistic: boolean, includeImages: boolean): string {
    const name = columnName.toLowerCase();
    
    if (name.includes('email')) {
      if (realistic) {
        const baseEmails = this.getRealisticEmails();
        const baseEmail = baseEmails[index % baseEmails.length];
        // Add index to avoid duplicates when we have more records than base emails
        if (index >= baseEmails.length) {
          const [user, domain] = baseEmail.split('@');
          return `${user}${Math.floor(index / baseEmails.length)}@${domain}`;
        }
        return baseEmail;
      } else {
        return `user${index}@example.com`;
      }
    }
    
    if (name.includes('password')) {
      // Generate realistic bcrypt-style hash
      const saltRounds = '$2b$10$';
      const hash = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789./';
      let result = saltRounds;
      for (let i = 0; i < 53; i++) {
        result += hash.charAt(Math.floor(Math.random() * hash.length));
      }
      return result;
    }
    
    if (name.includes('role')) {
      const roles = ['user', 'admin', 'moderator'];
      // Most users should be regular users, some admins, few moderators
      if (index === 0) return 'admin'; // First user is admin
      if (index % 10 === 0) return 'moderator'; // Every 10th user is moderator
      return 'user'; // Everyone else is regular user
    }
    
    if (name.includes('name') || name.includes('title')) {
      return realistic ? this.getRealisticNames()[index % this.getRealisticNames().length] 
                      : `Name ${index}`;
    }
    
    if (name.includes('url') && includeImages) {
      return `https://picsum.photos/400/300?random=${index}`;
    }
    
    if (name.includes('description') || name.includes('content')) {
      return `Sample ${columnName} content for record ${index}`;
    }
    
    if (name.includes('slug')) {
      return `sample-slug-${index}`;
    }
    
    return `Sample ${columnName} ${index}`;
  }

  /**
   * Generate integer value based on context
   */
  private generateIntegerValue(columnName: string, index: number): number {
    const name = columnName.toLowerCase();
    
    if (name.includes('quantity') || name.includes('count')) {
      return Math.floor(Math.random() * 100) + 1;
    }
    
    if (name.includes('price')) {
      return Math.floor(Math.random() * 10000) + 100; // $1.00 to $100.00
    }
    
    return index + 1;
  }

  /**
   * Generate decimal value based on context
   */
  private generateDecimalValue(columnName: string, index: number): number {
    const name = columnName.toLowerCase();
    
    if (name.includes('price')) {
      return Math.round((Math.random() * 999 + 10) * 100) / 100; // $0.10 to $999.99
    }
    
    return Math.round(Math.random() * 100 * 100) / 100;
  }

  /**
   * Get realistic email addresses
   */
  private getRealisticEmails(): string[] {
    return [
      'john.doe@example.com',
      'jane.smith@example.com',
      'alice.johnson@example.com',
      'bob.wilson@example.com',
      'carol.brown@example.com',
      'david.davis@example.com',
      'emma.miller@example.com',
      'frank.moore@example.com',
      'grace.taylor@example.com',
      'henry.anderson@example.com'
    ];
  }

  /**
   * Get realistic names
   */
  private getRealisticNames(): string[] {
    return [
      'John Doe',
      'Jane Smith', 
      'Alice Johnson',
      'Bob Wilson',
      'Carol Brown',
      'David Davis',
      'Emma Miller',
      'Frank Moore',
      'Grace Taylor',
      'Henry Anderson'
    ];
  }

  /**
   * Fallback to template-based data generation
   */
  private generateTemplateBasedDataFallback(template: string, recordCount: number, 
                                          realistic: boolean, includeImages: boolean, postgrestConfig: any): string {
    switch (template) {
      case 'basic':
        return this.generateBasicTemplateData(recordCount, realistic, postgrestConfig);
      case 'blog':
        return this.generateBlogTemplateData(recordCount, realistic, includeImages, postgrestConfig);
      case 'ecommerce':
        return this.generateEcommerceTemplateData(recordCount, realistic, includeImages, postgrestConfig);
      default:
        throw new Error(`Unsupported template: ${template}`);
    }
  }
}