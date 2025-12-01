import { Page } from '../types';

declare global {
  interface Window {
    PptxGenJS: any;
  }
}

export const generatePptx = async (pages: Page[], fontFamily: string = 'Yu Gothic') => {
  if (!window.PptxGenJS) {
    throw new Error("PptxGenJS library not loaded");
  }

  if (pages.length === 0) return;

  const pptx = new window.PptxGenJS();
  
  // Standard slide width 10 inches.
  const slideWidth = 10; 

  // We iterate through all pages and generate slides
  for (const page of pages) {
    const scaleFactor = slideWidth / page.width;
    const slideHeight = page.height * scaleFactor;

    const layoutName = `LAYOUT_${page.id}`;
    pptx.defineLayout({ name: layoutName, width: slideWidth, height: slideHeight });
    
    const slide = pptx.addSlide({ sectionTitle: `Page ${page.pageNumber}` });
    slide.layout = layoutName; 
    
    slide.background = { color: "FFFFFF" };

    // Place the extracted blocks
    for (const block of page.blocks) {
      const xInch = block.x * scaleFactor;
      const yInch = block.y * scaleFactor;
      const wInch = block.width * scaleFactor;
      const hInch = block.height * scaleFactor;

      if (block.type === 'text' && block.text) {
        
        // 1. If 'preserveBackground' is true, add the original image BEHIND the text.
        // This is useful for diagrams where we want the arrow shape + the text on top.
        if (block.preserveBackground) {
           slide.addImage({
            data: block.dataUrl,
            x: xInch,
            y: yInch,
            w: wInch,
            h: hInch
          });
        }

        // Calculate Font Size
        let fontSize = 12;
        if (block.textHeightPx) {
          // block.textHeightPx is the bbox height (Line Height).
          // 1 inch = 72 points.
          // Font Point Size is typically smaller than Line Height (approx 1.2 ratio).
          // We assume BBox ~ LineHeight.
          // fontSizePt = (LineHeightInInches * 72) / 1.2
          const heightInInches = block.textHeightPx * scaleFactor;
          fontSize = (heightInInches * 72) * 0.85; // 0.85 is roughly 1/1.18
        } else if (block.fontSize) {
          fontSize = block.fontSize;
        }

        // Ensure integer
        fontSize = Math.round(fontSize);

        // Format Color (remove #)
        const color = block.textColor ? block.textColor.replace('#', '') : '000000';

        // Add Text Box
        slide.addText(block.text, {
          x: xInch,
          y: yInch,
          w: wInch,
          h: hInch,
          fontSize: fontSize,
          color: color,
          fontFace: fontFamily, // Apply selected font
          bold: !!block.isBold,
          valign: 'top',
          align: 'left',
          // 'fit' ensures the text shrinks if it still overflows the box.
          // 'shrink' is safer than auto-fit for preservation of layout.
          fit: 'shrink' 
        });
      } else {
        // Add Image
        slide.addImage({
          data: block.dataUrl,
          x: xInch,
          y: yInch,
          w: wInch,
          h: hInch
        });
      }
    }
  }

  // Generate file
  pptx.writeFile({ fileName: `SliceAndSlide_Export_${Date.now()}.pptx` });
};