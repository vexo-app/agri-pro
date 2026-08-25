// src/features/admin/BackupToExcelCard.jsx
// ─────────────────────────────────────────────────────────
// أدمن بس: بطاقة برفع ملف نسخة احتياطية يدوية (.json) — نفس
// الملف اللي بينزل عند أي مستخدم من زر "تحميل نسخة احتياطية"
// (exportService.downloadBackupFile) وبعتهولك بأي طريقة — وتحويله
// لملف Excel واحد فيه شيتات منظمة ومترابطة (يبقى جاهز تبعته
// للمستخدم لو طلب نسخة إكسيل من بياناته).
// ─────────────────────────────────────────────────────────

import React, { useState } from "react";
import { Card, CardHeader, CardBody } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import Button from "../../components/ui/Button";
import { exportService } from "../../services/exportService";
import { backupToExcelService } from "../../services/backupToExcelService";
import toast from "react-hot-toast"; // نفس نظام التنبيهات المستخدم في DataContext

const BackupToExcelCard = () => {
  const [file, setFile] = useState(null);
  const [userLabel, setUserLabel] = useState("");
  const [preview, setPreview] = useState(null); // { exportedAt, counts }
  const [busy, setBusy] = useState(false);

  const handleFileChange = async (e) => {
    const f = e.target.files?.[0] || null;
    setFile(f);
    setPreview(null);
    if (!f) return;

    try {
      const { exportedAt, counts } = await exportService.readBackupFile(f);
      setPreview({ exportedAt, counts });
    } catch (err) {
      toast.error(err.message || "الملف ده مش نسخة احتياطية صحيحة");
      setFile(null);
    }
  };

  const handleConvert = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const { data, exportedAt } = await exportService.readBackupFile(file);
      backupToExcelService.convertAndDownload(data, {
        userLabel: userLabel.trim() || "مستخدم",
        exportedAt,
      });
      toast.success("تم تحويل النسخة لملف إكسيل وتنزيله");
    } catch (err) {
      toast.error(err.message || "حدث خطأ أثناء التحويل");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader
        title="تحويل نسخة احتياطية يدوية لملف إكسيل"
        subtitle="لو مستخدم بعتلك ملف الـ backup (JSON) بتاعه، ارفعه هنا وهيتحول لملف Excel منظم بشيتات مترابطة"
      />
      <CardBody className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">
            ملف النسخة الاحتياطية (.json)
          </label>
          <input
            type="file"
            accept=".json,application/json"
            onChange={handleFileChange}
            className="block w-full text-sm text-gray-300 file:me-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-brand-600 file:text-white file:font-semibold hover:file:bg-brand-500 file:cursor-pointer cursor-pointer"
          />
        </div>

        <Input
          label="اسم الحساب / المستخدم (اختياري — بيظهر في شيت الملخص واسم الملف)"
          placeholder="مثال: مزرعة الأمل"
          value={userLabel}
          onChange={(e) => setUserLabel(e.target.value)}
        />

        {preview && (
          <div className="rounded-xl border border-white/10 bg-surface-2 p-3 text-sm text-gray-300 space-y-1">
            <p className="font-semibold text-gray-200">
              تاريخ تصدير النسخة: {preview.exportedAt ? new Date(preview.exportedAt).toLocaleString("ar-EG") : "غير معروف"}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 text-xs text-gray-400">
              {Object.entries(preview.counts).map(([key, count]) => (
                <span key={key}>{key}: {count}</span>
              ))}
            </div>
          </div>
        )}

        <Button variant="primary" onClick={handleConvert} loading={busy} disabled={!file || busy}>
          تحويل لملف إكسيل وتنزيله
        </Button>
      </CardBody>
    </Card>
  );
};

export default BackupToExcelCard;
