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
/**
 * Represents a PDF file that has been prepared for server-side processing.
 * This is used as an intermediate format before the actual PDF text extraction.
 */
export interface ProcessedPDFFile {
  /** The original name of the PDF file */
  fileName: string;
  /** Size of the file in bytes */
  fileSize: number;
  /** The MIME type of the file (should be 'application/pdf') */
  fileType: string;
  /** The PDF file contents encoded as a base64 string so it can be sent to the server */
  fileData: string; // Base64 encoded file data for server processing
}

/**
 * Represents a PDF file after it has been fully processed by the server.
 * This contains the extracted text content and metadata about the PDF.
 */
export interface ServerProcessedPDF {
  /** The extracted text content from the PDF */
  content: string;
  /** Metadata about the processed PDF file */
  metadata: {
    /** Original filename of the PDF */
    fileName: string;
    /** Size of the original PDF in bytes */
    fileSize: number;
    /** MIME type of the file */
    fileType: string;
    /** Total count of words found in the PDF */
    wordCount: number;
    /** Total count of characters found in the PDF */
    charCount: number;
    /** Number of pages in the PDF */
    pageCount: number;
    /** The method used to extract text from the PDF (e.g. 'pdfjs', 'tesseract') */
    extractionMethod: string;
  };
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
      // PDF files require server-side processing because:
      // 1. PDF parsing libraries are heavy and not suitable for browser environments
      // 2. PDF text extraction requires specialized libraries like pdf2json or pdf-parse
      // 3. Server-side processing provides better security and performance
      // 4. We can use more powerful PDF parsing libraries on the server
      throw new Error(
        'PDF files must be processed on the server. Please use the uploadDocument mutation directly with PDF file data.'
      );
    } else {
      // Handle text-based files (TXT, MD, JSON) - these can be processed client-side
      // since they're just plain text files that can be read directly
      content = await readFileAsText(file);
      extractionMethod = 'text-reader';
    }

    // Basic content validation
    if (!content.trim()) {
      throw new Error('File appears to be empty or contains no readable text');
    }

    // Calculate metadata
    const wordCount = content
      .split(/\s+/)
      .filter(word => word.length > 0).length;
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
    throw new Error(
      `Failed to process file "${fileName}": ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Clean up extracted text to improve readability
 */
function cleanExtractedText(text: string): string {
  return (
    text
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
      .trim()
  );
}

/**
 * Prepare PDF file data for server-side processing
 *
 * This function is the first step in the PDF upload process:
 * 1. Takes a PDF File object from the browser's file input
 * 2. Converts it to an ArrayBuffer (binary data)
 * 3. Encodes the binary data as base64 string
 * 4. Returns a ProcessedPDFFile object that can be sent to the server
 *
 * Why base64? Because we need to send binary PDF data through HTTP/JSON,
 * and base64 is the standard way to encode binary data as text.
 */
export async function preparePDFForServer(
  file: File
): Promise<ProcessedPDFFile> {
  const fileName = file.name;
  const fileSize = file.size;
  const fileType = file.type || getFileTypeFromExtension(fileName);

  try {
    // Step 1: Convert File to ArrayBuffer (binary data)
    // This reads the PDF file as raw bytes
    const arrayBuffer = await readFileAsArrayBuffer(file);

    // Step 2: Convert ArrayBuffer to base64 string
    // This converts the binary data to a text format that can be sent via JSON
    const base64Data = arrayBufferToBase64(arrayBuffer);

    // Step 3: Return the prepared PDF data
    // This object will be sent to the server's uploadPDF mutation
    return {
      fileName,
      fileSize,
      fileType,
      fileData: base64Data,
    };
  } catch (error) {
    throw new Error(
      `Failed to prepare PDF file "${fileName}": ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Process PDF file by sending it to the server for parsing
 * This is the main function to use for PDF files in the upload dialog
 */
export async function processPDFFile(file: File): Promise<ProcessedFile> {
  const fileName = file.name;
  const fileSize = file.size;
  const fileType = file.type || getFileTypeFromExtension(fileName);

  try {
    // Prepare PDF data for server processing
    const pdfData = await preparePDFForServer(file);

    // For now, we'll throw an error indicating that PDF processing
    // should be handled by the upload dialog directly with the server
    // This function exists for future use when we implement client-side PDF processing
    throw new Error(
      'PDF processing must be handled by the upload dialog with server-side parsing'
    );
  } catch (error) {
    throw new Error(
      `Failed to process PDF file "${fileName}": ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Read file as text using FileReader
 */
function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = event => {
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

    reader.onload = event => {
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
    'application/pdf', // Now supported with server-side processing
  ];

  const fileType = file.type || getFileTypeFromExtension(file.name);
  return supportedTypes.includes(fileType);
}

/**
 * Get human-readable error message for unsupported file types
 */
export function getUnsupportedFileMessage(file: File): string {
  const fileType = file.type || getFileTypeFromExtension(file.name);

  if (fileType.includes('word') || fileType.includes('doc')) {
    return `Word documents are not yet supported. Please convert "${file.name}" to a text file or markdown file.`;
  }

  return `File type "${fileType}" is not supported. Please use TXT, MD, JSON, or PDF files.`;
}
