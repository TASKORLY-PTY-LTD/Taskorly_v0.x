import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UploadDialog } from '../upload-dialog';

// Mock the file processor
vi.mock('@/lib/file-processor', () => ({
  processFile: vi.fn(),
  isSupportedFileType: vi.fn(),
  getUnsupportedFileMessage: vi.fn(),
}));

// Mock tRPC
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

// Mock the UI components
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open, onOpenChange }: any) => (
    <div data-testid='dialog' data-open={open}>
      {children}
    </div>
  ),
  DialogContent: ({ children }: any) => (
    <div data-testid='dialog-content'>{children}</div>
  ),
  DialogDescription: ({ children }: any) => (
    <div data-testid='dialog-description'>{children}</div>
  ),
  DialogHeader: ({ children }: any) => (
    <div data-testid='dialog-header'>{children}</div>
  ),
  DialogTitle: ({ children }: any) => (
    <div data-testid='dialog-title'>{children}</div>
  ),
  DialogTrigger: ({ children }: any) => (
    <div data-testid='dialog-trigger'>{children}</div>
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
    <div data-testid='progress' data-value={value} className={className}>
      Progress: {value}%
    </div>
  ),
}));

// Mock Lucide React icons
vi.mock('lucide-react', () => ({
  Upload: () => <div data-testid='upload-icon'>Upload</div>,
  FileText: () => <div data-testid='file-text-icon'>FileText</div>,
  X: () => <div data-testid='x-icon'>X</div>,
  AlertCircle: () => <div data-testid='alert-circle-icon'>AlertCircle</div>,
  CheckCircle: () => <div data-testid='check-circle-icon'>CheckCircle</div>,
}));

