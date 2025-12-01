import { Block } from '../types';

/**
 * Performs dilation and connected component labeling to find content blocks.
 * Generates transparent PNG data URLs for each block based on the detected shape.
 */
export const detectBlocks = (
  imageSrc: string,
  granularity: number
): Promise<{ blocks: Block[]; width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      try {
        // 1. Setup Canvas (Downscaled for performance)
        const processingScale = 0.5; 
        const w = Math.floor(img.width * processingScale);
        const h = Math.floor(img.height * processingScale);
        
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) throw new Error("Could not get canvas context");

        // Draw image white background first
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);

        const imageData = ctx.getImageData(0, 0, w, h);
        const data = imageData.data;

        // 2. Binary Threshold & Dilation
        const binaryMap = new Uint8Array(w * h);
        const kernelSize = Math.max(2, Math.floor(granularity * 1.5)); 
        const threshold = 230; 

        // Apply threshold and simple dilation in one pass logic (simplified for speed)
        
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const idx = (y * w + x) * 4;
            const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;

            if (brightness < threshold) {
              // Dilate: Mark surrounding area
              const startY = Math.max(0, y - kernelSize);
              const endY = Math.min(h, y + kernelSize);
              const startX = Math.max(0, x - kernelSize);
              const endX = Math.min(w, x + kernelSize);

              for (let dy = startY; dy < endY; dy++) {
                const rowOffset = dy * w;
                for (let dx = startX; dx < endX; dx++) {
                   binaryMap[rowOffset + dx] = 1;
                }
              }
            }
          }
        }

        // 3. Connected Components Labeling (Iterative Flood Fill)
        const visited = new Uint8Array(w * h);
        const blocks: Block[] = [];
        const stack: number[] = [];

        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const startIdx = y * w + x;
            
            if (binaryMap[startIdx] === 1 && visited[startIdx] === 0) {
              // Found a new component
              let minX = x, maxX = x, minY = y, maxY = y;
              const componentIndices: number[] = []; 

              stack.push(startIdx);
              visited[startIdx] = 1;
              componentIndices.push(startIdx);

              while (stack.length > 0) {
                const currIdx = stack.pop()!;
                const cx = currIdx % w;
                const cy = Math.floor(currIdx / w);

                if (cx < minX) minX = cx;
                if (cx > maxX) maxX = cx;
                if (cy < minY) minY = cy;
                if (cy > maxY) maxY = cy;

                const neighbors = [currIdx - 1, currIdx + 1, currIdx - w, currIdx + w];

                for (const nIdx of neighbors) {
                   if (nIdx >= 0 && nIdx < w * h) {
                      if (Math.abs((nIdx % w) - cx) > 1) continue;

                      if (binaryMap[nIdx] === 1 && visited[nIdx] === 0) {
                        visited[nIdx] = 1;
                        stack.push(nIdx);
                        componentIndices.push(nIdx);
                      }
                   }
                }
              }

              // Filter noise
              const blockW = maxX - minX + 1;
              const blockH = maxY - minY + 1;
              
              if (blockW > 5 && blockH > 5) {
                // 4. Generate Masked Image for this Block
                const originalX = Math.floor(minX / processingScale);
                const originalY = Math.floor(minY / processingScale);
                const originalW = Math.ceil(blockW / processingScale);
                const originalH = Math.ceil(blockH / processingScale);

                // Heuristic: Determine if likely Text or Image
                // Text blocks are usually wider than they are tall, or smallish.
                // Images are often large or square-ish.
                const aspectRatio = originalW / originalH;
                const isLikelyText = (originalH < 150) || (aspectRatio > 2.5 && originalH < 300);

                // Create a temporary mask canvas at downscaled size
                const maskCanvas = document.createElement('canvas');
                maskCanvas.width = blockW;
                maskCanvas.height = blockH;
                const maskCtx = maskCanvas.getContext('2d');
                if (maskCtx) {
                  const maskData = maskCtx.createImageData(blockW, blockH);
                  for (const idx of componentIndices) {
                    const lx = (idx % w) - minX;
                    const ly = Math.floor(idx / w) - minY;
                    const localIdx = (ly * blockW + lx) * 4;
                    // Black opaque
                    maskData.data[localIdx] = 0;
                    maskData.data[localIdx + 1] = 0;
                    maskData.data[localIdx + 2] = 0;
                    maskData.data[localIdx + 3] = 255; 
                  }
                  maskCtx.putImageData(maskData, 0, 0);

                  const finalCanvas = document.createElement('canvas');
                  finalCanvas.width = originalW;
                  finalCanvas.height = originalH;
                  const finalCtx = finalCanvas.getContext('2d');
                  
                  if (finalCtx) {
                    finalCtx.drawImage(
                      img,
                      originalX, originalY, originalW, originalH,
                      0, 0, originalW, originalH
                    );

                    finalCtx.globalCompositeOperation = 'destination-in';
                    finalCtx.imageSmoothingEnabled = true;
                    finalCtx.drawImage(maskCanvas, 0, 0, originalW, originalH);
                    
                    blocks.push({
                      x: originalX,
                      y: originalY,
                      width: originalW,
                      height: originalH,
                      id: `block-${blocks.length}`,
                      dataUrl: finalCanvas.toDataURL('image/png'),
                      type: isLikelyText ? 'text' : 'image' // Apply Heuristic
                    });
                  }
                }
              }
            }
          }
        }

        resolve({ 
          blocks, 
          width: img.width, 
          height: img.height 
        });

      } catch (e) {
        reject(e);
      }
    };
    img.onerror = reject;
    img.src = imageSrc;
  });
};

/**
 * Extracts a rectangular region from a source image and returns it as a Data URL.
 */
export const extractRegion = (
  imageSrc: string,
  x: number,
  y: number,
  width: number,
  height: number
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error("Canvas context not available"));
        return;
      }

      ctx.drawImage(img, x, y, width, height, 0, 0, width, height);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = reject;
    img.src = imageSrc;
  });
};