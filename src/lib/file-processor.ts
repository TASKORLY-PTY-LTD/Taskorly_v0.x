/**
 * Unified file processing utility for extracting text content from different file types
 * Currently supports TXT, MD, and JSON files (PDF processing temporarily disabled)
 */
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