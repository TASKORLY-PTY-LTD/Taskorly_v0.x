/**
 * Unified file processing utility for extracting text content from different file types
 * Currently supports TXT, MD, and JSON files (PDF processing temporarily disabled)
 */

// PDF processing is temporarily disabled
// You'll need to install: npm install pdfjs-dist
// PDF.js will be loaded dynamically to avoid SSR issues
// let pdfjsLib: any = null;

// Load PDF.js library dynamically (client-side only) - DISABLED
// const loadPDFJS = async () => {
//   if (typeof window === 'undefined') {
//     throw new Error('PDF.js can only be used in browser environment');
//   }
//   
//   if (!pdfjsLib) {
//     try {
//       console.log('Loading PDF.js library...');
//       
//       // Dynamic import to avoid SSR issues
//       const pdfjsModule = await import('pdfjs-dist');
//       pdfjsLib = pdfjsModule;
//       
//       // Configure PDF.js worker
//       if (pdfjsLib.GlobalWorkerOptions) {
//         pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.js`;
//         console.log('PDF.js worker configured successfully');
//       }
//       
//       console.log('PDF.js library loaded successfully');
//     } catch (error) {
//       console.error('Failed to load PDF.js:', error);
//       throw new Error(`Failed to load PDF.js: ${error instanceof Error ? error.message : 'Unknown error'}`);
//     }
//   }
//   
//   return pdfjsLib;
// };

export interface ProcessedFile {
  content: string;
  metadata: {
    fileName: string;
    fileSize: number;
    fileType: string;
    wordCount: number;
    charCount: number;
    pageCount?: number;
    extractionMethod?: string;
  };
}

export interface ProcessedPDFFile {
  fileName: string;
  fileSize: number;
  fileType: string;
  fileData: string; // Base64 encoded file data for server processing
}

/**
 * Main function to process any supported file type
 */
