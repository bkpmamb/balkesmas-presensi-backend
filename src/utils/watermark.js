// src/utils/watermark.js

import sharp from "sharp";

/**
 * Add watermark to image
 * @param {Buffer} imageBuffer - Original image buffer
 * @param {Object} watermarkData - Data for watermark
 * @returns {Promise<Buffer>} - Watermarked image buffer
 */
export const addWatermark = async (imageBuffer, watermarkData) => {
  try {
    const {
      employeeName,
      employeeId,
      timestamp,
      location,
      status, // "Clock In" or "Clock Out"
    } = watermarkData;

    // Format timestamp ke WIB
    const WIB_OFFSET = 7 * 60 * 60 * 1000;
    const dateWIB = new Date(new Date(timestamp).getTime() + WIB_OFFSET);

    const dateStr = dateWIB.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });

    const timeStr = dateWIB.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });

    // Get image metadata
    const image = sharp(imageBuffer);
    const metadata = await image.metadata();
    const { width, height } = metadata;

    // Calculate font sizes based on image width
    const titleFontSize = Math.floor(width / 25); // Responsive font size
    const textFontSize = Math.floor(width / 35);
    const smallFontSize = Math.floor(width / 45);

    // Create watermark text
    const watermarkLines = [
      `${status.toUpperCase()}`, // Title
      ``,
      `${employeeName} (${employeeId})`,
      `${dateStr}`,
      `${timeStr} WIB`,
      `Lokasi: ${location.latitude.toFixed(6)}, ${location.longitude.toFixed(
        6
      )}`,
    ];

    // Build SVG watermark
    const lineHeight = textFontSize + 8;
    const padding = 20;
    const boxWidth = width - padding * 2;
    const boxHeight = watermarkLines.length * lineHeight + padding * 2;

    const svgWatermark = `
      <svg width="${width}" height="${height}">
        <!-- Semi-transparent background box -->
        <rect 
          x="${padding}" 
          y="${height - boxHeight - padding}" 
          width="${boxWidth}" 
          height="${boxHeight}" 
          fill="rgba(0, 0, 0, 0.7)" 
          rx="10"
        />
        
        <!-- Title (Clock In/Out) -->
        <text 
          x="${padding + 15}" 
          y="${height - boxHeight - padding + titleFontSize + 15}" 
          font-family="Arial, sans-serif" 
          font-size="${titleFontSize}" 
          font-weight="bold" 
          fill="#FFFFFF"
        >
          ${watermarkLines[0]}
        </text>
        
        <!-- Employee Name & ID -->
        <text 
          x="${padding + 15}" 
          y="${height - boxHeight - padding + titleFontSize + lineHeight + 25}" 
          font-family="Arial, sans-serif" 
          font-size="${textFontSize}" 
          font-weight="bold" 
          fill="#FFFFFF"
        >
          ${watermarkLines[2]}
        </text>
        
        <!-- Date -->
        <text 
          x="${padding + 15}" 
          y="${
            height - boxHeight - padding + titleFontSize + lineHeight * 2 + 25
          }" 
          font-family="Arial, sans-serif" 
          font-size="${textFontSize}" 
          fill="#E0E0E0"
        >
          ${watermarkLines[3]}
        </text>
        
        <!-- Time -->
        <text 
          x="${padding + 15}" 
          y="${
            height - boxHeight - padding + titleFontSize + lineHeight * 3 + 25
          }" 
          font-family="Arial, sans-serif" 
          font-size="${textFontSize}" 
          fill="#E0E0E0"
        >
          ${watermarkLines[4]}
        </text>
        
        <!-- Location -->
        <text 
          x="${padding + 15}" 
          y="${
            height - boxHeight - padding + titleFontSize + lineHeight * 4 + 25
          }" 
          font-family="Arial, sans-serif" 
          font-size="${smallFontSize}" 
          fill="#B0B0B0"
        >
          ${watermarkLines[5]}
        </text>
      </svg>
    `;

    // Composite watermark onto image
    const watermarkedBuffer = await image
      .composite([
        {
          input: Buffer.from(svgWatermark),
          top: 0,
          left: 0,
        },
      ])
      .jpeg({ quality: 90 }) // Output as JPEG with good quality
      .toBuffer();

    return watermarkedBuffer;
  } catch (error) {
    console.error("Watermark Error:", error);
    throw new Error(`Failed to add watermark: ${error.message}`);
  }
};
