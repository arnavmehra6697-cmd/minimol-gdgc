/**
 * HiveNet Client-Side Compression & Content-Addressing Engine
 * Mandate: Raw uncompressed uploads are rejected.
 * Compresses images client-side to modern WebP format and calculates cryptographic SHA-256 CID.
 */

export async function compressImage(file, maxDimension = 1920, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image file format'));
      img.onload = async () => {
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        // Downscale while preserving aspect ratio if larger than maxDimension
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(async (blob) => {
          if (!blob) {
            return reject(new Error('Canvas WebP compression failed'));
          }

          const arrayBuffer = await blob.arrayBuffer();
          // Compute cryptographic SHA-256 Content Identifier (CID)
          const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
          const hashArray = Array.from(new Uint8Array(hashBuffer));
          const cid = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

          const originalSize = file.size;
          const compressedSize = blob.size;
          const savedBytes = Math.max(0, originalSize - compressedSize);
          const compressionRatio = ((savedBytes / originalSize) * 100).toFixed(1);
          const previewUrl = URL.createObjectURL(blob);

          resolve({
            cid,
            compressedBlob: blob,
            arrayBuffer,
            mimeType: 'image/webp',
            originalName: file.name,
            originalSize,
            compressedSize,
            compressionRatio: Math.max(0, parseFloat(compressionRatio)),
            dimensions: { width, height },
            previewUrl,
          });
        }, 'image/webp', quality);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
