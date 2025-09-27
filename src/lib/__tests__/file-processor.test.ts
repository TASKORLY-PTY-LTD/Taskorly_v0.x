import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  processFile,
  isSupportedFileType,
  getUnsupportedFileMessage,
  preparePDFForServer,
  type ProcessedFile,
} from '../file-processor';

// Mock FileReader for testing file reading functionality
class MockFileReader {
  result: string | ArrayBuffer | null = null;
  error: Error | null = null;
  onload: ((event: any) => void) | null = null;
  onerror: (() => void) | null = null;

  readAsText(file: File, encoding?: string) {
    // Simulate async file reading
    setTimeout(() => {
      if (this.error) {
        this.onerror?.();
      } else {
        this.onload?.({
          target: { result: this.result },
        });
      }
    }, 0);
  }

  readAsArrayBuffer(file: File) {
    // Simulate async file reading
    setTimeout(() => {
      if (this.error) {
        this.onerror?.();
      } else {
        this.onload?.({
          target: { result: this.result },
        });
      }
    }, 0);
  }
}

// Mock global FileReader
const mockFileReader = new MockFileReader();
global.FileReader = vi.fn(() => mockFileReader) as any;

describe('File Processor', () => {
  beforeEach(() => {
    // Reset mock file reader state
    mockFileReader.result = null;
    mockFileReader.error = null;
    mockFileReader.onload = null;
    mockFileReader.onerror = null;
  });

  describe('isSupportedFileType', () => {
    it('should return true for supported text files', () => {
      // Create mock files with different MIME types
      const txtFile = new File(['test content'], 'test.txt', {
        type: 'text/plain',
      });
      const mdFile = new File(['# test'], 'test.md', { type: 'text/markdown' });
      const jsonFile = new File(['{"test": true}'], 'test.json', {
        type: 'application/json',
      });

      expect(isSupportedFileType(txtFile)).toBe(true);
      expect(isSupportedFileType(mdFile)).toBe(true);
      expect(isSupportedFileType(jsonFile)).toBe(true);
    });

    it('should return false for unsupported file types', () => {
      const pdfFile = new File(['test'], 'test.pdf', {
        type: 'application/pdf',
      });
      const docFile = new File(['test'], 'test.doc', {
        type: 'application/msword',
      });
      const unknownFile = new File(['test'], 'test.xyz', {
        type: 'application/unknown',
      });

      expect(isSupportedFileType(pdfFile)).toBe(false);
      expect(isSupportedFileType(docFile)).toBe(false);
      expect(isSupportedFileType(unknownFile)).toBe(false);
    });

    it('should detect file type from extension when MIME type is missing', () => {
      // Files without MIME type should be detected by extension
      const txtFile = new File(['test'], 'test.txt', { type: '' });
      const mdFile = new File(['test'], 'test.md', { type: '' });
      const jsonFile = new File(['test'], 'test.json', { type: '' });

      expect(isSupportedFileType(txtFile)).toBe(true);
      expect(isSupportedFileType(mdFile)).toBe(true);
      expect(isSupportedFileType(jsonFile)).toBe(true);
    });
  });

  describe('getUnsupportedFileMessage', () => {
    it('should return appropriate message for PDF files', () => {
      const pdfFile = new File(['test'], 'test.pdf', {
        type: 'application/pdf',
      });
      const message = getUnsupportedFileMessage(pdfFile);

      expect(message).toContain('PDF processing is temporarily disabled');
      expect(message).toContain('test.pdf');
    });

    it('should return appropriate message for Word documents', () => {
      const docFile = new File(['test'], 'test.doc', {
        type: 'application/msword',
      });
      const message = getUnsupportedFileMessage(docFile);

      expect(message).toContain('Word documents are not yet supported');
      expect(message).toContain('test.doc');
    });

    it('should return generic message for other unsupported types', () => {
      const unknownFile = new File(['test'], 'test.xyz', {
        type: 'application/unknown',
      });
      const message = getUnsupportedFileMessage(unknownFile);

      expect(message).toContain('not supported');
      expect(message).toContain('TXT, MD, or JSON files');
    });
  });

  describe('processFile', () => {
    it('should process a text file successfully', async () => {
      const content = 'This is a test text file with some content.';
      const file = new File([content], 'test.txt', { type: 'text/plain' });

      // Mock successful file reading
      mockFileReader.result = content;

      const result = await processFile(file);

      expect(result).toMatchObject({
        content: content.trim(),
        metadata: {
          fileName: 'test.txt',
          fileSize: content.length,
          fileType: 'text/plain',
          wordCount: 9, // "This is a test text file with some content"
          charCount: content.length,
          extractionMethod: 'text-reader',
        },
      });
    });

    it('should process a markdown file successfully', async () => {
      const content = '# Test Markdown\n\nThis is **bold** text.';
      const file = new File([content], 'test.md', { type: 'text/markdown' });

      mockFileReader.result = content;

      const result = await processFile(file);

      expect(result).toMatchObject({
        content: content.trim(),
        metadata: {
          fileName: 'test.md',
          fileSize: content.length,
          fileType: 'text/markdown',
          wordCount: 7, // "# Test Markdown\n\nThis is **bold** text" - actual word count
          charCount: content.length,
          extractionMethod: 'text-reader',
        },
      });
    });

    it('should process a JSON file successfully', async () => {
      const content = '{"name": "test", "value": 123}';
      const file = new File([content], 'test.json', {
        type: 'application/json',
      });

      mockFileReader.result = content;

      const result = await processFile(file);

      expect(result).toMatchObject({
        content: content.trim(),
        metadata: {
          fileName: 'test.json',
          fileSize: content.length,
          fileType: 'application/json',
          wordCount: 4, // JSON content split by spaces: "name", "test", "value", "123"
          charCount: content.length,
          extractionMethod: 'text-reader',
        },
      });
    });

    it('should throw error for PDF files', async () => {
      const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });

      await expect(processFile(file)).rejects.toThrow(
        'PDF processing is temporarily disabled'
      );
    });

    it('should throw error for empty files', async () => {
      const file = new File([''], 'empty.txt', { type: 'text/plain' });

      mockFileReader.result = '';

      await expect(processFile(file)).rejects.toThrow(
        'Failed to process file "empty.txt": Failed to read file content'
      );
    });

    it('should throw error for files with only whitespace', async () => {
      const file = new File(['   \n\t  '], 'whitespace.txt', {
        type: 'text/plain',
      });

      mockFileReader.result = '   \n\t  ';

      await expect(processFile(file)).rejects.toThrow(
        'File appears to be empty or contains no readable text'
      );
    });

    it('should handle file reading errors', async () => {
      const file = new File(['test'], 'test.txt', { type: 'text/plain' });

      // Mock file reading error
      mockFileReader.error = new Error('File reading failed');

      await expect(processFile(file)).rejects.toThrow(
        'Failed to process file "test.txt": File reading error occurred'
      );
    });

    it('should calculate word count correctly', async () => {
      const content = 'Hello world! This is a test.\n\nMultiple lines here.';
      const file = new File([content], 'test.txt', { type: 'text/plain' });

      mockFileReader.result = content;

      const result = await processFile(file);

      // Should count words correctly, ignoring punctuation and whitespace
      expect(result.metadata.wordCount).toBe(9); // "Hello world This is a test Multiple lines here"
    });

    it('should trim content and normalize whitespace', async () => {
      const content = '  \n  Hello world  \n  \n  ';
      const file = new File([content], 'test.txt', { type: 'text/plain' });

      mockFileReader.result = content;

      const result = await processFile(file);

      expect(result.content).toBe('Hello world');
    });

    it('should detect file type from extension when MIME type is missing', async () => {
      const content = 'test content';
      const file = new File([content], 'test.md', { type: '' });

      mockFileReader.result = content;

      const result = await processFile(file);

      expect(result.metadata.fileType).toBe('text/markdown');
    });
  });

  describe('preparePDFForServer', () => {
    it('should prepare PDF file for server processing', async () => {
      const content = 'test pdf content';
      const file = new File([content], 'test.pdf', { type: 'application/pdf' });

      // Mock ArrayBuffer result
      const arrayBuffer = new ArrayBuffer(content.length);
      const uint8Array = new Uint8Array(arrayBuffer);
      for (let i = 0; i < content.length; i++) {
        uint8Array[i] = content.charCodeAt(i);
      }

      mockFileReader.result = arrayBuffer;

      const result = await preparePDFForServer(file);

      expect(result).toMatchObject({
        fileName: 'test.pdf',
        fileSize: content.length,
        fileType: 'application/pdf',
        fileData: expect.any(String), // Base64 encoded
      });

      // Verify the base64 data can be decoded back to original content
      const decodedContent = atob(result.fileData);
      expect(decodedContent).toBe(content);
    });

    it('should handle PDF file reading errors', async () => {
      const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });

      mockFileReader.error = new Error('PDF reading failed');

      await expect(preparePDFForServer(file)).rejects.toThrow(
        'Failed to prepare PDF file "test.pdf": File reading error occurred'
      );
    });
  });

  describe('File type detection from extension', () => {
    it('should detect various file types correctly', async () => {
      const testCases = [
        { name: 'test.txt', expectedType: 'text/plain' },
        { name: 'test.md', expectedType: 'text/markdown' },
        { name: 'test.markdown', expectedType: 'text/markdown' },
        { name: 'test.json', expectedType: 'application/json' },
        { name: 'test.doc', expectedType: 'application/msword' },
        {
          name: 'test.docx',
          expectedType:
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        },
        { name: 'test.unknown', expectedType: 'text/plain' }, // Default fallback
      ];

      for (const testCase of testCases) {
        const file = new File(['content'], testCase.name, { type: '' });
        mockFileReader.result = 'content';

        const result = await processFile(file);
        expect(result.metadata.fileType).toBe(testCase.expectedType);
      }
    });
  });
});
