// src/pages/AuthPage.jsx
import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { EyeIcon, EyeOffIcon } from "../components/ui/Icons";
import toast from "react-hot-toast";

const AuthPage = () => {
  const { login, register: registerUser, resetPassword } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState("login"); // "login" | "register" | "forgot"
  const [showPassword, setShowPassword] = useState(false);

  const { register, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm();

  const authErrorMsgs = {
    "auth/user-not-found":       "البريد الإلكتروني غير مسجل",
    "auth/wrong-password":       "كلمة المرور غير صحيحة",
    "auth/email-already-in-use": "البريد الإلكتروني مسجل مسبقاً",
    "auth/weak-password":        "كلمة المرور ضعيفة (6 أحرف على الأقل)",
    "auth/invalid-email":        "صيغة البريد الإلكتروني غير صحيحة",
    "auth/too-many-requests":    "محاولات كتير، حاول تاني بعد شوية",
  };

  const onSubmit = async (data) => {
    try {
      if (mode === "login") {
        await login(data.email, data.password);
        toast.success("مرحباً بك!");
        navigate("/");
      } else if (mode === "register") {
        await registerUser(data.email, data.password, data.displayName);
        toast.success("تم إنشاء الحساب بنجاح!");
        navigate("/");
      } else {
        await resetPassword(data.email);
        toast.success("تم إرسال رابط استعادة كلمة المرور إلى بريدك الإلكتروني");
        setMode("login");
        reset();
      }
    } catch (err) {
      toast.error(authErrorMsgs[err.code] ?? "حدث خطأ، حاول مرة أخرى");
    }
  };

  const switchMode = () => { setMode((m) => m === "login" ? "register" : "login"); reset(); };
  const goToForgot = () => { setMode("forgot"); reset(); };
  const backToLogin = () => { setMode("login"); reset(); };

  const inputClass = "w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/30 transition";

  return (
    <div className="min-h-screen bg-dark flex items-center justify-center p-4 font-arabic" dir="rtl">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-brand-900/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/4 w-64 h-64 bg-blue-900/15 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        <div className="text-center mb-8">
          <img src="/brand-icon.png" alt="زراعي برو" className="w-16 h-16 rounded-3xl mx-auto mb-4 shadow-xl shadow-brand-900/50" />
          <h1 className="text-2xl font-extrabold text-gray-100">زراعي برو</h1>
          <p className="text-sm text-gray-500 mt-1">بيانات أوضح. قرارات أذكى. أرباح أكبر.</p>
          <p className="text-[11px] tracking-wide text-gray-600 mt-1.5">MADE BY: ADHAM FATHY</p>
        </div>

        <div className="bg-surface border border-white/10 rounded-3xl p-6 shadow-2xl">
          <h2 className="text-base font-bold text-gray-200 mb-5">
            {mode === "login" && "تسجيل الدخول"}
            {mode === "register" && "إنشاء حساب جديد"}
            {mode === "forgot" && "استعادة كلمة المرور"}
          </h2>

          {mode === "forgot" && (
            <p className="text-xs text-gray-500 mb-4 -mt-2">
              اكتب بريدك الإلكتروني وهنبعتلك رابط لإعادة تعيين كلمة المرور
            </p>
          )}

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
            {mode === "register" && (
              <input className={inputClass} placeholder="الاسم الكامل"
                {...register("displayName", { required: true })} />
            )}
            <input type="email" className={inputClass} placeholder="البريد الإلكتروني"
              style={{ direction: "ltr", textAlign: "right" }}
              {...register("email", { required: true })} />
            {mode !== "forgot" && (
              <div className="relative">
                <input type={showPassword ? "text" : "password"} className={`${inputClass} pl-11`} placeholder="كلمة المرور"
                  style={{ direction: "ltr", textAlign: "right" }}
                  {...register("password", { required: true, minLength: 6 })} />
                <button type="button" onClick={() => setShowPassword((s) => !s)}
                  tabIndex={-1}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                  aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}>
                  {showPassword ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
                </button>
              </div>
            )}
            {errors.password?.type === "minLength" && (
              <p className="text-xs text-red-400">6 أحرف على الأقل</p>
            )}

            {mode === "login" && (
              <div className="text-left -mt-1">
                <button type="button" onClick={goToForgot}
                  className="text-xs text-gray-500 hover:text-brand-400 transition-colors">
                  نسيت كلمة المرور؟
                </button>
              </div>
            )}

            <button type="submit" disabled={isSubmitting}
              className="w-full bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 mt-2">
              {isSubmitting
                ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : mode === "login" ? "دخول"
                : mode === "register" ? "إنشاء الحساب"
                : "إرسال رابط الاستعادة"
              }
            </button>
          </form>

          <div className="mt-5 pt-4 border-t border-white/8 text-center">
            {mode === "forgot" ? (
              <p className="text-sm text-gray-500">
                رجعت فاكر كلمة المرور؟{" "}
                <button onClick={backToLogin} className="text-brand-400 hover:text-brand-300 font-bold transition-colors">
                  تسجيل الدخول
                </button>
              </p>
            ) : (
              <p className="text-sm text-gray-500">
                {mode === "login" ? "ليس لديك حساب؟" : "لديك حساب؟"}{" "}
                <button onClick={switchMode} className="text-brand-400 hover:text-brand-300 font-bold transition-colors">
                  {mode === "login" ? "إنشاء حساب" : "تسجيل الدخول"}
                </button>
              </p>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-gray-600 mt-6">زراعي برو v1.0</p>
      </div>
    </div>
  );
};

export default AuthPage;