export async function processFile(file: File): Promise<ProcessedFile> {
  const fileName = file.name;
  const fileSize = file.size;
  const fileType = file.type || getFileTypeFromExtension(fileName);
  
  try {
    let content: string;
    let extractionMethod: string;
    let pageCount: number | undefined;
    
    if (fileType === 'application/pdf') {
      // PDF processing is temporarily disabled
      throw new Error('PDF processing is temporarily disabled. Please convert your PDF to a text file (.txt) or markdown file (.md) for now.');
    } else {
      // Handle text-based files (TXT, MD, JSON)
      content = await readFileAsText(file);
      extractionMethod = 'text-reader';
    }
    
    // Basic content validation
    if (!content.trim()) {
      throw new Error('File appears to be empty or contains no readable text');
    }
    
    // Calculate metadata
    const wordCount = content.split(/\s+/).filter(word => word.length > 0).length;
    const charCount = content.length;
    
    return {
      content: content.trim(),
      metadata: {
        fileName,
        fileSize,
        fileType,
        wordCount,
        charCount,
        pageCount,
        extractionMethod,
      },
    };
  } catch (error) {
    throw new Error(`Failed to process file "${fileName}": ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Extract text content from PDF using PDF.js - DISABLED
 */
// async function extractTextFromPDF(file: File): Promise<{ content: string; pageCount: number }> {
//   try {
//     console.log('Starting PDF extraction for file:', file.name);
//     
//     // Load PDF.js library
//     const pdfjs = await loadPDFJS();
//     console.log('PDF.js library loaded successfully');
//     
//     // Convert file to ArrayBuffer
//     const arrayBuffer = await readFileAsArrayBuffer(file);
//     console.log('File converted to ArrayBuffer, size:', arrayBuffer.byteLength);
//     
//     // Load PDF document with proper error handling
//     const loadingTask = pdfjs.getDocument({ 
//       data: arrayBuffer,
//       // Add these options to help with compatibility
//       verbosity: 0, // Reduce console output
//       disableAutoFetch: true,
//       disableStream: true
//     });
//     
//     console.log('PDF loading task created, waiting for promise...');
//     
//     const pdf = await loadingTask.promise;
//     console.log('PDF loaded successfully, pages:', pdf.numPages);
//     
//     const pageCount = pdf.numPages;
//     const textPages: string[] = [];
//     
//     // Extract text from each page
//     for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
//       try {
//         const page = await pdf.getPage(pageNum);
//         const textContent = await page.getTextContent();
//         
//         // Combine text items into readable text
//         const pageText = textContent.items
//           .map((item: any) => item.str)
//           .join(' ')
//           .trim();
//         
//         if (pageText) {
//           textPages.push(`[Page ${pageNum}]\n${pageText}`);
//         }
//       } catch (pageError) {
//         console.warn(`Failed to extract text from page ${pageNum}:`, pageError);
//         textPages.push(`[Page ${pageNum}]\n[Failed to extract text from this page]`);
//       }
//     }
//     
//     // Combine all pages
//     const fullContent = textPages.join('\n\n');
//     
//     if (!fullContent.trim()) {
//       throw new Error('No text content could be extracted from PDF. The PDF might be image-based or corrupted.');
//     }
//     
//     return {
//       content: cleanExtractedText(fullContent),
//       pageCount
//     };
//     
//   } catch (error) {
//     if (error instanceof Error && error.message.includes('No text content could be extracted')) {
//       throw error;
//     }
//     throw new Error(`PDF extraction failed: ${error instanceof Error ? error.message : 'Unknown PDF error'}`);
//   }
// }

/**
 * Clean up extracted text to improve readability
 */
function cleanExtractedText(text: string): string {
  return text
    // Normalize line endings
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // Remove excessive whitespace
    .replace(/\s{3,}/g, '  ')
    // Remove excessive line breaks but preserve intentional spacing
    .replace(/\n{4,}/g, '\n\n\n')
    // Clean up common PDF extraction artifacts
    .replace(/([a-z])([A-Z])/g, '$1 $2') // Add space between words that got joined
    .replace(/(\w)(\d)/g, '$1 $2') // Add space between word and number
    .replace(/(\d)(\w)/g, '$1 $2') // Add space between number and word
    // Trim and normalize
    .trim();
}

/**
 * Prepare PDF file data for server-side processing (fallback option)
 */
export async function preparePDFForServer(file: File): Promise<ProcessedPDFFile> {
  const fileName = file.name;
  const fileSize = file.size;
  const fileType = file.type || getFileTypeFromExtension(fileName);
  
  try {
    // Convert file to base64 for server transmission
    const arrayBuffer = await readFileAsArrayBuffer(file);
    const base64Data = arrayBufferToBase64(arrayBuffer);
    
    return {
      fileName,
      fileSize,
      fileType,
      fileData: base64Data,
    };
  } catch (error) {
    throw new Error(`Failed to prepare PDF file "${fileName}": ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Process PDF from base64 data (for server-side processing) - DISABLED
 * This function is used by the server-side API routes
 */
// export async function processPDFFromBase64(
//   base64Data: string,
//   fileName: string,
//   fileSize: number
// ): Promise<ProcessedFile> {
//   try {
//     // Convert base64 to ArrayBuffer
//     const binaryString = atob(base64Data);
//     const bytes = new Uint8Array(binaryString.length);
//     for (let i = 0; i < binaryString.length; i++) {
//       bytes[i] = binaryString.charCodeAt(i);
//     }
//     const arrayBuffer = bytes.buffer;
//     
//     // Load PDF.js library
//     const pdfjs = await loadPDFJS();
//     
//     // Load PDF document
//     const loadingTask = pdfjs.getDocument({ 
//       data: arrayBuffer,
//       verbosity: 0,
//       disableAutoFetch: true,
//       disableStream: true
//     });
//     
//     const pdf = await loadingTask.promise;
//     const pageCount = pdf.numPages;
//     const textPages: string[] = [];
//     
//     // Extract text from each page
//     for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
//       try {
//         const page = await pdf.getPage(pageNum);
//         const textContent = await page.getTextContent();
//         
//         // Combine text items into readable text
//         const pageText = textContent.items
//           .map((item: any) => item.str)
//           .join(' ')
//           .trim();
//         
//         if (pageText) {
//           textPages.push(`[Page ${pageNum}]\n${pageText}`);
//         }
//       } catch (pageError) {
//         console.warn(`Failed to extract text from page ${pageNum}:`, pageError);
//         textPages.push(`[Page ${pageNum}]\n[Failed to extract text from this page]`);
//       }
//     }
//     
//     // Combine all pages
//     const fullContent = textPages.join('\n\n');
//     
//     if (!fullContent.trim()) {
//       throw new Error('No text content could be extracted from PDF. The PDF might be image-based or corrupted.');
//     }
//     
//     const content = cleanExtractedText(fullContent);
//     const wordCount = content.split(/\s+/).filter(word => word.length > 0).length;
//     const charCount = content.length;
//     
//     return {
//       content: content.trim(),
//       metadata: {
//         fileName,
//         fileSize,
//         fileType: 'application/pdf',
//         wordCount,
//         charCount,
//         pageCount,
//         extractionMethod: 'pdf-js-server',
//       },
//     };
//     
//   } catch (error) {
//     throw new Error(`Failed to process PDF "${fileName}": ${error instanceof Error ? error.message : 'Unknown error'}`);
//   }
// }

/**
 * Read file as text using FileReader
 */
function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (event) => {
      if (event.target?.result) {
        resolve(event.target.result as string);
      } else {
        reject(new Error('Failed to read file content'));
      }
    };
    
    reader.onerror = () => {
      reject(new Error('File reading error occurred'));
    };
    
    // Read as text with UTF-8 encoding
    reader.readAsText(file, 'UTF-8');
  });
}

