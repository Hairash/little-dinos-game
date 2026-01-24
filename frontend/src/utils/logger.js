/**
 * Centralized logging utility for the frontend application.
 * 
 * Usage:
 *   import logger from '@/utils/logger';
 *   logger.debug('Debug message');
 *   logger.info('Info message');
 *   logger.warn('Warning message');
 *   logger.error('Error message', error);
 * 
 * Log levels are controlled via Vite environment variables:
 *   - VITE_LOG_LEVEL: 'debug' | 'info' | 'warn' | 'error' | 'none'
 *   - Default: 'warn' in production, 'debug' in development
 */

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  NONE: 4,
};

// Get log level from environment variable
// In production builds, Vite will replace import.meta.env with static values
const getLogLevel = () => {
  const envLevel = import.meta.env.VITE_LOG_LEVEL?.toLowerCase();
  
  if (envLevel === 'debug') return LOG_LEVELS.DEBUG;
  if (envLevel === 'info') return LOG_LEVELS.INFO;
  if (envLevel === 'warn') return LOG_LEVELS.WARN;
  if (envLevel === 'error') return LOG_LEVELS.ERROR;
  if (envLevel === 'none') return LOG_LEVELS.NONE;
  
  // Default: debug in dev, warn in production
  return import.meta.env.DEV ? LOG_LEVELS.DEBUG : LOG_LEVELS.WARN;
};

const currentLogLevel = getLogLevel();

const shouldLog = (level) => {
  return level >= currentLogLevel;
};

const logger = {
  debug(...args) {
    if (shouldLog(LOG_LEVELS.DEBUG)) {
      console.log('[DEBUG]', ...args);
    }
  },
  
  info(...args) {
    if (shouldLog(LOG_LEVELS.INFO)) {
      console.info('[INFO]', ...args);
    }
  },
  
  warn(...args) {
    if (shouldLog(LOG_LEVELS.WARN)) {
      console.warn('[WARN]', ...args);
    }
  },
  
  error(...args) {
    if (shouldLog(LOG_LEVELS.ERROR)) {
      console.error('[ERROR]', ...args);
    }
  },
  
  /**
   * Log with a custom prefix (useful for module-specific logging)
   * @param {string} prefix - Prefix to add to log messages
   * @returns {object} Logger instance with prefixed methods
   */
  withPrefix(prefix) {
    return {
      debug: (...args) => logger.debug(`[${prefix}]`, ...args),
      info: (...args) => logger.info(`[${prefix}]`, ...args),
      warn: (...args) => logger.warn(`[${prefix}]`, ...args),
      error: (...args) => logger.error(`[${prefix}]`, ...args),
    };
  },
};

export default logger;

