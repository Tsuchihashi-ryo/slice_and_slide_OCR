import { Page, Block } from '../types';

declare global {
  interface Window {
    Tesseract: any;
  }
}

let workerPromise: Promise<any> | null = null;

const getWorker = () => {
  if (!workerPromise) {
    if (!window.Tesseract) {
      throw new Error("Tesseract.js not loaded");
    }
    // Initialize worker with English and Japanese
    workerPromise = (async () => {
      const worker = await window.Tesseract.createWorker(['eng', 'jpn']);
      return worker;
    })();
  }
  return workerPromise;
};

/**
 * Pre-processes the image to improve OCR accuracy.
 * Handles:
 * 1. Transparency (flattens to white)
 * 2. Grayscale conversion
 * 3. Contrast enhancement
 * 4. Automatic Inversion
 * 5. Binarization (Otsu's Method)
 */
const preprocessImageForOcr = (imageSrc: string): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(imageSrc); return; }

      // 1. Draw on White Background to handle transparency
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      const w = canvas.width;
      const h = canvas.height;
      
      let min = 255, max = 0;
      let globalSum = 0;

      // 2. Grayscale & Stats
      for (let i = 0; i < data.length; i += 4) {
        // Luminance
        const brightness = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
        
        if (brightness < min) min = brightness;
        if (brightness > max) max = brightness;
        
        globalSum += brightness;

        // Set RGB to grayscale value
        data[i] = brightness;
        data[i + 1] = brightness;
        data[i + 2] = brightness;
      }
      
      const globalAvg = globalSum / (data.length / 4);

      // 3. Contrast Stretching
      if (max > min) {
        for (let i = 0; i < data.length; i += 4) {
           const v = data[i];
           const newVal = ((v - min) / (max - min)) * 255;
           data[i] = newVal;
           data[i+1] = newVal;
           data[i+2] = newVal;
        }
      }

      // 4. Smart Inversion Logic
      // We need to determine if this is "Light Text on Dark".
      
      // Calculate Border Brightness (Assume this is "Background")
      let borderSum = 0;
      let borderCount = 0;
      const borderSize = Math.min(5, Math.floor(Math.min(w, h) / 4));

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (y < borderSize || y >= h - borderSize || x < borderSize || x >= w - borderSize) {
             // It's a border pixel
             borderSum += data[(y * w + x) * 4];
             borderCount++;
          }
        }
      }
      const borderAvg = borderCount > 0 ? borderSum / borderCount : 255;

      // Calculate Center Brightness (The Object)
      let centerSum = 0;
      let centerCount = 0;
      const startX = Math.floor(w * 0.25);
      const endX = Math.floor(w * 0.75);
      const startY = Math.floor(h * 0.25);
      const endY = Math.floor(h * 0.75);

      for (let y = startY; y < endY; y++) {
         for (let x = startX; x < endX; x++) {
             centerSum += data[(y * w + x) * 4];
             centerCount++;
         }
      }
      const centerAvg = centerCount > 0 ? centerSum / centerCount : globalAvg;

      let shouldInvert = false;

      // Scenario A: Global Dark Background (e.g. Chalkboard)
      if (globalAvg < 128) {
        shouldInvert = true;
      }
      // Scenario B: Light Page, but Dark Center Object (e.g. Blue Arrow on White Page)
      else if (borderAvg > 180 && centerAvg < 160) {
        shouldInvert = true;
      }

      if (shouldInvert) {
        for (let i = 0; i < data.length; i += 4) {
           data[i] = 255 - data[i];
           data[i+1] = 255 - data[i+1];
           data[i+2] = 255 - data[i+2];
        }
      }

      // 5. Adaptive Binarization (Otsu's Method)
      // Calculate histogram
      const histogram = new Array(256).fill(0);
      for (let i = 0; i < data.length; i += 4) {
        // Data is grayscale, so R=G=B. We use R channel.
        histogram[Math.floor(data[i])]++;
      }

      // Compute Total Number of Pixels
      const total = data.length / 4;

      let sum = 0;
      for (let i = 0; i < 256; i++) sum += i * histogram[i];

      let sumB = 0;
      let wB = 0;
      let wF = 0;
      let maxVar = 0;
      let threshold = 0;

      for (let t = 0; t < 256; t++) {
        wB += histogram[t];
        if (wB === 0) continue;
        wF = total - wB;
        if (wF === 0) break;

        sumB += t * histogram[t];

        const mB = sumB / wB;
        const mF = (sum - sumB) / wF;

        // Between Class Variance
        const varBetween = wB * wF * (mB - mF) * (mB - mF);

        if (varBetween > maxVar) {
          maxVar = varBetween;
          threshold = t;
        }
      }

      // Apply Threshold
      for (let i = 0; i < data.length; i += 4) {
        const v = data[i] > threshold ? 255 : 0;
        data[i] = v;
        data[i+1] = v;
        data[i+2] = v;
      }

      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => resolve(imageSrc);
    img.src = imageSrc;
  });
};

/**
 * Extracts the text color using a Histogram / Peak Detection approach.
 * 1. Quantizes colors to group similar shades.
 * 2. Builds a frequency histogram.
 * 3. Identifies the dominant peak (Background).
 * 4. Identifies the secondary peak that is sufficiently different from the background (Text).
 */
