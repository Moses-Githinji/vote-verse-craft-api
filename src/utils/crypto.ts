import crypto from 'crypto';

/**
 * Generates a random password of a given length, containing
 * at least one lowercase letter, one uppercase letter, one number, and one symbol.
 */
export function generateRandomPassword(length: number = 8): string {
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  // Removed HTML-unsafe characters (<, >, &, ', ") to prevent email rendering bugs
  const symbols = '!@#$%^*()_+~|}{[]:;.,/-=';
  
  const allChars = lowercase + uppercase + numbers + symbols;
  
  let password = '';
  
  // Ensure at least one of each required type
  password += lowercase[crypto.randomInt(0, lowercase.length)];
  password += uppercase[crypto.randomInt(0, uppercase.length)];
  password += numbers[crypto.randomInt(0, numbers.length)];
  password += symbols[crypto.randomInt(0, symbols.length)];
  
  // Fill the rest
  for (let i = password.length; i < length; i++) {
    password += allChars[crypto.randomInt(0, allChars.length)];
  }
  
  // Shuffle the password
  return password.split('').sort(() => 0.5 - Math.random()).join('');
}
