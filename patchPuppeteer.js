// patchPuppeteer.js
const puppeteer = require('puppeteer');

process.env.PUPPETEER_EXECUTABLE_PATH = puppeteer.executablePath();
process.env.CHROME_EXECUTABLE_PATH = puppeteer.executablePath();
process.env.PUPPETEER_SKIP_CHROMIUM_DOWNLOAD = 'false';
