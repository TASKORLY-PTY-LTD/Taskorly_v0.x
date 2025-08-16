import { describe, it, expect } from 'vitest';
import { cn } from '../utils';

describe('Utils', () => {
  describe('cn (className utility)', () => {
    it('should merge class names correctly', () => {
      const result = cn('btn', 'btn-primary');
      expect(result).toBe('btn btn-primary');
    });

    it('should handle conditional classes', () => {
      const isActive = true;
      const result = cn('btn', isActive && 'btn-active');
      expect(result).toBe('btn btn-active');

      const isInactive = false;
      const result2 = cn('btn', isInactive && 'btn-active');
      expect(result2).toBe('btn');
    });

    it('should merge conflicting Tailwind classes', () => {
      // This tests tailwind-merge functionality
      const result = cn('px-2 py-1 px-3');
      expect(result).toBe('py-1 px-3'); // px-3 should override px-2
    });

    it('should handle empty values', () => {
      const result = cn('btn', '', undefined, null, false);
      expect(result).toBe('btn');
    });

    it('should handle arrays and nested conditions', () => {
      const result = cn(['btn', 'btn-primary'], {
        'btn-active': true,
        'btn-disabled': false,
      });
      expect(result).toBe('btn btn-primary btn-active');
    });
  });
});
