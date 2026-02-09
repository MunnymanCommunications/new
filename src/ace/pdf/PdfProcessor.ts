// =============================================================================
// PDF Processor - Client-side PDF rendering to images
// Uses canvas API for rendering PDF pages to high-resolution images.
// =============================================================================

import type { PDFPageData } from '../types';

// PDF.js types (loaded from CDN)
declare global {
  interface Window {
    pdfjsLib?: {
      getDocument: (src: { data: ArrayBuffer } | string) => {
        promise: Promise<PDFDocument>;
      };
      GlobalWorkerOptions: { workerSrc: string };
    };
  }
}

interface PDFDocument {
  numPages: number;
  getPage: (num: number) => Promise<PDFPage>;
}

interface PDFPage {
  getViewport: (params: { scale: number }) => { width: number; height: number };
  render: (params: { canvasContext: CanvasRenderingContext2D; viewport: { width: number; height: number } }) => { promise: Promise<void> };
  getTextContent: () => Promise<{ items: Array<{ str: string; transform: number[] }> }>;
}

const PDFJS_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs';
const PDFJS_WORKER_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs';

// Render scale - higher = better quality for AI vision but larger files
const RENDER_SCALE = 2.0;

/**
 * Load PDF.js from CDN if not already loaded.
 */
async function loadPdfJs(): Promise<void> {
  if (window.pdfjsLib) return;

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = PDFJS_CDN;
    script.type = 'module';
    script.onload = () => {
      // After loading, set worker
      if (window.pdfjsLib) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_CDN;
        resolve();
      } else {
        // For module-based loading, try importing
        import(/* @vite-ignore */ PDFJS_CDN).then((mod) => {
          window.pdfjsLib = mod;
          window.pdfjsLib!.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_CDN;
          resolve();
        }).catch(reject);
      }
    };
    script.onerror = () => reject(new Error('Failed to load PDF.js'));
    document.head.appendChild(script);
  });
}

/**
 * Read a File as ArrayBuffer.
 */
function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Render a single PDF page to a canvas and return as data URL.
 */
async function renderPageToImage(
  page: PDFPage,
  scale: number = RENDER_SCALE
): Promise<{ dataUrl: string; width: number; height: number }> {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Cannot get canvas 2D context');

  await page.render({ canvasContext: ctx, viewport }).promise;

  return {
    dataUrl: canvas.toDataURL('image/png'),
    width: viewport.width,
    height: viewport.height,
  };
}

/**
 * Extract raw text from a PDF page using PDF.js text layer.
 */
async function extractPageText(page: PDFPage): Promise<string> {
  try {
    const textContent = await page.getTextContent();
    return textContent.items.map((item) => item.str).join(' ');
  } catch {
    return '';
  }
}

/**
 * Process an uploaded PDF file into individual page images.
 * Returns an array of PDFPageData objects ready for AI analysis.
 */
export async function processPdf(
  file: File,
  onProgress?: (page: number, total: number) => void
): Promise<PDFPageData[]> {
  // Load PDF.js
  await loadPdfJs();

  if (!window.pdfjsLib) {
    throw new Error('PDF.js library not available');
  }

  // Read file
  const arrayBuffer = await readFileAsArrayBuffer(file);

  // Load PDF document
  const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const totalPages = pdf.numPages;

  const pages: PDFPageData[] = [];

  for (let i = 1; i <= totalPages; i++) {
    onProgress?.(i, totalPages);

    const page = await pdf.getPage(i);
    const { dataUrl, width, height } = await renderPageToImage(page);
    await extractPageText(page);

    pages.push({
      pageNumber: i,
      imageDataUrl: dataUrl,
      pageType: null, // Will be classified by Segmenter Agent
      width,
      height,
      analysisComplete: false,
      extractedData: null,
    });
  }

  return pages;
}

/**
 * Convert a data URL to a base64 string (without the prefix).
 */
export function dataUrlToBase64(dataUrl: string): string {
  const commaIndex = dataUrl.indexOf(',');
  return commaIndex >= 0 ? dataUrl.slice(commaIndex + 1) : dataUrl;
}

/**
 * Get the MIME type from a data URL.
 */
export function getDataUrlMimeType(dataUrl: string): string {
  const match = dataUrl.match(/^data:([^;]+);/);
  return match ? match[1] : 'image/png';
}
