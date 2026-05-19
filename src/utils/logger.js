import winston from 'winston';
import chalk from 'chalk';
import config from '../config.js';

const { combine, timestamp, printf, colorize } = winston.format;

const customFormat = printf(({ level, message, timestamp, ...meta }) => {
  const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
  return `${chalk.gray(timestamp)} [${level}] ${message}${metaStr}`;
});

export const logger = winston.createLogger({
  level: config.logLevel,
  format: combine(
    timestamp({ format: 'HH:mm:ss' }),
    customFormat
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: combine(timestamp(), winston.format.json()),
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
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
