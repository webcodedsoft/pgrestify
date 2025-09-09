/**
 * @fileoverview Logger utilities for PGRestify CLI
 * 
 * Provides consistent logging and user feedback throughout the CLI.
 * Uses chalk for colorized output and ora for spinners.
 * 
 * @author PGRestify Team
 * @since 1.0.0
 */

import chalk from 'chalk';
import ora, { type Ora } from 'ora';

/**
 * Logger class for consistent CLI output formatting
 */
export class Logger {
  private static instance: Logger;
  private activeSpinner: Ora | null = null;

  private constructor() {}

  /**
   * Get singleton logger instance
   */
  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  /**
   * Log success message with green checkmark
   * @param message - Success message to display
   */
  success(message: string): void {
    this.stopSpinner();
    console.log(chalk.green('✓'), message);
  }

  /**
   * Log error message with red cross
   * @param message - Error message to display
   */
  error(message: string): void {
    this.stopSpinner();
    console.log(chalk.red('✗'), message);
  }

  /**
   * Log warning message with yellow exclamation
   * @param message - Warning message to display
   */
  warn(message: string): void {
    this.stopSpinner();
    console.log(chalk.yellow('⚠'), message);
  }

  /**
   * Log info message with blue info icon
   * @param message - Info message to display
   */
  info(message: string): void {
    this.stopSpinner();
    console.log(chalk.blue('ℹ'), message);
  }

  /**
   * Log plain message without formatting
   * @param message - Message to display
   */
  log(message: string): void {
    this.stopSpinner();
    console.log(message);
  }

  /**
   * Log debug message (only shown in verbose mode)
   * @param message - Debug message to display
   */
  debug(message: string): void {
    if (process.env.DEBUG || process.env.VERBOSE) {
      this.stopSpinner();
      console.log(chalk.gray('🐛'), chalk.gray(message));
    }
  }

  /**
   * Start a loading spinner with message
   * @param message - Loading message to display
   */
  startSpinner(message: string): void {
    this.stopSpinner();
    this.activeSpinner = ora(message).start();
  }

  /**
   * Update spinner message
   * @param message - New message for spinner
   */
  updateSpinner(message: string): void {
    if (this.activeSpinner) {
      this.activeSpinner.text = message;
    }
  }

  /**
   * Stop active spinner with success
   * @param message - Success message (optional)
   */
  succeedSpinner(message?: string): void {
    if (this.activeSpinner) {
      this.activeSpinner.succeed(message);
      this.activeSpinner = null;
    }
  }

  /**
   * Stop active spinner with failure
   * @param message - Failure message (optional)
   */
  failSpinner(message?: string): void {
    if (this.activeSpinner) {
      this.activeSpinner.fail(message);
      this.activeSpinner = null;
    }
  }

  /**
   * Stop active spinner without message
   */
  stopSpinner(): void {
    if (this.activeSpinner) {
      this.activeSpinner.stop();
      this.activeSpinner = null;
    }
  }

  /**
   * Print a section header with styling
   * @param title - Section title
   */
  section(title: string): void {
    this.stopSpinner();
    console.log('');
    console.log(chalk.bold.cyan(`== ${title} ==`));
  }

  /**
   * Print a prominent title
   * @param title - Main title
   */
  title(title: string): void {
    this.stopSpinner();
    console.log('');
    console.log(chalk.bold.magenta(title));
    console.log(chalk.magenta('='.repeat(title.length)));
  }

  /**
   * Print code block with syntax highlighting
   * @param code - Code to display
   * @param language - Programming language (for styling)
   */
  code(code: string, language: string = 'bash'): void {
    this.stopSpinner();
    console.log('');
    console.log(chalk.gray('```' + language));
    console.log(chalk.cyan(code));
    console.log(chalk.gray('```'));
  }

  /**
   * Print a list of items with bullet points
   * @param items - Array of items to display
   */
  list(items: string[]): void {
    this.stopSpinner();
    items.forEach(item => {
      console.log(chalk.gray('  •'), item);
    });
  }

  /**
   * Print key-value pairs in a formatted way
   * @param data - Object with key-value pairs
   */
  keyValue(data: Record<string, string | number | boolean>): void {
    this.stopSpinner();
    Object.entries(data).forEach(([key, value]) => {
      console.log(chalk.gray(`  ${key}:`), chalk.white(String(value)));
    });
  }

  /**
   * Create a visual separator
   */
  separator(): void {
    this.stopSpinner();
    console.log(chalk.gray('─'.repeat(50)));
  }

  /**
   * Print empty line for spacing
   */
  newLine(): void {
    console.log('');
  }
}

/**
 * Global logger instance for easy access
 */
export const logger = Logger.getInstance();

/**
 * Utility function to handle async operations with loading spinner
 * @param message - Loading message
 * @param operation - Async operation to perform
 * @returns Promise with operation result
 */
export async function withSpinner<T>(
  message: string,
  operation: () => Promise<T>
): Promise<T> {
  logger.startSpinner(message);
  try {
    const result = await operation();
    logger.succeedSpinner();
    return result;
  } catch (error) {
    logger.failSpinner();
    throw error;
  }
}