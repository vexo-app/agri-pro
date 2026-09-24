// src/pages/guest/GuestDriverDetailPage.jsx
//
// نسخة قراءة-بس من DriverDetailPage.jsx بتاع صاحب الحساب — نفس ملخص
// كشف الراتب وسجل الحضور بالظبط، من غير أي إضافة/حذف قيود ولا طباعة/
// تحميل كشف.
//
// صلاحيات القراءة (كلها موجودة أصلاً في firestore.rules تحت نفس قسم
// 'drivers' — صفر تعديل قواعد):
//   - drivers        → guestCanRead(uid,'drivers')
//   - salaryEntries  → guestCanRead(uid,'drivers')
//   - attendance     → guestCanRead(uid,'drivers')
//   - jobs (اختياري، لعدد العمليات/الأفدنة لو العضو سائق) → قسم 'jobs'
import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useGuest } from "../../contexts/GuestContext";
import { guestAccessService } from "../../services/guestAccessService";
import { driverService } from "../../services/driverService";
import { salaryService } from "../../services/salaryService";
import { attendanceService } from "../../services/attendanceService";
import {
  calcMonthlySalary, getMonthEntries, calcAttendanceSummary, getSalaryForMonth,
} from "../../utils/salaryCalculations";
import { Card, CardHeader, CardBody, StatCard, Badge, EmptyState } from "../../components/ui/Card";
import LoadingScreen from "../../components/ui/LoadingScreen";
import { formatCurrency, formatNumber, formatDateShort, getInitial } from "../../utils/formatters";
import {
  CalendarIcon, AcreIcon, DriverIcon, AlertIcon, StarIcon, LockIcon,
} from "../../components/ui/Icons";
import {
  SALARY_ENTRY_LABELS, SALARY_ENTRY_COLORS, SALARY_ENTRY_TYPES,
  ATTENDANCE_LABELS, TEAM_ROLE,
} from "../../config/constants";

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

const ATTENDANCE_COLORS = { present: "green", absent: "red", late: "amber", half: "blue" };

