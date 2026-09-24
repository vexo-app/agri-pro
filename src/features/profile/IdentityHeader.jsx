// src/features/profile/IdentityHeader.jsx
//
// صورة/حرف الأفتار + عرض وتعديل الاسم المعروض — منقول هنا حرفيًا من
// ProfileModal.jsx من غير أي تغيير في السلوك أو الشكل.
//
// `open`: نفس خاصية "open" بتاعة ProfileModal — بتتمرر هنا بس عشان
// نعيد ضبط الاسم المعروض في الحقل كل مرة النافذة تتفتح (useEffect تحت)،
// بالظبط زي ما كان بيحصل قبل التقسيم.
import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { updateProfile } from "firebase/auth";
import { auth } from "../../config/firebase";
import { useAuth } from "../../contexts/AuthContext";
import { EditIcon, SaveIcon } from "../../components/ui/Icons";

const IdentityHeader = ({ open }) => {
  const { user } = useAuth();
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(user?.displayName || "");
  const [savingName, setSavingName] = useState(false);

  useEffect(() => { setName(user?.displayName || ""); }, [user, open]);

  const saveName = async () => {
    if (!name.trim()) return toast.error("الاسم لا يمكن أن يكون فارغًا");
    setSavingName(true);
    try {
      await updateProfile(auth.currentUser, { displayName: name.trim() });
      toast.success("تم تحديث الاسم");
      setEditingName(false);
    } catch (err) {
      toast.error("تعذر تحديث الاسم");
    } finally {
      setSavingName(false);
    }
  };

  return (
    <div className="flex items-center gap-4">
      <div className="w-16 h-16 rounded-2xl bg-brand-700 flex items-center justify-center text-2xl font-bold text-white flex-shrink-0">
        {(user?.displayName || user?.email || "م").charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        {editingName ? (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-surface-2 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-brand-600"
            />
            <button onClick={saveName} disabled={savingName}
              className="text-brand-400 hover:text-brand-300 p-1.5 rounded-lg hover:bg-brand-900/30 flex-shrink-0">
              <SaveIcon size={16} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <p className="text-base font-bold text-gray-100 truncate">{user?.displayName || "المستخدم"}</p>
            <button onClick={() => setEditingName(true)}
              className="text-gray-500 hover:text-brand-400 p-1 rounded-lg hover:bg-white/5 flex-shrink-0">
              <EditIcon size={13} />
            </button>
          </div>
        )}
        <p className="text-xs text-gray-500 truncate mt-0.5">{user?.email}</p>
      </div>
    </div>
  );
};

export default IdentityHeader;
