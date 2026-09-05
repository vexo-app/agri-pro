// src/features/drivers/DriverCard.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import { Card, Badge } from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import {
  EditIcon, TrashIcon, PhoneIcon, AlertIcon, TractorIcon, CheckCircleIcon, ClearIcon,
} from "../../components/ui/Icons";
import { formatNumber, getInitial } from "../../utils/formatters";
import { DRIVER_STATUS, TEAM_ROLE, TEAM_ROLE_LABELS, STAFF_POSITION_LABELS } from "../../config/constants";

const StatItem = ({ label, value, color = "text-gray-200" }) => (
  <div className="flex flex-col gap-0.5">
    <span className={`text-sm font-extrabold ${color}`}>{value}</span>
    <span className="text-[10px] text-gray-500">{label}</span>
  </div>
);

const DriverCard = ({ driver, onEdit, onDelete, onPaySalary, onCancelPaySalary }) => {
  const navigate = useNavigate();
  const {
    id, name, phone, totalAcres = 0, ops = 0, salary = 0,
    status, role = TEAM_ROLE.DRIVER, position, unpaidThisMonth, lastPaidBaseEntry, assignedEquipment = [],
  } = driver;

  const isInactive = status === DRIVER_STATUS.INACTIVE;
  const isStaff    = role !== TEAM_ROLE.DRIVER;
  // للإداريين/المحاسبين بنعرض المسمى الدقيق (إداري أو محاسب) بدل التصنيف
  // العام. لو سائق بمسمى مخصوص (اختار "أخرى" وكتب اسم)، بنعرضه هو كمان.
  const isCustomDriverTitle = !isStaff && position && position !== "driver";
  const roleBadgeLabel = isStaff
    ? (STAFF_POSITION_LABELS[position] || TEAM_ROLE_LABELS[role])
    : position;

  return (
    <Card hover className={isInactive ? "opacity-60" : ""}>
      <div className="p-5">
        <div className="flex gap-4 items-start">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-700 to-blue-700 flex items-center justify-center text-xl font-extrabold text-white flex-shrink-0 shadow-lg">
            {getInitial(name)}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-extrabold text-gray-100 truncate">{name}</h3>
              {(isStaff || isCustomDriverTitle) && <Badge variant="blue">{roleBadgeLabel}</Badge>}
              {isInactive && <Badge variant="gray">غير نشط</Badge>}
            </div>

            {phone && (
              <div className="flex items-center gap-1.5 mt-0.5">
                <PhoneIcon size={11} className="text-gray-500" />
                <p className="text-xs text-gray-500" style={{ direction: "ltr" }}>{phone}</p>
              </div>
            )}

            {/* أفدنة/عمليات مالهاش معنى غير للسائقين (المرتبطين بعمليات ميدانية) */}
            {!isStaff && (
              <div className="flex gap-4 mt-3 flex-wrap">
                <StatItem label="أفدنة"  value={formatNumber(totalAcres)} color="text-blue-400" />
                <StatItem label="عمليات" value={ops} />
              </div>
            )}

            {/* Alerts / status badges */}
            {(unpaidThisMonth || assignedEquipment.length > 0) && (
              <div className="flex items-center gap-2 flex-wrap mt-3">
                {unpaidThisMonth && (
                  <Badge variant="amber">
                    <AlertIcon size={11} /> لسه ما اتصرفش راتب الشهر ده
                  </Badge>
                )}
                {assignedEquipment.map((eqName) => (
                  <Badge key={eqName} variant="blue">
                    <TractorIcon size={11} /> {eqName}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2 flex-shrink-0">
            {salary > 0 && unpaidThisMonth && (
              <Button
                variant="primary"
                size="sm"
                icon={<CheckCircleIcon size={14} />}
                className="!bg-green-600 hover:!bg-green-500 !shadow-green-900/40"
                onClick={() => onPaySalary(driver)}
              >
                صرف الراتب
              </Button>
            )}
            {salary > 0 && !unpaidThisMonth && lastPaidBaseEntry && (
              <Button
                variant="danger"
                size="sm"
                icon={<ClearIcon size={13} />}
                onClick={() => onCancelPaySalary(driver)}
              >
                إلغاء صرف الراتب
              </Button>
            )}
            <Button variant="secondary" size="sm" onClick={() => navigate(`/drivers/${id}`)}>
              الرواتب والحضور
            </Button>
            <div className="flex gap-2">
              <Button variant="ghost" size="xs" icon={<EditIcon size={13} />}
                className="flex-1" onClick={onEdit} />
              <Button variant="ghost" size="xs" icon={<TrashIcon size={13} />}
                className="flex-1" onClick={onDelete} />
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default DriverCard;
