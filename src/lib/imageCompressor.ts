export interface CompressedResult {
  blob: Blob;
  file: File;
  previewUrl: string;
  originalSizeKB: number;
  compressedSizeKB: number;
  width: number;
  height: number;
}

/**
 * 将手机拍摄或相册原图压制为 WebP 格式
 * - 最大边限制为 1600px（保持长宽比）
 * - 自动循环递减 quality 确保体积控制在 300KB 以内
 */
export async function compressToWebP(
  sourceFile: File,
  maxDimension = 1600,
  maxSizeKB = 300
): Promise<CompressedResult> {
  const bitmap = await createImageBitmap(sourceFile);
  let { width, height } = bitmap;

  // 1. 等比缩放最大边至 1600px
  if (width > maxDimension || height > maxDimension) {
    if (width >= height) {
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
  if (!ctx) throw new Error('Canvas 2D 上下文初始化失败');

  // 填充白色底防止透明 PNG 转有损时出现黑底
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const canvasToBlob = (quality: number, mimeType: string): Promise<Blob> =>
    new Promise((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('图片编码失败'))),
        mimeType,
        quality
      );
    });

  // 2. 渐进降低画质直到 <= 300KB（老旧 iOS WebView 若不支持 webp 自动回退 jpeg）
  let quality = 0.86;
  let mimeType = 'image/webp';
  let blob = await canvasToBlob(quality, mimeType);

  if (blob.type !== 'image/webp') {
    mimeType = 'image/jpeg';
  }

  while (blob.size / 1024 > maxSizeKB && quality > 0.35) {
    quality -= 0.1;
    blob = await canvasToBlob(quality, mimeType);
  }

  const ext = mimeType === 'image/webp' ? 'webp' : 'jpg';
  const rand = Math.random().toString(36).slice(2, 9);
  const fileName = `${Date.now()}_${rand}.${ext}`;
  const compressedFile = new File([blob], fileName, { type: mimeType });

  return {
    blob,
    file: compressedFile,
    previewUrl: URL.createObjectURL(blob),
    originalSizeKB: Math.round(sourceFile.size / 1024),
    compressedSizeKB: Math.round(blob.size / 1024),
    width,
    height,
  };
}