describe('UploadDialog', () => {
  const mockProcessFile = vi.fn();
  const mockIsSupportedFileType = vi.fn();
  const mockGetUnsupportedFileMessage = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Import the mocked functions
    const fileProcessor = await import('@/lib/file-processor');
    mockProcessFile.mockImplementation(fileProcessor.processFile);
    mockIsSupportedFileType.mockImplementation(
      fileProcessor.isSupportedFileType
    );
    mockGetUnsupportedFileMessage.mockImplementation(
      fileProcessor.getUnsupportedFileMessage
    );
  });

  const renderUploadDialog = () => {
    return render(
      <UploadDialog>
        <button>Open Upload</button>
      </UploadDialog>
    );
  };

  const createMockFile = (
    name: string,
    content: string,
    type: string = 'text/plain'
  ) => {
    const file = new File([content], name, { type });
    return file;
  };

  describe('Dialog State Management', () => {
    it('should render trigger button', () => {
      renderUploadDialog();

      expect(screen.getByText('Open Upload')).toBeInTheDocument();
    });

    it('should open dialog when trigger is clicked', async () => {
      const user = userEvent.setup();
      renderUploadDialog();

      const trigger = screen.getByText('Open Upload');
      await user.click(trigger);

      expect(screen.getByTestId('dialog')).toHaveAttribute('data-open', 'true');
    });

    it('should close dialog when cancel is clicked', async () => {
      const user = userEvent.setup();
      renderUploadDialog();

      // Open dialog
      const trigger = screen.getByText('Open Upload');
      await user.click(trigger);

      // Click cancel
      const cancelButton = screen.getByText('Cancel');
      await user.click(cancelButton);

      expect(screen.getByTestId('dialog')).toHaveAttribute(
        'data-open',
        'false'
      );
    });
  });

  describe('File Selection', () => {
    it('should handle file selection', async () => {
      const user = userEvent.setup();
      mockIsSupportedFileType.mockReturnValue(true);

      renderUploadDialog();

      // Open dialog
      const trigger = screen.getByText('Open Upload');
      await user.click(trigger);

      // Create a mock file input
      const fileInput = screen.getByLabelText(/click to select files/i);
      const file = createMockFile('test.txt', 'test content');

      // Simulate file selection
      await user.upload(fileInput, file);

      // Check if file appears in selected files list
      expect(screen.getByText('test.txt')).toBeInTheDocument();
    });

    it('should show error for unsupported file types', async () => {
      const user = userEvent.setup();
      mockIsSupportedFileType.mockReturnValue(false);
      mockGetUnsupportedFileMessage.mockReturnValue('Unsupported file type');

      renderUploadDialog();

      // Open dialog
      const trigger = screen.getByText('Open Upload');
      await user.click(trigger);

      // Create a mock file input
      const fileInput = screen.getByLabelText(/click to select files/i);
      const file = createMockFile(
        'test.pdf',
        'test content',
        'application/pdf'
      );

      // Simulate file selection
      await user.upload(fileInput, file);

      // Check if error message appears
      expect(screen.getByText('Unsupported file type')).toBeInTheDocument();
    });

    it('should allow removing selected files', async () => {
      const user = userEvent.setup();
      mockIsSupportedFileType.mockReturnValue(true);

      renderUploadDialog();

      // Open dialog
      const trigger = screen.getByText('Open Upload');
      await user.click(trigger);

      // Add a file
      const fileInput = screen.getByLabelText(/click to select files/i);
      const file = createMockFile('test.txt', 'test content');
      await user.upload(fileInput, file);

      // Remove the file
      const removeButton = screen.getByTestId('x-icon');
      await user.click(removeButton);

      // File should be removed
      expect(screen.queryByText('test.txt')).not.toBeInTheDocument();
    });

    it('should show file size and type information', async () => {
      const user = userEvent.setup();
      mockIsSupportedFileType.mockReturnValue(true);

      renderUploadDialog();

      // Open dialog
      const trigger = screen.getByText('Open Upload');
      await user.click(trigger);

      // Add a file
      const fileInput = screen.getByLabelText(/click to select files/i);
      const file = createMockFile('test.txt', 'test content');
      await user.upload(fileInput, file);

      // Check if file info is displayed
      expect(screen.getByText(/12 B/)).toBeInTheDocument(); // File size
      expect(screen.getByText(/Text/)).toBeInTheDocument(); // File type
    });
  });

  describe('File Upload Process', () => {
    it('should process and upload files successfully', async () => {
      const user = userEvent.setup();
      mockIsSupportedFileType.mockReturnValue(true);
      mockProcessFile.mockResolvedValue({
        content: 'processed content',
        metadata: {
          fileName: 'test.txt',
          fileSize: 12,
          fileType: 'text/plain',
          wordCount: 2,
          charCount: 12,
          extractionMethod: 'text-reader',
        },
      });
      mockUploadDocument.mockResolvedValue({ success: true });

      renderUploadDialog();

      // Open dialog
      const trigger = screen.getByText('Open Upload');
      await user.click(trigger);

      // Add a file
      const fileInput = screen.getByLabelText(/click to select files/i);
      const file = createMockFile('test.txt', 'test content');
      await user.upload(fileInput, file);

      // Click upload button
      const uploadButton = screen.getByText(/Upload/);
      await user.click(uploadButton);

      // Wait for processing to complete
      await waitFor(() => {
        expect(mockProcessFile).toHaveBeenCalledWith(file);
      });

      expect(mockUploadDocument).toHaveBeenCalledWith({
        title: 'test.txt',
        content: 'processed content',
        metadata: expect.objectContaining({
          fileName: 'test.txt',
          fileSize: 12,
          fileType: 'text/plain',
          wordCount: 2,
          charCount: 12,
          extractionMethod: 'text-reader',
        }),
        contentType: 'text/plain',
        sourceUrl: undefined,
      });
    });

    it('should show upload progress', async () => {
      const user = userEvent.setup();
      mockIsSupportedFileType.mockReturnValue(true);
      mockProcessFile.mockResolvedValue({
        content: 'processed content',
        metadata: {
          fileName: 'test.txt',
          fileSize: 12,
          fileType: 'text/plain',
          wordCount: 2,
          charCount: 12,
          extractionMethod: 'text-reader',
        },
      });
      mockUploadDocument.mockResolvedValue({ success: true });

      renderUploadDialog();

      // Open dialog
      const trigger = screen.getByText('Open Upload');
      await user.click(trigger);

      // Add a file
      const fileInput = screen.getByLabelText(/click to select files/i);
      const file = createMockFile('test.txt', 'test content');
      await user.upload(fileInput, file);

      // Click upload button
      const uploadButton = screen.getByText(/Upload/);
      await user.click(uploadButton);

      // Check if progress is shown
      expect(screen.getByTestId('progress')).toBeInTheDocument();
      expect(screen.getByText(/Processing test.txt/)).toBeInTheDocument();
    });

    it('should show success messages after upload', async () => {
      const user = userEvent.setup();
      mockIsSupportedFileType.mockReturnValue(true);
      mockProcessFile.mockResolvedValue({
        content: 'processed content',
        metadata: {
          fileName: 'test.txt',
          fileSize: 12,
          fileType: 'text/plain',
          wordCount: 2,
          charCount: 12,
          extractionMethod: 'text-reader',
        },
      });
      mockUploadDocument.mockResolvedValue({ success: true });

      renderUploadDialog();

      // Open dialog
      const trigger = screen.getByText('Open Upload');
      await user.click(trigger);

      // Add a file
      const fileInput = screen.getByLabelText(/click to select files/i);
      const file = createMockFile('test.txt', 'test content');
      await user.upload(fileInput, file);

      // Click upload button
      const uploadButton = screen.getByText(/Upload/);
      await user.click(uploadButton);

      // Wait for success message
      await waitFor(() => {
        expect(
          screen.getByText(/Successfully processed "test.txt"/)
        ).toBeInTheDocument();
      });
    });

    it('should show error messages for failed uploads', async () => {
      const user = userEvent.setup();
      mockIsSupportedFileType.mockReturnValue(true);
      mockProcessFile.mockRejectedValue(new Error('Processing failed'));

      renderUploadDialog();

      // Open dialog
      const trigger = screen.getByText('Open Upload');
      await user.click(trigger);

      // Add a file
      const fileInput = screen.getByLabelText(/click to select files/i);
      const file = createMockFile('test.txt', 'test content');
      await user.upload(fileInput, file);

      // Click upload button
      const uploadButton = screen.getByText(/Upload/);
      await user.click(uploadButton);

      // Wait for error message
      await waitFor(() => {
        expect(
          screen.getByText(/Failed to process "test.txt"/)
        ).toBeInTheDocument();
      });
    });

    it('should disable upload button when no files selected', () => {
      renderUploadDialog();

      // Open dialog
      const trigger = screen.getByText('Open Upload');
      fireEvent.click(trigger);

      // Upload button should be disabled
      const uploadButton = screen.getByText(/Upload/);
      expect(uploadButton).toBeDisabled();
    });

    it('should disable controls during upload', async () => {
      const user = userEvent.setup();
      mockIsSupportedFileType.mockReturnValue(true);
      mockProcessFile.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 100))
      );

      renderUploadDialog();

      // Open dialog
      const trigger = screen.getByText('Open Upload');
      await user.click(trigger);

      // Add a file
      const fileInput = screen.getByLabelText(/click to select files/i);
      const file = createMockFile('test.txt', 'test content');
      await user.upload(fileInput, file);

      // Click upload button
      const uploadButton = screen.getByText(/Upload/);
      await user.click(uploadButton);

      // Check if controls are disabled
      expect(uploadButton).toBeDisabled();
      expect(screen.getByText('Cancel')).toBeDisabled();
    });
  });

  describe('Client-side Rendering', () => {
    it('should show loading message before client-side hydration', () => {
      // Mock not being on client side
      const originalIsClient = global.window;
      delete (global as any).window;

      renderUploadDialog();

      // Open dialog
      const trigger = screen.getByText('Open Upload');
      fireEvent.click(trigger);

      // Add a file
      const fileInput = screen.getByLabelText(/click to select files/i);
      const file = createMockFile('test.txt', 'test content');
      fireEvent.change(fileInput, { target: { files: [file] } });

      // Click upload button
      const uploadButton = screen.getByText(/Upload/);
      fireEvent.click(uploadButton);

      // Should show client-side loading message
      expect(
        screen.getByText(/Please wait for the page to fully load/)
      ).toBeInTheDocument();

      // Restore window
      global.window = originalIsClient;
    });
  });

  describe('File Formatting', () => {
    it('should format file sizes correctly', async () => {
      const user = userEvent.setup();
      mockIsSupportedFileType.mockReturnValue(true);

      renderUploadDialog();

      // Open dialog
      const trigger = screen.getByText('Open Upload');
      await user.click(trigger);

      // Test different file sizes
      const testCases = [
        { size: 0, expected: '0 B' },
        { size: 1024, expected: '1 KB' },
        { size: 1024 * 1024, expected: '1 MB' },
        { size: 1024 * 1024 * 1024, expected: '1 GB' },
      ];

      for (const testCase of testCases) {
        const file = new File(['x'.repeat(testCase.size)], 'test.txt', {
          type: 'text/plain',
        });
        const fileInput = screen.getByLabelText(/click to select files/i);

        await user.upload(fileInput, file);

        expect(screen.getByText(testCase.expected)).toBeInTheDocument();

        // Remove file for next test
        const removeButton = screen.getByTestId('x-icon');
        await user.click(removeButton);
      }
    });
  });

  describe('Dialog Content', () => {
    it('should display correct title and description', () => {
      renderUploadDialog();

      // Open dialog
      const trigger = screen.getByText('Open Upload');
      fireEvent.click(trigger);

      expect(screen.getByText('Upload Documents')).toBeInTheDocument();
      expect(
        screen.getByText(/Upload your restaurant documents/)
      ).toBeInTheDocument();
      expect(screen.getByText(/Supports: TXT, MD, JSON/)).toBeInTheDocument();
    });

    it('should show file input with correct accept attribute', () => {
      renderUploadDialog();

      // Open dialog
      const trigger = screen.getByText('Open Upload');
      fireEvent.click(trigger);

      const fileInput = screen.getByLabelText(/click to select files/i);
      expect(fileInput).toHaveAttribute('accept', '.txt,.md,.json');
      expect(fileInput).toHaveAttribute('multiple');
    });
  });
});
