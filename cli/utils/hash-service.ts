/**
 * @fileoverview Centralized hash service for SQL file change tracking
 * 
 * Provides hybrid detection for both automatically generated files (via writeTableSQL)
 * and manually created/edited files. All CLI commands and generators use this service
 * transparently for accurate change detection across team members.
 * 
 * @author PGRestify Team
 * @since 2.0.0
 */

import crypto from 'crypto';
import path from 'path';
import { logger } from './logger.js';
import { fs } from './fs.js';
import { getSQLFilesForMigration } from './sql-structure.js';

export interface FileHashInfo {
  hash: string;
  lastModified: number;
  source: 'automatic' | 'manual' | 'unknown';
}

export interface HashTrackingData {
  version: string;
  lastApplied: number;
  trackedFiles: Record<string, FileHashInfo>;
}

export class HashService {
  private trackingFilePath: string;
  private trackingData: HashTrackingData | null = null;

  constructor(private projectPath: string) {
    this.trackingFilePath = path.join(projectPath, '.pgrestify-applied');
  }

  /**
   * Calculate hash from SQL content (ignoring comments/whitespace)
   */
  private calculateContentHash(content: string): string {
    // Extract only meaningful SQL statements
    const sqlContent = content
      .split('\n')
      .filter(line => {
        const trimmed = line.trim();
        return trimmed && 
               !trimmed.startsWith('--') && 
               !trimmed.startsWith('/*') &&
               !trimmed.match(/^\/\*/);
      })
      .join('\n')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();

    return crypto.createHash('sha256').update(sqlContent).digest('hex');
  }

  /**
   * Load tracking data from file
   */
  private async loadTrackingData(): Promise<HashTrackingData> {
    if (this.trackingData) {
      return this.trackingData;
    }

    try {
      if (await fs.exists(this.trackingFilePath)) {
        const content = await fs.readFile(this.trackingFilePath);
        this.trackingData = JSON.parse(content);
      }
    } catch (error) {
      logger.debug(`Could not load hash tracking data: ${error.message}`);
    }

    // Default data if file doesn't exist or is invalid
    if (!this.trackingData) {
      this.trackingData = {
        version: '1.0',
        lastApplied: 0,
        trackedFiles: {}
      };
    }

    return this.trackingData;
  }

  /**
   * Save tracking data to file
   */
  private async saveTrackingData(): Promise<void> {
    if (!this.trackingData) return;

    try {
      const content = JSON.stringify(this.trackingData, null, 2);
      await fs.writeFile(this.trackingFilePath, content);
      logger.debug('Updated hash tracking data');
    } catch (error) {
      logger.debug(`Could not save hash tracking data: ${error.message}`);
    }
  }

  /**
   * Track a file write operation (called by writeTableSQL wrapper)
   */
  async trackFileWrite(filePath: string, originalContent: string): Promise<void> {
    const trackingData = await this.loadTrackingData();
    const relativePath = path.relative(this.projectPath, filePath);
    const contentHash = this.calculateContentHash(originalContent);

    trackingData.trackedFiles[relativePath] = {
      hash: contentHash,
      lastModified: Date.now(),
      source: 'automatic'
    };

    await this.saveTrackingData();
    logger.debug(`Tracked automatic write: ${relativePath}`);
  }

  /**
   * Scan for manual file changes (files not tracked via writeTableSQL)
   */
  private async scanForManualChanges(allSqlFiles: string[]): Promise<string[]> {
    const trackingData = await this.loadTrackingData();
    const manualChanges: string[] = [];

    for (const file of allSqlFiles) {
      const fullPath = file.startsWith('/') ? file : path.join(this.projectPath, file);
      const relativePath = path.relative(this.projectPath, fullPath);

      if (!(await fs.exists(fullPath))) {
        continue;
      }

      const content = await fs.readFile(fullPath);
      const currentHash = this.calculateContentHash(content);
      const trackedInfo = trackingData.trackedFiles[relativePath];

      // Check if this is a manual change
      if (!trackedInfo) {
        // New file not tracked
        manualChanges.push(file);
        logger.debug(`Detected new manual file: ${relativePath}`);
      } else if (currentHash !== trackedInfo.hash) {
        // File changed since last tracking
        if (trackedInfo.source === 'automatic') {
          // This was auto-tracked but manually modified
          logger.debug(`Detected manual modification of auto-tracked file: ${relativePath}`);
        } else {
          // This was manually tracked and manually modified again
          logger.debug(`Detected manual change: ${relativePath}`);
        }
        manualChanges.push(file);
      }
    }

    return manualChanges;
  }

