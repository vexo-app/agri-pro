// src/contexts/data/mutations/settingsMutations.js
//
// حفظ الإعدادات (سعر السولار...) — منقول هنا حرفيًا من DataContext.jsx
// من غير أي تغيير في السلوك.
import { useCallback } from "react";
import { settingsService } from "../../../services/settingsService";

export function useSettingsMutations({ user, dispatch, stateRef, trackWrite }) {
  const saveSettings = useCallback(async (d) => {
    const previous = stateRef.current.settings;
    dispatch({ type: "UPDATE_SETTINGS", payload: d });
    trackWrite(settingsService.save(user.uid, d), {
      rollback: () => dispatch({ type: "UPDATE_SETTINGS", payload: previous }),
      errorMessage: "تعذر حفظ الإعدادات، تم التراجع عن التغيير",
      successMessage: "تم حفظ الإعدادات",
    });
  }, [user, dispatch, stateRef, trackWrite]);

  return { saveSettings };
}
