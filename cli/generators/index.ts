// PGRestify Dynamic Generators
// Exports all generator classes and utilities

export { SchemaInspector } from './SchemaInspector.js';
export { PolicyGenerator } from './PolicyGenerator.js';
export { ViewGenerator } from './ViewGenerator.js';
export { FunctionGenerator } from './FunctionGenerator.js';
export { IndexGenerator } from './IndexGenerator.js';
export { TestingDataGenerator } from './TestingDataGenerator.js';

// Export types and interfaces
export type { 
  DatabaseConnection,
  TableColumn,
  TableRelation,
  TableIndex,
  SchemaAnalysis 
} from './SchemaInspector.js';

export type { 
  PolicyConfig 
} from './PolicyGenerator.js';

export type { 
  ViewConfig,
  ViewAnalysis 
} from './ViewGenerator.js';

export type { 
  FunctionParameter,
  CustomFunctionConfig,
  AuthFunctionConfig 
} from './FunctionGenerator.js';

export type { 
  IndexConfig,
  IndexAnalysis 
} from './IndexGenerator.js';

export type { 
  TestingDataConfig 
} from './TestingDataGenerator.js';