
declare global {
  interface Window {
    pdfjsLib: any;
  }
}

/**
 * Converts a PDF file into an array of images (Data URLs).
 * Returns an array of objects containing the image source and dimensions.
 */
export const convertPdfToImages = async (
  file: File
): Promise<{ src: string; width: number; height: number }[]> => {
  if (!window.pdfjsLib) {
    throw new Error("PDF.js library not loaded");
  }

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pageImages: { src: string; width: number; height: number }[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2.0 }); // High quality scale

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    if (context) {
      await page.render({
        canvasContext: context,
        viewport: viewport,
      }).promise;

      pageImages.push({
        src: canvas.toDataURL('image/jpeg', 0.95),
        width: viewport.width,
        height: viewport.height
      });
    }
  }

  return pageImages;
};
