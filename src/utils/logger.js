import winston from 'winston';
import chalk from 'chalk';
import { existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..', '..');
const LOG_DIR = join(ROOT_DIR, 'logs');

// Ensure logs directory exists
if (!existsSync(LOG_DIR)) {
  mkdirSync(LOG_DIR, { recursive: true });
}

const { combine, timestamp, printf } = winston.format;

const customFormat = printf(({ level, message, timestamp: ts }) => {
  return `${chalk.gray(ts)} [${level}] ${message}`;
});

const logLevel = process.env.LOG_LEVEL || 'info';

export const logger = winston.createLogger({
  level: logLevel,
  format: combine(
    timestamp({ format: 'HH:mm:ss' }),
    customFormat
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({
      filename: join(LOG_DIR, 'error.log'),
      level: 'error',
      format: combine(timestamp(), winston.format.json()),
    }),
    new winston.transports.File({
      filename: join(LOG_DIR, 'combined.log'),
      format: combine(timestamp(), winston.format.json()),
    }),
  ],
});

export const logSuccess = (msg) => logger.info(chalk.green(`✓ ${msg}`));
export const logError = (msg) => logger.error(chalk.red(`✗ ${msg}`));
export const logWarn = (msg) => logger.warn(chalk.yellow(`⚠ ${msg}`));
export const logInfo = (msg) => logger.info(chalk.blue(`ℹ ${msg}`));
export const logStep = (step, msg) => logger.info(chalk.cyan(`[Step ${step}] ${msg}`));

export default logger;
