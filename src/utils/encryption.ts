import CryptoJS from 'crypto-js';

const SALT = 'personal-dashboard-v1';

export function encrypt(data: string, masterPassword: string): string {
  return CryptoJS.AES.encrypt(data, masterPassword + SALT).toString();
}

export function decrypt(encryptedData: string, masterPassword: string): string {
  const bytes = CryptoJS.AES.decrypt(encryptedData, masterPassword + SALT);
  const result = bytes.toString(CryptoJS.enc.Utf8);
  if (!result) throw new Error('Decryption failed');
  return result;
}

export function hashPassword(password: string): string {
  return CryptoJS.SHA256(password + SALT).toString();
}

export function generatePassword(
  length: number = 16,
  options: { upper?: boolean; lower?: boolean; numbers?: boolean; symbols?: boolean } = {}
): string {
  const { upper = true, lower = true, numbers = true, symbols = true } = options;
  let chars = '';
  if (lower) chars += 'abcdefghijklmnopqrstuvwxyz';
  if (upper) chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  if (numbers) chars += '0123456789';
  if (symbols) chars += '!@#$%^&*()_+-=[]{}|;:,.<>?';
  if (!chars) chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const limit = 256 - (256 % chars.length);
  const result: string[] = [];
  while (result.length < length) {
    const arr = new Uint8Array(length * 2);
    crypto.getRandomValues(arr);
    for (const byte of arr) {
      if (byte < limit) result.push(chars[byte % chars.length]);
      if (result.length === length) break;
    }
  }
  return result.join('');
}
