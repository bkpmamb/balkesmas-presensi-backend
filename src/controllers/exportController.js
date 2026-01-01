// src/controllers/exportController.js

import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import Attendance from "../models/Attendance.js";
import User from "../models/User.js";
import Shift from "../models/Shift.js";

/**
 * Export Attendances to Excel
 */
export const exportToExcel = async (req, res) => {
  try {
    const { startDate, endDate, userId, shiftId, clockInStatus } = req.query;

    console.log("==========================================");
    console.log("📊 EXPORT TO EXCEL");
    console.log("Filters:", {
      startDate,
      endDate,
      userId,
      shiftId,
      clockInStatus,
    });

    // Build filter
    const filter = {};

    if (userId) filter.user = userId;
    if (shiftId) filter.shift = shiftId;
    if (clockInStatus) filter.clockInStatus = clockInStatus;

    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.date.$lte = end;
      }
    }

    // Fetch attendances
    const attendances = await Attendance.find(filter)
      .populate("user", "name employeeId category")
      .populate({
        path: "user",
        populate: {
          path: "category",
          select: "name prefix",
        },
      })
      .populate("shift", "name startTime endTime")
      .sort({ date: -1, clockIn: -1 })
      .lean();

    console.log("Found attendances:", attendances.length);

    // Create workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Balkesmas Presensi System";
    workbook.created = new Date();

    // Add worksheet
    const worksheet = workbook.addWorksheet("Laporan Presensi", {
      pageSetup: { paperSize: 9, orientation: "landscape" },
    });

    // ===== HEADER SECTION =====
    worksheet.mergeCells("A1:L1");
    const titleCell = worksheet.getCell("A1");
    titleCell.value = "LAPORAN PRESENSI KARYAWAN";
    titleCell.font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } };
    titleCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1F4788" },
    };
    titleCell.alignment = { horizontal: "center", vertical: "middle" };
    worksheet.getRow(1).height = 30;

    // Period info
    worksheet.mergeCells("A2:L2");
    const periodCell = worksheet.getCell("A2");
    periodCell.value = `Periode: ${startDate || "Awal"} s/d ${
      endDate || "Sekarang"
    }`;
    periodCell.font = { bold: true, size: 12 };
    periodCell.alignment = { horizontal: "center" };
    worksheet.getRow(2).height = 20;

    // Empty row
    worksheet.addRow([]);

    // ===== TABLE HEADERS =====
    const headerRow = worksheet.addRow([
      "No",
      "Tanggal",
      "Nama",
      "ID Karyawan",
      "Kategori",
      "Shift",
      "Jam Masuk",
      "Jam Pulang",
      "Status Masuk",
      "Status Pulang",
      "Terlambat (menit)",
      "Durasi Kerja",
    ]);

    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF2E75B6" },
    };
    headerRow.alignment = { horizontal: "center", vertical: "middle" };
    headerRow.height = 25;

    // Set column widths
    worksheet.columns = [
      { width: 6 }, // No
      { width: 15 }, // Tanggal
      { width: 25 }, // Nama
      { width: 12 }, // ID Karyawan
      { width: 15 }, // Kategori
      { width: 20 }, // Shift
      { width: 12 }, // Jam Masuk
      { width: 12 }, // Jam Pulang
      { width: 15 }, // Status Masuk
      { width: 15 }, // Status Pulang
      { width: 15 }, // Terlambat
      { width: 15 }, // Durasi Kerja
    ];

    // ===== DATA ROWS =====
    attendances.forEach((attendance, index) => {
      const clockInTime = new Date(attendance.clockIn).toLocaleTimeString(
        "id-ID",
        {
          hour: "2-digit",
          minute: "2-digit",
        }
      );

      const clockOutTime = attendance.clockOut
        ? new Date(attendance.clockOut).toLocaleTimeString("id-ID", {
            hour: "2-digit",
            minute: "2-digit",
          })
        : "-";

      const workDuration = attendance.workMinutes
        ? `${Math.floor(attendance.workMinutes / 60)}j ${
            attendance.workMinutes % 60
          }m`
        : "-";

      const row = worksheet.addRow([
        index + 1,
        new Date(attendance.date).toLocaleDateString("id-ID"),
        attendance.user.name,
        attendance.user.employeeId,
        attendance.user.category?.name || "-",
        attendance.shift.name,
        clockInTime,
        clockOutTime,
        attendance.clockInStatus === "ontime" ? "Tepat Waktu" : "Terlambat",
        attendance.clockOutStatus === "normal"
          ? "Normal"
          : attendance.clockOutStatus === "early"
          ? "Pulang Awal"
          : "-",
        attendance.lateMinutes || 0,
        workDuration,
      ]);

      // Alternating row colors
      if (index % 2 === 0) {
        row.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF2F2F2" },
        };
      }

      // Status color coding
      const statusMasukCell = row.getCell(9);
      statusMasukCell.font = {
        color: {
          argb: attendance.clockInStatus === "ontime" ? "FF00B050" : "FFFF0000",
        },
        bold: true,
      };

      // Alignment
      row.alignment = { vertical: "middle" };
      row.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
      row.getCell(2).alignment = { horizontal: "center", vertical: "middle" };
      row.getCell(7).alignment = { horizontal: "center", vertical: "middle" };
      row.getCell(8).alignment = { horizontal: "center", vertical: "middle" };
      row.getCell(9).alignment = { horizontal: "center", vertical: "middle" };
      row.getCell(10).alignment = { horizontal: "center", vertical: "middle" };
      row.getCell(11).alignment = { horizontal: "center", vertical: "middle" };
      row.getCell(12).alignment = { horizontal: "center", vertical: "middle" };
    });

    // ===== SUMMARY SECTION =====
    worksheet.addRow([]);
    const summaryStartRow = worksheet.lastRow.number + 1;

    const totalOnTime = attendances.filter(
      (a) => a.clockInStatus === "ontime"
    ).length;
    const totalLate = attendances.filter(
      (a) => a.clockInStatus === "late"
    ).length;
    const totalLateMinutes = attendances.reduce(
      (sum, a) => sum + (a.lateMinutes || 0),
      0
    );
    const totalWorkMinutes = attendances.reduce(
      (sum, a) => sum + (a.workMinutes || 0),
      0
    );

    worksheet.addRow(["RINGKASAN"]);
    worksheet.mergeCells(`A${summaryStartRow}:L${summaryStartRow}`);
    const summaryHeaderCell = worksheet.getCell(`A${summaryStartRow}`);
    summaryHeaderCell.font = { bold: true, size: 14 };
    summaryHeaderCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFD9E1F2" },
    };
    summaryHeaderCell.alignment = { horizontal: "center", vertical: "middle" };

    worksheet.addRow(["Total Presensi", attendances.length]);
    worksheet.addRow(["Tepat Waktu", totalOnTime]);
    worksheet.addRow(["Terlambat", totalLate]);
    worksheet.addRow(["Total Menit Terlambat", totalLateMinutes]);
    worksheet.addRow([
      "Rata-rata Jam Kerja",
      attendances.length > 0
        ? `${(totalWorkMinutes / attendances.length / 60).toFixed(1)} jam`
        : "0 jam",
    ]);

    // Style summary rows
    for (let i = summaryStartRow + 1; i <= worksheet.lastRow.number; i++) {
      worksheet.getRow(i).font = { bold: true };
      worksheet.getCell(`A${i}`).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF2F2F2" },
      };
      worksheet.getCell(`B${i}`).alignment = { horizontal: "center" };
    }

    // Add borders to all cells
    const lastRow = worksheet.lastRow.number;
    for (let i = 4; i <= lastRow; i++) {
      const row = worksheet.getRow(i);
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
      });
    }

    console.log("✅ Excel generated successfully");
    console.log("==========================================");

    // Send file
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=Laporan_Presensi_${
        new Date().toISOString().split("T")[0]
      }.xlsx`
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("❌ Export to Excel Error:", error);
    res.status(500).json({
      success: false,
      message: "Gagal export ke Excel",
      error: error.message,
    });
  }
};

/**
 * Export Attendances to PDF
 */
export const exportToPDF = async (req, res) => {
  try {
    const { startDate, endDate, userId, shiftId, clockInStatus } = req.query;

    console.log("==========================================");
    console.log("📄 EXPORT TO PDF");
    console.log("Filters:", {
      startDate,
      endDate,
      userId,
      shiftId,
      clockInStatus,
    });

    // Build filter (same as Excel)
    const filter = {};

    if (userId) filter.user = userId;
    if (shiftId) filter.shift = shiftId;
    if (clockInStatus) filter.clockInStatus = clockInStatus;

    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.date.$lte = end;
      }
    }

    // Fetch attendances
    const attendances = await Attendance.find(filter)
      .populate("user", "name employeeId category")
      .populate({
        path: "user",
        populate: {
          path: "category",
          select: "name prefix",
        },
      })
      .populate("shift", "name startTime endTime")
      .sort({ date: -1, clockIn: -1 })
      .lean();

    console.log("Found attendances:", attendances.length);

    // Create PDF
    const doc = new PDFDocument({
      size: "A4",
      layout: "landscape",
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
    });

    // Set response headers
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=Laporan_Presensi_${
        new Date().toISOString().split("T")[0]
      }.pdf`
    );

    doc.pipe(res);

    // ===== HEADER =====
    doc.fontSize(18).font("Helvetica-Bold").text("LAPORAN PRESENSI KARYAWAN", {
      align: "center",
    });

    doc.moveDown(0.5);
    doc
      .fontSize(12)
      .font("Helvetica")
      .text(`Periode: ${startDate || "Awal"} s/d ${endDate || "Sekarang"}`, {
        align: "center",
      });

    doc.moveDown(1);

    // ===== TABLE =====
    const tableTop = doc.y;
    const colWidths = {
      no: 30,
      tanggal: 70,
      nama: 120,
      id: 60,
      shift: 80,
      masuk: 50,
      pulang: 50,
      status: 70,
      terlambat: 50,
    };

    let currentY = tableTop;

    // Table header
    doc.fontSize(9).font("Helvetica-Bold");
    doc.rect(50, currentY, 750, 20).fillAndStroke("#2E75B6", "#000");

    doc.fillColor("#FFF");
    let currentX = 55;
    doc.text("No", currentX, currentY + 5, {
      width: colWidths.no,
      align: "center",
    });
    currentX += colWidths.no;
    doc.text("Tanggal", currentX, currentY + 5, {
      width: colWidths.tanggal,
      align: "center",
    });
    currentX += colWidths.tanggal;
    doc.text("Nama", currentX, currentY + 5, {
      width: colWidths.nama,
      align: "left",
    });
    currentX += colWidths.nama;
    doc.text("ID", currentX, currentY + 5, {
      width: colWidths.id,
      align: "center",
    });
    currentX += colWidths.id;
    doc.text("Shift", currentX, currentY + 5, {
      width: colWidths.shift,
      align: "left",
    });
    currentX += colWidths.shift;
    doc.text("Masuk", currentX, currentY + 5, {
      width: colWidths.masuk,
      align: "center",
    });
    currentX += colWidths.masuk;
    doc.text("Pulang", currentX, currentY + 5, {
      width: colWidths.pulang,
      align: "center",
    });
    currentX += colWidths.pulang;
    doc.text("Status", currentX, currentY + 5, {
      width: colWidths.status,
      align: "center",
    });
    currentX += colWidths.status;
    doc.text("Terlambat", currentX, currentY + 5, {
      width: colWidths.terlambat,
      align: "center",
    });

    currentY += 20;

    // Table rows
    doc.font("Helvetica").fontSize(8);

    attendances.forEach((attendance, index) => {
      // Check if need new page
      if (currentY > 500) {
        doc.addPage();
        currentY = 50;
      }

      const fillColor = index % 2 === 0 ? "#F2F2F2" : "#FFF";
      doc.rect(50, currentY, 750, 18).fillAndStroke(fillColor, "#000");

      doc.fillColor("#000");
      currentX = 55;

      doc.text(index + 1, currentX, currentY + 4, {
        width: colWidths.no,
        align: "center",
      });
      currentX += colWidths.no;

      doc.text(
        new Date(attendance.date).toLocaleDateString("id-ID"),
        currentX,
        currentY + 4,
        { width: colWidths.tanggal, align: "center" }
      );
      currentX += colWidths.tanggal;

      doc.text(attendance.user.name, currentX, currentY + 4, {
        width: colWidths.nama,
        align: "left",
      });
      currentX += colWidths.nama;

      doc.text(attendance.user.employeeId, currentX, currentY + 4, {
        width: colWidths.id,
        align: "center",
      });
      currentX += colWidths.id;

      doc.text(attendance.shift.name, currentX, currentY + 4, {
        width: colWidths.shift,
        align: "left",
      });
      currentX += colWidths.shift;

      const clockInTime = new Date(attendance.clockIn).toLocaleTimeString(
        "id-ID",
        {
          hour: "2-digit",
          minute: "2-digit",
        }
      );
      doc.text(clockInTime, currentX, currentY + 4, {
        width: colWidths.masuk,
        align: "center",
      });
      currentX += colWidths.masuk;

      const clockOutTime = attendance.clockOut
        ? new Date(attendance.clockOut).toLocaleTimeString("id-ID", {
            hour: "2-digit",
            minute: "2-digit",
          })
        : "-";
      doc.text(clockOutTime, currentX, currentY + 4, {
        width: colWidths.pulang,
        align: "center",
      });
      currentX += colWidths.pulang;

      const statusColor =
        attendance.clockInStatus === "ontime" ? "#00B050" : "#FF0000";
      doc.fillColor(statusColor);
      doc.text(
        attendance.clockInStatus === "ontime" ? "Tepat Waktu" : "Terlambat",
        currentX,
        currentY + 4,
        { width: colWidths.status, align: "center" }
      );
      doc.fillColor("#000");
      currentX += colWidths.status;

      doc.text(`${attendance.lateMinutes || 0} mnt`, currentX, currentY + 4, {
        width: colWidths.terlambat,
        align: "center",
      });

      currentY += 18;
    });

    // ===== SUMMARY =====
    doc.addPage();
    doc
      .fontSize(14)
      .font("Helvetica-Bold")
      .text("RINGKASAN", { align: "center" });
    doc.moveDown(1);

    const totalOnTime = attendances.filter(
      (a) => a.clockInStatus === "ontime"
    ).length;
    const totalLate = attendances.filter(
      (a) => a.clockInStatus === "late"
    ).length;
    const totalLateMinutes = attendances.reduce(
      (sum, a) => sum + (a.lateMinutes || 0),
      0
    );
    const totalWorkMinutes = attendances.reduce(
      (sum, a) => sum + (a.workMinutes || 0),
      0
    );

    doc.fontSize(12).font("Helvetica");
    doc.text(`Total Presensi: ${attendances.length}`);
    doc.text(`Tepat Waktu: ${totalOnTime}`);
    doc.text(`Terlambat: ${totalLate}`);
    doc.text(`Total Menit Terlambat: ${totalLateMinutes}`);
    doc.text(
      `Rata-rata Jam Kerja: ${
        attendances.length > 0
          ? (totalWorkMinutes / attendances.length / 60).toFixed(1)
          : 0
      } jam`
    );

    doc.end();

    console.log("✅ PDF generated successfully");
    console.log("==========================================");
  } catch (error) {
    console.error("❌ Export to PDF Error:", error);
    res.status(500).json({
      success: false,
      message: "Gagal export ke PDF",
      error: error.message,
    });
  }
};

