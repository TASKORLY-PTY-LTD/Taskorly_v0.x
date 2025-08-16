import { describe, it, expect, beforeAll, vi } from 'vitest';
import { encrypt, decrypt, hash, verifyHash, generateToken } from '../encryption';

// Mock environment
beforeAll(() => {
  vi.stubEnv('ENCRYPTION_KEY', 'test-encryption-key-32-chars-long');
});

describe('Encryption Utils', () => {
  describe('encrypt/decrypt', () => {
    it('should encrypt and decrypt text correctly', () => {
      const originalText = 'Hello, World!';
      const encrypted = encrypt(originalText);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(originalText);
      expect(encrypted).not.toBe(originalText);
      expect(encrypted).toMatch(/^[a-f0-9]+:[a-f0-9]+:[a-f0-9]+$/);
    });

    it('should produce different encrypted output for same input', () => {
      const text = 'test message';
      const encrypted1 = encrypt(text);
      const encrypted2 = encrypt(text);

      expect(encrypted1).not.toBe(encrypted2);
      expect(decrypt(encrypted1)).toBe(text);
      expect(decrypt(encrypted2)).toBe(text);
    });

    it('should handle empty strings', () => {
      const empty = '';
      const encrypted = encrypt(empty);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(empty);
    });

    it('should handle special characters', () => {
      const special = '!@#$%^&*()_+{}|:<>?[]\\;\'",./`~';
      const encrypted = encrypt(special);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(special);
    });

    it('should throw error for invalid encrypted data format', () => {
      expect(() => decrypt('invalid-format')).toThrow('Invalid encrypted data format');
      expect(() => decrypt('only:one:colon')).toThrow();
    });
  });

  describe('hash/verifyHash', () => {
    it('should create consistent hashes', () => {
      const input = 'password123';
      const hash1 = hash(input);
      const hash2 = hash(input);

      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex
    });

    it('should verify hashes correctly', () => {
      const password = 'mySecurePassword';
      const hashedPassword = hash(password);

      expect(verifyHash(password, hashedPassword)).toBe(true);
      expect(verifyHash('wrongPassword', hashedPassword)).toBe(false);
    });

    it('should produce different hashes for different inputs', () => {
      const hash1 = hash('input1');
      const hash2 = hash('input2');

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('generateToken', () => {
    it('should generate tokens of correct length', () => {
      const token32 = generateToken(32);
      const token16 = generateToken(16);

      expect(token32).toHaveLength(64); // 32 bytes = 64 hex chars
      expect(token16).toHaveLength(32); // 16 bytes = 32 hex chars
    });

    it('should generate different tokens each time', () => {
      const token1 = generateToken();
      const token2 = generateToken();

      expect(token1).not.toBe(token2);
      expect(token1).toMatch(/^[a-f0-9]+$/);
      expect(token2).toMatch(/^[a-f0-9]+$/);
    });

    it('should use default length when not specified', () => {
      const token = generateToken();
      expect(token).toHaveLength(64); // Default 32 bytes
    });
  });
});