/**
 * @fileoverview File system utilities for PGRestify CLI
 * 
 * Provides enhanced file system operations with error handling,
 * template processing, and project structure management.
 * 
 * @author PGRestify Team
 * @since 1.0.0
 */

import fsExtra from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { FileTemplate } from '../types/secure.js';
import { logger } from './logger.js';

const execAsync = promisify(exec);

/**
 * Get the directory path of the current module
 */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * File system utilities class
 */
export class FileSystemUtils {
  /**
   * Check if a file or directory exists
   * @param filePath - Path to check
   * @returns True if exists, false otherwise
   */
  static async exists(filePath: string): Promise<boolean> {
    try {
      await fsExtra.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Ensure directory exists, create if it doesn't
   * @param dirPath - Directory path to ensure
   */
  static async ensureDir(dirPath: string): Promise<void> {
    await fsExtra.ensureDir(dirPath);
  }

  /**
   * Read file content as string
   * @param filePath - Path to file
   * @returns File content as string
   */
  static async readFile(filePath: string): Promise<string> {
    return fsExtra.readFile(filePath, 'utf-8');
  }

  /**
   * Write content to file, creating directories if needed
   * @param filePath - Path to file
   * @param content - Content to write
   */
  static async writeFile(filePath: string, content: string): Promise<void> {
    await fsExtra.ensureDir(path.dirname(filePath));
    await fsExtra.writeFile(filePath, content, 'utf-8');
  }

  /**
   * Append content to file
   * @param filePath - Path to file
   * @param content - Content to append
   */
  static async appendFile(filePath: string, content: string): Promise<void> {
    await fsExtra.appendFile(filePath, content, 'utf-8');
  }

  /**
   * Copy file from source to destination
   * @param source - Source file path
   * @param destination - Destination file path
   */
  static async copyFile(source: string, destination: string): Promise<void> {
    await fsExtra.ensureDir(path.dirname(destination));
    await fsExtra.copy(source, destination);
  }

  /**
   * Copy entire directory recursively
   * @param source - Source directory path
   * @param destination - Destination directory path
   */
  static async copyDir(source: string, destination: string): Promise<void> {
    await fsExtra.copy(source, destination);
  }

  /**
   * Remove file or directory
   * @param filePath - Path to remove
   */
  static async remove(filePath: string): Promise<void> {
    await fsExtra.remove(filePath);
  }

  /**
   * List directory contents
   * @param dirPath - Directory path
   * @returns Array of file/directory names
   */
  static async readDir(dirPath: string): Promise<string[]> {
    return fsExtra.readdir(dirPath);
  }

  /**
   * Get file/directory stats
   * @param filePath - Path to check
   * @returns File stats
   */
  static async stat(filePath: string): Promise<fsExtra.Stats> {
    return fsExtra.stat(filePath);
  }

  /**
   * Change file permissions
   * @param filePath - Path to file
   * @param mode - File mode (e.g., 0o755)
   */
  static async chmod(filePath: string, mode: number): Promise<void> {
    await fsExtra.chmod(filePath, mode);
  }

  /**
   * Check if path is a directory
   * @param filePath - Path to check
   * @returns True if directory, false otherwise
   */
  static async isDirectory(filePath: string): Promise<boolean> {
    try {
      const stats = await fsExtra.stat(filePath);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * Check if path is a file
   * @param filePath - Path to check
   * @returns True if file, false otherwise
   */
  static async isFile(filePath: string): Promise<boolean> {
    try {
      const stats = await fsExtra.stat(filePath);
      return stats.isFile();
    } catch {
      return false;
    }
  }

  /**
   * Process template file by replacing variables
   * @param templateContent - Template content with placeholders
   * @param variables - Variables to replace (e.g., {{PROJECT_NAME}})
   * @returns Processed content
   */
  static processTemplate(
    templateContent: string,
    variables: Record<string, string>
  ): string {
    let processed = templateContent;
    
    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      processed = processed.replace(regex, value);
    });

    return processed;
  }

  /**
   * Write file from template with variable substitution
   * @param template - Template configuration
   * @param outputPath - Output file path
   */
  static async writeFromTemplate(
    template: FileTemplate,
    outputPath: string
  ): Promise<void> {
    const content = template.variables
      ? this.processTemplate(template.content, template.variables)
      : template.content;

    await this.writeFile(outputPath, content);
    logger.debug(`Generated file: ${outputPath}`);
  }

  /**
   * Get project root directory (where package.json is located)
   * @param startPath - Starting search path (defaults to cwd)
   * @returns Project root path or null if not found
   */
  static async findProjectRoot(startPath: string = process.cwd()): Promise<string | null> {
    let currentPath = path.resolve(startPath);
    const root = path.parse(currentPath).root;

    while (currentPath !== root) {
      const packageJsonPath = path.join(currentPath, 'package.json');
      if (await this.exists(packageJsonPath)) {
        return currentPath;
      }
      currentPath = path.dirname(currentPath);
    }

    return null;
  }

  /**
   * Get CLI templates directory path
   * @returns Templates directory path
   */
  static getTemplatesDir(): string {
    return path.resolve(__dirname, '..', 'templates');
  }

  /**
   * Load template file from templates directory
   * @param templateName - Template file name
   * @returns Template content
   */
  static async loadTemplate(templateName: string): Promise<string> {
    const templatePath = path.join(this.getTemplatesDir(), templateName);
    if (!(await this.exists(templatePath))) {
      throw new Error(`Template not found: ${templateName}`);
    }
    return this.readFile(templatePath);
  }

  /**
   * Create directory structure from template
   * @param templateDir - Source template directory
   * @param targetDir - Target directory to create
   * @param variables - Variables for template processing
   */
  static async createFromTemplate(
    templateDir: string,
    targetDir: string,
    variables: Record<string, string> = {}
  ): Promise<void> {
    const sourcePath = path.join(this.getTemplatesDir(), templateDir);
    
    if (!(await this.exists(sourcePath))) {
      throw new Error(`Template directory not found: ${templateDir}`);
    }

    await this.ensureDir(targetDir);
    await this.copyTemplateDir(sourcePath, targetDir, variables);
  }

  /**
   * Recursively copy template directory with variable substitution
   * @param source - Source directory
   * @param destination - Destination directory
   * @param variables - Variables for substitution
   */
  private static async copyTemplateDir(
    source: string,
    destination: string,
    variables: Record<string, string>
  ): Promise<void> {
    const entries = await fsExtra.readdir(source, { withFileTypes: true });

    for (const entry of entries) {
      const sourcePath = path.join(source, entry.name);
      const destPath = path.join(destination, entry.name);

      if (entry.isDirectory()) {
        await this.ensureDir(destPath);
        await this.copyTemplateDir(sourcePath, destPath, variables);
      } else {
        const content = await this.readFile(sourcePath);
        const processedContent = this.processTemplate(content, variables);
        await this.writeFile(destPath, processedContent);
      }
    }
  }

  /**
   * Safely read JSON file with error handling
   * @param filePath - JSON file path
   * @returns Parsed JSON object
   */
  static async readJson<T = any>(filePath: string): Promise<T> {
    try {
      const content = await this.readFile(filePath);
      return JSON.parse(content);
    } catch (error) {
      throw new Error(`Failed to read JSON file ${filePath}: ${error}`);
    }
  }

  /**
   * Write object to JSON file with formatting
   * @param filePath - JSON file path
   * @param data - Data to write
   * @param indent - JSON indentation (default: 2)
   */
  static async writeJson(
    filePath: string,
    data: any,
    indent: number = 2
  ): Promise<void> {
    const content = JSON.stringify(data, null, indent);
    await this.writeFile(filePath, content);
  }

  /**
   * Get relative path from current working directory
   * @param filePath - Absolute file path
   * @returns Relative path from cwd
   */
  static getRelativePath(filePath: string): string {
    return path.relative(process.cwd(), filePath);
  }

  /**
   * Validate file name (no invalid characters)
   * @param fileName - File name to validate
   * @returns True if valid, false otherwise
   */
  static isValidFileName(fileName: string): boolean {
    const invalidChars = /[<>:"/\\|?*]/;
    return !invalidChars.test(fileName) && fileName.length > 0;
  }

  /**
   * Validate directory name (no invalid characters)
   * @param dirName - Directory name to validate
   * @returns True if valid, false otherwise
   */
  static isValidDirName(dirName: string): boolean {
    return this.isValidFileName(dirName);
  }

  /**
   * Execute shell command
   * @param command - Command to execute
   * @param options - Execution options
   * @returns Command output
   */
  static async exec(command: string, options?: { cwd?: string }): Promise<string> {
    try {
      const { stdout } = await execAsync(command, options);
      return stdout.trim();
    } catch (error: any) {
      throw new Error(`Command failed: ${error.message}`);
    }
  }
}

/**
 * Convenience alias for easier imports
 */
export const fs = FileSystemUtils;