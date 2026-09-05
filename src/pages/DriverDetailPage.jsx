// src/pages/DriverDetailPage.jsx
import React, { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSalary }       from "../hooks/useSalary";
import { useDrivers }      from "../hooks/useDrivers";
import { useConfirm }      from "../hooks/useConfirm";
import SalaryEntryForm     from "../features/salary/SalaryEntryForm";
import AttendanceForm      from "../features/attendance/AttendanceForm";
import Modal               from "../components/ui/Modal";
import ConfirmDialog       from "../components/ui/ConfirmDialog";
import Button              from "../components/ui/Button";
import DownloadReportButton from "../components/ui/DownloadReportButton";
import { Card, CardHeader, CardBody, StatCard, Badge } from "../components/ui/Card";
import LoadingScreen       from "../components/ui/LoadingScreen";
import {
  PlusIcon, TrashIcon, CalendarIcon,
  AcreIcon, DriverIcon, AlertIcon, StarIcon,
} from "../components/ui/Icons";
import {
  formatCurrency, formatNumber, formatDateShort, getInitial,
} from "../utils/formatters";
import {
  SALARY_ENTRY_LABELS, SALARY_ENTRY_COLORS,
  SALARY_ENTRY_TYPES, ATTENDANCE_LABELS, TEAM_ROLE,
} from "../config/constants";
import { printDriverPayslip, downloadDriverPayslipPdf } from "../utils/pdfGenerator";

// ── Month selector ────────────────────────────────────────────────────────────
const buildMonthOptions = () => {
  const options = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("ar-EG", { month: "long", year: "numeric" });
    options.push({ value, label });
  }
  return options;
};

const ATTENDANCE_COLORS = {
  present: "badge-green",
  absent:  "badge-red",
  late:    "badge-amber",
  half:    "badge-blue",
};

