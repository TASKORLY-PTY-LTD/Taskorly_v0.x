import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UploadDialog } from '@/components/documents/upload-dialog';
import { documentsRouter } from '@/server/routers/documents';

// Mock all external dependencies
vi.mock('@/lib/file-processor', () => ({
  processFile: vi.fn(),
  isSupportedFileType: vi.fn(),
  getUnsupportedFileMessage: vi.fn(),
}));

vi.mock('@/lib/gemini-chunker', () => ({
  chunkDocumentWithGemini: vi.fn(),
}));

// Mock tRPC with realistic behavior
const mockUploadDocument = vi.fn();
const mockInvalidate = vi.fn();

vi.mock('@/utils/trpc', () => ({
  trpc: {
    useContext: vi.fn(() => ({
      documents: {
        list: {
          invalidate: mockInvalidate,
        },
      },
    })),
    documents: {
      upload: {
        useMutation: vi.fn(() => ({
          mutate: mockUploadDocument,
        })),
      },
    },
  },
}));

// Mock UI components
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open, onOpenChange }: any) => (
    <div data-testid="dialog" data-open={open}>
      {children}
    </div>
  ),
  DialogContent: ({ children }: any) => (
    <div data-testid="dialog-content">{children}</div>
  ),
  DialogDescription: ({ children }: any) => (
    <div data-testid="dialog-description">{children}</div>
  ),
  DialogHeader: ({ children }: any) => (
    <div data-testid="dialog-header">{children}</div>
  ),
  DialogTitle: ({ children }: any) => (
    <div data-testid="dialog-title">{children}</div>
  ),
  DialogTrigger: ({ children }: any) => (
    <div data-testid="dialog-trigger">{children}</div>
  ),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/progress', () => ({
  Progress: ({ value, className }: any) => (
    <div data-testid="progress" data-value={value} className={className}>
      Progress: {value}%
    </div>
  ),
}));

vi.mock('lucide-react', () => ({
  Upload: () => <div data-testid="upload-icon">Upload</div>,
  FileText: () => <div data-testid="file-text-icon">FileText</div>,
  X: () => <div data-testid="x-icon">X</div>,
  AlertCircle: () => <div data-testid="alert-circle-icon">AlertCircle</div>,
  CheckCircle: () => <div data-testid="check-circle-icon">CheckCircle</div>,
}));

