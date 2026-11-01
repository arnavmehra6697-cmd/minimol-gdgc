/**
 * HiveNet Cryptographic Engine
 * AES-256-GCM Authenticated Encryption with PBKDF2 Key Derivation
 * 
 * Strict Privacy Guarantee:
 * - Passwords are never sent across the network or stored on storage peers.
 * - Files are compressed first, then encrypted client-side prior to network dispatch.
 * - Storage peers only see ciphertext and cryptographic nonces/salt; never the plaintext image.
 */

// Format identifier for HiveNet encrypted package:
// [4 bytes magic 'HVN1'] [16 bytes salt] [12 bytes IV] [ciphertext + 16 bytes auth tag]
const MAGIC_HEADER = new Uint8Array([0x48, 0x56, 0x4e, 0x31]); // 'HVN1'

/**
 * Derives a 256-bit AES-GCM CryptoKey from a password and salt using PBKDF2 with SHA-256 (100,000 iterations).
 */
async function deriveKey(password, salt) {
  const enc = new TextEncoder();
  const passwordBytes = enc.encode(password);

  const baseKey = await crypto.subtle.importKey(
    'raw',
    passwordBytes,
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts an ArrayBuffer of plaintext data (e.g. compressed WebP image)
 * using AES-256-GCM.
 *
 * @param {ArrayBuffer} plaintextBuffer - Raw data to encrypt
 * @param {string} password - User-supplied storage password
 * @returns {Promise<{ encryptedBuffer: ArrayBuffer, saltHex: string, ivHex: string }>}
 */
export async function encryptPayload(plaintextBuffer, password) {
  if (!password || typeof password !== 'string' || password.length < 1) {
    throw new Error('A valid storage password is required to encrypt your files.');
  }

  // 1. Generate unique 16-byte random salt and 12-byte IV nonce
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // 2. Derive key using PBKDF2
  const aesKey = await deriveKey(password, salt);

  // 3. Encrypt payload
  const ciphertextBuffer = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv,
      tagLength: 128, // 16 bytes authentication tag
    },
    aesKey,
    plaintextBuffer
  );

  // 4. Pack into standard wire format: [4B MAGIC][16B SALT][12B IV][CIPHERTEXT]
  const totalLength = MAGIC_HEADER.length + salt.length + iv.length + ciphertextBuffer.byteLength;
  const packaged = new Uint8Array(totalLength);
  packaged.set(MAGIC_HEADER, 0);
  packaged.set(salt, MAGIC_HEADER.length);
  packaged.set(iv, MAGIC_HEADER.length + salt.length);
  packaged.set(new Uint8Array(ciphertextBuffer), MAGIC_HEADER.length + salt.length + iv.length);

  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
  const ivHex = Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join('');

  return {
    encryptedBuffer: packaged.buffer,
    saltHex,
    ivHex,
  };
}

/**
 * Decrypts a packaged encrypted buffer using the user's password.
 *
 * @param {ArrayBuffer} encryptedPackage - Wire format buffer
 * @param {string} password - User-supplied password
 * @returns {Promise<ArrayBuffer>} - Decrypted plaintext buffer
 */
export async function decryptPayload(encryptedPackage, password) {
  if (!password || typeof password !== 'string') {
    throw new Error('Please enter your storage password to decrypt this photo.');
  }

  const pkg = new Uint8Array(encryptedPackage);
  if (pkg.length < MAGIC_HEADER.length + 16 + 12 + 16) {
    throw new Error('Encrypted payload is corrupted or invalid (too short).');
  }

  // Verify magic header
  for (let i = 0; i < MAGIC_HEADER.length; i++) {
    if (pkg[i] !== MAGIC_HEADER[i]) {
      // Legacy unencrypted fallback if needed:
      // If it doesn't match MAGIC_HEADER, treat as unencrypted data
      throw new Error('Invalid format: File is not encrypted with HiveNet AES-256 format.');
    }
  }

  const saltOffset = MAGIC_HEADER.length;
  const ivOffset = saltOffset + 16;
  const cipherOffset = ivOffset + 12;

  const salt = pkg.slice(saltOffset, saltOffset + 16);
  const iv = pkg.slice(ivOffset, ivOffset + 12);
  const ciphertext = pkg.slice(cipherOffset);

  try {
    const aesKey = await deriveKey(password, salt);
    const plaintext = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv,
        tagLength: 128,
      },
      aesKey,
      ciphertext
    );
    return plaintext;
  } catch (err) {
    // AES-GCM fails authentication if ciphertext or password is wrong
    throw new Error('Incorrect password! Authentication tag mismatch or corrupted data.');
  }
}

/**
 * Checks if a given buffer starts with HiveNet encrypted magic header 'HVN1'
 */
export function isEncryptedPackage(buffer) {
  if (!buffer || buffer.byteLength < 4) return false;
  const view = new Uint8Array(buffer, 0, 4);
  return view[0] === 0x48 && view[1] === 0x56 && view[2] === 0x4e && view[3] === 0x31;
}

/**
 * Computes SHA-256 hash of any ArrayBuffer or Uint8Array
 */
export async function computeSHA256(buffer) {
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