/**
 * Export Employee Specific Report to Excel
 */
export const exportEmployeeExcel = async (req, res) => {
  try {
    const { userId } = req.params;
    const { startDate, endDate } = req.query;

    // Check user exists
    const user = await User.findById(userId).populate(
      "category",
      "name prefix"
    );
    if (!user || user.role !== "employee") {
      return res.status(404).json({
        success: false,
        message: "Karyawan tidak ditemukan",
      });
    }

    // Build filter
    const filter = { user: userId };

    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.date.$lte = end;
      }
    }

    const attendances = await Attendance.find(filter)
      .populate("shift", "name startTime endTime")
      .sort({ date: -1 })
      .lean();

    // Create workbook (similar to general export but employee-focused)
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Laporan Presensi");

    // Header
    worksheet.mergeCells("A1:J1");
    const titleCell = worksheet.getCell("A1");
    titleCell.value = `LAPORAN PRESENSI - ${user.name} (${user.employeeId})`;
    titleCell.font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } };
    titleCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1F4788" },
    };
    titleCell.alignment = { horizontal: "center", vertical: "middle" };
    worksheet.getRow(1).height = 30;

    worksheet.mergeCells("A2:J2");
    const periodCell = worksheet.getCell("A2");
    periodCell.value = `Periode: ${startDate || "Awal"} s/d ${
      endDate || "Sekarang"
    }`;
    periodCell.font = { bold: true, size: 12 };
    periodCell.alignment = { horizontal: "center" };

    worksheet.addRow([]);

    // Table headers
    const headerRow = worksheet.addRow([
      "No",
      "Tanggal",
      "Shift",
      "Jam Masuk",
      "Jam Pulang",
      "Status Masuk",
      "Status Pulang",
      "Terlambat (menit)",
      "Durasi Kerja",
      "Catatan",
    ]);

    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF2E75B6" },
    };
    headerRow.alignment = { horizontal: "center", vertical: "middle" };

    worksheet.columns = [
      { width: 6 },
      { width: 15 },
      { width: 20 },
      { width: 12 },
      { width: 12 },
      { width: 15 },
      { width: 15 },
      { width: 15 },
      { width: 15 },
      { width: 30 },
    ];

    // Data rows
    attendances.forEach((attendance, index) => {
      const clockInTime = new Date(attendance.clockIn).toLocaleTimeString(
        "id-ID",
        {
          hour: "2-digit",
          minute: "2-digit",
        }
      );

      const clockOutTime = attendance.clockOut
        ? new Date(attendance.clockOut).toLocaleTimeString("id-ID", {
            hour: "2-digit",
            minute: "2-digit",
          })
        : "-";

      const workDuration = attendance.workMinutes
        ? `${Math.floor(attendance.workMinutes / 60)}j ${
            attendance.workMinutes % 60
          }m`
        : "-";

      worksheet.addRow([
        index + 1,
        new Date(attendance.date).toLocaleDateString("id-ID"),
        attendance.shift.name,
        clockInTime,
        clockOutTime,
        attendance.clockInStatus === "ontime" ? "Tepat Waktu" : "Terlambat",
        attendance.clockOutStatus === "normal"
          ? "Normal"
          : attendance.clockOutStatus === "early"
          ? "Pulang Awal"
          : "-",
        attendance.lateMinutes || 0,
        workDuration,
        attendance.isManualEntry ? "Entri Manual" : "",
      ]);
    });

    // Summary
    worksheet.addRow([]);
    const summaryRow = worksheet.lastRow.number + 1;

    const totalOnTime = attendances.filter(
      (a) => a.clockInStatus === "ontime"
    ).length;
    const totalLate = attendances.filter(
      (a) => a.clockInStatus === "late"
    ).length;
    const totalWorkMinutes = attendances.reduce(
      (sum, a) => sum + (a.workMinutes || 0),
      0
    );

    worksheet.addRow(["RINGKASAN"]);
    worksheet.mergeCells(`A${summaryRow}:J${summaryRow}`);
    worksheet.addRow(["Total Kehadiran", attendances.length]);
    worksheet.addRow(["Tepat Waktu", totalOnTime]);
    worksheet.addRow(["Terlambat", totalLate]);
    worksheet.addRow([
      "Rata-rata Jam Kerja",
      attendances.length > 0
        ? `${(totalWorkMinutes / attendances.length / 60).toFixed(1)} jam`
        : "0 jam",
    ]);

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=Laporan_${user.employeeId}_${
        new Date().toISOString().split("T")[0]
      }.xlsx`
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("❌ Export Employee Excel Error:", error);
    res.status(500).json({
      success: false,
      message: "Gagal export ke Excel",
      error: error.message,
    });
  }
};

/**
 * Export Employee Specific Report to PDF
 */
export const exportEmployeePDF = async (req, res) => {
  try {
    const { userId } = req.params;
    const { startDate, endDate } = req.query;

    console.log("==========================================");
    console.log("📄 EXPORT EMPLOYEE PDF");
    console.log("User ID:", userId);
    console.log("Date range:", startDate, "to", endDate);

    // Check user exists
    const user = await User.findById(userId).populate(
      "category",
      "name prefix"
    );
    if (!user || user.role !== "employee") {
      return res.status(404).json({
        success: false,
        message: "Karyawan tidak ditemukan",
      });
    }

    console.log("Employee:", user.name, user.employeeId);

    // Build filter
    const filter = { user: userId };

    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.date.$lte = end;
      }
    }

    const attendances = await Attendance.find(filter)
      .populate("shift", "name startTime endTime")
      .sort({ date: -1 })
      .lean();

    console.log("Found attendances:", attendances.length);

    // Create PDF
    const doc = new PDFDocument({
      size: "A4",
      layout: "portrait",
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=Laporan_${user.employeeId}_${
        new Date().toISOString().split("T")[0]
      }.pdf`
    );

    doc.pipe(res);

    // ===== HEADER =====
    doc.fontSize(16).font("Helvetica-Bold").text("LAPORAN PRESENSI KARYAWAN", {
      align: "center",
    });
    doc.moveDown(0.5);
    doc
      .fontSize(14)
      .text(`${user.name} (${user.employeeId})`, { align: "center" });
    doc
      .fontSize(10)
      .font("Helvetica")
      .text(`Kategori: ${user.category.name}`, { align: "center" });
    doc.moveDown(0.5);
    doc.text(`Periode: ${startDate || "Awal"} s/d ${endDate || "Sekarang"}`, {
      align: "center",
    });

    doc.moveDown(1);

    // ===== TABLE =====
    let currentY = doc.y;

    // Table header
    doc.fontSize(9).font("Helvetica-Bold");
    doc.rect(50, currentY, 495, 20).fillAndStroke("#2E75B6", "#000");
    doc.fillColor("#FFF");

    doc.text("No", 55, currentY + 5, { width: 30, align: "center" });
    doc.text("Tanggal", 85, currentY + 5, { width: 70, align: "center" });
    doc.text("Shift", 155, currentY + 5, { width: 80, align: "left" });
    doc.text("Masuk", 235, currentY + 5, { width: 50, align: "center" });
    doc.text("Pulang", 285, currentY + 5, { width: 50, align: "center" });
    doc.text("Status", 335, currentY + 5, { width: 60, align: "center" });
    doc.text("Terlambat", 395, currentY + 5, { width: 50, align: "center" });
    doc.text("Durasi", 445, currentY + 5, { width: 50, align: "center" });

    currentY += 20;

    // Data rows
    doc.font("Helvetica").fontSize(8);

    attendances.forEach((attendance, index) => {
      // Check if need new page
      if (currentY > 700) {
        doc.addPage();
        currentY = 50;
      }

      const fillColor = index % 2 === 0 ? "#F2F2F2" : "#FFF";
      doc.rect(50, currentY, 495, 18).fillAndStroke(fillColor, "#000");

      doc.fillColor("#000");

      // No
      doc.text(index + 1, 55, currentY + 4, { width: 30, align: "center" });

      // Tanggal
      doc.text(
        new Date(attendance.date).toLocaleDateString("id-ID"),
        85,
        currentY + 4,
        { width: 70, align: "center" }
      );

      // Shift
      doc.text(attendance.shift.name, 155, currentY + 4, {
        width: 80,
        align: "left",
      });

      // Jam Masuk
      const clockInTime = new Date(attendance.clockIn).toLocaleTimeString(
        "id-ID",
        {
          hour: "2-digit",
          minute: "2-digit",
        }
      );
      doc.text(clockInTime, 235, currentY + 4, { width: 50, align: "center" });

      // Jam Pulang
      const clockOutTime = attendance.clockOut
        ? new Date(attendance.clockOut).toLocaleTimeString("id-ID", {
            hour: "2-digit",
            minute: "2-digit",
          })
        : "-";
      doc.text(clockOutTime, 285, currentY + 4, { width: 50, align: "center" });

      // Status (with color)
      const statusColor =
        attendance.clockInStatus === "ontime" ? "#00B050" : "#FF0000";
      doc.fillColor(statusColor);
      doc.text(
        attendance.clockInStatus === "ontime" ? "Tepat" : "Terlambat",
        335,
        currentY + 4,
        { width: 60, align: "center" }
      );
      doc.fillColor("#000");

      // Terlambat (menit)
      doc.text(`${attendance.lateMinutes || 0}m`, 395, currentY + 4, {
        width: 50,
        align: "center",
      });

      // Durasi Kerja
      const workDuration = attendance.workMinutes
        ? `${Math.floor(attendance.workMinutes / 60)}j ${
            attendance.workMinutes % 60
          }m`
        : "-";
      doc.text(workDuration, 445, currentY + 4, { width: 50, align: "center" });

      currentY += 18;
    });

    // ===== SUMMARY PAGE =====
    doc.addPage();
    doc
      .fontSize(14)
      .font("Helvetica-Bold")
      .text("RINGKASAN", { align: "center" });
    doc.moveDown(1);

    const totalOnTime = attendances.filter(
      (a) => a.clockInStatus === "ontime"
    ).length;
    const totalLate = attendances.filter(
      (a) => a.clockInStatus === "late"
    ).length;
    const totalLateMinutes = attendances.reduce(
      (sum, a) => sum + (a.lateMinutes || 0),
      0
    );
    const totalWorkMinutes = attendances.reduce(
      (sum, a) => sum + (a.workMinutes || 0),
      0
    );

    doc.fontSize(12).font("Helvetica");
    doc.text(`Total Kehadiran: ${attendances.length}`);
    doc.moveDown(0.3);
    doc.text(
      `Tepat Waktu: ${totalOnTime} (${
        attendances.length > 0
          ? Math.round((totalOnTime / attendances.length) * 100)
          : 0
      }%)`
    );
    doc.moveDown(0.3);
    doc.text(
      `Terlambat: ${totalLate} (${
        attendances.length > 0
          ? Math.round((totalLate / attendances.length) * 100)
          : 0
      }%)`
    );
    doc.moveDown(0.3);
    doc.text(`Total Menit Terlambat: ${totalLateMinutes} menit`);
    doc.moveDown(0.3);
    doc.text(
      `Rata-rata Keterlambatan: ${
        totalLate > 0 ? Math.round(totalLateMinutes / totalLate) : 0
      } menit`
    );
    doc.moveDown(0.3);
    doc.text(
      `Total Jam Kerja: ${Math.floor(totalWorkMinutes / 60)} jam ${
        totalWorkMinutes % 60
      } menit`
    );
    doc.moveDown(0.3);
    doc.text(
      `Rata-rata Jam Kerja per Hari: ${
        attendances.length > 0
          ? (totalWorkMinutes / attendances.length / 60).toFixed(1)
          : 0
      } jam`
    );

    // Performance indicator
    doc.moveDown(1);
    doc
      .fontSize(14)
      .font("Helvetica-Bold")
      .text("PERFORMA", { align: "center" });
    doc.moveDown(0.5);

    const punctualityRate =
      attendances.length > 0
        ? Math.round((totalOnTime / attendances.length) * 100)
        : 0;

    doc.fontSize(12).font("Helvetica");
    doc.text(`Tingkat Kedisiplinan: ${punctualityRate}%`);
    doc.moveDown(0.3);

    // Performance rating
    let performanceRating = "";
    let performanceColor = "#000";

    if (punctualityRate >= 95) {
      performanceRating = "Sangat Baik";
      performanceColor = "#00B050";
    } else if (punctualityRate >= 85) {
      performanceRating = "Baik";
      performanceColor = "#92D050";
    } else if (punctualityRate >= 75) {
      performanceRating = "Cukup";
      performanceColor = "#FFC000";
    } else {
      performanceRating = "Perlu Perbaikan";
      performanceColor = "#FF0000";
    }

    doc.fillColor(performanceColor);
    doc.fontSize(14).font("Helvetica-Bold");
    doc.text(`Rating: ${performanceRating}`, { align: "center" });

    // Footer
    doc.fillColor("#000");
    doc.fontSize(8).font("Helvetica");
    doc.moveDown(2);
    doc.text(
      `Dicetak pada: ${new Date().toLocaleDateString("id-ID", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })} WIB`,
      { align: "center" }
    );

    doc.end();

    console.log("✅ Employee PDF generated successfully");
    console.log("==========================================");
  } catch (error) {
    console.error("❌ Export Employee PDF Error:", error);

    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "ID karyawan tidak valid",
      });
    }

    res.status(500).json({
      success: false,
      message: "Gagal export ke PDF",
      error: error.message,
    });
  }
};