  /**
   * Find all files that have changed since last application
   * Combines automatic tracking + manual file scanning
   */
  async findRecentChanges(): Promise<string[]> {
    // Get all SQL files in the project
    let allSqlFiles: string[] = [];
    
    try {
      allSqlFiles = await getSQLFilesForMigration(this.projectPath);
      
      // Add additional files that might exist
      const additionalFiles = [
        'sql/functions/auth.sql',
        'sql/testing_data.sql'
      ];
      
      for (const file of additionalFiles) {
        const fullPath = path.join(this.projectPath, file);
        if (await fs.exists(fullPath)) {
          allSqlFiles.push(file);
        }
      }
    } catch (error) {
      logger.debug(`Could not get SQL files: ${error.message}`);
    }

    // Scan for all changes (both automatic and manual)
    const changedFiles = await this.scanForManualChanges(allSqlFiles);
    
    return changedFiles;
  }

  /**
   * Get human-readable information about recent changes
   */
  async getChangesSummary(): Promise<Array<{file: string, status: string, modifiedAgo: string}>> {
    const recentFiles = await this.findRecentChanges();
    const summary = [];

    for (const file of recentFiles) {
      const fullPath = file.startsWith('/') ? file : path.join(this.projectPath, file);
      const relativePath = path.relative(this.projectPath, fullPath);
      
      try {
        const stat = await fs.stat(fullPath);
        const modTime = stat.mtimeMs;
        const timeAgo = this.getTimeAgo(modTime);
        
        const trackingData = await this.loadTrackingData();
        const trackedInfo = trackingData.trackedFiles[relativePath];
        
        let status = 'new';
        if (trackedInfo) {
          status = trackedInfo.source === 'automatic' ? 'modified (auto-tracked)' : 'modified (manual)';
        }

        summary.push({
          file: relativePath,
          status,
          modifiedAgo: timeAgo
        });
      } catch (error) {
        summary.push({
          file: relativePath,
          status: 'unknown',
          modifiedAgo: 'unknown'
        });
      }
    }

    return summary;
  }

  /**
   * Mark files as applied (after successful database application)
   */
  async markFilesAsApplied(appliedFiles: string[]): Promise<void> {
    const trackingData = await this.loadTrackingData();
    const now = Date.now();
    
    trackingData.lastApplied = now;

    for (const file of appliedFiles) {
      const fullPath = file.startsWith('/') ? file : path.join(this.projectPath, file);
      const relativePath = path.relative(this.projectPath, fullPath);

      if (await fs.exists(fullPath)) {
        const content = await fs.readFile(fullPath);
        const contentHash = this.calculateContentHash(content);
        
        // Update or create tracking info
        const existingInfo = trackingData.trackedFiles[relativePath];
        trackingData.trackedFiles[relativePath] = {
          hash: contentHash,
          lastModified: now,
          source: existingInfo?.source === 'automatic' ? 'automatic' : 'manual'
        };
      }
    }

    await this.saveTrackingData();
    logger.debug(`Marked ${appliedFiles.length} files as applied`);
  }

  /**
   * Get human-readable time ago string
   */
  private getTimeAgo(timestamp: number): string {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    return 'just now';
  }

  /**
   * Reset tracking data (useful for debugging)
   */
  async resetTracking(): Promise<void> {
    this.trackingData = {
      version: '1.0',
      lastApplied: 0,
      trackedFiles: {}
    };
    await this.saveTrackingData();
    logger.debug('Reset hash tracking data');
  }

  /**
   * Get tracking file path for git ignore purposes
   */
  getTrackingFilePath(): string {
    return this.trackingFilePath;
  }
}

// Global hash service instance per project
const hashServiceInstances = new Map<string, HashService>();

/**
 * Get or create hash service instance for a project
 */
export function getHashService(projectPath: string): HashService {
  if (!hashServiceInstances.has(projectPath)) {
    hashServiceInstances.set(projectPath, new HashService(projectPath));
  }
  return hashServiceInstances.get(projectPath)!;
}