const GuestDriverDetailPage = () => {
  const { driverId } = useParams();
  const navigate = useNavigate();
  const { ownerUid, isSectionOpen, access } = useGuest();

  const driversOpen = isSectionOpen("drivers");
  const jobsOpen    = isSectionOpen("jobs");

  const [drivers, setDrivers] = useState([]);
  const [salaryEntries, setSalaryEntries] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  const MONTH_OPTIONS = useMemo(() => buildMonthOptions(), []);
  const [selectedMonth, setSelectedMonth] = useState(MONTH_OPTIONS[0].value);

  useEffect(() => {
    if (!driversOpen || !ownerUid) { setLoading(false); return; }
    let drvLoaded = false, salLoaded = false, attLoaded = false;
    const maybeDone = () => { if (drvLoaded && salLoaded && attLoaded) setLoading(false); };

    const unsubDrv = driverService.subscribe(ownerUid, (list) => { setDrivers(list); drvLoaded = true; maybeDone(); }, () => { drvLoaded = true; maybeDone(); });
    const unsubSal = salaryService.subscribe(ownerUid, (list) => { setSalaryEntries(list); salLoaded = true; maybeDone(); }, () => { salLoaded = true; maybeDone(); });
    const unsubAtt = attendanceService.subscribe(ownerUid, (list) => { setAttendance(list); attLoaded = true; maybeDone(); }, () => { attLoaded = true; maybeDone(); });

    let unsubJobs = () => {};
    if (jobsOpen) {
      unsubJobs = guestAccessService.subscribeGuestJobs(ownerUid, access?.allowedClients, setJobs, () => {});
    }

    return () => { unsubDrv(); unsubSal(); unsubAtt(); unsubJobs(); };
  }, [driversOpen, jobsOpen, ownerUid, access]);

  const driver = drivers.find((d) => d.id === driverId);
  const isStaff = driver && (driver.role || TEAM_ROLE.DRIVER) !== TEAM_ROLE.DRIVER;

  const driverJobs = useMemo(() => {
    if (!jobsOpen || !driver || isStaff) return [];
    return jobs.filter((j) => j.driverId === driverId);
  }, [jobsOpen, jobs, driverId, driver, isStaff]);
  const totalAcres = driverJobs.reduce((s, j) => s + (Number(j.acres) || 0), 0);

  if (!driversOpen) {
    return (
      <EmptyState
        icon={<LockIcon size={40} className="text-gray-600 mx-auto mb-2" />}
        title="القسم ده مش متاح ليك"
        description="صاحب الحساب ما فعّلش الوصول لقسم فريق العمل في الكود بتاعك."
      />
    );
  }

  if (loading) return <LoadingScreen />;
  if (!driver) return <div className="p-6 text-center text-gray-400">العضو غير موجود</div>;

  const monthlySummary = { ...calcMonthlySalary(
    getMonthEntries(salaryEntries, driverId, selectedMonth),
    getSalaryForMonth(driver, selectedMonth)
  ) };
  const monthEntries = getMonthEntries(salaryEntries, driverId, selectedMonth);
  const attendSummary = calcAttendanceSummary(attendance, driverId, selectedMonth);
  const monthAttend = attendance.filter((r) => r.driverId === driverId && (r.date || "").startsWith(selectedMonth)).sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="max-w-4xl mx-auto animate-fade-up" dir="rtl">
      <button onClick={() => navigate("/guest/app/drivers")}
        className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-200 mb-5 transition-colors">
        ← فريق العمل
      </button>

      <div className="flex items-center gap-4 mb-6">
        <div className="w-14 h-14 rounded-2xl bg-brand-700 flex items-center justify-center text-2xl font-extrabold text-white shadow-lg">
          {getInitial(driver.name)}
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-extrabold text-gray-100">{driver.name}</h1>
          {!isStaff && jobsOpen && (
            <p className="text-sm text-gray-500 mt-0.5">
              {driverJobs.length} عملية · {formatNumber(totalAcres)} فدان
            </p>
          )}
        </div>
      </div>

      <div className={`grid grid-cols-2 ${isStaff ? "lg:grid-cols-3" : "lg:grid-cols-4"} gap-3 mb-6`}>
        <StatCard icon={<DriverIcon size={22}/>}  label="الراتب الأساسي" value={formatCurrency(monthlySummary.base)}       color="green" />
        <StatCard icon={<StarIcon size={22}/>}    label="الحوافز"        value={formatCurrency(monthlySummary.bonuses)}    color="blue" />
        <StatCard icon={<AlertIcon size={22}/>}   label="الخصومات"       value={formatCurrency(monthlySummary.deductions)} color="red" />
        {!isStaff && (
          <StatCard icon={<AcreIcon size={22}/>}    label="إجمالي الأفدنة" value={jobsOpen ? `${formatNumber(totalAcres)} ف` : "—"} color="blue" />
        )}
      </div>

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

      <Card className="mb-5">
        <CardHeader title={`ملخص كشف الراتب — ${MONTH_OPTIONS.find(m => m.value === selectedMonth)?.label}`} />
        <CardBody>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
            {[
              { label:"الراتب الأساسي",  value:formatCurrency(monthlySummary.base),             color:"text-gray-200"  },
              { label:"الحوافز والزيادات", value:formatCurrency(monthlySummary.bonuses),          color:"text-green-400" },
              { label:"الإجمالي",         value:formatCurrency(monthlySummary.gross),            color:"text-amber-400" },
              { label:"الخصومات",         value:formatCurrency(monthlySummary.deductions),       color:"text-red-400"   },
              { label:"صافي الراتب",      value:formatCurrency(monthlySummary.net),              color: monthlySummary.net >= 0 ? "text-green-400" : "text-red-400" },
            ].map((s) => (
              <div key={s.label} className="bg-surface-2 rounded-xl p-3">
                <p className={`text-sm font-extrabold tabular-nums ${s.color}`}>{s.value}</p>
                <p className="text-[10px] text-gray-500 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {monthEntries.length === 0 ? (
            <div className="text-center py-6 text-xs text-gray-500 bg-surface-2 rounded-xl">
              لا توجد قيود لهذا الشهر
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
                    e.type === SALARY_ENTRY_TYPES.DEDUCTION ? "text-red-400" : "text-green-400"
                  }`}>
                    {e.type === SALARY_ENTRY_TYPES.DEDUCTION
                      ? `- ${formatCurrency(e.amount)}`
                      : `+ ${formatCurrency(e.amount)}`
                    }
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="سجل الحضور والغياب"
          actions={
            <span className="text-xs text-gray-500 self-center">
              {attendSummary.present} حضر · {attendSummary.absent} غياب · {attendSummary.late} تأخير
            </span>
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
                    <Badge variant={ATTENDANCE_COLORS[r.status] || "gray"}>
                      {ATTENDANCE_LABELS[r.status] || r.status}
                    </Badge>
                    {r.notes && <span className="text-xs text-gray-500 mr-2">{r.notes}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
};

export default GuestDriverDetailPage;
