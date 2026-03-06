import CryptoJS from 'crypto-js';

const SALT = 'personal-dashboard-v1';

export function encrypt(data: string, masterPassword: string): string {
  return CryptoJS.AES.encrypt(data, masterPassword + SALT).toString();
}

export function decrypt(encryptedData: string, masterPassword: string): string {
  const bytes = CryptoJS.AES.decrypt(encryptedData, masterPassword + SALT);
  return bytes.toString(CryptoJS.enc.Utf8);
}

export function hashPassword(password: string): string {
  return CryptoJS.SHA256(password + SALT).toString();
}

export function generatePassword(length: number = 16): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => chars[byte % chars.length]).join('');
}
