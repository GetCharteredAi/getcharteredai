// netlify/functions/utils/lessons-loader.js
// Loads and filters published manager learning topics from manager-lessons-data.json.
// Injected via require.cache in tests to supply controlled topic fixtures.

'use strict';

const fs   = require('fs');
const path = require('path');

const DEFAULT_DATA_PATH = path.join(__dirname, '..', 'manager-lessons-data.json');

class LessonsLoadError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = 'LessonsLoadError';
    if (cause !== undefined) this.cause = cause;
  }
}

/**
 * Loads published topics from an arbitrary file path.
 *
 * Returns [] only when the file is structurally valid and the topics array is
 * empty or contains no published topics.
 *
 * Throws LessonsLoadError (after server-side logging) for:
 *   - File not found or unreadable
 *   - Invalid JSON
 *   - JSON that lacks a "topics" array at the root
 *
 * @param {string} dataPath
 * @returns {object[]}
 * @throws {LessonsLoadError}
 */
function loadPublishedTopicsFrom(dataPath) {
  let raw;
  try {
    raw = fs.readFileSync(dataPath, 'utf8');
  } catch (e) {
    const msg = e.code === 'ENOENT'
      ? `[lessons-loader] Data file not found: ${dataPath}`
      : `[lessons-loader] Could not read data file: ${e.message}`;
    console.error(msg);
    throw new LessonsLoadError(msg, e);
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    const msg = `[lessons-loader] Data file is not valid JSON: ${e.message}`;
    console.error(msg);
    throw new LessonsLoadError(msg, e);
  }

  if (!data || typeof data !== 'object' || !Array.isArray(data.topics)) {
    const msg = '[lessons-loader] Data file must have a "topics" array at the root';
    console.error(msg);
    throw new LessonsLoadError(msg);
  }

  return data.topics.filter(t => t.published === true);
}

/**
 * Loads published topics from the default data file.
 * @returns {object[]}
 * @throws {LessonsLoadError}
 */
function loadPublishedTopics() {
  return loadPublishedTopicsFrom(DEFAULT_DATA_PATH);
}

module.exports = { loadPublishedTopics, loadPublishedTopicsFrom, LessonsLoadError };