/**
 * Read file as ArrayBuffer for binary files like PDF
 */
function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (event) => {
      if (event.target?.result) {
        resolve(event.target.result as ArrayBuffer);
      } else {
        reject(new Error('Failed to read file content'));
      }
    };
    
    reader.onerror = () => {
      reject(new Error('File reading error occurred'));
    };
    
    // Read as ArrayBuffer for binary files
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Convert ArrayBuffer to Base64 string
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

/**
 * Get file type from file extension when MIME type is not available
 */
function getFileTypeFromExtension(fileName: string): string {
  const extension = fileName.split('.').pop()?.toLowerCase();
  
  switch (extension) {
    case 'txt':
      return 'text/plain';
    case 'md':
    case 'markdown':
      return 'text/markdown';
    case 'json':
      return 'application/json';
    case 'pdf':
      return 'application/pdf';
    case 'doc':
      return 'application/msword';
    case 'docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    default:
      return 'text/plain';
  }
}

/**
 * Validate if file type is supported
 */
export function isSupportedFileType(file: File): boolean {
  const supportedTypes = [
    'text/plain',
    'text/markdown', 
    'application/json',
    // 'application/pdf', // Temporarily disabled
  ];
  
  const fileType = file.type || getFileTypeFromExtension(file.name);
  return supportedTypes.includes(fileType);
}

/**
 * Get human-readable error message for unsupported file types
 */
export function getUnsupportedFileMessage(file: File): string {
  const fileType = file.type || getFileTypeFromExtension(file.name);
  
  if (fileType === 'application/pdf') {
    return `PDF processing is temporarily disabled. Please convert "${file.name}" to a text file (.txt) or markdown file (.md) for now.`;
  }
  
  if (fileType.includes('word') || fileType.includes('doc')) {
    return `Word documents are not yet supported. Please convert "${file.name}" to a text file or markdown file.`;
  }
  
  return `File type "${fileType}" is not supported. Please use TXT, MD, or JSON files.`;
}