describe('Upload Integration Tests', () => {
  const mockProcessFile = vi.fn();
  const mockIsSupportedFileType = vi.fn();
  const mockGetUnsupportedFileMessage = vi.fn();
  const mockChunkDocumentWithGemini = vi.fn();

  beforeAll(() => {
    vi.stubEnv('ENCRYPTION_KEY', 'test-encryption-key-32-chars-long');
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Setup mocks
    const fileProcessor = await import('@/lib/file-processor');
    mockProcessFile.mockImplementation(fileProcessor.processFile);
    mockIsSupportedFileType.mockImplementation(fileProcessor.isSupportedFileType);
    mockGetUnsupportedFileMessage.mockImplementation(fileProcessor.getUnsupportedFileMessage);
    
    const geminiChunker = await import('@/lib/gemini-chunker');
    mockChunkDocumentWithGemini.mockImplementation(geminiChunker.chunkDocumentWithGemini);
  });

  const createMockFile = (name: string, content: string, type: string = 'text/plain') => {
    return new File([content], name, { type });
  };

  const renderUploadDialog = () => {
    return render(
      <UploadDialog>
        <button>Open Upload</button>
      </UploadDialog>
    );
  };

  describe('Complete Upload Flow', () => {
    it('should handle successful file upload from start to finish', async () => {
      const user = userEvent.setup();
      
      // Setup mocks for successful flow
      mockIsSupportedFileType.mockReturnValue(true);
      mockProcessFile.mockResolvedValue({
        content: 'This is a test document with some content for processing.',
        metadata: {
          fileName: 'test-document.txt',
          fileSize: 58,
          fileType: 'text/plain',
          wordCount: 10,
          charCount: 58,
          extractionMethod: 'text-reader',
        },
      });
      
      // Mock successful chunking
      mockChunkDocumentWithGemini.mockResolvedValue([
        {
          content: 'This is a test document with some content for processing.',
          chunkIndex: 0,
          metadata: {
            document_id: 'doc-1',
            title: 'test-document.txt',
            content_type: 'text/plain',
            chunk_size: 58,
          },
        },
      ]);
      
      // Mock successful upload
      mockUploadDocument.mockResolvedValue({
        id: 'doc-1',
        title: 'test-document.txt',
        chunk_count: 1,
        processing_status: 'completed',
      });
      
      renderUploadDialog();
      
      // Step 1: Open dialog
      const trigger = screen.getByText('Open Upload');
      await user.click(trigger);
      
      expect(screen.getByTestId('dialog')).toHaveAttribute('data-open', 'true');
      
      // Step 2: Select file
      const fileInput = screen.getByLabelText(/click to select files/i);
      const file = createMockFile('test-document.txt', 'This is a test document with some content for processing.');
      await user.upload(fileInput, file);
      
      // Verify file appears in UI
      expect(screen.getByText('test-document.txt')).toBeInTheDocument();
      expect(screen.getByText(/58 B/)).toBeInTheDocument();
      expect(screen.getByText(/Text/)).toBeInTheDocument();
      
      // Step 3: Upload file
      const uploadButton = screen.getByText(/Upload/);
      expect(uploadButton).not.toBeDisabled();
      await user.click(uploadButton);
      
      // Step 4: Verify processing state
      expect(screen.getByText(/Processing test-document.txt/)).toBeInTheDocument();
      expect(screen.getByTestId('progress')).toBeInTheDocument();
      expect(uploadButton).toBeDisabled();
      
      // Step 5: Wait for completion
      await waitFor(() => {
        expect(mockProcessFile).toHaveBeenCalledWith(file);
      });
      
      await waitFor(() => {
        expect(mockUploadDocument).toHaveBeenCalledWith({
          title: 'test-document.txt',
          content: 'This is a test document with some content for processing.',
          metadata: expect.objectContaining({
            fileName: 'test-document.txt',
            fileSize: 58,
            fileType: 'text/plain',
            wordCount: 10,
            charCount: 58,
            extractionMethod: 'text-reader',
          }),
          contentType: 'text/plain',
          sourceUrl: undefined,
        });
      });
      
      // Step 6: Verify success message
      await waitFor(() => {
        expect(screen.getByText(/Successfully processed "test-document.txt"/)).toBeInTheDocument();
      });
      
      // Step 7: Verify cache invalidation
      expect(mockInvalidate).toHaveBeenCalled();
    });

    it('should handle multiple file uploads', async () => {
      const user = userEvent.setup();
      
      // Setup mocks
      mockIsSupportedFileType.mockReturnValue(true);
      mockProcessFile
        .mockResolvedValueOnce({
          content: 'First document content',
          metadata: {
            fileName: 'doc1.txt',
            fileSize: 22,
            fileType: 'text/plain',
            wordCount: 3,
            charCount: 22,
            extractionMethod: 'text-reader',
          },
        })
        .mockResolvedValueOnce({
          content: 'Second document content',
          metadata: {
            fileName: 'doc2.md',
            fileSize: 24,
            fileType: 'text/markdown',
            wordCount: 3,
            charCount: 24,
            extractionMethod: 'text-reader',
          },
        });
      
      mockChunkDocumentWithGemini.mockResolvedValue([
        { content: 'test', chunkIndex: 0, metadata: {} },
      ]);
      
      mockUploadDocument.mockResolvedValue({ success: true });
      
      renderUploadDialog();
      
      // Open dialog
      const trigger = screen.getByText('Open Upload');
      await user.click(trigger);
      
      // Select multiple files
      const fileInput = screen.getByLabelText(/click to select files/i);
      const file1 = createMockFile('doc1.txt', 'First document content');
      const file2 = createMockFile('doc2.md', 'Second document content', 'text/markdown');
      
      await user.upload(fileInput, [file1, file2]);
      
      // Verify both files appear
      expect(screen.getByText('doc1.txt')).toBeInTheDocument();
      expect(screen.getByText('doc2.md')).toBeInTheDocument();
      
      // Upload files
      const uploadButton = screen.getByText(/Upload \(2\)/);
      await user.click(uploadButton);
      
      // Verify both files are processed
      await waitFor(() => {
        expect(mockProcessFile).toHaveBeenCalledTimes(2);
      });
      
      await waitFor(() => {
        expect(mockUploadDocument).toHaveBeenCalledTimes(2);
      });
    });

    it('should handle file processing errors gracefully', async () => {
      const user = userEvent.setup();
      
      // Setup mocks for error scenario
      mockIsSupportedFileType.mockReturnValue(true);
      mockProcessFile.mockRejectedValue(new Error('File processing failed'));
      
      renderUploadDialog();
      
      // Open dialog
      const trigger = screen.getByText('Open Upload');
      await user.click(trigger);
      
      // Select file
      const fileInput = screen.getByLabelText(/click to select files/i);
      const file = createMockFile('error-file.txt', 'content');
      await user.upload(fileInput, file);
      
      // Upload file
      const uploadButton = screen.getByText(/Upload/);
      await user.click(uploadButton);
      
      // Verify error message
      await waitFor(() => {
        expect(screen.getByText(/Failed to process "error-file.txt"/)).toBeInTheDocument();
      });
      
      // Verify upload was not called
      expect(mockUploadDocument).not.toHaveBeenCalled();
    });

    it('should handle unsupported file types', async () => {
      const user = userEvent.setup();
      
      // Setup mocks for unsupported file
      mockIsSupportedFileType.mockReturnValue(false);
      mockGetUnsupportedFileMessage.mockReturnValue('PDF processing is temporarily disabled');
      
      renderUploadDialog();
      
      // Open dialog
      const trigger = screen.getByText('Open Upload');
      await user.click(trigger);
      
      // Select unsupported file
      const fileInput = screen.getByLabelText(/click to select files/i);
      const file = createMockFile('document.pdf', 'content', 'application/pdf');
      await user.upload(fileInput, file);
      
      // Verify error message
      expect(screen.getByText('PDF processing is temporarily disabled')).toBeInTheDocument();
      
      // Verify upload button is disabled
      const uploadButton = screen.getByText(/Upload/);
      expect(uploadButton).toBeDisabled();
    });

    it('should handle upload API errors', async () => {
      const user = userEvent.setup();
      
      // Setup mocks for upload error
      mockIsSupportedFileType.mockReturnValue(true);
      mockProcessFile.mockResolvedValue({
        content: 'test content',
        metadata: {
          fileName: 'test.txt',
          fileSize: 12,
          fileType: 'text/plain',
          wordCount: 2,
          charCount: 12,
          extractionMethod: 'text-reader',
        },
      });
      
      mockUploadDocument.mockRejectedValue(new Error('Upload failed'));
      
      renderUploadDialog();
      
      // Open dialog
      const trigger = screen.getByText('Open Upload');
      await user.click(trigger);
      
      // Select file
      const fileInput = screen.getByLabelText(/click to select files/i);
      const file = createMockFile('test.txt', 'test content');
      await user.upload(fileInput, file);
      
      // Upload file
      const uploadButton = screen.getByText(/Upload/);
      await user.click(uploadButton);
      
      // Verify error message
      await waitFor(() => {
        expect(screen.getByText(/Failed to process "test.txt"/)).toBeInTheDocument();
      });
    });
  });

  describe('User Experience Flow', () => {
    it('should clear state when dialog is closed', async () => {
      const user = userEvent.setup();
      
      mockIsSupportedFileType.mockReturnValue(true);
      
      renderUploadDialog();
      
      // Open dialog
      const trigger = screen.getByText('Open Upload');
      await user.click(trigger);
      
      // Add a file
      const fileInput = screen.getByLabelText(/click to select files/i);
      const file = createMockFile('test.txt', 'content');
      await user.upload(fileInput, file);
      
      // Verify file is shown
      expect(screen.getByText('test.txt')).toBeInTheDocument();
      
      // Close dialog
      const cancelButton = screen.getByText('Cancel');
      await user.click(cancelButton);
      
      // Reopen dialog
      await user.click(trigger);
      
      // Verify file is cleared
      expect(screen.queryByText('test.txt')).not.toBeInTheDocument();
    });

    it('should show progress for multiple files', async () => {
      const user = userEvent.setup();
      
      mockIsSupportedFileType.mockReturnValue(true);
      mockProcessFile.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({
          content: 'test',
          metadata: { fileName: 'test.txt', fileSize: 4, fileType: 'text/plain', wordCount: 1, charCount: 4, extractionMethod: 'text-reader' },
        }), 100))
      );
      mockChunkDocumentWithGemini.mockResolvedValue([{ content: 'test', chunkIndex: 0, metadata: {} }]);
      mockUploadDocument.mockResolvedValue({ success: true });
      
      renderUploadDialog();
      
      // Open dialog
      const trigger = screen.getByText('Open Upload');
      await user.click(trigger);
      
      // Add multiple files
      const fileInput = screen.getByLabelText(/click to select files/i);
      const file1 = createMockFile('file1.txt', 'content1');
      const file2 = createMockFile('file2.txt', 'content2');
      await user.upload(fileInput, [file1, file2]);
      
      // Upload files
      const uploadButton = screen.getByText(/Upload \(2\)/);
      await user.click(uploadButton);
      
      // Verify progress updates
      await waitFor(() => {
        expect(screen.getByText(/Processing file1.txt/)).toBeInTheDocument();
      });
      
      await waitFor(() => {
        expect(screen.getByText(/Processing file2.txt/)).toBeInTheDocument();
      });
    });

    it('should handle empty file selection', async () => {
      const user = userEvent.setup();
      
      renderUploadDialog();
      
      // Open dialog
      const trigger = screen.getByText('Open Upload');
      await user.click(trigger);
      
      // Verify upload button is disabled
      const uploadButton = screen.getByText(/Upload/);
      expect(uploadButton).toBeDisabled();
    });
  });

  describe('File Validation Integration', () => {
    it('should validate file types before processing', async () => {
      const user = userEvent.setup();
      
      // Mock file type validation
      mockIsSupportedFileType
        .mockReturnValueOnce(true)  // First file is supported
        .mockReturnValueOnce(false); // Second file is not supported
      
      mockGetUnsupportedFileMessage.mockReturnValue('Unsupported file type');
      
      renderUploadDialog();
      
      // Open dialog
      const trigger = screen.getByText('Open Upload');
      await user.click(trigger);
      
      // Select mixed files
      const fileInput = screen.getByLabelText(/click to select files/i);
      const supportedFile = createMockFile('supported.txt', 'content');
      const unsupportedFile = createMockFile('unsupported.pdf', 'content', 'application/pdf');
      
      await user.upload(fileInput, [supportedFile, unsupportedFile]);
      
      // Verify only supported file is shown in selected files
      expect(screen.getByText('supported.txt')).toBeInTheDocument();
      expect(screen.queryByText('unsupported.pdf')).not.toBeInTheDocument();
      
      // Verify error message for unsupported file
      expect(screen.getByText('Unsupported file type')).toBeInTheDocument();
    });

    it('should handle file processing edge cases', async () => {
      const user = userEvent.setup();
      
      mockIsSupportedFileType.mockReturnValue(true);
      
      // Test empty file
      mockProcessFile.mockRejectedValueOnce(new Error('File appears to be empty'));
      
      renderUploadDialog();
      
      // Open dialog
      const trigger = screen.getByText('Open Upload');
      await user.click(trigger);
      
      // Select empty file
      const fileInput = screen.getByLabelText(/click to select files/i);
      const emptyFile = createMockFile('empty.txt', '');
      await user.upload(fileInput, emptyFile);
      
      // Upload file
      const uploadButton = screen.getByText(/Upload/);
      await user.click(uploadButton);
      
      // Verify specific error message
      await waitFor(() => {
        expect(screen.getByText(/File appears to be empty/)).toBeInTheDocument();
      });
    });
  });
});
