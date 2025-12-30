// src/utils/watermark.js

import sharp from "sharp";

/**
 * Add watermark overlay to image
 * @param {Buffer} imageBuffer - Original image buffer
 * @param {Object} watermarkData - Watermark information
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

    console.log("🎨 Adding watermark...");
    console.log("Status:", status);
    console.log("Employee:", employeeName, employeeId);

    // Format timestamp ke WIB
    const WIB_OFFSET = 7 * 60 * 60 * 1000;
    const dateWIB = new Date(new Date(timestamp).getTime() + WIB_OFFSET);

    const dateStr = dateWIB.toLocaleDateString("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    const timeStr = dateWIB.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });

    // Get original image metadata
    const image = sharp(imageBuffer);
    const metadata = await image.metadata();
    const { width, height } = metadata;

    console.log("Image size:", width, "x", height);

    // Calculate responsive font sizes
    const titleFontSize = Math.max(Math.floor(width / 18), 32);
    const textFontSize = Math.max(Math.floor(width / 26), 22);
    const smallFontSize = Math.max(Math.floor(width / 35), 18);

    const lineHeight = textFontSize + 14;
    const padding = 25;
    const boxPadding = 20;

    // Calculate box dimensions
    const totalLines = 5.8;
    const boxHeight = totalLines * lineHeight + boxPadding * 2;
    const boxWidth = width - padding * 2;
    const boxY = height - boxHeight - padding;

    // ✅ Build SVG watermark overlay (WITHOUT EMOJIS)
    const svgWatermark = `
      <svg width="${width}" height="${height}">
        <defs>
          <!-- Gradient background -->
          <linearGradient id="boxGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style="stop-color:rgb(0,0,0);stop-opacity:0.85" />
            <stop offset="100%" style="stop-color:rgb(20,20,20);stop-opacity:0.90" />
          </linearGradient>
        </defs>
        
        <!-- Background box with gradient -->
        <rect 
          x="${padding}" 
          y="${boxY}" 
          width="${boxWidth}" 
          height="${boxHeight}" 
          fill="url(#boxGradient)"
          stroke="#FFD700"
          stroke-width="3"
          rx="18"
        />
        
        <!-- Status Title (CLOCK IN / CLOCK OUT) -->
        <text 
          x="${padding + boxPadding}" 
          y="${boxY + boxPadding + titleFontSize}" 
          font-family="Arial, Helvetica, sans-serif" 
          font-size="${titleFontSize}" 
          font-weight="bold" 
          fill="#FFD700"
          letter-spacing="3"
        >
          ${status.toUpperCase()}
        </text>
        
        <!-- Separator line -->
        <line
          x1="${padding + boxPadding}"
          y1="${boxY + boxPadding + titleFontSize + 10}"
          x2="${width - padding - boxPadding}"
          y2="${boxY + boxPadding + titleFontSize + 10}"
          stroke="#FFD700"
          stroke-width="2"
          opacity="0.5"
        />
        
        <!-- Employee Name -->
        <text 
          x="${padding + boxPadding}" 
          y="${boxY + boxPadding + titleFontSize + lineHeight * 1.3}" 
          font-family="Arial, Helvetica, sans-serif" 
          font-size="${textFontSize}" 
          font-weight="bold" 
          fill="#FFFFFF"
        >
          ${employeeName}
        </text>
        
        <!-- Employee ID -->
        <text 
          x="${padding + boxPadding}" 
          y="${boxY + boxPadding + titleFontSize + lineHeight * 2}" 
          font-family="Arial, Helvetica, sans-serif" 
          font-size="${smallFontSize}" 
          fill="#D0D0D0"
        >
          ID: ${employeeId}
        </text>
        
        <!-- Date Label -->
        <text 
          x="${padding + boxPadding}" 
          y="${boxY + boxPadding + titleFontSize + lineHeight * 2.9}" 
          font-family="Arial, Helvetica, sans-serif" 
          font-size="${smallFontSize}" 
          font-weight="600"
          fill="#90EE90"
        >
          TANGGAL:
        </text>
        
        <!-- Date Value -->
        <text 
          x="${padding + boxPadding}" 
          y="${boxY + boxPadding + titleFontSize + lineHeight * 3.5}" 
          font-family="Arial, Helvetica, sans-serif" 
          font-size="${textFontSize}" 
          fill="#E8E8E8"
        >
          ${dateStr}
        </text>
        
        <!-- Time Label + Value -->
        <text 
          x="${padding + boxPadding}" 
          y="${boxY + boxPadding + titleFontSize + lineHeight * 4.3}" 
          font-family="Arial, Helvetica, sans-serif" 
          font-size="${textFontSize}" 
          font-weight="bold"
          fill="#90EE90"
        >
          JAM: ${timeStr} WIB
        </text>
        
        <!-- Location (GPS Coordinates) -->
        <text 
          x="${padding + boxPadding}" 
          y="${boxY + boxPadding + titleFontSize + lineHeight * 5.1}" 
          font-family="Courier New, monospace" 
          font-size="${smallFontSize}" 
          fill="#A0A0A0"
        >
          GPS: ${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}
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
      .jpeg({
        quality: 92,
        mozjpeg: true,
      })
      .toBuffer();

    console.log("✅ Watermark applied successfully");
    return watermarkedBuffer;
  } catch (error) {
    console.error("❌ Watermark Error:", error);
    throw new Error(`Failed to add watermark: ${error.message}`);
  }
};
