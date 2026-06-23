import puppeteer from 'puppeteer';
import { PuppeteerScreenRecorder } from 'puppeteer-screen-recorder';
import path from 'path';
import fs from 'fs';
import { Video } from '../models/Video';

export const recordGameplay = async (durationSeconds: number, title: string) => {
  const uploadDir = path.join(process.cwd(), 'public', 'uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const timestamp = Date.now();
  const filename = `gameplay_${timestamp}.mp4`;
  const savePath = path.join(uploadDir, filename);

  let browser;
  try {
    // Launch headless browser
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1080,1920']
    });
    
    const page = await browser.newPage();
    
    // Set viewport to the canvas size
    await page.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 });

    // Initialize screen recorder
    const recorder = new PuppeteerScreenRecorder(page, {
      fps: 60,
      videoFrame: { width: 1080, height: 1920 },
      videoCrf: 18,
      videoCodec: 'libx264',
      videoPreset: 'ultrafast',
      videoBitrate: 2500,
      autopad: { color: 'black' },
      recordDurationLimit: durationSeconds // The recorder will automatically stop after this
    });

    // Navigate to the game page in auto-play and headless mode
    // Using localhost:5000 which serves the frontend from /public
    console.log(`Starting headless game recording for ${durationSeconds} seconds...`);
    await page.goto('http://localhost:5000/game?autoplay=true&headless=true', { waitUntil: 'networkidle0' });

    // Start recording
    await recorder.start(savePath);

    // Wait for the duration + a small buffer to ensure saving completes
    await new Promise(resolve => setTimeout(resolve, durationSeconds * 1000 + 2000));

    // Stop recorder if it hasn't stopped automatically
    await recorder.stop();
    await browser.close();

    console.log(`Recording finished: ${filename}`);

    // Create a Video entry in the database
    const video = new Video({
      title: title || `Gameplay Recording ${new Date().toLocaleString()}`,
      filePath: savePath,
      fileName: filename,
      duration: durationSeconds,
      status: 'Ready',
      url: `http://localhost:5000/uploads/${filename}`,
      detectedFormat: 'Shorts Mode (9:16)'
    });

    await video.save();
    return video;

  } catch (error) {
    if (browser) await browser.close();
    console.error('Error during headless recording:', error);
    throw error;
  }
};

export const startStudioRecording = async (loops: number) => {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: "new",
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox', 
        '--autoplay-policy=no-user-gesture-required',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding'
      ]
    });
    
    const page = await browser.newPage();
    
    // Listen for completion and log all browser console messages
    page.on('console', async (msg) => {
      const text = msg.text();
      console.log(`[Browser Console]: ${text}`);
      if (text === 'RECORDING_COMPLETE') {
        console.log('Studio recording completed. Closing browser.');
        if (browser) await browser.close();
      }
    });

    page.on('pageerror', (err) => {
      console.error('Headless Page Error:', err.message);
    });

    page.on('requestfailed', (req) => {
      console.error('Headless Request Failed:', req.url(), req.failure()?.errorText);
    });

    console.log(`Starting headless studio recording for ${loops} loops...`);
    await page.goto(`http://localhost:${process.env.PORT || 5000}/g-records?autoplay=true&headless=true&loops=${loops}`, { waitUntil: 'networkidle2' });

  } catch (error) {
    if (browser) await browser.close();
    console.error('Error during headless studio recording:', error);
    throw error;
  }
};