// ── DriverDetailPage ──────────────────────────────────────────────────────────
const DriverDetailPage = () => {
  const { driverId }  = useParams();
  const navigate      = useNavigate();
  const { report }    = useDrivers();
  const {
    getMonthSummary, getDriverEntries,
    getDriverAttendance, getAttendanceSummary,
    addSalaryEntry, deleteSalaryEntry,
    addAttendance,  deleteAttendance,
    loading,
  } = useSalary();
  const { confirm, confirmState } = useConfirm();

  const MONTH_OPTIONS = useMemo(() => buildMonthOptions(), []);
  const [selectedMonth, setSelectedMonth] = useState(MONTH_OPTIONS[0].value);
  const [modal, setModal] = useState(null);

  const driver = report.find((d) => d.id === driverId);
  const isStaff = driver && (driver.role || TEAM_ROLE.DRIVER) !== TEAM_ROLE.DRIVER;

  if (loading) return <LoadingScreen />;
  if (!driver) return (
    <div className="p-6 text-center text-gray-400">العضو غير موجود</div>
  );

  const monthlySummary   = getMonthSummary(driverId, selectedMonth);
  const allEntries       = getDriverEntries(driverId);
  const attendanceRecs   = getDriverAttendance(driverId);
  const attendSummary    = getAttendanceSummary(driverId, selectedMonth);

  // Filter entries for selected month
  const monthEntries = allEntries.filter((e) => (e.date || "").startsWith(selectedMonth));
  const monthAttend  = attendanceRecs.filter((r) => (r.date || "").startsWith(selectedMonth));

  const handleSaveEntry = async (data) => {
    await addSalaryEntry(data);
    setModal(null);
  };

  const handleDeleteEntry = async (id) => {
    const ok = await confirm(id);
    if (ok) deleteSalaryEntry(id);
  };

  const handleSaveAttend = async (data) => {
    await addAttendance(data);
    setModal(null);
  };

  const handleDeleteAttend = async (id) => {
    const ok = await confirm(id);
    if (ok) deleteAttendance(id);
  };

  const handlePrintPayslip = () => {
    printDriverPayslip({
      driver,
      month: selectedMonth,
      summary: monthlySummary,
      entries: monthEntries,
      attendance: monthAttend,
    });
  };

  const handleDownloadPayslip = () => downloadDriverPayslipPdf({
    driver,
    month: selectedMonth,
    summary: monthlySummary,
    entries: monthEntries,
    attendance: monthAttend,
  });

  return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto" dir="rtl">

      {/* Back */}
      <button onClick={() => navigate("/drivers")}
        className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-200 mb-5 transition-colors">
        ← فريق العمل
      </button>

      {/* Driver header */}
      <div className="flex items-center gap-4 mb-6">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-700 to-blue-700 flex items-center justify-center text-2xl font-extrabold text-white shadow-lg">
          {getInitial(driver.name)}
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-extrabold text-gray-100">{driver.name}</h1>
          {!isStaff && (
            <p className="text-sm text-gray-500 mt-0.5">
              {driver.ops} عملية · {formatNumber(driver.totalAcres)} فدان
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handlePrintPayslip}>
            طباعة كشف
          </Button>
          <DownloadReportButton onDownload={handleDownloadPayslip} title="تحميل كشف الراتب PDF" />
        </div>
      </div>

      {/* KPI cards — كل القيم دي جايه من نفس ملخص الشهر تحت، فهي دايمًا متطابقة */}
      <div className={`grid grid-cols-2 ${isStaff ? "lg:grid-cols-3" : "lg:grid-cols-4"} gap-3 mb-6`}>
        <StatCard icon={<DriverIcon size={22}/>}  label="الراتب الأساسي" value={formatCurrency(monthlySummary.base)}       color="green" />
        <StatCard icon={<StarIcon size={22}/>}    label="الحوافز"        value={formatCurrency(monthlySummary.bonuses)}    color="blue" />
        <StatCard icon={<AlertIcon size={22}/>}   label="الخصومات"       value={formatCurrency(monthlySummary.deductions)} color="red" />
        {!isStaff && (
          <StatCard icon={<AcreIcon size={22}/>}    label="إجمالي الأفدنة" value={`${formatNumber(driver.totalAcres || 0)} ف`} color="blue" />
        )}
      </div>

      {/* Month selector */}
      <div className="flex items-center gap-3 mb-5">
        <label className="text-xs text-gray-400 font-semibold flex-shrink-0">الشهر:</label>
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="bg-surface-2 border border-white/10 rounded-xl px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-brand-600 flex-1"
        >
          {MONTH_OPTIONS.map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
      </div>

      {/* Monthly summary card */}
      <Card className="mb-5">
        <CardHeader title={`ملخص كشف الراتب — ${MONTH_OPTIONS.find(m => m.value === selectedMonth)?.label}`}
          actions={
            <Button size="sm" icon={<PlusIcon size={14}/>}
              onClick={() => setModal({ type: "salary" })}>
              إضافة قيد
            </Button>
          }
        />
        <CardBody>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
            {[
              { label:"الراتب الأساسي",  value:formatCurrency(monthlySummary.base),             color:"text-gray-200"  },
              { label:"الحوافز والزيادات", value:formatCurrency(monthlySummary.bonuses),          color:"text-green-400" },
              { label:"الإجمالي",         value:formatCurrency(monthlySummary.gross),            color:"text-amber-400" },
              { label:"الخصومات",         value:formatCurrency(monthlySummary.deductions),       color:"text-red-400"   },
              { label:"سداد السلف",       value:formatCurrency(monthlySummary.advanceRepayments),color:"text-red-400"   },
              { label:"صافي الراتب",      value:formatCurrency(monthlySummary.net),              color: monthlySummary.net >= 0 ? "text-green-400" : "text-red-400" },
            ].map((s) => (
              <div key={s.label} className="bg-surface-2 rounded-xl p-3">
                <p className={`text-sm font-extrabold tabular-nums ${s.color}`}>{s.value}</p>
                <p className="text-[10px] text-gray-500 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Entries list */}
          {monthEntries.length === 0 ? (
            <div className="text-center py-6 text-xs text-gray-500 bg-surface-2 rounded-xl">
              لا توجد قيود لهذا الشهر — اضغط "إضافة قيد"
            </div>
          ) : (
            <div className="space-y-2">
              {monthEntries.map((e) => (
                <div key={e.id} className="flex items-center gap-3 bg-surface-2 rounded-xl px-4 py-2.5">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-sm font-semibold ${SALARY_ENTRY_COLORS[e.type] || "text-gray-200"}`}>
                        {SALARY_ENTRY_LABELS[e.type] || e.type}
                      </span>
                      {e.reason && <span className="text-xs text-gray-500">· {e.reason}</span>}
                      {e.type === SALARY_ENTRY_TYPES.BASE && (
                        <Badge variant={e.paid ? "green" : "amber"}>
                          {e.paid ? "تم الصرف" : "لم يُصرف"}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-0.5">
                      <CalendarIcon size={11}/>
                      <span>{formatDateShort(e.date)}</span>
                      {e.notes && <span>· {e.notes}</span>}
                    </div>
                  </div>
                  <span className={`text-sm font-bold tabular-nums flex-shrink-0 ${
                    e.type === SALARY_ENTRY_TYPES.DEDUCTION || e.type === SALARY_ENTRY_TYPES.ADVANCE_REPAY
                      ? "text-red-400" : e.type === SALARY_ENTRY_TYPES.ADVANCE
                      ? "text-amber-400" : "text-green-400"
                  }`}>
                    {e.type === SALARY_ENTRY_TYPES.DEDUCTION || e.type === SALARY_ENTRY_TYPES.ADVANCE_REPAY
                      ? `- ${formatCurrency(e.amount)}`
                      : `+ ${formatCurrency(e.amount)}`
                    }
                  </span>
                  <Button variant="ghost" size="xs" icon={<TrashIcon size={12}/>}
                    className="px-2 flex-shrink-0" onClick={() => handleDeleteEntry(e.id)}/>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Tabs: Attendance */}
      <Card>
        <CardHeader
          title="سجل الحضور والغياب"
          actions={
            <div className="flex gap-2">
              <span className="text-xs text-gray-500 self-center">
                {attendSummary.present} حضر · {attendSummary.absent} غياب · {attendSummary.late} تأخير
              </span>
              <Button size="sm" variant="secondary" icon={<PlusIcon size={14}/>}
                onClick={() => setModal({ type: "attendance" })}>
                تسجيل
              </Button>
            </div>
          }
        />
        <CardBody>
          {monthAttend.length === 0 ? (
            <div className="text-center py-6 text-xs text-gray-500 bg-surface-2 rounded-xl">
              لا توجد سجلات حضور لهذا الشهر
            </div>
          ) : (
            <div className="space-y-2">
              {monthAttend.map((r) => (
                <div key={r.id} className="flex items-center gap-3 bg-surface-2 rounded-xl px-4 py-2.5">
                  <div className="flex items-center gap-1.5 text-xs text-gray-500 flex-shrink-0">
                    <CalendarIcon size={11}/>
                    <span>{formatDateShort(r.date)}</span>
                  </div>
                  <div className="flex-1">
                    <Badge variant={ATTENDANCE_COLORS[r.status]?.replace("badge-","") || "gray"}>
                      {ATTENDANCE_LABELS[r.status] || r.status}
                    </Badge>
                    {r.notes && <span className="text-xs text-gray-500 mr-2">{r.notes}</span>}
                  </div>
                  <Button variant="ghost" size="xs" icon={<TrashIcon size={12}/>}
                    className="px-2" onClick={() => handleDeleteAttend(r.id)}/>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Modals */}
      <Modal open={modal?.type === "salary"} onClose={() => setModal(null)}
        title="إضافة قيد راتب">
        {modal?.type === "salary" && (
          <SalaryEntryForm
            driverId={driverId}
            driverName={driver.name}
            onSave={handleSaveEntry}
            onClose={() => setModal(null)}
          />
        )}
      </Modal>

      <Modal open={modal?.type === "attendance"} onClose={() => setModal(null)}
        title="تسجيل حضور / غياب">
        {modal?.type === "attendance" && (
          <AttendanceForm
            driverId={driverId}
            driverName={driver.name}
            onSave={handleSaveAttend}
            onClose={() => setModal(null)}
          />
        )}
      </Modal>

      <ConfirmDialog open={confirmState.open} onClose={confirmState.reject}
        onConfirm={confirmState.accept} message="هل تريد حذف هذا السجل؟"/>
    </div>
  );
};

export default DriverDetailPage;