const extractTextColor = (imageSrc: string): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve('#000000'); return; }
      
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      // Map key "r,g,b" -> count
      const colorCounts = new Map<string, number>();
      const colorValues = new Map<string, {r: number, g: number, b: number}>();
      
      // Quantization factor: Rounds colors to nearest 10 to group compression artifacts
      const Q = 10; 

      for (let i = 0; i < data.length; i += 4) {
        // Skip transparent pixels
        if (data[i + 3] < 50) continue;

        // Quantize
        const r = Math.round(data[i] / Q) * Q;
        const g = Math.round(data[i+1] / Q) * Q;
        const b = Math.round(data[i+2] / Q) * Q;
        
        const key = `${r},${g},${b}`;
        
        colorCounts.set(key, (colorCounts.get(key) || 0) + 1);
        if (!colorValues.has(key)) {
          colorValues.set(key, {r, g, b});
        }
      }

      // Convert to array and sort by frequency (Descending)
      const sortedColors = Array.from(colorCounts.entries())
        .map(([key, count]) => ({
          key,
          count,
          rgb: colorValues.get(key)!
        }))
        .sort((a, b) => b.count - a.count);

      if (sortedColors.length === 0) { resolve('#000000'); return; }

      // Peak 1: Background (Most frequent)
      const bg = sortedColors[0].rgb;

      // Peak 2: Text (Next most frequent distinct color)
      // We look for the first color that has a significant Euclidean distance from the background.
      let textRgb = { r: 0, g: 0, b: 0 };
      let foundText = false;
      const MIN_DISTANCE = 60; // Threshold to avoid picking gradient noise

      for (let i = 1; i < sortedColors.length; i++) {
        const candidate = sortedColors[i].rgb;
        const dist = Math.sqrt(
          Math.pow(candidate.r - bg.r, 2) +
          Math.pow(candidate.g - bg.g, 2) +
          Math.pow(candidate.b - bg.b, 2)
        );

        if (dist > MIN_DISTANCE) {
          textRgb = candidate;
          foundText = true;
          break; // Found the lower peak (text)
        }
      }

      // Fallback: If no distinct second peak found (solid block), contrast against background
      if (!foundText) {
        const bgBrightness = (bg.r * 299 + bg.g * 587 + bg.b * 114) / 1000;
        textRgb = bgBrightness > 128 
          ? { r: 0, g: 0, b: 0 } 
          : { r: 255, g: 255, b: 255 };
      }

      const hex = "#" + ((1 << 24) + (textRgb.r << 16) + (textRgb.g << 8) + textRgb.b).toString(16).slice(1);
      resolve(hex);
    };
    img.onerror = () => resolve('#000000');
    img.src = imageSrc;
  });
};

/**
 * Removes excess spaces often added by OCR between full-width (Japanese/Chinese) characters.
 * Example: "こ ん に ち は" -> "こんにちは"
 * Keeps "Hello World" as "Hello World".
 */
const cleanText = (text: string): string => {
  return text.replace(/([^\x00-\x7F])\s+([^\x00-\x7F])/g, '$1$2')
             .replace(/([^\x00-\x7F])\s+([^\x00-\x7F])/g, '$1$2'); 
};

export const performOcrOnPages = async (pages: Page[], language: string = 'eng+jpn'): Promise<Page[]> => {
  const worker = await getWorker();
  
  // Clone pages
  const processedPages = JSON.parse(JSON.stringify(pages));

  for (const page of processedPages) {
    const pageLineHeights: number[] = [];
    const blockUpdates: { index: number; data: any; color: string }[] = [];

    // 1. Run OCR ONLY on blocks marked as 'text'
    for (let i = 0; i < page.blocks.length; i++) {
      const block = page.blocks[i];
      
      // SKIP if marked as image
      if (block.type !== 'text') continue;

      // Skip if already processed and has text (unless user forced empty text?)
      if (block.text) continue;

      try {
        // PREPROCESSING: Create a high-contrast/inverted version for OCR
        const optimizedImageForOcr = await preprocessImageForOcr(block.dataUrl);

        // Pass language explicitly to recognize
        const result = await worker.recognize(optimizedImageForOcr, language);
        const { data } = result;
        
        // Extract color from ORIGINAL image to preserve aesthetics
        // We now use the histogram peak method for the whole block
        const color = await extractTextColor(block.dataUrl);
        
        blockUpdates.push({ index: i, data, color });
        
        // Collect line heights for page stats
        if (data.lines && data.lines.length > 0) {
          data.lines.forEach((line: any) => {
            const h = Math.abs(line.bbox.y1 - line.bbox.y0);
            pageLineHeights.push(h);
          });
        }
      } catch (e) {
        console.warn(`OCR failed for block ${block.id}`, e);
      }
    }

    // 2. Calculate Page Median Height for Bold Detection
    pageLineHeights.sort((a, b) => a - b);
    const medianHeight = pageLineHeights.length > 0 
      ? pageLineHeights[Math.floor(pageLineHeights.length / 2)] 
      : 16;

    // 3. Apply updates
    for (const update of blockUpdates) {
      const block = page.blocks[update.index];
      const { data, color } = update;
      
      block.text = cleanText(data.text.trim());
      block.textColor = color;

      let blockMedianHeight = medianHeight;

      if (data.lines && data.lines.length > 0) {
         const lineHeights = data.lines.map((line: any) => Math.abs(line.bbox.y1 - line.bbox.y0));
         lineHeights.sort((a: number, b: number) => a - b);
         blockMedianHeight = lineHeights[Math.floor(lineHeights.length / 2)];
      }

      block.textHeightPx = blockMedianHeight;
      // Integer font size
      block.fontSize = Math.round(blockMedianHeight * 0.75); 

      // Bold Heuristic
      block.isBold = blockMedianHeight > (medianHeight * 1.2);
    }
  }

  return processedPages;
};